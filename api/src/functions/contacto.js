'use strict';

const { app } = require('@azure/functions');
const { createRecord } = require('../dataverse');
const { clean, validar, construirLead } = require('../lead');

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

    if (rateLimited(ip)) {
      context.warn(`Rate limit alcanzado por ${ip}.`);
      return { status: 429, jsonBody: { ok: false, error: 'demasiados_envios' } };
    }

    const { errores, datos } = validar(body);
    if (errores.length) {
      return { status: 400, jsonBody: { ok: false, error: 'campos_invalidos', campos: errores } };
    }

    // leadsourcecode 8 = "Web" en el conjunto de opciones estándar de D365.
    // Si el entorno lo tiene personalizado, ajusta LEAD_SOURCE_CODE.
    const leadSource = Number(process.env.LEAD_SOURCE_CODE || 8);

    try {
      const leadId = await createRecord('leads', construirLead(datos, leadSource));
      context.log(`Lead creado: ${leadId} (interés: ${datos.interes})`);
      return { status: 201, jsonBody: { ok: true } };
    } catch (err) {
      // El detalle queda en los logs; al visitante solo le decimos que falló.
      context.error(`Error creando el lead: ${err.message}`);
      return { status: 502, jsonBody: { ok: false, error: 'crm_no_disponible' } };
    }
  },
});
