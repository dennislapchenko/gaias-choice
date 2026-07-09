#!/usr/bin/env python3
"""Static server for the built `dist/` with SPA fallback, matching prod.

`python -m http.server` 404s on deep links (e.g. /reviews); the nginx runtime
and the Pages 404.html both serve index.html instead. This mirrors that so
local preview deep links resolve. Usage: preview-spa.py [port] [dir]
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, test

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
os.chdir(sys.argv[2] if len(sys.argv) > 2 else "dist")


class SPAHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        # Missing path with no file extension = a client route, not an asset.
        if not os.path.exists(path) and "." not in os.path.basename(path):
            self.path = "/index.html"
        return super().send_head()


test(HandlerClass=SPAHandler, port=port)
