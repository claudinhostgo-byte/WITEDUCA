'use strict';

/**
 * Envío de correo con Microsoft Graph (sendMail), igual que w-it.cl.
 *
 * Usa client credentials. Por defecto reutiliza el App Registration de
 * Dataverse (DATAVERSE_*); GRAPH_TENANT_ID / GRAPH_CLIENT_ID /
 * GRAPH_CLIENT_SECRET permiten usar otra app.
 *
 * El permiso NO se da con Mail.Send en Entra (valdría para todos los buzones
 * del tenant), sino con RBAC de aplicaciones de Exchange acotado al buzón
 * remitente. Ver README, "Aviso por correo a Comercial".
 */

const TOKEN_SKEW_MS = 60 * 1000;

let cachedToken = null; // { value, expiresAt }

const env = (nombre) => process.env[`GRAPH_${nombre}`] || process.env[`DATAVERSE_${nombre}`];

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_SKEW_MS) {
    return cachedToken.value;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(env('TENANT_ID') || '')}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env('CLIENT_ID') || '',
        client_secret: env('CLIENT_SECRET') || '',
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`No se pudo obtener el token de Graph (HTTP ${res.status}): ${detail.slice(0, 500)}`);
  }

  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

/** Envía `correo` (cuerpo de sendMail) desde el buzón `remitente`. Lanza si Graph lo rechaza. */
async function enviarCorreo(remitente, correo) {
  const token = await getToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(remitente)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(correo),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Graph rechazó el envío (HTTP ${res.status}): ${detail.slice(0, 500)}`);
  }
}

module.exports = { enviarCorreo };
