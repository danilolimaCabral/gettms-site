"""Gera dist/index.html já renderizado (SEO para crawlers e primeiro paint).

Sobe um servidor estático temporário em dist/, abre a página com Chromium,
espera o React montar e salva o HTML final de volta em dist/index.html.
O React continua hidratando normalmente no navegador.
"""
import functools
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist", "public")
PORT = 4391


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=DIST)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    if not os.path.isdir(DIST):
        sys.exit("dist/ não existe: rode o build antes do prerender")
    httpd = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox",
        ])
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="load", timeout=90000)
        page.wait_for_timeout(6000)
        page.wait_for_selector("main#conteudo", timeout=30000)
        html = page.evaluate("""() => {
            document.querySelectorAll('script[data-prerender]').forEach((s) => s.remove());
            document.documentElement.removeAttribute('style');
            document.body.removeAttribute('style');
            document.body.classList.remove('overflow-hidden');
            return '<!doctype html>\\n' + document.documentElement.outerHTML;
        }""")
        browser.close()
    httpd.shutdown()
    with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(html)
    size = len(html.encode("utf-8"))
    has_hero = "Menos custo" in html
    print(f"prerender: dist/index.html {size / 1024:.0f} KB · hero presente: {has_hero}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # ambiente sem Chromium (ex.: build da Vercel)
        print(f"prerender: ignorado ({type(exc).__name__}: {exc}) — o HTML estático do #root continua servindo de fallback")
        sys.exit(0)
