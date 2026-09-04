# Sitio web W-IT Educa

Sitio de WITEDUCA, la unidad de formación y adopción tecnológica de W-IT SpA.
Publicado en Azure Static Web Apps en <https://witeduca.cl>.

Diseño original creado en [Claude Design](https://claude.ai/design) y convertido
a HTML estático en septiembre de 2026 para que Google lo indexe sin depender de
JavaScript y para que funcione en móvil.

## Páginas

| URL | Archivo | Página |
|---|---|---|
| `/` | `index.html` | Home |
| `/oferta/` | `oferta/index.html` | Oferta — 4 líneas de trabajo + carrusel de agentes IA |
| `/adopcion-garantizada/` | `adopcion-garantizada/index.html` | Adopción Garantizada — programa ancla |
| `/cursos-abiertos/` | `cursos-abiertos/index.html` | Cursos abiertos — segundo camino: personas, ejecutivos y equipos pequeños |
| `/claude/` | `claude/index.html` | Claude de Anthropic — curso de entrada + preparación para las 4 certificaciones |
| `/consultores/` | `consultores/index.html` | Consultores — horas de consultoría agendables, 8 relatores + paquetes por nivel |
| `/nosotros/` | `nosotros/index.html` | Nosotros — designaciones Microsoft y FAQ |
| `/recursos/` | `recursos/index.html` | Recursos — hub de adopción Microsoft + material oficial de Anthropic y guías de examen |
| `/contacto/` | `contacto/index.html` | Contacto — formulario |
| — | `404.html` | Página de error |

Las URLs antiguas (`/Oferta.dc.html`, etc.) redirigen con 301 a las nuevas; ver
`staticwebapp.config.json`. `trailingSlash: auto` normaliza `/oferta` → `/oferta/` sin tocar archivos como `robots.txt`.

## Estructura

```
assets/site.css   hoja de estilos compartida (responsive, sistema de diseño W-IT)
assets/site.js    interacciones sin framework: menú móvil, reveal, roadmap,
                  carrusel de agentes, envío del formulario
assets/*.png/webp logos, badges, favicon, imagen Open Graph
assets/claude-logo.webp       lockup horizontal de Claude (hero de /claude/)
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
sitemap.xml       las 9 URLs públicas
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
opciones estándar de D365. Si tu entorno lo personalizó, confirma el valor real
antes de publicar.

### Nota sobre el secreto

Las Functions gestionadas de Static Web Apps **no soportan identidad
administrada**, y el plan Free no permite un Function App propio. Por eso se usa
client credentials con secreto. Si más adelante pasas a plan Standard con un
Function App externo, conviene migrar a managed identity y eliminar el secreto.

### Protección del formulario

- Campo trampa (honeypot) oculto: si viene con texto, se descarta y se responde 200
  para no avisarle al bot.
- Límite de 5 envíos por IP cada 10 minutos. Es **best-effort**: la memoria no se
  comparte entre instancias ni sobrevive al reciclaje, así que frena a un bot torpe,
  no a uno distribuido. Ante abuso sostenido habría que agregar un captcha.
- Validación en servidor del correo, del interés y del tamaño de organización; los
  largos se recortan a los límites de los campos de Dataverse para que la API no
  rechace el registro.

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

## Consultores: horas agendables

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
  **Bloqueante para publicar `/consultores/`.**

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

- **Analítica**: falta agregar GA4 y Microsoft Clarity (requieren los IDs de las
  cuentas) y registrar el dominio en Google Search Console y Bing Webmaster Tools.
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
- **Cifra "15+ años"**: confirmar con Administración antes de que quede indexada.
- **Agentes**: la sección de Oferta mantiene los 15 agentes a la espera de decidir si
  se reducen a ejemplos dentro del curso constructor de agentes.

---

© 2026 W-IT SpA · Santiago de Chile
