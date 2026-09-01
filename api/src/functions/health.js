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

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => {
    const configurado = {};
    for (const nombre of REQUERIDAS) {
      configurado[nombre] = Boolean(process.env[nombre]);
    }

    const faltantes = REQUERIDAS.filter((n) => !configurado[n]);

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
      },
    };
  },
});
