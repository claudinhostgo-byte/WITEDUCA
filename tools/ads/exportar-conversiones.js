'use strict';

/**
 * Exporta conversiones de Google Ads desde los Leads de Dynamics 365, sin
 * ningun script de Google instalado en el sitio.
 *
 * Como funciona: el formulario ya guarda `location.pathname + location.search`
 * completo en el campo Origen de cada Lead (ver api/src/lead.js). Si en Google
 * Ads se activa el "etiquetado automatico" (auto-tagging), cada clic en un
 * anuncio agrega `?gclid=...` a la URL de destino sin usar cookies. Ese gclid
 * queda guardado en el Lead sin tocar el sitio para nada.
 *
 * Este script:
 *   1. Se autentica contra Dataverse igual que api/src/dataverse.js
 *   2. Busca Leads creados en el rango de fechas dado cuya descripcion tenga
 *      un gclid
 *   3. Escribe un CSV en el formato de importacion de conversiones sin
 *      conexion (offline conversion import) de Google Ads
 *
 * Es una herramienta local, no un endpoint publico: nunca se despliega junto
 * a las Azure Functions. Se corre a mano, cuando Comercial quiera subir las
 * conversiones acumuladas.
 *
 * RECOMENDACION DE SEGURIDAD: no reusar el DATAVERSE_CLIENT_SECRET de la
 * Function publica para correr esto en una laptop. Ese secreto vive sellado
 * en las variables de entorno de Azure; sacarlo a una maquina local aumenta
 * su exposicion sin necesidad. Crear un usuario de aplicacion SEPARADO en
 * Dataverse, con un rol de seguridad que solo tenga privilegio de Leer sobre
 * Cliente potencial (Lead) -- nada de Crear, nada de otras tablas -- y usar
 * ESE secreto aqui. Ver el README para los pasos, son los mismos que se
 * siguieron para crear el usuario de aplicacion original.
 *
 * Variables de entorno esperadas (de ese usuario de aplicacion de solo lectura):
 *   DATAVERSE_URL, DATAVERSE_TENANT_ID, DATAVERSE_CLIENT_ID, DATAVERSE_CLIENT_SECRET
 *
 * Uso:
 *   DATAVERSE_URL=... DATAVERSE_TENANT_ID=... DATAVERSE_CLIENT_ID=... DATAVERSE_CLIENT_SECRET=... \
 *   node tools/ads/exportar-conversiones.js --dias 14 --nombre "Lead web" --salida conversiones.csv
 *
 * Requiere Node 18+ (fetch global). Sin dependencias npm.
 */

const fs = require('fs');

function argv(nombre, porDefecto) {
  const i = process.argv.indexOf('--' + nombre);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

function requiredEnv(nombre) {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

function dataverseUrl() {
  return requiredEnv('DATAVERSE_URL').replace(/\/+$/, '');
}

async function getToken() {
  const tenantId = requiredEnv('DATAVERSE_TENANT_ID');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requiredEnv('DATAVERSE_CLIENT_ID'),
    client_secret: requiredEnv('DATAVERSE_CLIENT_SECRET'),
    scope: `${dataverseUrl()}/.default`,
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  );
  if (!res.ok) {
    throw new Error(`No se pudo obtener el token (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()).access_token;
}

/** Extrae el gclid del campo Origen dentro de la descripcion del Lead.
 *  El texto tiene la forma: "Origen: formulario de contacto de witeduca.cl (/oferta/?gclid=XXXX&utm_...)" */
function extraerGclid(description) {
  const m = /Origen:[^\n]*\(([^)]*)\)/.exec(description || '');
  if (!m) return null;
  const qs = m[1].split('?')[1];
  if (!qs) return null;
  const params = new URLSearchParams(qs);
  return params.get('gclid');
}

/** Formato que Google Ads exige para Conversion Time en la importacion CSV. */
function formatearFechaGoogleAds(isoUtc) {
  const d = new Date(isoUtc);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} `
       + `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  const dias = Number(argv('dias', '14'));
  const nombreConversion = argv('nombre', 'Lead web');
  const salida = argv('salida', 'conversiones.csv');

  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const token = await getToken();

  const filtro = encodeURIComponent(`createdon ge ${desde}`);
  const select = encodeURIComponent('leadid,description,createdon,subject');
  const url = `${dataverseUrl()}/api/data/v9.2/leads?$filter=${filtro}&$select=${select}&$orderby=createdon asc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Dataverse rechazo la consulta (HTTP ${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
  const { value: leads } = await res.json();

  const filas = [];
  for (const lead of leads) {
    const gclid = extraerGclid(lead.description);
    if (!gclid) continue;
    filas.push({
      'Google Click ID': gclid,
      'Conversion Name': nombreConversion,
      'Conversion Time': formatearFechaGoogleAds(lead.createdon),
      'Conversion Value': '',
      'Conversion Currency': 'CLP',
    });
  }

  const encabezado = ['Google Click ID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency'];
  const lineas = [encabezado.join(',')];
  for (const f of filas) lineas.push(encabezado.map((c) => csvEscape(f[c])).join(','));
  fs.writeFileSync(salida, lineas.join('\n') + '\n', 'utf8');

  console.log(`Leads revisados: ${leads.length}`);
  console.log(`Con gclid (conversiones exportadas): ${filas.length}`);
  console.log(`Escrito en: ${salida}`);
  if (filas.length === 0) {
    console.log('\nSin conversiones en el rango. Confirma que el auto-tagging este activo en Google Ads');
    console.log('y que la campana lleve corriendo desde antes de "--dias".');
  } else {
    console.log('\nSiguiente paso: Google Ads > Conversiones > Cargas manuales > subir este CSV.');
    console.log('El "Conversion Value" queda vacio a proposito: llenarlo solo si Comercial definio');
    console.log('un valor por Lead. Si no, Google Ads cuenta la conversion igual, sin valor.');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
