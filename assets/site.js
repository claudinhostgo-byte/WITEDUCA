/* WITEDUCA — interacciones del sitio, sin framework.
   Todo el contenido está en el HTML; este archivo solo agrega comportamiento. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---- Menú móvil ---- */
  var nav = $(".nav");
  var toggle = $(".nav__toggle");
  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      if (!open) {
        $$(".nav__group .nav__btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
        $$(".nav__group .nav__panel").forEach(function (pa) { pa.hidden = true; });
      }
    });
    document.addEventListener("keydown", function (e) {
      // Con un desplegable abierto, Escape cierra solo ese: lo hace el bloque de
      // más abajo, que corre después de este listener.
      if (e.key === "Escape" && nav.classList.contains("is-open") && !$(".nav__btn[aria-expanded='true']")) toggle.click();
    });
  }

  /* ---- Menús desplegables de la nav ---- */
  /* Se abren con clic, no con hover: el hover deja los menús inalcanzables en
     táctil y obliga al doble toque. Con clic funciona igual en mouse, teclado
     y dedo. */
  var grupos = $$(".nav__group");
  var btnAbierto = function () { return $(".nav__btn[aria-expanded='true']"); };
  if (grupos.length) {
    var cerrarGrupos = function (excepto) {
      grupos.forEach(function (g) {
        if (g === excepto) return;
        var b = $(".nav__btn", g), pa = $(".nav__panel", g);
        if (b) b.setAttribute("aria-expanded", "false");
        if (pa) pa.hidden = true;
      });
    };
    grupos.forEach(function (g) {
      var b = $(".nav__btn", g), pa = $(".nav__panel", g);
      if (!b || !pa) return;
      b.addEventListener("click", function () {
        var abierto = b.getAttribute("aria-expanded") === "true";
        cerrarGrupos(g);
        b.setAttribute("aria-expanded", String(!abierto));
        pa.hidden = abierto;
      });
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && !e.target.closest(".nav__group")) cerrarGrupos(null);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var b = btnAbierto();
      if (b) { cerrarGrupos(null); b.focus(); }
    });
  }

  /* ---- Aparición al hacer scroll ---- */
  var reveals = $$(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---- Contador del mock de la home ---- */
  var counter = $("[data-count]");
  if (counter && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var target = Number(counter.getAttribute("data-count")) || 0;
    var t0 = null, dur = 1600;
    var tick = function (t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      counter.textContent = String(Math.round(target * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    counter.textContent = "0";
    requestAnimationFrame(tick);
  }

  /* ---- Roadmap (Adopción Garantizada) ---- */
  var roadmap = $(".roadmap");
  if (roadmap) {
    var steps = $$(".step", roadmap);
    var details = $$(".roadmap__detail", roadmap);
    var progress = $(".roadmap__progress", roadmap);
    var activate = function (i) {
      steps.forEach(function (s, j) {
        s.classList.toggle("is-active", j === i);
        s.classList.toggle("is-done", j < i);
        s.setAttribute("aria-selected", String(j === i));
        s.setAttribute("tabindex", j === i ? "0" : "-1");
      });
      details.forEach(function (d, j) { d.hidden = j !== i; });
      if (progress) progress.style.width = (i / (steps.length - 1)) * 80 + "%";
    };
    steps.forEach(function (s, i) {
      s.addEventListener("click", function () { activate(i); });
      s.addEventListener("mouseenter", function () { activate(i); });
      s.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
        if (n !== null && steps[n]) { activate(n); steps[n].focus(); e.preventDefault(); }
      });
    });
    activate(0);
  }

  /* ---- Carrusel de agentes (Oferta) ---- */
  var track = $(".track");
  if (track) {
    var chips = $$(".chip[data-cat]");
    var agents = $$(".agent", track);
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var cat = c.getAttribute("data-cat");
        chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x === c)); });
        agents.forEach(function (a) { a.hidden = cat !== "todos" && a.getAttribute("data-cat") !== cat; });
        track.scrollTo({ left: 0, behavior: "smooth" });
      });
    });
    var prev = $("[data-scroll='prev']"), next = $("[data-scroll='next']");
    if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -360, behavior: "smooth" }); });
    if (next) next.addEventListener("click", function () { track.scrollBy({ left: 360, behavior: "smooth" }); });
  }

  /* ---- Filtro por especialidad en una rejilla (Consultores) ---- */
  $$("[data-filter]").forEach(function (grupo) {
    var caja = $("[data-filter-items]", grupo);
    if (!caja) return;
    var chips = $$(".chip[data-cat]", grupo);
    var items = $$("[data-cat]", caja);
    var cuenta = $(".filter__count", grupo);
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var cat = c.getAttribute("data-cat");
        chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x === c)); });
        var n = 0;
        items.forEach(function (it) {
          var cats = (it.getAttribute("data-cat") || "").split(/\s+/);
          var ver = cat === "todos" || cats.indexOf(cat) !== -1;
          it.hidden = !ver;
          if (ver) n++;
        });
        if (cuenta) cuenta.textContent = n === 1 ? "1 relator" : n + " relatores";
      });
    });
  });

  /* ---- Formulario de contacto → /api/contacto ---- */
  var form = $("#form-contacto");
  if (form) {
    var errorBox = $(".form__error", form);
    var submit = $(".form__submit", form);
    var okBox = $(".form__ok");

    // El backend devuelve códigos, no detalle del CRM; aquí se traducen.
    var mensajeError = function (codigo, campos) {
      if (codigo === "campos_invalidos") {
        var etiquetas = { nombre: "tu nombre", correo: "un correo válido", interes: "el tipo de interés", tamano: "el tamaño de la organización" };
        var faltan = (campos || []).map(function (c) { return etiquetas[c] || c; });
        return faltan.length ? "Falta " + faltan.join(" y ") + "." : "Revisa los datos del formulario.";
      }
      if (codigo === "demasiados_envios") return "Recibimos varios envíos desde tu conexión. Espera unos minutos o escríbenos a contacto@witeduca.cl.";
      return "No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos directo a contacto@witeduca.cl.";
    };
    var showError = function (msg) { errorBox.textContent = msg; errorBox.hidden = false; };

    // Interés precargado desde la URL (?interes=...) para enlazar desde cada página.
    var params = new URLSearchParams(location.search);
    var interesParam = params.get("interes");
    var selInteres = $("select[name='interes']", form);
    if (interesParam && selInteres) {
      $$("option", selInteres).forEach(function (o) { if (o.value === interesParam) selInteres.value = interesParam; });
    }

    // Detalle precargado (?detalle=...): lo usa /consultores/ para mandar el
    // relator y el paquete elegidos. Se respeta lo que la persona ya escribio.
    var detalleParam = params.get("detalle");
    var taMensaje = $("textarea[name='mensaje']", form);
    if (detalleParam && taMensaje && !taMensaje.value) {
      taMensaje.value = detalleParam.slice(0, 2000);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      errorBox.hidden = true;
      submit.disabled = true;
      var original = submit.textContent;
      submit.textContent = "Enviando…";

      var datos = {};
      new FormData(form).forEach(function (v, k) { datos[k] = v; });
      datos.origen = location.pathname + location.search;
      datos.referente = document.referrer || "";

      fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; }); })
        .then(function (r) {
          if (r.res.ok && r.data.ok) {
            form.hidden = true;
            if (okBox) okBox.hidden = false;
          } else {
            showError(mensajeError(r.data.error, r.data.campos));
          }
        })
        .catch(function () { showError(mensajeError()); })
        .then(function () { submit.disabled = false; submit.textContent = original; });
    });
  }
})();
