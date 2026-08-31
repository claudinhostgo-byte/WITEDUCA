# Sitio web W-IT Educa

Sitio de WITEDUCA, la unidad de formación y adopción tecnológica de W-IT SpA.

Importado desde el proyecto **"Sitio web W-IT Educa"** de [Claude Design](https://claude.ai/design).

## Páginas

| Archivo | Página |
|---|---|
| `WITEDUCA.dc.html` | Home |
| `Oferta.dc.html` | Oferta — 4 líneas de trabajo + carrusel de agentes IA |
| `Adopcion.dc.html` | Adopción Garantizada — programa ancla |
| `Nosotros.dc.html` | Nosotros — equipo, designaciones Microsoft, FAQ |
| `Recursos.dc.html` | Recursos — artículos y hub de adopción Microsoft |
| `Contacto.dc.html` | Contacto — formulario |

La home es `WITEDUCA.dc.html`, no `index.html`.

## Cómo verlo

Las páginas usan rutas relativas para `assets/`, así que **no funcionan abiertas con doble clic** (`file://`). Hay que servirlas por HTTP:

```bash
python -m http.server 8765
```

Luego abrir <http://127.0.0.1:8765/WITEDUCA.dc.html>.

## Formato `.dc.html`

Cada página es un componente del runtime de Claude Design:

- `<x-dc>` envuelve el markup, con interpolación `{{ }}`, `<sc-for>` (listas), `<sc-if>` (condicionales) y `style-hover` / `style-focus`.
- El `<script type="text/x-dc">` final define una clase `Component extends DCLogic` con `state`, `componentDidMount()` y `renderVals()`.
- `support.js` es el runtime que interpreta todo eso.

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
