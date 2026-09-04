# -*- coding: utf-8 -*-
"""Inyecta la navegacion y el pie de pagina canonicos en todas las paginas.

La nav estaba duplicada a mano en 10 archivos: cada cambio eran 10 ediciones y
se desincronizaban. Aqui vive la definicion unica; el script reemplaza el bloque
<header class="nav"> ... </header> y <footer class="footer"> ... </footer> de
cada pagina, y marca aria-current segun la URL de esa pagina.

Uso:  python tools/nav/build-nav.py            (escribe)
      python tools/nav/build-nav.py --check    (solo avisa si algo esta desfasado)

El sitio sigue siendo HTML estatico sin build: este script se corre a mano
cuando cambia el menu, y su salida se commitea.
"""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --- Definicion unica del menu -------------------------------------------------
# Agrupado por tipo de servicio: es como decide quien compra. El eje
# Microsoft / Anthropic vive dentro de "Cursos" y en el selector de la home.
# Ningun item cambia de URL respecto de la version anterior del sitio.
# (etiqueta, ref, descriptor de audiencia, items). items=None -> enlace directo.
#
# Se descarto renombrar el item a "Programas empresariales": sube el minimo de
# viewport de 891 a 986 px (obligaria a subir el hamburguesa de 900 a 1000) y,
# peor, al etiquetar solo un grupo como empresarial el lector deduce que los
# otros dos no lo son, cuando Formacion in-company, Asesorias y Agentes tambien
# van a empresa. El descriptor lo dice sin esa asimetria y sin costo de ancho.
NAV = [
    ('Inicio', '/', None, None),
    ('Programas', 'nav-programas', 'Para tu organización', [
        ('Adopción Garantizada', '/adopcion-garantizada/'),
        ('Nivelación tecnológica', '/oferta/#nivelacion'),
    ]),
    ('Cursos', 'nav-cursos', 'Empresa y personas', [
        ('Formación in-company', '/oferta/#cursos'),
        ('Cursos abiertos', '/cursos-abiertos/'),
        ('Claude y certificaciones', '/claude/'),
        ('Recursos oficiales', '/recursos/'),
    ]),
    # /consultores/ esta oculto a proposito: ni relatores ni tarifas estan
    # definidos. Al publicarlo, devolver aqui ('Horas con un consultor',
    # '/consultores/') y quitar el noindex de la pagina. Ver el README.
    ('Consultoría', 'nav-consultoria', 'Asesoría y automatización', [
        ('Asesorías en IA y gobernanza', '/oferta/#asesorias'),
        ('Agentes autónomos', '/oferta/#agentes'),
    ]),
    # Un desplegable de un solo item es ruido: Nosotros queda como enlace directo.
    ('Nosotros', '/nosotros/', None, None),
]
CTA = ('Conversemos', '/contacto/')

FOOTER_COLS = [
    ('Programas', [
        ('Adopción Garantizada', '/adopcion-garantizada/'),
        ('Nivelación tecnológica', '/oferta/#nivelacion'),
    ]),
    ('Cursos', [
        ('Formación in-company', '/oferta/#cursos'),
        ('Cursos abiertos', '/cursos-abiertos/'),
        ('Claude y certificaciones', '/claude/'),
        ('Recursos oficiales', '/recursos/'),
    ]),
    ('Consultoría', [
        ('Asesorías en IA', '/oferta/#asesorias'),
        ('Agentes autónomos', '/oferta/#agentes'),
    ]),
    ('WITEDUCA', [
        ('Toda la oferta', '/oferta/'),
        ('Quiénes somos', '/nosotros/'),
        ('Contacto', '/contacto/'),
        ('contacto@witeduca.cl', 'mailto:contacto@witeduca.cl'),
    ]),
]

LEGAL = (u'© 2026 W-IT SpA · Apoquindo 3039, Las Condes, Santiago de Chile · '
         u'Claude y Anthropic son marcas de Anthropic PBC. WITEDUCA no está afiliada '
         u'a Anthropic; las certificaciones las emite Anthropic.')

LEGAL_404 = (u'© 2026 W-IT SpA · Apoquindo 3039, Las Condes, Santiago de Chile · '
             u'<a href="mailto:contacto@witeduca.cl" style="color: rgba(255,255,255,0.75)">'
             u'contacto@witeduca.cl</a>')

# archivo -> URL publica. None = sin URL propia (404), no marca nada como actual.
PAGINAS = {
    'index.html': '/',
    'oferta/index.html': '/oferta/',
    'adopcion-garantizada/index.html': '/adopcion-garantizada/',
    'cursos-abiertos/index.html': '/cursos-abiertos/',
    'claude/index.html': '/claude/',
    'consultores/index.html': '/consultores/',
    'nosotros/index.html': '/nosotros/',
    'recursos/index.html': '/recursos/',
    'contacto/index.html': '/contacto/',
    '404.html': None,
}


def es_actual(href, url):
    """Un item es la pagina actual solo si coincide exacto y sin ancla.

    Por eso /oferta/ no marca nada: al menu entra por cuatro anclas distintas
    (#cursos, #nivelacion, #asesorias, #agentes) y marcar una sola seria mentir
    sobre por donde llego la persona.
    """
    return url is not None and href == url


def construir_nav(url):
    filas = []
    for etiqueta, ref, descriptor, items in NAV:
        if items is None:
            act = ' aria-current="page"' if es_actual(ref, url) else ''
            filas.append(u'    <li><a href="%s"%s>%s</a></li>' % (ref, act, etiqueta))
            continue
        hay_actual = any(es_actual(h, url) for _, h in items)
        clase = ' nav__group--current' if hay_actual else ''
        enlaces = u''.join(
            u'<li><a href="%s"%s>%s</a></li>' % (
                h, ' aria-current="page"' if es_actual(h, url) else '', t)
            for t, h in items
        )
        filas.append(
            u'    <li class="nav__group%s">\n'
            u'      <button class="nav__btn" type="button" aria-expanded="false" aria-controls="%s">%s</button>\n'
            u'      <div class="nav__panel" id="%s" hidden><p class="nav__panel-t">%s</p><ul>%s</ul></div>\n'
            u'    </li>' % (clase, ref, etiqueta, ref, descriptor, enlaces)
        )
    cta_act = ' aria-current="page"' if es_actual(CTA[1], url) else ''
    filas.append(u'    <li><a class="nav__cta" href="%s"%s>%s</a></li>' % (CTA[1], cta_act, CTA[0]))

    return (
        u'<header class="nav">\n'
        u'  <a class="nav__brand" href="/">\n'
        u'    <img class="nav__logo" src="/assets/logo-color-mark.png" alt="W-IT" width="746" height="557">\n'
        u'    <span class="nav__tag">Adopción y<br>Formación</span>\n'
        u'    <img class="nav__partner" src="/assets/ms-solutions-partner.png" alt="Microsoft Solutions Partner" width="925" height="420">\n'
        u'  </a>\n'
        u'  <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menú"><span></span><span></span><span></span></button>\n'
        u'  <ul class="nav__links" id="menu">\n'
        + u'\n'.join(filas) + u'\n'
        u'  </ul>\n'
        u'</header>'
    )


def construir_footer(url, minimo=False):
    if minimo:
        return (
            u'<footer class="footer">\n'
            u'  <div class="wrap">\n'
            u'    <div class="footer__legal" style="margin-top: 0; padding-top: 0; border-top: 0">%s</div>\n'
            u'  </div>\n'
            u'</footer>' % LEGAL_404
        )
    cols = []
    for titulo, items in FOOTER_COLS:
        lis = u''.join(
            u'<li><a href="%s"%s>%s</a></li>' % (
                h, ' aria-current="page"' if es_actual(h, url) else '', t)
            for t, h in items
        )
        cols.append(u'        <div><p class="footer__col-t">%s</p><ul>%s</ul></div>' % (titulo, lis))
    return (
        u'<footer class="footer">\n'
        u'  <div class="wrap">\n'
        u'    <div class="footer__row">\n'
        u'      <div>\n'
        u'        <img class="footer__logo" src="/assets/logo-white-mark.png" alt="W-IT" width="746" height="557">\n'
        u'        <p class="footer__tag">Adopción y Formación</p>\n'
        u'        <p class="footer__claim">We Make It Simple</p>\n'
        u'      </div>\n'
        u'      <nav class="footer__links" aria-label="Enlaces del pie de página">\n'
        + u'\n'.join(cols) + u'\n'
        u'      </nav>\n'
        u'    </div>\n'
        u'    <div class="footer__legal">%s</div>\n'
        u'  </div>\n'
        u'</footer>' % LEGAL
    )


RE_NAV = re.compile(r'<header class="nav">.*?</header>', re.S)
RE_FOOTER = re.compile(r'<footer class="footer">.*?</footer>', re.S)


def main():
    solo_check = '--check' in sys.argv
    desfasadas, tocadas = [], []
    for archivo, url in sorted(PAGINAS.items()):
        ruta = os.path.join(RAIZ, archivo)
        s = original = io.open(ruta, encoding='utf-8').read()

        if len(RE_NAV.findall(s)) != 1:
            raise SystemExit('ERROR: %s no tiene exactamente un <header class="nav">' % archivo)
        if len(RE_FOOTER.findall(s)) != 1:
            raise SystemExit('ERROR: %s no tiene exactamente un <footer class="footer">' % archivo)

        s = RE_NAV.sub(lambda m: construir_nav(url), s, count=1)
        s = RE_FOOTER.sub(lambda m: construir_footer(url, minimo=(archivo == '404.html')), s, count=1)

        if s == original:
            continue
        desfasadas.append(archivo)
        if not solo_check:
            io.open(ruta, 'w', encoding='utf-8', newline='').write(s)
            tocadas.append(archivo)

    if solo_check:
        if desfasadas:
            print('DESFASADAS (%d):' % len(desfasadas))
            for f in desfasadas:
                print('  ' + f)
            raise SystemExit(1)
        print('OK: las %d paginas tienen la nav y el footer al dia.' % len(PAGINAS))
    else:
        print('Actualizadas %d de %d paginas:' % (len(tocadas), len(PAGINAS)))
        for f in tocadas:
            print('  ' + f)
        if not tocadas:
            print('  (ninguna: ya estaban al dia)')


if __name__ == '__main__':
    main()
