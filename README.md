### Aviso de tratamiento de datos

Vive en `/privacidad/` y esta enlazado desde el footer de todas las paginas y
desde debajo del boton de los dos formularios (`.form__legal`, inyectado por
`build-nav.py` como el widget de Turnstile: una definicion, dos formularios).

Declara lo que el codigo hace de verdad, no una plantilla generica:

- **Que se recolecta**: los campos del formulario, mas la pagina de origen con
  sus parametros de campana, el referente, y la IP para el limite de envios.
- **Con quien se comparte**: Dynamics 365 (el Lead), Azure (hosting y la
  Function) y Cloudflare Turnstile (verificacion). Se declara que Turnstile
  recibe senales del navegador y la IP pero **no** el contenido del formulario.
- **Que puede salir de Chile**, por la infraestructura global de esos servicios.
- **Conservacion**: mientras siga vigente el interes y hasta que la persona pida
  eliminarlo. **No se invento un plazo fijo**, porque no estaba definido.

Al cambiar el formulario, los proveedores o la analitica, **hay que actualizar
este aviso y la fecha de su encabezado**. Si se agrega GA4, va declarado ahi y
deja de ser cierta la frase "no usa cookies de publicidad ni de seguimiento".

**El texto es un borrador tecnico**: describe fielmente el tratamiento, pero la
base de licitud, el plazo de conservacion definitivo y la via de reclamo los
tiene que revisar el Encargado de Plataforma y Seguridad. No corresponde que los
fije quien escribe el codigo.

# Sitio web W-IT Educa

Sitio de WITEDUCA, la unidad de formación y adopción tecnológica de W-IT SpA.
Publicado en Azure Static Web Apps en <https://witeduca.cl>.

Diseño original creado en [Claude Design](https://claude.ai/design) y convertido
a HTML estático en septiembre de 2026 para que Google lo indexe sin depender de
JavaScript y para que funcione en móvil.

## Páginas

| URL | Archivo | Página |
|---|---|---|
| `/` | `index.html` | Home — hero "Aprende IA con quienes la implementan", dos puertas y tira de clientes |
| `/oferta/` | `oferta/index.html` | Oferta Microsoft — 4 líneas de trabajo, 7 cursos in-company + carrusel de agentes IA |
| `/adopcion-garantizada/` | `adopcion-garantizada/index.html` | Adopción Garantizada — programa ancla |
| `/cursos-abiertos/` | `cursos-abiertos/index.html` | Cursos abiertos — segundo camino: personas, ejecutivos y equipos pequeños |
| `/claude/` | `claude/index.html` | Claude de Anthropic — curso de entrada + preparación para las 4 certificaciones |
| `/consultores/` | `consultores/index.html` | Consultores — **oculta**: `noindex`, fuera del menú y del sitemap (ver abajo) |
| `/nosotros/` | `nosotros/index.html` | Nosotros — designaciones Microsoft y FAQ |
| `/recursos/` | `recursos/index.html` | Recursos — hub de adopción Microsoft + material oficial de Anthropic y guías de examen |
| `/contacto/` | `contacto/index.html` | Contacto — formulario |
| `/privacidad/` | `privacidad/index.html` | Aviso de privacidad y tratamiento de datos |
| — | `404.html` | Página de error |

Las URLs antiguas (`/Oferta.dc.html`, etc.) redirigen con 301 a las nuevas; ver
`staticwebapp.config.json`. `trailingSlash: auto` normaliza `/oferta` → `/oferta/` sin tocar archivos como `robots.txt`.

## Estructura

```
assets/site.css   hoja de estilos compartida (responsive, sistema de diseño W-IT)
assets/site.js    interacciones sin framework: menú móvil, desplegables, reveal,
                  roadmap, modal del formulario,
                  carrusel de agentes, envío del formulario
assets/*.png/webp logos, badges, favicon, imagen Open Graph
assets/claude-logo.webp       lockup horizontal de Claude (hero de /claude/)
assets/iconos/     iconos de las tarjetas de /oferta/. Ver "Iconos" mas abajo.
assets/claude-mark.webp       la estrella de Claude, icono chico junto a títulos
assets/anthropic-wordmark.webp  wordmark ANTHROPIC (sección de quién certifica)
tools/logos/       originales de los logos de terceros + prep-logos.py, el script
                   que recorta el aire y hace transparente el fondo plano para
                   regenerar los tres .webp de arriba. Vive fuera de assets/ para
                   que el script no quede servido en producción.
tools/nav/         build-nav.py: definicion unica de la nav y el footer, y los
                   inyecta en las 10 paginas. Ver "Navegacion" mas abajo.
tools/dev/         serve.py: servidor local sin cache para revisar el sitio.
assets/clientes/   29 logos de clientes (carrusel en home y Nosotros), extraídos de
                  la presentación comercial clientes.pptx y normalizados a 112 px de alto
assets/eventos/    12 fotos de eventos optimizadas (WebP + JPEG, 1000 px) para la galería
                  de Nosotros y la franja de la home. Los originales van en
                  assets/eventos/originales/, que está en .gitignore
robots.txt        permite todo salvo /api/, apunta al sitemap
sitemap.xml       las 9 URLs públicas (`/consultores/` esta fuera a proposito)
```

Cada página lleva sus metadatos completos (`title`, `description`, `canonical`,
Open Graph, favicon) y, donde aplica, datos estructurados JSON-LD:
`EducationalOrganization` en la home, `Service` en Adopción Garantizada y
`FAQPage` en Nosotros.

Las páginas usan rutas absolutas (`/assets/...`), así que **no funcionan abiertas
con doble clic** (`file://`). Para verlas en local:

```bash
python tools/dev/serve.py
```

Luego abrir <http://127.0.0.1:8765/>. Ese script es `http.server` mas cabeceras
`Cache-Control: no-store`. **No usar `python -m http.server` directo**: no manda
cabeceras de cache, el navegador se queda con el `site.js` y el `site.css` viejos
y da falsos negativos — cambias algo, recargas y sigues viendo lo anterior.
Si vienes de una sesion en que si lo usaste, un `Ctrl+Shift+R` limpia la entrada
ya cacheada. El formulario solo funciona con la API
levantada (ver más abajo); con el servidor local el envío falla con un mensaje de
error controlado.

## Los dos formularios del sitio

Hay **exactamente dos**, y los dos postean a `/api/contacto`:

1. **`#form-contacto`** — el de `/contacto/`, la página "Conversemos".
2. **`#form-modal`** — un modal inyectado en las 10 páginas, que se abre al
   pinchar cualquier curso o programa.

Comparten el manejador de envío en `site.js` (`conectarForm`), así que la
traducción de errores y el estado del botón son los mismos en los dos.

### Cómo se abre el modal

Cualquier elemento con `data-form="<interes>"` lo abre y **precarga ese interes en
el select**. Hay 44 disparadores repartidos en 19 valores distintos.

```html
<a class="btn btn--outline btn--sm"
   href="/contacto/?interes=Power%20Platform%20para%20el%20negocio"
   data-form="Power Platform para el negocio">Cotizar este curso</a>
```

**El `href` se mantiene a proposito.** Sin JavaScript el boton sigue siendo un
enlace normal a `/contacto/` con el interes precargado por `?interes=`; `site.js`
solo intercepta el clic. Al agregar un CTA nuevo, poner los dos: `href` y
`data-form`, con el mismo valor.

**Cada apertura parte en limpio:** `form.reset()`, se oculta el mensaje de exito y
el de error, y se vuelve a fijar el interes. Era un requisito explicito: que cada
clic vuelva a pedir los datos.

Incluye Escape, clic en el fondo, boton de cierre, trampa de foco mientras esta
abierto, retorno del foco al boton que lo abrio y bloqueo del scroll del body.

### Que abre el modal y que no

- **Si**: los 5 cursos in-company, nivelacion y las 3 asesorias de `/oferta/`; los
  5 cursos de `/claude/`; los 2 cursos de `/cursos-abiertos/`; Adopcion
  Garantizada; y los paquetes de `/consultores/` (pagina oculta hoy).
- **No**: "Conversemos" del menu y "Contacto" del footer, que navegan a
  `/contacto/`. Tampoco los 15 agentes de `/oferta/`: son ejemplos dentro de un
  curso, no unidades que se compren.
- Los CTA genericos de pagina ("Cual Copilot necesito?", "Hablemos de mi equipo")
  abren el modal con el interes **"Todavia no lo se, quiero orientacion"**. Es un
  dato util: dice que la persona quiere que la orienten, no que no le interesa nada.

### Estado de envio del boton

Al enviar, el boton se deshabilita, cambia a "Enviando..." y muestra un aro
girando (`.form__submit.is-enviando`, con `::before`). Aplica a los dos
formularios porque vive en la clase compartida, sin tocar el HTML de ninguno.

Hay un **piso de 500 ms** para ese estado. Si la API contesta en 40 ms el aro
alcanza a parpadear y se lee como un salto raro en la pantalla, no como que se
envio; el piso garantiza que la persona vea que algo paso. Medido: con una API
de 40 ms el estado dura 502 ms y el mensaje de exito aparece a los 523 ms.

Con `prefers-reduced-motion` el aro no se muestra: ahi la senal es el texto
"Enviando...", que cambia igual.

### El catalogo de intereses es una sola fuente

Los valores tienen que coincidir en tres lugares o **la API rechaza el envio con
`campos_invalidos`**. Los tres los genera `tools/nav/build-nav.py` desde su lista
`INTERESES`:

1. el `<select name="interes">` de `/contacto/`
2. el `<select name="interes">` del modal
3. la lista `INTERESES` de `api/src/lead.js`, entre los marcadores
   `/* build-nav:intereses-inicio */` y `-fin`

**No editar ninguno de los tres a mano.** Se edita el catalogo del script y se
corre `python tools/nav/build-nav.py`.

Son 20 valores agrupados con `<optgroup>` por programa, curso, ecosistema y
asesoria, mas 4 valores de la version anterior del sitio que `lead.js` sigue
aceptando — y que ya no se ofrecen en los select — para que un enlace viejo
circulando por correo no falle al enviarse.

El grano fino es deliberado: el Lead le llega a Comercial con el curso exacto en
el asunto, no con una categoria.

## Formulario de contacto → Dynamics 365

El formulario de `contacto/index.html` hace `POST /api/contacto`. Esa ruta es una
Azure Function gestionada de Static Web Apps (`api/`) que crea un **Cliente
potencial (Lead)** en Dataverse.

Se crea un Lead y no una Oportunidad a propósito: es el flujo estándar de D365
Sales. El equipo comercial califica el Lead y, al calificarlo, D365 genera
Cuenta + Contacto + Oportunidad. Así el tráfico anónimo de la web no entra
directo al pipeline ni al forecast.

```
contacto/index.html  --POST-->  api/src/functions/contacto.js
                                   |-- api/src/lead.js       (validación + mapeo, lógica pura)
                                   `-- api/src/dataverse.js  (token + Web API)
                                            |
                                            v
                               POST /api/data/v9.2/leads
```

Campos del formulario y su destino en el Lead:

| Campo | Lead |
|---|---|
| nombre | `firstname` + `lastname` |
| empresa | `companyname` |
| cargo | `jobtitle` |
| correo | `emailaddress1` |
| telefono | `telephone1` |
| tamano (tamaño de la organización) | línea en `description` — permite segmentar empresa grande / pyme / persona / sector público |
| interes | `subject` y línea en `description` |
| mensaje, origen (ruta + UTM), referente | `description` |

El select de interés puede venir precargado desde la URL: `/contacto/?interes=Adopci%C3%B3n%20Garantizada`.

### 1. Registrar la aplicación en Entra ID

1. Entra ID → Registros de aplicaciones → Nuevo registro (solo este directorio).
2. Anota el **Id. de aplicación (cliente)** y el **Id. de directorio (inquilino)**.
3. Certificados y secretos → Nuevo secreto de cliente. Copia el **valor** ahora;
   después no se puede volver a ver. Anota la fecha de expiración: hay que rotarlo.

No hace falta agregar permisos de API delegados; el acceso se otorga en el paso 2
mediante el usuario de aplicación de Dataverse.

### 2. Crear el usuario de aplicación en Dynamics 365

1. Centro de administración de Power Platform → tu entorno → Configuración →
   Usuarios + permisos → **Usuarios de aplicación** → Nuevo usuario de aplicación.
2. Selecciona la aplicación del paso 1 y una unidad de negocio.
3. Asígnale un rol de seguridad con permiso de **Creación** sobre la entidad
   Cliente potencial. Conviene un rol a medida con el mínimo necesario, en vez de
   Vendedor o Administrador del sistema.

### 3. Configurar la Static Web App

En el portal de Azure → tu Static Web App → **Configuración** → agrega:

| Variable | Ejemplo |
|---|---|
| `DATAVERSE_URL` | `https://<tu-org>.crm2.dynamics.com` |
| `DATAVERSE_TENANT_ID` | id de directorio del paso 1 |
| `DATAVERSE_CLIENT_ID` | id de aplicación del paso 1 |
| `DATAVERSE_CLIENT_SECRET` | secreto del paso 1 |
| `LEAD_SOURCE_CODE` | `8` (opcional) |

El secreto se pega **solo ahí**, nunca en el repositorio. `api/local.settings.json`
está en `.gitignore`; usa `api/local.settings.json.example` como plantilla para
desarrollo local.

`LEAD_SOURCE_CODE` es el valor de `leadsourcecode`; **8 = "Web"** en el conjunto de
opciones estándar de D365. Confirmado el 7 de septiembre de 2026 contra un Lead real: en este entorno el 8 cae en "Web"

### Diagnostico de la conexion

`GET /api/health` responde que variables de entorno estan presentes, en booleanos:
nunca devuelve un valor. Con **`?verificar=1`** ademas prueba la conexion de
verdad y distingue las fallas que desde fuera se ven iguales:

```bash
curl -s "https://witeduca.cl/api/health?verificar=1"
```

```json
{"token": {"ok": true}, "whoAmI": {"ok": true}, "leerLeads": {"ok": true}}
```

- **`token`** falla -> la credencial esta mal. Devuelve el codigo `AADSTS`.
- **`whoAmI`** falla -> la credencial sirve pero el usuario de aplicacion no
  existe en ese entorno, o apunta a otro.
- **`leerLeads`** falla -> el rol de seguridad no se esta aplicando.

El resultado se cachea 60 s, porque el endpoint es publico y no queremos que se
pueda usar para golpear Entra en bucle.

### Los privilegios que el rol necesita de verdad

El rol minimo `WIT - CREA - LEADS - WEB` no basta con Crear sobre Cliente
potencial. Al crear un Lead, Dynamics crea tambien la instancia del flujo de
proceso de negocio de Ventas, y sin permiso sobre esa tabla **la creacion
completa se revierte** con un 403.

Privilegios necesarios, todos en alcance Organizacion:

| Tabla | Privilegios |
|---|---|
| Cliente potencial (`lead`) | Crear, Leer, Anexar, Anexar a |
| Instancia de proceso de venta (`salesprocessinstance`) | Crear, Leer, Escribir, Anexar, Anexar a |
| Trabajo del sistema (`asyncoperation`) | Leer |

Se descubrio iterando: el mensaje de Dataverse nombra la tabla que falta. Si el
dia de manana se activa otro proceso automatico sobre Lead, puede aparecer otra
tabla y habra que agregarla igual. El sintoma siempre es el mismo: `502
crm_no_disponible` en el formulario, con token y WhoAmI en verde.

Se prefirio este rol a medida antes que asignar *Vendedor*: si el secreto se
filtra, el dano queda acotado a crear Clientes potenciales y no a leerse la base
comercial completa.

### Secretos y su renovacion

Dos secretos hacen andar el formulario, los dos en variables de entorno de Azure
Static Web Apps y **ninguno en el repositorio**:

| Variable | Para que | Vence |
|---|---|---|
| `DATAVERSE_CLIENT_SECRET` | crear el Lead en Dynamics | **3 de septiembre de 2028** |
| `TURNSTILE_SECRET` | verificar el captcha | no vence |

**Cuando el de Dataverse expire, el formulario deja de crear Leads sin aviso**:
la persona ve el error generico y nadie se entera hasta que alguien reclame.
Conviene tenerlo en el calendario del equipo. `GET /api/health?verificar=1`
detecta la falla al instante, con el codigo AADSTS.

Si un secreto se expone — por ejemplo en una captura de pantalla — se rota en su
consola de origen y se actualiza la variable en Azure. Turnstile solo permite
rotar una vez cada dos horas.

### Nota sobre el secreto

Las Functions gestionadas de Static Web Apps **no soportan identidad
administrada**, y el plan Free no permite un Function App propio. Por eso se usa
client credentials con secreto. Si más adelante pasas a plan Standard con un
Function App externo, conviene migrar a managed identity y eliminar el secreto.

### Proteccion del formulario

Cuatro capas, de la mas debil a la mas fuerte:

1. **Campo trampa** (honeypot) oculto: si viene con texto, se descarta y se
   responde 200 para no avisarle al bot que fue detectado.
2. **Tiempo minimo de llenado**: si el envio llega en menos de 1,5 s se pide
   reintentar. El valor lo manda el cliente y se puede falsear, asi que es una
   senal debil. **Responde con error recuperable, no con un 200 silencioso**: del
   honeypot no sale una persona por accidente, pero de un chequeo de tiempo si
   podria, con autocompletado del navegador, y descartar en silencio un
   formulario real seria lo peor posible — la persona ve "enviado" y el Lead
   nunca llega.
3. **Cloudflare Turnstile**: token verificado en el servidor contra
   `challenges.cloudflare.com`. Es la defensa de verdad.
4. **Limite de 5 envios por IP cada 10 minutos.** Es best-effort: la memoria no
   se comparte entre instancias ni sobrevive al reciclaje, asi que frena a un bot
   torpe desde una IP, no a uno distribuido.

Validacion en servidor del correo, del interes y del tamano de organizacion; los
largos se recortan a los limites de Dataverse para que la API no rechace el
registro.

### Por que Turnstile y no reCAPTCHA

reCAPTCHA envia datos de comportamiento del visitante a Google, y sus terminos
**obligan** a mostrar el badge o la declaracion "este sitio esta protegido por
reCAPTCHA...". En el sitio de una consultora que vende Politica y Gobernanza de
IA con cumplimiento de la Ley 21.719, eso es la primera pregunta que hace un
cliente que audita la web antes de contratar. Turnstile da la misma proteccion
practica sin perfilar al visitante y sin exigir declaracion.

### Como se configura Turnstile

- La **site key es publica** y vive en `TURNSTILE_SITEKEY`, en
  `tools/nav/build-nav.py`. El script inyecta el widget en los dos formularios y
  el `<script>` de Cloudflare.
- El **secreto** va en Azure Static Web Apps como `TURNSTILE_SECRET`. Nunca en el
  repositorio.

**Con `TURNSTILE_SITEKEY` vacia no se inyecta nada** y el formulario funciona sin
verificacion; con `TURNSTILE_SECRET` ausente el handler omite la verificacion y
deja constancia en el log. Es deliberado: permite desplegar el codigo antes de
tener las llaves sin dejar el formulario caido. Verificado que es reversible: al
vaciar la llave y regenerar, no queda ningun residuo en las 10 paginas.

El token de Turnstile es **de un solo uso**: `site.js` llama a
`turnstile.reset()` al abrir el modal y despues de cada error, o el reintento
fallaria siempre con `captcha_invalido`.

Si Cloudflare no responde, el envio se **rechaza**. Preferimos perder un
formulario antes que dejar la puerta abierta durante una caida suya.

### Analítica: Cloudflare Web Analytics

Se eligió sobre GA4 y Clarity por una razón que no es técnica: **no usa cookies ni
datos personales**, así que no obliga a banner de consentimiento y deja verdadera
la frase de `/privacidad/` de que el sitio no usa cookies de seguimiento. Es el
mismo proveedor que Turnstile, ya declarado en el aviso, y es gratis.

Lo que da: visitas y visitantes únicos, páginas más vistas, referentes, países,
dispositivos y Core Web Vitals. **Lo que no da: embudos ni eventos** (no se puede
medir "abrió el modal y no envió"). Para quienes sí convierten, la atribución ya
existe: cada Lead lleva la página de origen, los UTM y el referente en su
descripción.

El token es público y vive en `CF_ANALYTICS_TOKEN`, en `tools/nav/build-nav.py`;
el generador inyecta el beacon dentro del bloque del modal en las 11 páginas.
Vacío = nada inyectado. **Si algún día se pasa a GA4**, no es pegar un script: hay
que reescribir `/privacidad/`, poner banner de consentimiento y asumir que Google
entra al sitio de una consultora que vende gobernanza de datos.

### Pendiente: aviso de tratamiento de datos

El sitio **no tiene aviso de privacidad** y el formulario recolecta nombre,
correo, telefono, empresa y cargo, y los manda a un CRM. Falta declarar la
finalidad, el responsable y el plazo de conservacion. Es un hueco anterior a este
cambio y mas grande que el del captcha, y se ve especialmente mal dado que
`/oferta/` vende cumplimiento de la Ley 21.719. Cuando se agregue GA4, tambien
tiene que quedar declarado ahi.


- Campo trampa (honeypot) oculto: si viene con texto, se descarta y se responde 200
  para no avisarle al bot.
- Límite de 5 envíos por IP cada 10 minutos. Es **best-effort**: la memoria no se
  comparte entre instancias ni sobrevive al reciclaje, así que frena a un bot torpe,
  no a uno distribuido. Ante abuso sostenido habría que agregar un captcha.
- Validación en servidor del correo, del interés y del tamaño de organización; los
  largos se recortan a los límites de los campos de Dataverse para que la API no
  rechace el registro.

## El hero de la home

Titular: **"Aprende IA con quienes la implementan."** Debajo, dos puertas —
*Para tu organización* (a `/oferta/`) y *Para ti* (cursos abiertos y
certificaciones de Claude) — y una tira de seis clientes como prueba.

Se eligió entre tres direcciones (credibilidad, audiencia, prueba) y ganó la de
credibilidad porque es la única verdadera a la vez para los dos públicos y los
dos ecosistemas: el gerente y el ejecutivo que aprende solo comparten que ya
tienen la IA y desconfían de promesas. El hero anterior — "Tu plataforma ya está
lista. ¿Y tu gente?" — solo le hablaba a la empresa con Microsoft, y sus dos
botones eran corporativos: la persona no tenía puerta.

Consecuencias del cambio:

- Salió el panel ilustrativo de Copilot (`.mock`) y su CSS. La medición sigue en
  la bajada y en la sección "El impacto se mide".
- Salió la franja "Cursos abiertos" que iba bajo el hero: la puerta *Para ti* la
  dejaba redundante. La clase `.band` sigue viva en `/oferta/`.
- Los seis logos del hero (Codelco, LATAM, Cencosud, Banco Ripley, Mallplaza,
  ChileAtiende) van en escala de grises y toman color al pasar el mouse. Su uso
  destacado en la home quedó **autorizado el 7 de septiembre de 2026**; siguen
  sujetos a la confirmación por cliente que pide el pendiente de logos.
- La cifra **"más de 15 años"** quedó confirmada el 7 de septiembre de 2026 y por
  eso entra en la bajada.

La comparación de las tres direcciones quedó publicada como artefacto interno,
para no perder el razonamiento si se reabre la discusión.

## Dos caminos en un sitio

La home y la mayor parte del sitio hablan a la empresa (gerencia, TI, personas).
`/cursos-abiertos/` es el camino para personas, ejecutivos y equipos pequeños:
versiones abiertas de una jornada de "Copilot en el trabajo diario" e "IA aplicada
para líderes". Reglas de ese camino:

- **No se publican fechas ni precios hasta que la cohorte esté confirmada** (fecha,
  relator y cupo). Mientras, el CTA es dejar el correo con interés "Curso abierto".
- Se vende como la misma metodología corporativa en formato corto, no como curso
  barato, para proteger el precio in-company.
- No se menciona franquicia SENCE hasta resolver el registro OTEC.
- Tono: "tú", "tu trabajo", "esta semana". El resto del sitio usa "tu organización",
  "gerencia", "dotación".

## Dos ecosistemas: Microsoft y Anthropic

El sitio separa la formación por ecosistema, porque son propuestas distintas y se
compran distinto:

- **Microsoft** — `/oferta/`, `/adopcion-garantizada/`, `/cursos-abiertos/`.
  Es la línea histórica y donde W-IT es Microsoft Solutions Partner.
- **Anthropic (Claude)** — `/claude/`. Cinco cursos: uno de entrada sin
  certificación y cuatro de preparación para los exámenes de Anthropic.

El puente entre ambas está en tres lugares: la sección `#ecosistemas` de la home
(dos tarjetas, justo después de la sección de Copilot), la franja `.band` al inicio
de `/oferta/`, y el botón "Ver la línea Microsoft" en el cierre de `/claude/`.
El `h1` de `/oferta/` dice "Nuestra oferta Microsoft" para que el alcance quede claro.

### Datos de los examenes: la fuente son las guias oficiales

Los numeros de `/claude/` y de `/recursos/` **salen de los cuatro PDF de guia de
examen de Anthropic**, leidos directamente, no de resumenes de terceros. Verificado
en septiembre de 2026:

| Certificacion | Codigo | Preguntas | Precio | Vigencia |
|---|---|---|---|---|
| Associate – Foundations | CCAO-F | 60 | US$ 99 | 12 meses |
| Developer – Foundations | CCDV-F | 53 | US$ 125 | 12 meses |
| Architect – Foundations | CCAR-F | 60 | US$ 125 | 12 meses |
| Architect – Professional | CCAR-P | 63 | US$ 175 | 12 meses |

Los cuatro: 120 minutos, supervisados (en linea o centro de examen), aprueban con
**720 sobre escala de 100 a 1.000**, sin requisitos previos obligatorios.
Reintentos con espera de 14 / 30 / 90 dias y maximo cuatro por ano movil.

**Las credenciales vencen a los 12 meses.** Anthropic las hizo temporales a
proposito; la renovacion es una evaluacion gratuita y sin supervision. Es un dato
comercial relevante: al planificar la certificacion de un equipo completo hay que
contar la renovacion, y abre una conversacion recurrente con el cliente.

**Correccion aplicada:** las descripciones iniciales de las tarjetas estaban mal.
`Architect – Foundations` no es "diseno de soluciones de punta a punta": su
blueprint es tecnico y practico — arquitectura y orquestacion de agentes 27%,
Claude Code 20%, prompting y salida estructurada 20%, herramientas y MCP 18%,
contexto y confiabilidad 15% — y se solapa bastante con Developer. El de diseno,
integracion y gobernanza es `Architect – Professional`. Si se vuelve a redactar
esas tarjetas, **leer la guia antes**: un cliente que elige por la descripcion
puede comprar la preparacion equivocada.

## Iconos

En `assets/iconos/` conviven **dos origenes con reglas distintas**, y no da lo
mismo cual se toca.

### `ms-*.svg` — oficiales de Microsoft, no se modifican

Vienen de los paquetes oficiales de learn.microsoft.com y estan copiados **byte a
byte**:

| Archivo | Paquete | Se usa en |
|---|---|---|
| `ms-power-platform.svg` | [Power Platform icons](https://learn.microsoft.com/en-us/power-platform/guidance/icons) | Power Platform para el negocio |
| `ms-copilot-studio.svg` | Power Platform icons | Constructor de agentes |
| `ms-dynamics-sales.svg` | [Dynamics 365 icons](https://learn.microsoft.com/en-us/dynamics365/get-started/icons) | D365 para ventas y servicio |
| `ms-dynamics-finance.svg` | Dynamics 365 icons | D365 para finanzas y operaciones |

Sus terminos permiten el uso en **material de formacion**, que es lo que son
estas paginas, y ademas Microsoft *recomienda* poner el nombre del producto junto
al icono — que es justo lo que hace el `h3` de cada tarjeta.

Lo que prohiben: **recortar, girar, deformar o cambiar la forma**, y usarlos para
representar un producto propio. Por eso **no pasan por ningun script de
procesamiento**, al contrario de los logos de Claude. Escalarlos de forma
uniforme si esta permitido; cambiarles el `viewBox` o el color, no.

Si algun dia Microsoft actualiza sus paquetes, se vuelven a descargar y se
reemplazan tal cual. No editarlos a mano.

### `wit-*.svg` — propios, se pueden cambiar

Dibujados para lo que **no es un producto de Microsoft**: Piso Digital, IA
aplicada para lideres y las tres asesorias. Van en la paleta W-IT, navy
`#1B3A50` con acento verde `#54BA00`, en `viewBox` de 24x24.

Esa diferencia visual es intencional y comunica algo: **el logo de producto
identifica a Microsoft, el icono propio identifica un servicio de W-IT.**

Al dibujar uno nuevo, ojo con el peso: la primera version tenia trazo de 1.7 y a
24 px se hundia al lado de los iconos solidos y de color de Microsoft. El trazo
quedo en 2.2 y cada uno lleva un acento verde solido para tener algo de masa de
color y no quedar como puro contorno.

### Enlaces a las guias: ojo con las URL de los PDF

Las guias se sirven desde el S3 de Skilljar y su URL incluye un identificador de
instructor y un numero que parece un timestamp:

```
https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F<hash>%2Fpublic%2F<numero>%2F<nombre>.pdf
```

**Si Anthropic vuelve a subir una guia, ese numero cambia y el enlace muere.** Por
eso en `/recursos/` cada guia va junto al enlace a la **pagina del examen**, que
tiene slug estable (`/claude-certified-<nivel>-certification`) y desde donde
siempre se puede bajar la version vigente. Al revisar esta seccion, comprobar los
cuatro PDF; hay un chequeo de enlaces externos que los cubre.

### Reglas de la línea Claude

Estas reglas existen para no prometer lo que no controlamos:

- **La certificación la emite Anthropic, no WITEDUCA**, y pertenece a la persona que
  rinde, no a la empresa. La página lo dice en el hero, en una sección propia, en la
  primera FAQ y en el pie legal. No cambiar ese lenguaje a "certifícate con nosotros".
- **No se afirma que W-IT sea partner de Anthropic** mientras la postulación al Claude
  Partner Network esté en curso. Cuando se resuelva, actualizar el hero y evaluar el
  badge, siguiendo la guía de marca de Anthropic.
- **Solo se publica el precio del examen**, que es dato público de Anthropic (US$ 99 /
  125 / 125 / 175) y lo paga cada persona en su plataforma. El precio del curso de
  preparación no se publica: el CTA es cotizar.
- **Se declara que Anthropic ofrece preparación gratuita.** Los prep paths de Skilljar
  no tienen costo, así que la página explica qué agrega el curso pagado (relatoria en
  vivo en español, práctica sobre casos reales, acompañamiento). Si se omite, el
  cliente lo descubre solo y la propuesta pierde credibilidad.
- **Los valores y temarios se enlazan al portal de Anthropic**, que es la fuente. Si
  Anthropic cambia precios o agrega certificaciones, hay que actualizar la página;
  revisar el portal cada vez que se toque esta sección.
- No se publican duraciones de los cursos de preparación hasta que Operaciones las
  defina, por la misma razón que no se publican fechas en `/cursos-abiertos/`.
- **Los logos de Claude y Anthropic se usan de forma nominativa**: identifican el
  producto sobre el que se ensena, igual que `copilot.webp` en el resto del sitio.
  El lockup del hero de `/claude/` va acompanado, inmediatamente debajo, de la
  seccion que aclara que no hay afiliacion. No convertirlos en un badge tipo
  "partner" ni ponerlos en la nav junto al de Microsoft Solutions Partner mientras
  no exista una designacion real y su guia de uso de marca.
- Los tres archivos se **auto-hospedan**, recortados y con fondo transparente. No se
  hotlinkean desde el sitio de origen ni desde un servicio de logos con token en la
  URL: eso publicaria la credencial en cada visita. Para regenerarlos desde los
  originales: `python tools/logos/prep-logos.py`.

El formulario tiene el interés **"Formación en Claude"**, precargable con
`/contacto/?interes=Formaci%C3%B3n%20en%20Claude`. Está en el `select` de
`contacto/index.html` **y** en la lista `INTERESES` de `api/src/lead.js`: si se agrega
en uno y no en el otro, la API rechaza el envío con `campos_invalidos`.

## Consultores: horas agendables — OCULTA HOY

`/consultores/` **no está publicada**. Existe, se despliega y responde por URL
directa, pero:

- lleva `<meta name="robots" content="noindex, nofollow">`
- no está en `sitemap.xml`
- no está en el menú ni en el footer (comentado en `tools/nav/build-nav.py`)
- no la enlaza ninguna otra página: se quitaron la franja de la home y las notas
  de `/oferta/`, `/claude/` y `/contacto/`

La razón: **ni los relatores ni las tarifas están definidos**. Estuvo pública unos
minutos el 4 de septiembre de 2026 y se retiró el mismo día; es improbable que
alcanzara a indexarse, pero conviene revisar Search Console cuando esté conectado.

### Para publicarla

1. Reemplazar los 8 placeholders por nombres, fotos, roles y tarifas reales.
2. Poner las URLs de Microsoft Bookings en el `href` de cada ficha (cada una tiene
   un comentario HTML marcando el punto).
3. Quitar el `<meta name="robots">` de `consultores/index.html`.
4. En `tools/nav/build-nav.py`, devolver `('Horas con un consultor',
   '/consultores/')` al grupo Consultoría y a su columna del footer, y volver el
   descriptor del grupo a "Por hora o por proyecto". Correr el script.
5. Volver a agregar la URL a `sitemap.xml`.
6. Restituir los enlaces cruzados si se quieren: franja en la home, nota en
   `/oferta/` bajo Línea 1, nota en `/claude/` bajo las certificaciones, y nota en
   `/contacto/` sobre el detalle precargado.

Lo que sigue describe la página tal como está construida.


`/consultores/` vende **horas de un relator**, no un curso cerrado. Es la puerta de
entrada más chica del sitio: una hora suelta para una duda concreta, o un paquete
de varias sesiones. La metáfora es la hora médica: eliges profesional, eliges
cuánto tiempo y agendas.

### Estructura

- **Hora suelta** — 1 h, sin paquete.
- **Paquetes por ecosistema** — Copilot y Claude, cada uno con Básico (4 h),
  Intermedio (8 h) y Avanzado (12 h), en sesiones de 2 h. Las horas son una
  **propuesta pendiente de validar con Operaciones**, no un compromiso cerrado.
- **Certificación** — a medida en los dos ecosistemas: el alcance y las horas se
  definen con el cliente, así que la tarjeta no publica horas y manda al formulario.
- **8 relatores** con rol, especialidad y valor hora.

### Reglas

- **Los nombres son placeholders a propósito.** Las fichas dicen
  "Relator NN · [Nombre por definir]": son personas reales y no se publican nombres
  inventados. Los **roles están escritos en forma neutra en género** porque todavía
  no hay una persona asignada a cada casilla; al poner los nombres reales, ajustar
  el título a como cada persona lo use.
- **Publicar la página requiere, por relator:** nombre, foto, confirmación de que
  acepta atender horas agendadas, y su tarifa. Sin eso la página es una maqueta.
- **El botón "Agendar" todavía no agenda.** Hoy manda al formulario con el relator y
  el paquete precargados, y el Lead llega a D365. Cuando cada relator tenga su
  página de **Microsoft Bookings**, se reemplaza el `href` de su ficha; cada tarjeta
  lleva un comentario HTML marcando el punto exacto.
- **No se simula una compra.** La primera FAQ dice explicitamente que el pago en
  linea no existe todavia y que se coordina por transferencia o factura. Es
  deliberado: una UI que parece cobrar y no cobra deja al cliente creyendo que
  reservo y a nadie llamandolo.
- **Politicas sin definir, declaradas como tal:** vigencia de las horas compradas y
  reagendamiento/cancelacion. Ambas estan en la FAQ como "por confirmar". Definirlas
  antes de habilitar el pago en linea.

### Como funciona el filtro por especialidad

La rejilla de relatores usa `data-filter` en la sección, `data-filter-items` en la
rejilla y `data-cat` en cada ficha. **`data-cat` acepta varias categorías separadas
por espacio** (`data-cat="copilot claude"`), porque hay relatores expertos en los dos
ecosistemas: por eso el filtro de `site.js` es distinto del carrusel de agentes de
`/oferta/`, que asume una sola categoría por tarjeta. Filtrar por Copilot da 6 y por
Claude da 5, sobre 8 relatores: la suma es mayor que el total y está bien.

### Enlace al formulario

Los botones apuntan a `/contacto/?interes=Agendar hora con un consultor&detalle=...`.
El parámetro **`detalle`** precarga el `textarea` del mensaje con el relator y el
paquete elegidos, y respeta lo que la persona ya haya escrito. Lo implementa
`site.js`; el interes tambien esta en la whitelist `INTERESES` de `api/src/lead.js`.

## Navegacion: una sola definicion

La nav estaba duplicada a mano en 10 archivos HTML. Cada cambio eran 10 ediciones
y se desincronizaban. Ahora **la definicion unica vive en `tools/nav/build-nav.py`**
y ese script la inyecta en todas las paginas:

```bash
python tools/nav/build-nav.py          # escribe
python tools/nav/build-nav.py --check  # falla si alguna pagina esta desfasada
```

Es idempotente y su salida se commitea: el sitio sigue siendo HTML estatico sin
build. **No editar la nav ni el footer a mano en los HTML**: se pierden en la
siguiente corrida. Editar `build-nav.py` y correrlo.

Reemplaza los bloques `<header class="nav">...</header>` y
`<footer class="footer">...</footer>` completos, y marca `aria-current` segun la
URL de cada pagina.

### Como esta agrupado y por que

```
Inicio   Programas v   Cursos v   Consultoria v   Nosotros   [Conversemos]

Programas v      Adopcion Garantizada  ·  Nivelacion tecnologica
Cursos v         Formacion in-company  ·  Cursos abiertos
                 Claude y certificaciones  ·  Recursos oficiales
Consultoria v    Horas con un consultor  ·  Asesorias en IA y gobernanza
                 Agentes autonomos
Nosotros         enlace directo a /nosotros/
```

`/recursos/` vive dentro de **Cursos**, no de Nosotros: la pagina es material de
aprendizaje — guias de examen, documentacion, cursos gratuitos — no informacion
institucional. Con eso Nosotros quedaba con un solo item, y un desplegable de uno
es ruido, asi que es un enlace directo.

### Dynamics 365: dos cursos, no uno

Se separo en **ventas y servicio** (Sales, Customer Service) y **finanzas y
operaciones** (Finance, Business Central), en vez de copiar el patron de una
tarjeta unica que tiene Power Platform.

La razon: Power Platform es una familia coherente para un publico — analistas y
jefaturas de proceso — pero Dynamics 365 abarca CRM y ERP, y un usuario de Sales
no tiene nada que ver con uno de Business Central. Una tarjeta unica dejaria la
linea de audiencia en algo como "usuarios de Dynamics 365", que no le dice nada a
quien decide la compra.

Si mas adelante conviene abrir una tarjeta por modulo, el costo es que el selector
del formulario crece: cada curso es un valor del catalogo de intereses.

### Por que los items de la barra son de una palabra

Cada panel abre con un **descriptor de audiencia** — "Para tu organizacion",
"Empresa y personas", "Por hora o por proyecto" — en vez de meter la audiencia en
la etiqueta de la barra.

Se evaluo renombrar el item a **"Programas empresariales"**, que es literalmente
cierto: los dos programas van a empresa. Se descarto por dos razones medidas:

1. **Ancho.** La barra pasa de 603 a 698 px y el minimo de viewport de 891 a
   986 px, lo que obliga a subir el hamburguesa de 900 a 1000 px. Los laptops
   entre 900 y 1000 perderian la barra completa.
2. **Asimetria, que es peor.** Si solo un grupo dice "empresariales", el lector
   deduce por contraste que los otros dos no lo son. Y si lo son: `Cursos`
   contiene **Formacion in-company** y `Consultoria` contiene **Asesorias en IA**
   y **Agentes autonomos**, las tres de venta a empresa. La etiqueta desviaria a
   un comprador corporativo lejos de tres ofertas que le corresponden.

El descriptor resuelve lo mismo sin ninguno de los dos costos. **Si se agrega un
grupo nuevo, darle su descriptor**: la gracia es que los tres lo tengan.

Agrupado **por tipo de servicio**, que es como decide quien compra: programas
institucionales, formacion puntual, y expertise por hora o por proyecto. Se
descartaron dos alternativas: por audiencia (empresa / persona) reparte Claude en
los dos grupos porque esa pagina sirve a ambos publicos; por ecosistema entierra
Adopcion Garantizada un nivel y fuerza a Nivelacion y Asesorias dentro de
"Microsoft", donde no pertenecen. El eje Microsoft / Anthropic vive dentro de
"Cursos" y en el selector `#ecosistemas` de la home.

**Ningun item cambio de URL**: los grupos apuntan a las paginas y anclas que ya
existian, asi que no hubo redirects ni se rompio nada indexado.

`/oferta/` es el destino de cuatro items del menu (`#cursos`, `#nivelacion`,
`#asesorias`, `#agentes`) y por eso **no marca ninguno como actual**: marcar uno
solo mentiria sobre por donde llego la persona. La regla esta en `es_actual()`:
un item es el actual solo si coincide exacto y sin ancla.

### Por que los desplegables abren con clic y no con hover

El hover deja los menus inalcanzables en tactil y obliga al doble toque. Con clic
funciona igual en mouse, teclado y dedo. Incluye Escape (cierra y devuelve el
foco al boton), clic fuera, exclusion mutua entre grupos, y `aria-expanded` /
`aria-controls`. En movil los mismos grupos se expanden en linea dentro del menu
hamburguesa, y al cerrar el menu se cierran todos.

El Escape del menu movil esta condicionado a que no haya un desplegable abierto,
porque su listener corre **antes** que el de los desplegables: sin esa condicion,
un Escape con un submenu abierto cerraria todo el menu de golpe.

### Sin JavaScript

Los paneles llevan el atributo `hidden`, asi que sin JS quedarian inalcanzables
y con ellos 6 destinos del sitio. La regla `html:not(.js) .nav__panel[hidden]`
los muestra en linea — misma convencion que `.reveal`, que solo se oculta cuando
`site.js` agrega la clase `.js` al `<html>`. Queda como una tira tipo mapa del
sitio: no bonita, pero completa y navegable.

Limitacion preexistente que **no** se resolvio: bajo 900 px el menu depende del
boton hamburguesa, asi que sin JS el menu movil sigue inalcanzable.

### Breakpoints de la nav, y por que estan ahi

Con 8 items la barra mediía 932 px y **se desbordaba entre 1051 y 1300 px**: flex
encogia `.nav__brand` en silencio y "Adopcion y Formacion" se partia en tres
lineas. Justo la banda de la mayoria de los laptops. Dos cosas lo cierran:

- `.nav__brand` tiene `flex-shrink: 0`, asi que **el logo no se puede comprimir
  nunca mas**. Si algo no cabe, el fallo es visible (overflow) en vez de
  silencioso y feo.
- Al agrupar, la barra bajo de 932 a 615 px. Con eso el hamburguesa volvio a
  **900 px** (antes 1050) y el badge de Microsoft Solutions Partner reaparece a
  **1150 px** (antes 1400, y llego a 1500): en la practica se veia en muy pocas
  pantallas.

Minimos medidos: 903 px sin badge, 1096 px con badge, con la barra en 615 px. Hoy
mide 602 px. Al agregar o renombrar items del menu, **volver a medir**: el margen a
900 px es de unos 70 px, y el metodo esta descrito arriba.

## Pendientes

- **Cursos abiertos**: confirmar el formato de una jornada, definir la primera cohorte
  (curso, fecha, relator, cupo mínimo, precio por persona) y decidir cómo se
  inscribe y paga. Hasta entonces la página solo capta interés.

- **Consultores — datos de las personas**: nombre, foto, rol definitivo, confirmación
  de disponibilidad para horas agendadas y tarifa, por cada uno de los 8 relatores.
  **Es lo que mantiene la página oculta.** Los seis pasos para publicarla estan en la
  seccion "Consultores".

  El interes "Agendar hora con un consultor" se mantiene en el formulario y en la
  whitelist de `api/src/lead.js`: la pagina sigue operativa por URL directa y sus
  botones necesitan que exista.

- **Consultores — tarifas**: definir con Comercial el valor hora (¿uno solo, o por
  seniority del relator?) y si los paquetes tienen precio propio o son valor hora ×
  horas. Hoy la página muestra `$ —` con la leyenda "tarifa por definir" en 9 lugares:
  las 8 fichas y la hora suelta.

- **Consultores — Microsoft Bookings**: crear el servicio por relator y pegar cada URL
  en el `href` de su ficha (hay un comentario HTML marcando el punto). Hasta entonces
  el botón manda al formulario.

- **Consultores — pago en línea**: elegir pasarela y definir vigencia de las horas y
  política de reagendamiento antes de habilitarlo.

- **Consultores — horas por nivel**: 4 / 8 / 12 h en sesiones de 2 h es una propuesta.
  Validar con Operaciones antes de publicar.

- **Línea Claude**: definir con Operaciones la duración y el programa por módulos de
  los cuatro cursos de preparación, y con Comercial el precio por persona y el precio
  in-company. Hasta entonces la página solo cotiza.

- **Claude Partner Network**: confirmar el resultado de la postulación. Si W-IT queda
  aceptada, revisar el hero de `/claude/`, el pie legal y la guía de uso de marca de
  Anthropic antes de mostrar cualquier badge.

- **Origen de los logos de Anthropic**: los tres archivos de `/assets/` se derivaron de
  imágenes públicas de terceros, no del kit de marca oficial de Anthropic. Reemplazarlos
  por los assets oficiales cuando se tenga acceso al kit, y confirmar con Anthropic que
  el uso nominativo en esta página cumple su guía de marca.

- **Idioma del examen de Anthropic**: las cuatro guías estan en ingles y **ninguna
  declara en que idiomas se rinde el examen**. La FAQ de `/claude/` lo dice asi y
  remite al portal. Si Anthropic lo publica, precisar la respuesta.

- **Páginas de detalle por certificación**: hoy `/claude/` es un hub único. Si el
  tráfico lo justifica, abrir una URL por certificación con su programa y su JSON-LD
  `Course` propio, para SEO de cola larga.

- **Enlaces externos**: `/recursos/` depende de 28 URL de Microsoft y Anthropic, y
  cuatro de ellas son PDF en S3 con URL fragil (ver arriba). Conviene revisarlas
  cada cierto tiempo; al 4 de septiembre de 2026 las 35 externas responden 200.

- **Analítica**: se eligió Cloudflare Web Analytics (ver la sección). Falta pegar
  el token en `CF_ANALYTICS_TOKEN` de `tools/nav/build-nav.py` y regenerar. Sigue
  pendiente registrar el dominio en Google Search Console y Bing Webmaster Tools,
  que es lo que dice *cómo te encuentran en buscadores* y además permite pedir el
  reindexado tras cambios como el del título de la home.
- **Equipo**: la sección de equipo se retiró porque solo había placeholders. Volver a
  agregarla cuando existan nombres y fotos.
- **Fotos de eventos**: aparecen personas identificables (participantes de clientes,
  equipo de W-IT). Confirmar que existe consentimiento para publicarlas en la web,
  según la Ley 21.719, y retirar las que no lo tengan.
- **Logos de clientes**: el carrusel usa los 29 logos de la presentación comercial de
  W-IT. Confirmar con Comercial que cada cliente autoriza su uso en la web y retirar
  los que no.
- **Artículos**: Recursos muestra solo el hub oficial de Microsoft hasta que haya un
  artículo propio publicado.
- **Agentes**: la sección de Oferta mantiene los 15 agentes a la espera de decidir si
  se reducen a ejemplos dentro del curso constructor de agentes.

---

© 2026 W-IT SpA · Santiago de Chile
