"""Portão de qualidade: roda antes de publicar e barra deploys quebrados.

Uso: python3 scripts/predeploy.py [url]
Sai com código 1 quando qualquer checagem falha.
"""
import sys
import time

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
FAILS = []


def fail(msg):
    FAILS.append(msg)
    print("FALHA:", msg)


def ok(msg):
    print("ok:", msg)


with sync_playwright() as p:
    browser = p.chromium.launch(
        args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
    )
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:160]))
    page.goto(URL, wait_until="load", timeout=90000)

    # 1) a cena precisa inicializar
    ready = False
    for _ in range(45):
        if page.evaluate("()=>!!window.__gettmsInfo"):
            ready = True
            break
        page.wait_for_timeout(1000)
    if ready:
        ok("cena inicializada")
    else:
        fail("cena não inicializou em 45 s")

    # 2) nenhum erro de execução (inclui TDZ, módulo e shader)
    if errors:
        fail(f"erros no console: {errors[:2]}")
    else:
        ok("sem erros de execução")

    # 3) canvas visível
    page.wait_for_timeout(3000)
    opacity = page.evaluate(
        "()=>{const c=document.querySelector('canvas');return c?parseFloat(getComputedStyle(c).opacity):0}"
    )
    if opacity and opacity > 0.3:
        ok(f"canvas visível (opacidade {opacity:.2f})")
    else:
        fail("canvas não apareceu")

    # 4) dois ciclos completos sem crescimento anormal de GPU
    def geo():
        return page.evaluate("()=>(window.__gettmsInfo||{}).geometries||0")

    def cycle():
        for f in (0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.6, 1.0):
            page.evaluate(
                """(f)=>{const s=document.getElementById('experiencia');
                const t=s.offsetHeight-window.innerHeight;
                window.scrollTo({top:s.offsetTop+t*f,behavior:'instant'});}""",
                f,
            )
            page.wait_for_timeout(1600)

    cycle()  # aquecimento: modelos terminam de chegar
    page.wait_for_timeout(4000)
    cycle()
    first = geo()
    cycle()
    second = geo()
    growth = second - first
    print(f"geometrias: {first} -> {second} (delta {growth})")
    if growth > 120:
        fail(f"crescimento de geometrias acima do limite: +{growth}")
    else:
        ok(f"crescimento de geometrias dentro do limite (+{growth})")

    browser.close()

print("\nRESULTADO:", "APROVADO" if not FAILS else f"REPROVADO ({len(FAILS)} falha(s))")
sys.exit(1 if FAILS else 0)
