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
| `/nosotros/` | `nosotros/index.html` | Nosotros — designaciones Microsoft y FAQ |
| `/recursos/` | `recursos/index.html` | Recursos — hub de adopción Microsoft |
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
robots.txt        permite todo salvo /api/, apunta al sitemap
sitemap.xml       las 6 URLs públicas
```

Cada página lleva sus metadatos completos (`title`, `description`, `canonical`,
Open Graph, favicon) y, donde aplica, datos estructurados JSON-LD:
`EducationalOrganization` en la home, `Service` en Adopción Garantizada y
`FAQPage` en Nosotros.

Las páginas usan rutas absolutas (`/assets/...`), así que **no funcionan abiertas
con doble clic** (`file://`). Para verlas en local:

```bash
python -m http.server 8765
```

Luego abrir <http://127.0.0.1:8765/>. El formulario solo funciona con la API
levantada (ver más abajo); en `http.server` el envío falla con un mensaje de
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

## Pendientes

- **Cursos abiertos**: confirmar el formato de una jornada, definir la primera cohorte
  (curso, fecha, relator, cupo mínimo, precio por persona) y decidir cómo se
  inscribe y paga. Hasta entonces la página solo capta interés.

- **Analítica**: falta agregar GA4 y Microsoft Clarity (requieren los IDs de las
  cuentas) y registrar el dominio en Google Search Console y Bing Webmaster Tools.
- **Equipo y clientes**: la sección de equipo y los logos de clientes se retiraron
  porque solo había placeholders. Volver a agregarlos cuando existan nombres, fotos
  y autorizaciones.
- **Artículos**: Recursos muestra solo el hub oficial de Microsoft hasta que haya un
  artículo propio publicado.
- **Cifra "15+ años"**: confirmar con Administración antes de que quede indexada.
- **Agentes**: la sección de Oferta mantiene los 15 agentes a la espera de decidir si
  se reducen a ejemplos dentro del curso constructor de agentes.

---

© 2026 W-IT SpA · Santiago de Chile
