#!/usr/bin/env python3
"""Static server for the built `dist/`, matching GitHub Pages' resolution.

`python -m http.server` 404s on extensionless routes; Pages serves
`/reviews/x` from the prerendered `reviews/x.html` and unknown paths from
`404.html`. This mirrors both so local previews behave like prod.
Usage: preview-spa.py [port] [dir]
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, test

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
os.chdir(sys.argv[2] if len(sys.argv) > 2 else "dist")


class SPAHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        # Extensionless miss: a prerendered page (path.html) — else a real 404.
        if not os.path.exists(path) and "." not in os.path.basename(path):
            stripped = self.path.split("?")[0].split("#")[0].rstrip("/")
            if os.path.exists(path.rstrip("/") + ".html"):
                self.path = stripped + ".html"
            elif os.path.exists("404.html"):
                self.path = "/404.html"
            else:
                self.path = "/index.html"  # pre-prerender build: SPA fallback
        return super().send_head()


test(HandlerClass=SPAHandler, port=port)
