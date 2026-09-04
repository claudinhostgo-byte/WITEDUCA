# -*- coding: utf-8 -*-
"""Servidor local para revisar el sitio, sin cache.

`python -m http.server` no manda cabeceras de cache, asi que el navegador
decide por su cuenta y se queda con el site.js y el site.css viejos. Eso da
falsos negativos: cambias algo, recargas y sigues viendo lo anterior.

Este servidor manda Cache-Control: no-store en todo, asi que cada recarga trae
los archivos frescos. Es solo para desarrollo; en produccion las cabeceras las
pone Azure Static Web Apps.

Uso:  python tools/dev/serve.py [puerto]     (por defecto 8765)
      luego abrir http://127.0.0.1:8765/
"""
import functools
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        SimpleHTTPRequestHandler.end_headers(self)

    def guess_type(self, path):
        # SimpleHTTPRequestHandler no conoce .webp en todas las versiones de Python.
        if path.endswith('.webp'):
            return 'image/webp'
        return SimpleHTTPRequestHandler.guess_type(self, path)


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(SinCache, directory=RAIZ)
    srv = HTTPServer(('127.0.0.1', puerto), handler)
    print('Sirviendo %s en http://127.0.0.1:%d/  (sin cache)' % (RAIZ, puerto))
    print('Ctrl+C para detener.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nDetenido.')


if __name__ == '__main__':
    main()
