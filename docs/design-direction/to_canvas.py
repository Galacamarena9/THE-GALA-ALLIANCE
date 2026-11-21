"""Convierte los prototipos HTML en artboards .dc.html del canvas de Design (paquete de aprobación)."""
import json, re, sys
from pathlib import Path

SRC = Path(__file__).parent / "prototypes"
OUT = Path(sys.argv[1]) / "project"
OUT.mkdir(parents=True, exist_ok=True)
BLOB = {
    "fonts/inter.woff2": "/_blob/621e1cdc163ada69fc8f0f6a2ffde266",
    "fonts/barlow-600.woff2": "/_blob/a9e6f2b8726d188ad6eaea2345f054cf",
    "fonts/barlow-700.woff2": "/_blob/ef791f6d7ee1da5c9bd9448d1312172c",
    "media/arena-bg-sm.webp": "/_blob/54b6fda2bcfe2a7b58656a1cfa29a0c0",
}
BA = [("Portada", "ac072ce5cb8c103ba61d43eafe582e71"), ("Página de agentes → portada agent-first", "67e0c70fa6a2fa26aef70f0e27851911"),
      ("Inicio del agente", "c1fc0c1999a85c9955f32c50bd46c8af"), ("Mis atletas", "ebceb7664d67446a731dc54b1f80995f"),
      ("Procesos", "6c9ad6c055564f13458de8b56dd6a694"), ("Oportunidades", "18e8ba6ce8775d570c308b0add25a349"),
      ("Inicio del atleta", "5271f83321419f4f27d5152b134db97d"), ("Inicio de la universidad", "6363f6e57623a51b840b79660752ff82")]

css = (SRC / "gala.css").read_text()
for k, v in BLOB.items():
    css = css.replace(f"url({k})", f"url({v})")
# En el canvas el menú no es fijo ni de alto de ventana.
css += "\n.rail { position: static !important; height: auto !important; } .app { min-height: 900px !important; } .top { position: static !important; }\n"


def fix(markup: str) -> str:
    markup = re.sub(r'aria-current=page', 'aria-current="page"', markup)
    markup = re.sub(r'class=count', 'class="count"', markup)
    markup = markup.replace('<label class="t-13"><input type="checkbox" checked> Solo organizaciones verificadas</label>',
                            '<p class="t-13" style="margin:0">✓ Solo organizaciones verificadas</p>')
    for k, v in BLOB.items():
        markup = markup.replace(f"url({k})", f"url({v})")
    return markup


def page(title, extra_css, body, w, h):
    props = json.dumps({"$preview": {"width": w, "height": h}})
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{{margin:0}}
a{{color:#3d2fd1}}a:hover{{color:#2f23b3}}
{css}
{extra_css}
</style>
</helmet>
<div style="width: 100%; font-family: Inter, system-ui, sans-serif; color: #111318">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{props}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
"""


FILES = [("index.html", "Main.dc.html", "Portada pública (agent-first)", 1396), ("agent-home.html", "AgentHome.dc.html", "Inicio del agente", 1112),
         ("my-athletes.html", "MyAthletes.dc.html", "Mis atletas", 900), ("athlete-360.html", "Athlete360.dc.html", "Ficha 360 del atleta", 900),
         ("opportunities.html", "Opportunities.dc.html", "Oportunidades", 900), ("pipeline.html", "Pipeline.dc.html", "Procesos", 900),
         ("athlete-home.html", "AthleteHome.dc.html", "Inicio del atleta", 900), ("university-home.html", "UniversityHome.dc.html", "Inicio de la universidad", 900)]
boards, order = {}, []
for i, (src, dst, title, h) in enumerate(FILES):
    html = (SRC / src).read_text()
    extra = "\n".join(re.findall(r"<style>(.*?)</style>", html, re.S))
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    (OUT / dst).write_text(page(title, fix(extra), fix(body), 1440, h))
    row, col = divmod(i, 4)
    boards[dst] = {"x": col * 1520, "y": row * 1900, "w": 1440, "h": h, "title": title, "expand": "fill"}
    order.append(dst)

ba_body = '<div style="background:#f6f6f3;padding:48px;display:flex;flex-direction:column;gap:40px">' \
    '<div><p class="kicker">Paquete de aprobación · Prompt 3</p><h1 class="display d-56" style="margin-top:8px">Antes y después</h1>' \
    '<p class="muted t-16" style="max-width:820px">Izquierda: la app actual (preview con datos de ejemplo; sin barra lateral). Derecha: la dirección Matchday Ops. Datos ficticios. La ficha 360 no tiene «antes»: hoy no existe con ofertas, documentos ni mensajes.</p></div>' + \
    "".join(f'<section style="display:flex;flex-direction:column;gap:12px"><h2 class="t-20" style="font-weight:650">{t}</h2>'
            f'<img src="/_blob/{b}" alt="Antes y después: {t}" style="width:100%;height:auto;border-radius:12px;border:1px solid #e4e4de"></section>' for t, b in BA) + "</div>"
(OUT / "AntesDespues.dc.html").write_text(page("Antes y después", "", ba_body, 1440, 4400))
boards["AntesDespues.dc.html"] = {"x": 0, "y": 3800, "w": 1440, "h": 4400, "title": "Antes y después", "expand": "fill"}
order.append("AntesDespues.dc.html")

notes = {
    "t1": {"x": 0, "y": -300, "text": "Matchday Ops · marketing y agente", "kind": "title1", "maxW": 5920},
    "t2": {"x": 0, "y": 1600, "text": "Agente, atleta y universidad", "kind": "title1", "maxW": 5920},
    "t3": {"x": 0, "y": 3500, "text": "Paquete de aprobación", "kind": "title1", "maxW": 1440},
    "n1": {"x": 1520, "y": 3800, "w": 520, "size": "m", "fill": "blue", "text": "Dirección ganadora: Mesa de operaciones con capa de marca nocturna (8,40/10 en la matriz ponderada). Lienzo claro y denso para trabajar; noche y lima para marca, raíl y un héroe por pantalla. Firma propia: procedencia de cada dato (● validado, ◐ documentado, ○ declarado). Detalle completo: docs/design-direction/README.md del repositorio."},
}
canvas = {"v": 3, "createdOnFiles": {"v": 1, "at": "2026-11-21T08:40:00Z"}, "title": "The Gala Alliance · Matchday Ops (Prompt 3)",
          "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": order, "notes": notes, "designSystems": []}
(OUT / "canvas.json").write_text(json.dumps(canvas, ensure_ascii=False, indent=1))
print("ok", order)
