"""Serve the extension test harnesses with the URL mapping the tests expect.

/watch.html       -> harness.html   (pathname == "/watch" so isWatchPage() passes)
/watch_late.html  -> harness_late.html
/content.js       -> repo-root content.js (harness includes ../content.js)
/content.css      -> repo-root content.css
Anything else     -> file in test/ (e.g. /harness.html)
"""
import http.server
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
MAP = {
    "/watch.html": ("harness.html", ROOT),
    "/watch_late.html": ("harness_late.html", ROOT),
    "/content.js": ("content.js", REPO),
    "/content.css": ("content.css", REPO),
}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path in MAP:
            name, base = MAP[path]
            body = open(os.path.join(base, name), "rb").read()
            ctype = ("text/html" if path.endswith(".html")
                     else "text/javascript" if path.endswith(".js")
                     else "text/css")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"nf")

    def log_message(self, *a):
        pass


http.server.HTTPServer(("127.0.0.1", 8931), Handler).serve_forever()
