'use strict';

const { app } = require('@azure/functions');
const { createRecord } = require('../dataverse');
const { clean, validar, construirLead } = require('../lead');
const turnstile = require('../turnstile');
const { armarAviso } = require('../aviso');
const { enviarCorreo } = require('../graph');

// Límite de envíos por IP. Es best-effort: la memoria no se comparte entre
// instancias y se pierde al reciclarse, así que frena a un bot torpe, no a uno
// distribuido. La defensa real ante abuso sostenido sería un captcha.
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const prev = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  prev.push(now);
  hits.set(ip, prev);

  if (hits.size > 5000) hits.clear(); // techo de memoria

  return prev.length > RATE_LIMIT.max;
}

app.http('contacto', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contacto',
  handler: async (request, context) => {
    const ip = (request.headers.get('x-forwarded-for') || 'sin-ip').split(',')[0].trim();

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { ok: false, error: 'json_invalido' } };
    }

    // Honeypot: campo oculto que una persona nunca llena. Respondemos 200 para
    // no darle al bot la señal de que fue detectado, pero no creamos nada.
    if (clean(body.sitio, 100)) {
      context.log(`Honeypot activado desde ${ip}; descartado.`);
      return { status: 200, jsonBody: { ok: true } };
    }

    // Tiempo minimo de llenado. Un bot postea en decimas de segundo. Es una
    // senal debil porque el valor lo manda el cliente y se puede falsear: la
    // defensa de verdad es Turnstile.
    //
    // El umbral es bajo (1,5 s) y responde con error recuperable, no con un 200
    // silencioso como el honeypot. La diferencia importa: del honeypot no sale
    // una persona por accidente, pero de un chequeo de tiempo si podria, con
    // autocompletado del navegador. Descartar en silencio un formulario real
    // seria lo peor posible: la persona ve "enviado" y el Lead nunca llega.
    const llenadoMs = Number(body.llenado_ms);
    if (Number.isFinite(llenadoMs) && llenadoMs >= 0 && llenadoMs < 1500) {
      context.warn(`Formulario enviado en ${llenadoMs} ms desde ${ip}; se pide reintentar.`);
      return { status: 400, jsonBody: { ok: false, error: 'demasiado_rapido' } };
    }

    if (rateLimited(ip)) {
      context.warn(`Rate limit alcanzado por ${ip}.`);
      return { status: 429, jsonBody: { ok: false, error: 'demasiados_envios' } };
    }

    const { errores, datos } = validar(body);
    if (errores.length) {
      return { status: 400, jsonBody: { ok: false, error: 'campos_invalidos', campos: errores } };
    }

    if (turnstile.activo()) {
      const captcha = await turnstile.verificar(body['cf-turnstile-response'], ip);
      if (!captcha.ok) {
        context.warn(`Turnstile rechazo un envio desde ${ip}: ${captcha.motivo}`);
        return { status: 400, jsonBody: { ok: false, error: 'captcha_invalido' } };
      }
    } else {
      context.warn('TURNSTILE_SECRET no configurado: el formulario corre sin verificacion.');
    }

    // leadsourcecode 8 = "Web" en el conjunto de opciones estándar de D365.
    // Si el entorno lo tiene personalizado, ajusta LEAD_SOURCE_CODE.
    const leadSource = Number(process.env.LEAD_SOURCE_CODE || 8);

    const lead = construirLead(datos, leadSource);
    let leadId;
    try {
      leadId = await createRecord('leads', lead);
      context.log(`Lead creado: ${leadId} (interés: ${datos.interes})`);
    } catch (err) {
      // El detalle queda en los logs; al visitante solo le decimos que falló.
      context.error(`Error creando el lead: ${err.message}`);
      return { status: 502, jsonBody: { ok: false, error: 'crm_no_disponible' } };
    }

    // El lead ya quedó en el CRM: si el aviso falla, solo se registra y la
    // persona igual recibe su confirmación.
    const remitente = process.env.AVISO_LEAD_REMITENTE;
    if (remitente) {
      try {
        await enviarCorreo(
          remitente,
          armarAviso(datos, lead, leadId, {
            destino: process.env.AVISO_LEAD_DESTINO,
            dataverseUrl: process.env.DATAVERSE_URL,
          })
        );
      } catch (err) {
        context.error(`No se pudo enviar el aviso a Comercial (lead ${leadId}): ${err.message}`);
      }
    } else {
      context.warn('AVISO_LEAD_REMITENTE no configurado: no se avisa a Comercial por correo.');
    }

    return { status: 201, jsonBody: { ok: true } };
  },
});
