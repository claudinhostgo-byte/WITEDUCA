'use strict';

/**
 * Correo que avisa a Comercial de cada Lead nuevo, con los datos del formulario
 * para entender la solicitud sin abrir Dynamics 365.
 *
 * Es el mismo aviso que manda w-it.cl (api/shared/lead.py, armar_aviso), con
 * otra paleta para que en la bandeja se distinga de un vistazo cuál sitio lo
 * generó. Lógica pura, sin red: el envío vive en graph.js.
 */

// Paleta propia del aviso de WITEDUCA (el de w-it.cl usa azul #1B3A50 y verde #54BA00)
const C = {
  cabecera: '#0F4C5C', // petróleo
  acento: '#F2A541', // ámbar
  etiqueta: '#B26B00', // ámbar oscuro: el claro no contrasta sobre blanco
  subtitulo: '#FFD9A0',
  tinta: '#242424',
  gris: '#616161',
  linea: '#E6ECEE',
  fondo: '#F4F8F9',
};

const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parrafo = (t) => escapar(t).replace(/\r?\n/g, '<br>');

/** "/ruta/?utm_source=google&x=1" -> { pagina: "/ruta/", campana: "google · ..." } */
function leerOrigen(origen) {
  if (!origen) return { pagina: '', campana: '' };
  let url;
  try {
    url = new URL(origen, 'https://witeduca.cl');
  } catch {
    return { pagina: origen, campana: '' };
  }
  const q = url.searchParams;
  const campana = ['utm_source', 'utm_medium', 'utm_campaign']
    .map((k) => q.get(k))
    .filter(Boolean)
    .join(' · ');
  return { pagina: url.pathname, campana };
}

function fila(etiqueta, valor) {
  if (!valor) return '';
  return (
    `<tr><td style="padding:6px 16px 6px 0;color:${C.gris};white-space:nowrap;vertical-align:top">${etiqueta}</td>` +
    `<td style="padding:6px 0;color:${C.tinta};vertical-align:top">${valor}</td></tr>`
  );
}

function tabla(titulo, filas) {
  const cuerpo = filas.join('');
  if (!cuerpo) return '';
  return (
    `<p style="margin:24px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;` +
    `color:${C.etiqueta};font-weight:700">${titulo}</p>` +
    `<table cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.4">${cuerpo}</table>`
  );
}

/**
 * @param {object} d       salida de validar().datos
 * @param {object} lead    salida de construirLead() (se usa su subject)
 * @param {string} leadId  GUID del Lead creado, para el enlace a Dynamics
 * @param {object} cfg     { destino, dataverseUrl }
 * @returns cuerpo para POST /users/{remitente}/sendMail de Microsoft Graph
 */
function armarAviso(d, lead, leadId, { destino, dataverseUrl } = {}) {
  const base = String(dataverseUrl || '').replace(/\/+$/, '');
  const enlace = base && leadId ? `${base}/main.aspx?pagetype=entityrecord&etn=lead&id=${leadId}` : '';
  const { pagina, campana } = leerOrigen(d.origen);

  const contacto = tabla('Contacto', [
    fila('Nombre', escapar(d.nombre)),
    fila('Empresa', escapar(d.empresa)),
    fila('Cargo', escapar(d.cargo)),
    fila(
      'Email',
      `<a href="mailto:${escapar(d.correo)}" style="color:${C.cabecera}">${escapar(d.correo)}</a>`,
    ),
    fila('Teléfono', escapar(d.telefono)),
    fila('Tamaño', escapar(d.tamano)),
  ]);

  const mensaje = d.mensaje
    ? parrafo(d.mensaje)
    : `<em style="color:${C.gris}">(sin mensaje)</em>`;
  const solicitud =
    tabla('Solicitud', [fila('Interés', escapar(d.interes))]) +
    `<div style="margin:12px 0 0;padding:14px 16px;background:${C.fondo};border-left:3px solid ${C.acento};` +
    `font-size:15px;line-height:1.5;color:${C.tinta}">${mensaje}</div>`;

  const origen = tabla('Origen', [
    fila('Página', escapar(pagina)),
    fila('Campaña', escapar(campana)),
    fila('Referente', escapar(d.referente)),
  ]);

  const boton = enlace
    ? `<a href="${escapar(enlace)}" style="display:inline-block;padding:12px 22px;background:${C.cabecera};` +
      'color:#ffffff;text-decoration:none;font-weight:700;border-radius:6px">Abrir en Dynamics 365</a>'
    : `<span style="color:${C.gris}">Búscalo en Dynamics 365 Sales → Clientes potenciales.</span>`;

  const html =
    `<div style="margin:0;padding:24px 12px;background:${C.fondo}">` +
    `<table cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;` +
    `border:1px solid ${C.linea};border-radius:8px;font-family:Segoe UI,Arial,sans-serif;color:${C.tinta}">` +
    `<tr><td style="padding:20px 28px;background:${C.cabecera};border-radius:8px 8px 0 0">` +
    '<span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.04em">WITEDUCA</span>' +
    `<span style="font-size:13px;color:${C.subtitulo};float:right;padding-top:4px">Nuevo cliente potencial · witeduca.cl</span>` +
    '</td></tr>' +
    `<tr><td style="height:4px;background:${C.acento};font-size:0;line-height:0">&nbsp;</td></tr>` +
    '<tr><td style="padding:28px">' +
    `<h1 style="margin:0 0 4px;font-size:22px;line-height:1.3;color:${C.cabecera}">${escapar(d.empresa || d.nombre)}</h1>` +
    `<p style="margin:0;font-size:15px;color:${C.gris}">${escapar(d.interes)} · formulario de witeduca.cl</p>` +
    `${contacto}${solicitud}${origen}` +
    `<p style="margin:28px 0 0">${boton}</p>` +
    '</td></tr>' +
    `<tr><td style="padding:16px 28px;border-top:1px solid ${C.linea};font-size:12px;line-height:1.5;color:${C.gris}">` +
    'El lead ya quedó registrado en el CRM. Para contactar a la persona, usa Responder: el correo va directo a su dirección. ' +
    'La persona aceptó la política de privacidad; estos datos son personales, úsalos solo para atender su solicitud ' +
    'y no los reenvíes fuera de W-IT.' +
    '</td></tr></table></div>';

  return {
    message: {
      subject: `Nuevo lead · ${lead.subject}`.slice(0, 250),
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: destino || 'comercial@w-it.cl' } }],
      replyTo: [{ emailAddress: { address: d.correo, name: d.nombre } }],
    },
    saveToSentItems: false,
  };
}

module.exports = { armarAviso, leerOrigen };
