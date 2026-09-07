'use strict';

/**
 * Verificación de Cloudflare Turnstile.
 *
 * Se eligió Turnstile y no reCAPTCHA porque no perfila al visitante: el sitio
 * de una consultora que vende gobernanza de datos y cumplimiento de la Ley
 * 21.719 no puede estar enviando datos de comportamiento a un tercero sin
 * informarlo. Ver el README.
 *
 * Si `TURNSTILE_SECRET` no está configurado, la verificación se omite y el
 * formulario sigue funcionando. Es deliberado: permite desplegar el código
 * antes de tener las llaves, sin dejar el formulario caído mientras tanto. El
 * handler deja constancia en el log cuando corre sin verificar.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** ¿Está activa la verificación? */
function activo() {
  return Boolean(process.env.TURNSTILE_SECRET);
}

/**
 * @param {string} token  el `cf-turnstile-response` que manda el widget
 * @param {string} ip     IP del visitante, opcional; Cloudflare la usa de señal
 * @returns {Promise<{ok: boolean, motivo?: string}>}
 */
async function verificar(token, ip) {
  if (!activo()) return { ok: true, motivo: 'sin_secreto' };
  if (!token) return { ok: false, motivo: 'sin_token' };

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET,
    response: token,
  });
  if (ip && ip !== 'sin-ip') body.set('remoteip', ip);

  let json;
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    json = await res.json();
  } catch (err) {
    // Si Cloudflare no responde, se rechaza el envío. Preferimos perder un
    // formulario antes que dejar la puerta abierta durante una caída suya.
    return { ok: false, motivo: `verificador_no_disponible: ${err.message.slice(0, 120)}` };
  }

  if (json.success) return { ok: true };
  return { ok: false, motivo: (json['error-codes'] || ['desconocido']).join(',') };
}

module.exports = { activo, verificar };
