"""Deriva los logos de Claude y Anthropic que usa el sitio, desde los originales
de esta misma carpeta.

Los originales vienen con fondo plano (blanco o el crema #FAF9F5 de Anthropic) y
con mucho aire alrededor. Sobre el blanco y el #FAFAFA del sitio ese fondo se ve
como un recuadro sucio, asi que se recorta el aire y se vuelve transparente el
fondo. No se recolorea ni se deforma nada: solo se quita fondo y padding.

Uso:  python tools/logos/prep-logos.py
Salida: assets/claude-logo.webp, assets/claude-mark.webp, assets/anthropic-wordmark.webp
"""
import os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(os.path.dirname(os.path.dirname(AQUI)), 'assets')


def quitar_fondo(im, tol=18):
    """Vuelve transparente todo pixel cercano al color de la esquina superior izquierda.

    El margen entre `tol` y `tol*3` se pasa a alfa proporcional, para no dejar un
    borde dentado en los trazos curvos de la estrella y de la tipografia.
    """
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    br, bg, bb = px[0, 0][:3]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = max(abs(r - br), abs(g - bg), abs(b - bb))
            if d <= tol:
                px[x, y] = (r, g, b, 0)
            elif d < tol * 3:
                px[x, y] = (r, g, b, int(255 * (d - tol) / (tol * 2)))
    return im


def recortar(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def guardar(im, nombre, alto):
    w = round(im.size[0] * alto / im.size[1])
    im = im.resize((w, alto), Image.LANCZOS)
    ruta = os.path.join(ASSETS, nombre + '.webp')
    im.save(ruta, 'WEBP', quality=92, method=6)
    print('%-26s %sx%s  %5d b' % (nombre + '.webp', im.size[0], im.size[1],
                                  os.path.getsize(ruta)))


# --- Claude: lockup horizontal y la estrella suelta -------------------------
claude = quitar_fondo(Image.open(os.path.join(AQUI, 'logoclaude.png')), tol=20)
guardar(recortar(claude), 'claude-logo', alto=96)

# La estrella ocupa aproximadamente el primer 27% del ancho del lockup.
w, h = claude.size
guardar(recortar(claude.crop((0, 0, int(w * 0.27), h))), 'claude-mark', alto=96)

# --- Anthropic: wordmark (el original es una tarjeta OG, casi todo aire) ----
ant = quitar_fondo(Image.open(os.path.join(AQUI, 'logoanthropic2.jpg')), tol=14)
guardar(recortar(ant), 'anthropic-wordmark', alto=48)
