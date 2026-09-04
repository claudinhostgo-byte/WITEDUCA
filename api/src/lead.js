'use strict';

/**
 * Validación del formulario y mapeo a la entidad Lead de Dataverse.
 *
 * Deliberadamente sin dependencias ni acceso a red: es lógica pura, para poder
 * probarla de forma aislada. El handler HTTP vive en functions/contacto.js.
 */

/** Opciones válidas del select "¿Qué te interesa?" en contacto/index.html */
const INTERESES = [
  'Adopción Garantizada',
  'Formación in-company',
  'Nivelación tecnológica',
  'Asesoría en IA / Gobernanza',
  'Curso abierto',
  'Formación en Claude',
  'Agendar hora con un consultor',
  'Otro',
];

/** Opciones válidas del select "Tamaño de la organización". Permite segmentar
 *  el Lead (empresa grande, pyme, persona, sector público) sin dos formularios. */
const TAMANOS = [
  'Solo yo',
  '2 a 50 personas',
  '51 a 500 personas',
  'Más de 500 personas',
  'Sector público',
];

/** Largos máximos de los campos de Lead en Dataverse (valores por defecto). */
const MAX = {
  firstname: 50,
  lastname: 50,
  companyname: 100,
  emailaddress1: 100,
  jobtitle: 100,
  telephone1: 50,
  subject: 300,
  description: 2000,
};

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

/** "Claudio Castillo Rojas" -> { firstname: "Claudio", lastname: "Castillo Rojas" } */
function splitNombre(nombre) {
  const partes = clean(nombre, 200).split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { firstname: null, lastname: null };
  if (partes.length === 1) return { firstname: null, lastname: clean(partes[0], MAX.lastname) };
  return {
    firstname: clean(partes[0], MAX.firstname),
    lastname: clean(partes.slice(1).join(' '), MAX.lastname),
  };
}

function validar(body) {
  const errores = [];
  const b = body || {};

  const datos = {
    nombre: clean(b.nombre, 120),
    empresa: clean(b.empresa, MAX.companyname),
    cargo: clean(b.cargo, MAX.jobtitle),
    correo: clean(b.correo, MAX.emailaddress1).toLowerCase(),
    telefono: clean(b.telefono, MAX.telephone1),
    tamano: clean(b.tamano, 40),
    mensaje: clean(b.mensaje, MAX.description),
    interes: clean(b.interes, 80),
    // Página desde la que se envió (ruta + query, incluye UTM) y referente.
    origen: clean(b.origen, 300),
    referente: clean(b.referente, 300),
  };

  if (!datos.nombre) errores.push('nombre');
  if (!datos.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) errores.push('correo');
  if (!INTERESES.includes(datos.interes)) errores.push('interes');
  if (!TAMANOS.includes(datos.tamano)) errores.push('tamano');

  return { errores, datos };
}

/**
 * @param {object} datos       salida de validar().datos
 * @param {number} leadSource  leadsourcecode; 8 = "Web" en el optionset estándar
 */
function construirLead(
  { nombre, empresa, cargo, correo, telefono, tamano, mensaje, interes, origen, referente },
  leadSource = 8,
) {
  const { firstname, lastname } = splitNombre(nombre);

  const descripcion = [
    `Interés: ${interes}`,
    empresa ? `Empresa: ${empresa}` : null,
    cargo ? `Cargo: ${cargo}` : null,
    `Tamaño de la organización: ${tamano}`,
    telefono ? `Teléfono: ${telefono}` : null,
    `Origen: formulario de contacto de witeduca.cl${origen ? ` (${origen})` : ''}`,
    referente ? `Referente: ${referente}` : null,
    '',
    mensaje || '(sin mensaje)',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const lead = {
    subject: clean(`${interes}${empresa ? ` — ${empresa}` : ''}`, MAX.subject),
    lastname,
    emailaddress1: correo,
    description: clean(descripcion, MAX.description),
  };

  if (firstname) lead.firstname = firstname;
  if (empresa) lead.companyname = empresa;
  if (cargo) lead.jobtitle = cargo;
  if (telefono) lead.telephone1 = telefono;
  if (Number.isFinite(leadSource)) lead.leadsourcecode = leadSource;

  return lead;
}

module.exports = { INTERESES, TAMANOS, MAX, clean, splitNombre, validar, construirLead };
