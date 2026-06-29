import http.server
import socketserver
import sys

PORT = 5188

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests for resources (especially local web fonts)
        self.send_header('Access-Control-Allow-Origin', '*')
        # Force correct MIME type for JavaScript files and fonts
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.ttf'):
            self.send_header('Content-Type', 'font/ttf')
        elif self.path.endswith('.otf'):
            self.send_header('Content-Type', 'font/otf')
        super().end_headers()

# Add extension map override as well
http.server.SimpleHTTPRequestHandler.extensions_map.update({
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
})

# Allow reusing the address immediately
socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving Dhandu Hisaabu on port {PORT} with correct MIME types...")
        httpd.serve_forever()
except Exception as e:
    print(f"Error starting server: {e}", file=sys.stderr)
    sys.exit(1)
