'use strict';

/**
 * Cliente mínimo de la Web API de Dataverse.
 *
 * Autentica con client credentials (app registration + secreto) porque las
 * Azure Functions gestionadas de Static Web Apps no soportan identidad
 * administrada. Si el día de mañana la API se mueve a un Function App propio
 * (requiere plan Standard), conviene cambiar a managed identity y eliminar el
 * secreto.
 *
 * Sin dependencias npm: usa el fetch global de Node 18+.
 */

const TOKEN_SKEW_MS = 60 * 1000; // renueva el token 1 min antes de que expire

let cachedToken = null; // { value, expiresAt }

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** URL del entorno, sin barra final. Ej: https://witeduca.crm2.dynamics.com */
function dataverseUrl() {
  return requiredEnv('DATAVERSE_URL').replace(/\/+$/, '');
}

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_SKEW_MS) {
    return cachedToken.value;
  }

  const tenantId = requiredEnv('DATAVERSE_TENANT_ID');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requiredEnv('DATAVERSE_CLIENT_ID'),
    client_secret: requiredEnv('DATAVERSE_CLIENT_SECRET'),
    scope: `${dataverseUrl()}/.default`,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`No se pudo obtener el token (HTTP ${res.status}): ${detail.slice(0, 500)}`);
  }

  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

/**
 * Crea un registro y devuelve su GUID.
 * El id sale de la cabecera OData-EntityId; así evitamos pedir la
 * representación completa del registro de vuelta.
 */
async function createRecord(entitySetName, record) {
  const token = await getToken();

  const res = await fetch(`${dataverseUrl()}/api/data/v9.2/${entitySetName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Dataverse rechazó la creación en ${entitySetName} (HTTP ${res.status}): ${detail.slice(0, 1000)}`
    );
  }

  const entityId = res.headers.get('OData-EntityId') || '';
  const match = entityId.match(/\(([0-9a-fA-F-]{36})\)/);
  return match ? match[1] : null;
}

module.exports = { createRecord };
