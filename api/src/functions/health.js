'use strict';

const { app } = require('@azure/functions');

/**
 * Diagnóstico de la API.
 *
 * Responde qué variables de entorno están presentes, para poder distinguir
 * "la Function no está desplegada" de "está desplegada pero le faltan
 * credenciales" sin tener que leer los logs.
 *
 * Devuelve solo booleanos: nunca el valor de una variable. El endpoint es
 * anónimo y público, así que no puede filtrar el secreto ni los identificadores.
 */

const REQUERIDAS = [
  'DATAVERSE_URL',
  'DATAVERSE_TENANT_ID',
  'DATAVERSE_CLIENT_ID',
  'DATAVERSE_CLIENT_SECRET',
];

/**
 * Verificacion profunda, solo con ?verificar=1.
 *
 * Distingue tres fallas que desde fuera se ven iguales:
 *   - la credencial esta mal            -> falla el token
 *   - falta el usuario de aplicacion    -> el token sale pero WhoAmI falla
 *   - falta el rol o sus privilegios    -> WhoAmI sale pero crear el Lead falla
 *
 * Nunca devuelve el secreto ni el token: solo si cada paso resulto y un texto de
 * error acotado. El endpoint es publico, asi que el resultado se cachea 60 s para
 * que nadie pueda usarlo para golpear Entra en bucle.
 */
let cacheVerif = null;

async function verificar() {
  if (cacheVerif && Date.now() - cacheVerif.t < 60 * 1000) return cacheVerif.r;

  const r = { token: null, whoAmI: null };
  const url = (process.env.DATAVERSE_URL || '').replace(/\/+$/, '');

  let token;
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(process.env.DATAVERSE_TENANT_ID || '')}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.DATAVERSE_CLIENT_ID || '',
          client_secret: process.env.DATAVERSE_CLIENT_SECRET || '',
          scope: `${url}/.default`,
        }),
      }
    );
    const cuerpo = await res.text();
    if (res.ok) {
      token = JSON.parse(cuerpo).access_token;
      r.token = { ok: true };
    } else {
      // El cuerpo de Entra trae el codigo AADSTS, que es lo util aqui.
      const cod = (cuerpo.match(/AADSTS\d+/) || [])[0] || `HTTP ${res.status}`;
      r.token = { ok: false, error: cod };
    }
  } catch (e) {
    r.token = { ok: false, error: e.message.slice(0, 200) };
  }

  if (!token) {
    cacheVerif = { t: Date.now(), r };
    return r;
  }

  try {
    const res = await fetch(`${url}/api/data/v9.2/WhoAmI()`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (res.ok) {
      r.whoAmI = { ok: true };
    } else {
      const d = await res.text().catch(() => '');
      r.whoAmI = { ok: false, error: `HTTP ${res.status}`, detalle: d.slice(0, 300) };
    }
  } catch (e) {
    r.whoAmI = { ok: false, error: e.message.slice(0, 200) };
  }

  // Lectura de leads: si esto falla, el rol no se esta aplicando en absoluto.
  // Si funciona, el rol llega pero puede faltarle justo el privilegio de Crear.
  try {
    const res = await fetch(`${url}/api/data/v9.2/leads?$top=1&$select=leadid`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const d = await res.text().catch(() => '');
    r.leerLeads = res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}`, detalle: d.slice(0, 600) };
  } catch (e) {
    r.leerLeads = { ok: false, error: e.message.slice(0, 200) };
  }

  cacheVerif = { t: Date.now(), r };
  return r;
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (request) => {
    const configurado = {};
    for (const nombre of REQUERIDAS) {
      configurado[nombre] = Boolean(process.env[nombre]);
    }

    const faltantes = REQUERIDAS.filter((n) => !configurado[n]);

    // ?verificar=1 prueba la conexion de verdad; sin el parametro solo se
    // reporta que variables estan presentes, que es lo barato.
    let verificacion;
    const pidenVerificar = new URL(request.url).searchParams.get('verificar') === '1';
    if (pidenVerificar) {
      verificacion = faltantes.length
        ? { omitida: 'faltan variables de entorno' }
        : await verificar();
    }

    return {
      status: 200,
      jsonBody: {
        ok: true,
        servicio: 'witeduca-api',
        funcionesDesplegadas: ['contacto', 'health'],
        configurado,
        faltantes,
        listoParaCrearLeads: faltantes.length === 0,
        leadSourceCode: Number(process.env.LEAD_SOURCE_CODE || 8),
        ...(verificacion ? { verificacion } : {}),
      },
    };
  },
});
