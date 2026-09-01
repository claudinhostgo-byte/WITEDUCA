# Sitio web W-IT Educa

Sitio de WITEDUCA, la unidad de formación y adopción tecnológica de W-IT SpA.

Importado desde el proyecto **"Sitio web W-IT Educa"** de [Claude Design](https://claude.ai/design).

## Páginas

| Archivo | Página |
|---|---|
| `index.html` | Home |
| `Oferta.dc.html` | Oferta — 4 líneas de trabajo + carrusel de agentes IA |
| `Adopcion.dc.html` | Adopción Garantizada — programa ancla |
| `Nosotros.dc.html` | Nosotros — equipo, designaciones Microsoft, FAQ |
| `Recursos.dc.html` | Recursos — artículos y hub de adopción Microsoft |
| `Contacto.dc.html` | Contacto — formulario |

La home es `index.html`, así que la raíz del dominio (<https://www.witeduca.cl>) la sirve directamente.

## Cómo verlo

Las páginas usan rutas relativas para `assets/`, así que **no funcionan abiertas con doble clic** (`file://`). Hay que servirlas por HTTP:

```bash
python -m http.server 8765
```

Luego abrir <http://127.0.0.1:8765/>.

## Formato `.dc.html`

Cada página es un componente del runtime de Claude Design:

- `<x-dc>` envuelve el markup, con interpolación `{{ }}`, `<sc-for>` (listas), `<sc-if>` (condicionales) y `style-hover` / `style-focus`.
- El `<script type="text/x-dc">` final define una clase `Component extends DCLogic` con `state`, `componentDidMount()` y `renderVals()`.
- `support.js` es el runtime que interpreta todo eso.

## Formulario de contacto → Dynamics 365

El formulario de `Contacto.dc.html` hace `POST /api/contacto`. Esa ruta es una
Azure Function gestionada de Static Web Apps (`api/`) que crea un **Cliente
potencial (Lead)** en Dataverse.

Se crea un Lead y no una Oportunidad a propósito: es el flujo estándar de D365
Sales. El equipo comercial califica el Lead y, al calificarlo, D365 genera
Cuenta + Contacto + Oportunidad. Así el tráfico anónimo de la web no entra
directo al pipeline ni al forecast.

```
Contacto.dc.html  --POST-->  api/src/functions/contacto.js
                                 |-- api/src/lead.js       (validación + mapeo, lógica pura)
                                 `-- api/src/dataverse.js  (token + Web API)
                                          |
                                          v
                             POST /api/data/v9.2/leads
```

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
- Validación en servidor del correo y del valor del select; los largos se recortan a
  los límites de los campos de Dataverse para que la API no rechace el registro.

## Dependencias

**El sitio requiere conexión a internet para renderizar.** `support.js` carga tres librerías desde unpkg en tiempo de ejecución:

```
https://unpkg.com/react@18.3.1/umd/react.production.min.js
https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js
https://unpkg.com/@babel/standalone@7.29.0/babel.min.js
```

Sin acceso a unpkg la página queda en blanco. Antes de publicar en producción conviene vendorizar esas tres librerías al repositorio.

`image-slot.js` (usado en `Nosotros` y `Recursos`) define el elemento `<image-slot>`, un placeholder de imagen que se puede rellenar arrastrando un archivo. Busca un sidecar `.image-slots.state.json` para persistir lo que se suelte; el **404 de ese archivo es esperado** mientras no se haya llenado ningún slot.

## Pendientes de contenido

- `Nosotros.dc.html`: los cuatro integrantes del equipo son `Nombre Apellido` con foto vacía, y hay dos slots de logos de clientes sin llenar.
- `Recursos.dc.html`: los tres artículos están marcados *Próximamente* y sin imagen.

---

© 2026 W-IT SpA · Santiago de Chile
