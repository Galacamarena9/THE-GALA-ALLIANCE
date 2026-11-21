"""Genera los 8 prototipos de «Matchday Ops» (HTML estático, datos ficticios). python3 build.py"""
from pathlib import Path

OUT = Path(__file__).parent / "prototypes"

ICONS = {
    "home": '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    "users": '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>',
    "flow": '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="6" rx="1.5"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "trophy": '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    "chat": '<path d="M4 5h16v11H8l-4 4z"/>',
    "doc": '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    "id": '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>',
    "spark": '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    "campus": '<path d="M3 10l9-5 9 5-9 5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/>',
    "bell": '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "euro": '<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>',
    "cal": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
}
SPRITE = '<svg style="display:none" aria-hidden="true">' + "".join(f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + "</svg>"
ic = lambda n, cls="ico": f'<svg class="{cls}" aria-hidden="true"><use href="#i-{n}"/></svg>'

AGENT_NAV = [("home", "Hoy", "agent-home.html", 3), ("users", "Mis atletas", "my-athletes.html", None), ("flow", "Procesos", "pipeline.html", None),
             ("trophy", "Oportunidades", "opportunities.html", None), ("search", "Buscar talento", "#", None), ("chat", "Mensajes", "#", 2),
             ("doc", "Documentos", "#", None)]
ATHLETE_NAV = [("home", "Inicio", "athlete-home.html", None), ("id", "Mi Passport", "#", None), ("spark", "Gala Match", "#", None),
               ("flow", "Mis procesos", "#", None), ("trophy", "Oportunidades", "#", None), ("chat", "Mensajes", "#", 1)]
UNI_NAV = [("home", "Hoy", "university-home.html", None), ("search", "Descubrir atletas", "#", None), ("list", "Listas", "#", None),
           ("users", "Candidatos", "#", None), ("trophy", "Nuestras becas", "#", None), ("chat", "Mensajes", "#", 4)]


def shell(title, nav, current, org, body, tabbar, who="CR"):
    links = "".join(
        f'<a href="{h}"{" aria-current=page" if l == current else ""}>{ic(i)}<span>{l}</span>{f"<b class=count>{c}</b>" if c else ""}</a>'
        for i, l, h, c in nav)
    tabs = "".join(f'<a href="#"{" aria-current=page" if j == 0 else ""}>{ic(i)}{l}</a>' for j, (i, l) in enumerate(tabbar))
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Prototipo Matchday Ops</title><link rel="stylesheet" href="gala.css"></head><body>{SPRITE}
<div class="app"><nav class="rail" aria-label="Principal"><div class="brand"><i>G</i><span>THE GALA ALLIANCE</span></div>{links}
<div class="sep"></div><a href="#">{ic("spark")}<span>Gala IA</span></a><div class="org">{org}</div></nav>
<div class="main"><header class="top"><div class="search">{ic("search")}Buscar atleta, universidad o proceso…<kbd>⌘K</kbd></div>
<span class="demo hide-m">Prototipo · datos ficticios</span><span style="margin-left:auto"></span>{ic("bell")}<span class="avatar">{who}</span></header>
<main class="content">{body}</main></div></div><nav class="tabbar" aria-label="Accesos rápidos">{tabs}</nav></body></html>"""


AG_TABS = [("home", "Hoy"), ("users", "Atletas"), ("flow", "Procesos"), ("chat", "Mensajes")]
AG_ORG = "Norte Sports Management<small>Agencia verificada · 3 agentes</small>"

CREST = {"MJ": "basket", "DK": "football", "SM": "volley", "LF": "tennis", "NV": "swim", "AR": "athletics"}
crest = lambda i: f'<span class="crest" style="background:var(--{CREST.get(i, "night-2")})">{i}</span>'

# ---------------------------------------------------------------- 1. Portada pública (agent-first)
HOME = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portada · Prototipo Matchday Ops</title><link rel="stylesheet" href="gala.css"><style>
.pub-top{{display:flex;align-items:center;gap:28px;padding:18px 40px;color:var(--on-night)}} .pub-top nav{{display:flex;gap:22px;font-size:14px;color:var(--on-night-2)}}
.mk{{background:var(--night) url(media/arena-bg-sm.webp) center/cover;background-blend-mode:soft-light;color:var(--on-night)}}
.mk-hero{{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center;padding:56px 40px 72px;max-width:1360px;margin:0 auto}}
.shot{{background:var(--canvas);border-radius:16px;box-shadow:var(--shadow-pop);overflow:hidden;color:var(--text);transform:perspective(1600px) rotateY(-8deg) rotateX(3deg)}}
.shot .chrome{{background:var(--night);height:28px;display:flex;gap:6px;align-items:center;padding:0 12px}} .shot .chrome i{{width:9px;height:9px;border-radius:50%;background:#3a3670}}
.proof{{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--hairline);border-radius:var(--r-card);overflow:hidden;margin-top:-40px;position:relative;max-width:1280px;margin-left:auto;margin-right:auto}}
.proof div{{background:var(--surface);padding:24px}} .sec{{max-width:1280px;margin:0 auto;padding:72px 40px}}
.actors{{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:16px}}
@media(max-width:1100px){{.mk-hero{{grid-template-columns:1fr}}.shot{{transform:none}}.actors{{grid-template-columns:1fr 1fr}}.pub-top nav{{display:none}}}} .actor{{border:1px solid var(--hairline);border-radius:var(--r-card);padding:20px;background:var(--surface)}}
.actor.main{{background:var(--night);color:var(--on-night);border:0}}
@media(max-width:720px){{.pub-top nav,.pub-top .btn-ghost,.pub-top .btn-dark-ghost{{display:none}}.pub-top{{padding:14px 16px}}.mk-hero{{grid-template-columns:1fr;padding:28px 16px 64px;gap:28px}}.shot{{transform:none}}
.proof{{grid-template-columns:1fr;margin:-32px 16px 0}}.sec{{padding:48px 16px}}.actors{{grid-template-columns:1fr}}}}
</style></head><body>{SPRITE}
<div class="mk"><header class="pub-top"><div class="brand" style="padding:0"><i>G</i>THE GALA ALLIANCE</div>
<nav><a>Agencias</a><a>Universidades</a><a>Atletas y familias</a><a>Precios</a><a>Seguridad</a></nav><span style="margin-left:auto"></span>
<a class="btn btn-dark-ghost btn-sm">Entrar</a><a class="btn btn-lime btn-sm">Probar gratis</a></header>
<section class="mk-hero"><div><p class="kicker" style="color:var(--lime)">Para agencias deportivas</p>
<h1 class="display d-72" style="margin:14px 0 18px">Todos tus atletas.<br>Cada universidad.<br><span style="color:var(--lime)">Ningún plazo perdido.</span></h1>
<p class="t-20" style="color:var(--on-night-2);max-width:520px;margin:0 0 28px">Cartera, procesos, ofertas y documentos de toda tu agencia en un solo tablero. Datos verificados y siempre con el permiso del atleta.</p>
<div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-lime">Crear cuenta de agencia {ic("arrow")}</a><a class="btn btn-dark-ghost">Ver demo de 3 min</a></div>
<p class="t-13" style="color:var(--on-night-2);margin-top:18px">Gratis hasta el 31 de marzo de 2027 · sin comisión por atleta</p></div>
<div class="shot" aria-label="Vista del producto"><div class="chrome"><i></i><i></i><i></i></div><div style="padding:18px">
<p class="kicker">Hoy · 3 urgentes</p><ul class="rows panel" style="margin-top:10px">
<li class="row urgent">{'<span class="bar"></span>'}{crest("MJ")}<div><b>Enviar highlights al coach de Gonzaga</b><div class="meta">Marcos Jiménez · Baloncesto 2027</div></div><span class="when urgent">Vencido</span><a class="btn btn-primary btn-sm">Hacer</a></li>
<li class="row warn"><span class="bar"></span>{crest("DK")}<div><b>Oferta de Lakeshore caduca</b><div class="meta">Daniel Kim · 18.000 $/año</div></div><span class="when">2 días</span><a class="btn btn-ghost btn-sm">Revisar</a></li>
<li class="row"><span class="bar"></span>{crest("SM")}<div><b>Falta expediente traducido</b><div class="meta">Sofía Martín · Northfield</div></div><span class="when">5 días</span><a class="btn btn-ghost btn-sm">Pedir</a></li></ul></div></div></section></div>
<div class="proof"><div><p class="num" style="font-size:40px">1 tablero</p><p class="muted">para toda la cartera: estado, siguiente paso y responsable de cada atleta.</p></div>
<div><p class="num" style="font-size:40px">Cada plazo avisado</p><p class="muted">Ofertas que caducan, documentos que faltan y respuestas sin leer, ordenados por urgencia.</p></div>
<div><p class="num" style="font-size:40px">Datos con origen</p><p class="muted">Cada dato dice si es declarado, documentado o validado por su club.</p></div></div>
<section class="sec"><p class="kicker">Hecho para cada actor</p><h2 class="display d-40" style="margin:8px 0 24px">Una red. Un idioma.</h2>
<div class="actors"><div class="actor main"><p class="kicker" style="color:var(--lime)">Agencias</p><h3 class="display d-28" style="margin:8px 0">Tu herramienta de trabajo</h3><p style="color:var(--on-night-2)">Cartera, procesos, ofertas, documentos y equipo. Desde 39 €/mes por agente.</p><a class="btn btn-lime btn-sm" style="margin-top:8px">Ver planes de agencia</a></div>
<div class="actor"><p class="kicker">Universidades</p><h3 class="t-16" style="margin:8px 0">Talento comparable y verificado</h3><p class="muted t-13">Filtra por posición, físico, nivel e inglés.</p></div>
<div class="actor"><p class="kicker">Atletas</p><h3 class="t-16" style="margin:8px 0">Tu Passport, gratis siempre</h3><p class="muted t-13">Tú decides quién ve cada dato.</p></div>
<div class="actor"><p class="kicker">Familias</p><h3 class="t-16" style="margin:8px 0">Coste real y control</h3><p class="muted t-13">Nada se comparte sin vuestra aprobación.</p></div></div></section>
<p class="footer-note" style="text-align:center;padding-bottom:24px">Prototipo · datos ficticios · precios de /precios (programa fundador)</p></body></html>"""

# ---------------------------------------------------------------- 2. Agent Home
AGENT_HOME = shell("Hoy", AGENT_NAV, "Hoy", AG_ORG, f"""
<div class="page-head"><div><p class="kicker">Sábado 21 nov</p><h1 class="display d-40" style="margin-top:6px">Buenos días, Carlos</h1></div>
<div style="display:flex;gap:8px"><a class="btn btn-ghost">{ic("plus")}Nueva tarea</a><a class="btn btn-primary">{ic("search")}Buscar talento</a></div></div>
<section class="panel" aria-labelledby="hoy"><div class="panel-h"><h2 id="hoy">Hoy necesita tu atención <span class="chip urgent" style="margin-left:6px">3 urgentes</span></h2><a class="link t-13">Ver las 9</a></div>
<ul class="rows">
<li class="row urgent"><span class="bar"></span>{crest("MJ")}<div><b>Enviar highlights al coach de Gonzaga</b><div class="meta">Marcos Jiménez · Baloncesto · Promoción 2027 · lo pidió el coach el 18 nov</div></div><span class="when urgent">Vencido</span><a class="btn btn-primary btn-sm">Enviar vídeo</a></li>
<li class="row urgent"><span class="bar"></span>{crest("DK")}<div><b>Oferta de Lakeshore College caduca</b><div class="meta">Daniel Kim · 18.000 $/año · renovable · <span class="prov d">Documentada</span></div></div><span class="when urgent">En 2 días</span><a class="btn btn-primary btn-sm">Revisar oferta</a></li>
<li class="row urgent"><span class="bar"></span>{crest("SM")}<div><b>Northfield pide el expediente traducido</b><div class="meta">Sofía Martín · admisión bloqueada hasta recibirlo</div></div><span class="when urgent">En 3 días</span><a class="btn btn-primary btn-sm">Pedir a la familia</a></li>
<li class="row warn"><span class="bar"></span>{crest("LF")}<div><b>Respuesta nueva del asistente de Saint Mary's</b><div class="meta">Lucía Ferrer · «Nos encaja para 2027, ¿podéis hacer visita en enero?»</div></div><span class="when">Hoy 09:12</span><a class="btn btn-ghost btn-sm">Responder</a></li>
<li class="row"><span class="bar"></span>{crest("NV")}<div><b>Llamada con el coach de Pinecrest</b><div class="meta">Nora Vidal · Natación · preparada por Ana (tu equipo)</div></div><span class="when">Lun 23</span><a class="btn btn-ghost btn-sm">Ver notas</a></li>
</ul></section>
<div class="kpis" style="margin-top:20px">
<div class="kpi"><p class="kicker">Atletas</p><div class="num">12</div><p>3 en búsqueda activa</p></div>
<div class="kpi"><p class="kicker">Procesos abiertos</p><div class="num">27</div><p><span style="color:var(--urgent);font-weight:600">4 parados +14 días</span></p></div>
<div class="kpi"><p class="kicker">Ofertas vivas</p><div class="num">5</div><p>91.000 $/año en becas</p></div>
<div class="kpi"><p class="kicker">Documentos pendientes</p><div class="num">7</div><p>2 bloquean admisión</p></div></div>
<div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:20px">
<section class="panel"><div class="panel-h"><h2>Mis atletas por estado</h2><a class="link t-13">Abrir cartera</a></div><table class="table-m"><thead><tr><th>Atleta</th><th class="hide-m">Fase</th><th>Siguiente paso</th></tr></thead><tbody>
<tr><td><div class="who">{crest("MJ")}<div><b>Marcos Jiménez</b><small>Base · 2027</small></div></div></td><td class="hide-m"><span class="chip action">Ofertas (2)</span></td><td class="t-13">Decidir antes del 30 nov</td></tr>
<tr><td><div class="who">{crest("DK")}<div><b>Daniel Kim</b><small>Delantero · 2027</small></div></div></td><td class="hide-m"><span class="chip warn">Visita</span></td><td class="t-13">Visita oficial 4 dic</td></tr>
<tr><td><div class="who">{crest("SM")}<div><b>Sofía Martín</b><small>Receptora · 2028</small></div></div></td><td class="hide-m"><span class="chip">En contacto (4)</span></td><td class="t-13">Expediente traducido</td></tr></tbody></table></section>
<section class="panel"><div class="panel-h"><h2>Nuevos que encajan</h2><a class="link t-13">Búsqueda guardada</a></div><ul class="rows">
<li class="row" style="grid-template-columns:36px 1fr auto">{crest("AR")}<div><b>Álex Romero</b><div class="meta">400 m · 2027 · <span class="prov v">Marcas validadas</span></div></div><a class="btn btn-ghost btn-sm">Proponer</a></li>
<li class="row" style="grid-template-columns:36px 1fr auto">{crest("NV")}<div><b>Irene Costa</b><div class="meta">Velocista · 2027 · <span class="prov s">Declarado</span></div></div><a class="btn btn-ghost btn-sm">Proponer</a></li></ul></section></div>
<p class="footer-note">Prioridad calculada con reglas fijas y explicables: vencido → caduca ≤ 3 días → bloquea admisión → respuesta nueva.</p>""", AG_TABS)

# ---------------------------------------------------------------- 3. Mis atletas
ATHLETES = [("MJ", "Marcos Jiménez", "Baloncesto · Base", "2027", "1,93 m", "ES", "Ofertas (2)", "action", "Decidir antes del 30 nov", "Carlos", "v"),
            ("DK", "Daniel Kim", "Fútbol · Delantero", "2027", "1,81 m", "KR", "Visita", "warn", "Visita oficial 4 dic", "Ana", "d"),
            ("SM", "Sofía Martín", "Voleibol · Receptora", "2028", "1,84 m", "ES", "En contacto (4)", "", "Expediente traducido", "Carlos", "v"),
            ("LF", "Lucía Ferrer", "Tenis", "2027", "1,70 m", "ES", "Respuesta nueva", "urgent", "Responder a Saint Mary's", "Ana", "s"),
            ("NV", "Nora Vidal", "Natación · 400 m", "2026", "1,75 m", "PT", "Seguimiento", "", "Llamada lunes 23", "Ana", "v"),
            ("AR", "Álex Romero", "Atletismo · 400 m", "2027", "1,86 m", "AR", "Propuesta enviada", "", "Espera respuesta del atleta", "Carlos", "s")]
rows = "".join(f"""<tr><td><div class="who">{crest(i)}<div><b>{n}</b><small>{s}</small></div></div></td><td class="hide-m">{y}</td><td class="hide-m">{h}</td>
<td class="hide-m">{c}</td><td><span class="chip {t}">{ph}</span></td><td class="hide-m t-13">{nx}</td><td class="hide-m t-13">{o}</td><td class="hide-m"><span class="prov {p}">{ {"v":"Validado","d":"Documentado","s":"Declarado"}[p] }</span></td></tr>"""
               for i, n, s, y, h, c, ph, t, nx, o, p in ATHLETES)
MY_ATHLETES = shell("Mis atletas", AGENT_NAV, "Mis atletas", AG_ORG, f"""
<div class="page-head"><div><h1 class="display d-40">Mis atletas</h1><p class="muted" style="margin:6px 0 0">12 representados · 2 propuestas pendientes · 1 representación caduca en enero</p></div>
<div style="display:flex;gap:8px"><a class="btn btn-ghost">Exportar</a><a class="btn btn-primary">{ic("plus")}Añadir atleta</a></div></div>
<div class="tabs"><a aria-current="page">Todos<span class="n">12</span></a><a>Necesitan acción<span class="n">4</span></a><a>Con ofertas<span class="n">3</span></a><a>Propuestas<span class="n">2</span></a><a>Finalizados<span class="n">5</span></a></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><div class="search" style="max-width:320px">{ic("search")}Nombre, equipo o universidad</div>
<span class="chip">Deporte ▾</span><span class="chip">Promoción ▾</span><span class="chip">Responsable ▾</span><span class="chip action">Ordenar: siguiente plazo ▾</span></div>
<section class="panel"><table class="table-m"><thead><tr><th>Atleta</th><th class="hide-m">Promoción</th><th class="hide-m">Altura</th><th class="hide-m">País</th><th>Fase</th><th class="hide-m">Siguiente paso</th><th class="hide-m">Responsable</th><th class="hide-m">Datos</th></tr></thead><tbody>{rows}</tbody></table></section>
<p class="footer-note">Lista densa (fila de 56 px), una acción por fila al pasar el ratón; en móvil cada fila es una tarjeta de dos líneas.</p>""", AG_TABS)

# ---------------------------------------------------------------- 4. Athlete 360
ATH360 = shell("Marcos Jiménez", AGENT_NAV, "Mis atletas", AG_ORG, f"""
<p class="t-13 muted" style="margin:0 0 12px">Mis atletas / <b style="color:var(--text)">Marcos Jiménez</b></p>
<section class="hero-night" style="display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:center">
<span class="crest" style="width:72px;height:72px;font-size:28px;border-radius:16px;background:var(--basket)">MJ</span>
<div><h1 class="display d-40">Marcos Jiménez</h1><p class="muted" style="margin:6px 0 10px">Base · Baloncesto · Promoción 2027 · España · Club Ficticio Valencia</p>
<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip" style="background:#2a2470;color:var(--lime)">Representado hasta jun 2027</span><span class="chip" style="background:#2a2470;color:var(--on-night)">Mayor de edad</span><span class="chip" style="background:#2a2470;color:var(--on-night)">Permisos: procesos, ofertas, documentos</span></div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-lime">Decidir oferta</a><a class="btn btn-dark-ghost">Mensaje</a></div></section>
<div class="kpis" style="margin-top:16px"><div class="kpi"><p class="kicker">Altura</p><div class="num">1,93 m</div><p><span class="prov v">Validado por club</span></p></div>
<div class="kpi"><p class="kicker">Puntos/partido</p><div class="num">14,2</div><p><span class="prov v">Validado · 2025-26</span></p></div>
<div class="kpi"><p class="kicker">Inglés</p><div class="num">C1</div><p><span class="prov d">Certificado Cambridge</span></p></div>
<div class="kpi"><p class="kicker">GPA (aprox.)</p><div class="num">3,4</div><p><span class="prov s">Declarado · no oficial NCAA</span></p></div></div>
<div class="tabs" style="margin-top:20px"><a aria-current="page">Resumen</a><a>Procesos<span class="n">6</span></a><a>Ofertas<span class="n">2</span></a><a>Documentos<span class="n">1 falta</span></a><a>Mensajes<span class="n">3</span></a><a>Notas</a><a>Actividad</a></div>
<div class="grid" style="grid-template-columns:1.3fr 1fr">
<section class="panel"><div class="panel-h"><h2>Ofertas</h2><a class="link t-13">Comparar</a></div><table class="table-m"><thead><tr><th>Universidad</th><th>Ayuda/año</th><th class="hide-m">Coste neto</th><th class="hide-m">Caduca</th><th></th></tr></thead><tbody>
<tr><td><div class="who"><span class="crest" style="background:var(--night-2)">LC</span><div><b>Lakeshore College</b><small>NCAA D2 · renovable</small></div></div></td><td><b>18.000 $</b></td><td class="hide-m">20.000 $</td><td class="hide-m"><span class="chip urgent">30 nov</span></td><td><a class="btn btn-primary btn-sm">Revisar</a></td></tr>
<tr><td><div class="who"><span class="crest" style="background:var(--night-2)">NU</span><div><b>Northfield University</b><small>NCAA D1 · 1 año</small></div></div></td><td><b>24.000 $</b></td><td class="hide-m">31.000 $</td><td class="hide-m">15 dic</td><td><a class="btn btn-ghost btn-sm">Revisar</a></td></tr></tbody></table>
<p class="t-12 faint" style="padding:10px 18px;margin:0">Aceptar una oferta solo lo hace el atleta (o su familia si es menor). Tú ves, comparas y aconsejas.</p></section>
<section class="panel"><div class="panel-h"><h2>Siguiente</h2></div><ul class="rows">
<li class="row urgent" style="grid-template-columns:4px 1fr auto"><span class="bar"></span><div><b>Decidir oferta Lakeshore</b><div class="meta">Caduca el 30 nov · hablarlo con Marcos</div></div><a class="btn btn-ghost btn-sm">Hecho</a></li>
<li class="row warn" style="grid-template-columns:4px 1fr auto"><span class="bar"></span><div><b>Falta: carta de recomendación</b><div class="meta">La pide Northfield para admisión</div></div><a class="btn btn-ghost btn-sm">Pedir</a></li>
<li class="row" style="grid-template-columns:4px 1fr auto"><span class="bar"></span><div><b>Visita oficial Northfield</b><div class="meta">12–14 dic · viaje por confirmar</div></div><a class="btn btn-ghost btn-sm">Ver</a></li></ul></section></div>""", AG_TABS)

# ---------------------------------------------------------------- 5. Descubrir oportunidades (para un atleta)
OPPS = [("Northfield University", "NCAA D1 · Ohio · Baloncesto M", 86, "Alto", "24.000 $", "15 dic", "v"),
        ("Lakeshore College", "NCAA D2 · Michigan", 81, "Alto", "18.000 $", "30 nov", "v"),
        ("Pinecrest State", "NCAA D2 · Oregón", 74, "Medio", "Hasta 15.000 $", "10 ene", "d"),
        ("Harbor Tech", "NAIA · California", 63, "Bajo", "Sin publicar", "—", "s")]
opp_rows = "".join(f"""<tr><td><div class="who"><span class="crest" style="background:var(--night-2)">{n[:2].upper()}</span><div><b>{n}</b><small>{m}</small></div></div></td>
<td><span class="num" style="font-size:24px">{s}%</span></td><td class="hide-m"><span class="chip {'ok' if c=='Alto' else 'warn' if c=='Medio' else ''}">Confianza {c.lower()}</span></td>
<td class="hide-m">{a}</td><td class="hide-m">{d}</td><td class="hide-m"><span class="prov {p}">{ {"v":"Verificada","d":"Documentada","s":"Sin verificar"}[p] }</span></td><td><a class="btn btn-ghost btn-sm">Añadir a procesos</a></td></tr>""" for n, m, s, c, a, d, p in OPPS)
OPPORTUNITIES = shell("Oportunidades", AGENT_NAV, "Oportunidades", AG_ORG, f"""
<div class="page-head"><div><h1 class="display d-40">Oportunidades</h1><p class="muted" style="margin:6px 0 0">Para: <b style="color:var(--text)">Marcos Jiménez</b> ▾ · encaje calculado con su Passport y sus permisos</p></div>
<a class="btn btn-ghost">Guardar búsqueda</a></div>
<div class="grid" style="grid-template-columns:260px 1fr">
<aside class="panel hide-m" style="padding:18px;align-self:start"><p class="kicker">Filtros</p>
<p class="t-13" style="margin:14px 0 6px;font-weight:600">División</p><span class="chip action">NCAA D1</span> <span class="chip action">NCAA D2</span> <span class="chip">NAIA</span>
<p class="t-13" style="margin:14px 0 6px;font-weight:600">Ayuda mínima</p><div class="search" style="height:36px">10.000 $</div>
<p class="t-13" style="margin:14px 0 6px;font-weight:600">Plazo</p><span class="chip">Próximos 30 días</span>
<p class="t-13" style="margin:14px 0 6px;font-weight:600">Confianza</p><label class="t-13"><input type="checkbox" checked> Solo organizaciones verificadas</label></aside>
<section class="panel"><div class="panel-h"><h2>14 oportunidades · ordenadas por encaje</h2><span class="chip">Encaje · Plazo · Ayuda</span></div>
<table class="table-m"><thead><tr><th>Universidad</th><th>Encaje</th><th class="hide-m">Confianza del dato</th><th class="hide-m">Ayuda/año</th><th class="hide-m">Plazo</th><th class="hide-m">Fuente</th><th></th></tr></thead><tbody>{opp_rows}</tbody></table>
<p class="t-12 faint" style="padding:10px 18px;margin:0">El encaje es compatibilidad, no probabilidad de admisión ni de beca. Requisitos académicos y de elegibilidad se muestran aparte.</p></section></div>""", AG_TABS)

# ---------------------------------------------------------------- 6. Procesos (kanban)
def kcard(i, n, u, nx, cls=""):
    tag = {"urgent": "Vencido", "warn": "Esta semana"}.get(cls, "")
    chip = f'<span class="chip {cls}" style="margin-top:8px">{tag}</span>' if tag else ""
    return f'<div class="card"><div class="who">{crest(i)}<div><b>{n}</b><small>{u}</small></div></div><p class="meta" style="margin:8px 0 0">{nx}</p>{chip}</div>'
PIPE = shell("Procesos", AGENT_NAV, "Procesos", AG_ORG, f"""
<div class="page-head"><div><h1 class="display d-40">Procesos</h1><p class="muted" style="margin:6px 0 0">27 abiertos · 4 parados más de 14 días</p></div>
<div style="display:flex;gap:8px"><span class="chip action">Tablero</span><span class="chip">Tabla</span><a class="btn btn-primary">{ic("plus")}Nuevo proceso</a></div></div>
<div class="board">
<div class="col"><h3>Investigación <span class="faint">6</span></h3>{kcard("NV","Nora Vidal","Pinecrest State","Revisar programa de natación")}{kcard("AR","Álex Romero","Harbor Tech","Confirmar plazas 2027")}</div>
<div class="col"><h3>En contacto <span class="faint">9</span></h3>{kcard("SM","Sofía Martín","Northfield University","Expediente traducido","urgent")}{kcard("LF","Lucía Ferrer","Saint Mary's","Responder sobre visita","warn")}</div>
<div class="col"><h3>Visita <span class="faint">3</span></h3>{kcard("DK","Daniel Kim","Lakeshore College","Visita oficial 4 dic")}</div>
<div class="col"><h3>Oferta <span class="faint">5</span></h3>{kcard("MJ","Marcos Jiménez","Lakeshore College","Decidir antes del 30 nov","urgent")}{kcard("MJ","Marcos Jiménez","Northfield University","Comparar con Lakeshore")}</div>
<div class="col"><h3>Decisión <span class="faint">2</span></h3>{kcard("NV","Nora Vidal","Ridgeview College","Firmada · llegada en agosto")}</div></div>
<p class="footer-note">En móvil el tablero pasa a una lista agrupada por fase con la acción visible (nunca columnas recortadas).</p>""", AG_TABS)

# ---------------------------------------------------------------- 7. Athlete Home
ATH_HOME = shell("Inicio", ATHLETE_NAV, "Inicio", "Lucía Ferrer<small>Tenis · Promoción 2027</small>", f"""
<div class="grid" style="grid-template-columns:1.5fr 1fr;align-items:stretch">
<section class="hero-night"><p class="kicker" style="color:var(--lime)">Tu siguiente paso</p><h1 class="display d-40" style="margin:10px 0">Responde a Saint Mary's</h1>
<p class="muted" style="max-width:460px">Te proponen una visita en enero. Tu agente Ana ya ha revisado fechas; decide tú y respóndeles.</p>
<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><a class="btn btn-lime">Responder</a><a class="btn btn-dark-ghost">Hablar con Ana</a></div></section>
<section class="panel" style="padding:20px"><p class="kicker">Tu Passport</p><div style="display:flex;align-items:baseline;gap:8px;margin:8px 0"><span class="num" style="font-size:56px">82</span><span class="muted">/100 listo</span></div>
<div style="height:8px;background:var(--sunken);border-radius:9px;overflow:hidden"><div style="width:82%;height:100%;background:var(--action)"></div></div>
<p class="t-13" style="margin:12px 0 4px"><b>Sube un partido completo</b> · +8</p><p class="t-13 muted" style="margin:0">Lo piden 3 de las universidades que te siguen.</p>
<p class="t-13" style="margin:14px 0 0"><span class="prov v">4 datos validados</span> · <span class="prov s">2 declarados</span></p></section></div>
<div class="kpis" style="margin-top:20px"><div class="kpi"><p class="kicker">Te vieron</p><div class="num">7</div><p>organizaciones esta semana</p></div>
<div class="kpi"><p class="kicker">Universidades que encajan</p><div class="num">12</div><p>3 nuevas</p></div><div class="kpi"><p class="kicker">Procesos</p><div class="num">4</div><p>1 espera tu respuesta</p></div>
<div class="kpi"><p class="kicker">Plazos</p><div class="num">2</div><p>el próximo en 9 días</p></div></div>
<section class="panel" style="margin-top:20px"><div class="panel-h"><h2>Universidades que encajan contigo</h2><a class="link t-13">Ver las 12</a></div><ul class="rows">
<li class="row" style="grid-template-columns:36px 1fr auto auto"><span class="crest" style="background:var(--night-2)">SM</span><div><b>Saint Mary's College</b><div class="meta">NCAA D1 · California · encaja: deportivo, académico, ubicación</div></div><span class="num" style="font-size:24px">88%</span><a class="btn btn-ghost btn-sm">Ver por qué</a></li>
<li class="row" style="grid-template-columns:36px 1fr auto auto"><span class="crest" style="background:var(--night-2)">RC</span><div><b>Ridgeview College</b><div class="meta">NCAA D2 · Texas · falta: certificado de inglés</div></div><span class="num" style="font-size:24px">79%</span><a class="btn btn-ghost btn-sm">Ver por qué</a></li></ul></section>
<p class="footer-note">Tú decides quién ve cada bloque de tu Passport. Nunca se comparte tu contacto ni tu presupuesto familiar.</p>""",
    [("home", "Inicio"), ("id", "Passport"), ("spark", "Match"), ("chat", "Mensajes")], who="LF")

# ---------------------------------------------------------------- 8. University Home
UNI_HOME = shell("Recruiting", UNI_NAV, "Hoy", "Northfield University<small>NCAA D1 · Baloncesto M · verificada</small>", f"""
<div class="page-head"><div><p class="kicker">Clase 2027 · 4 plazas abiertas</p><h1 class="display d-40" style="margin-top:6px">Recruiting</h1></div>
<div style="display:flex;gap:8px"><a class="btn btn-ghost">Nueva necesidad</a><a class="btn btn-primary">{ic("search")}Descubrir atletas</a></div></div>
<div class="grid four" style="grid-template-columns:1fr 1fr 1fr 1fr">
<div class="panel" style="padding:16px"><p class="kicker">Base</p><div class="num">1/2</div><p class="t-13 muted">plazas cubiertas</p></div>
<div class="panel" style="padding:16px"><p class="kicker">Ala-pívot</p><div class="num">0/1</div><p class="t-13 muted">5 candidatos</p></div>
<div class="panel" style="padding:16px"><p class="kicker">Escolta</p><div class="num">1/1</div><p class="t-13 muted">cubierta</p></div>
<div class="panel" style="padding:16px"><p class="kicker">Becas</p><div class="num">62%</div><p class="t-13 muted">del presupuesto asignado · privado</p></div></div>
<div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:20px">
<section class="panel"><div class="panel-h"><h2>Candidatos que necesitan revisión</h2><a class="link t-13">Ver los 9</a></div><table class="table-m"><thead><tr><th>Atleta</th><th class="hide-m">Posición</th><th>Encaje</th><th class="hide-m">Datos</th><th></th></tr></thead><tbody>
<tr><td><div class="who">{crest("MJ")}<div><b>Marcos Jiménez</b><small>ES · 2027 · 1,93 m</small></div></div></td><td class="hide-m">Base</td><td><b>86%</b></td><td class="hide-m"><span class="prov v">Validados</span></td><td><a class="btn btn-ghost btn-sm">Revisar</a></td></tr>
<tr><td><div class="who"><span class="crest" style="background:var(--basket)">TO</span><div><b>Tomás Ortega</b><small>AR · 2027 · 2,04 m</small></div></div></td><td class="hide-m">Ala-pívot</td><td><b>81%</b></td><td class="hide-m"><span class="prov d">Documentados</span></td><td><a class="btn btn-ghost btn-sm">Revisar</a></td></tr>
<tr><td><div class="who"><span class="crest" style="background:var(--basket)">EK</span><div><b>Erik Karlsson</b><small>SE · 2028 · 2,01 m</small></div></div></td><td class="hide-m">Ala-pívot</td><td><b>77%</b></td><td class="hide-m"><span class="prov s">Declarados</span></td><td><a class="btn btn-ghost btn-sm">Revisar</a></td></tr></tbody></table></section>
<section class="panel"><div class="panel-h"><h2>Esta semana</h2></div><ul class="rows">
<li class="row urgent" style="grid-template-columns:4px 1fr auto"><span class="bar"></span><div><b>Oferta a Marcos Jiménez caduca</b><div class="meta">15 dic · su agencia ha pedido comparar</div></div><span class="when">24 días</span></li>
<li class="row warn" style="grid-template-columns:4px 1fr auto"><span class="bar"></span><div><b>Visita oficial: Daniel Kim</b><div class="meta">4 dic · campus</div></div><span class="when">13 días</span></li>
<li class="row" style="grid-template-columns:4px 1fr auto"><span class="bar"></span><div><b>Admisión: expediente de Sofía Martín</b><div class="meta">Pendiente de traducción</div></div><span class="when">—</span></li></ul></section></div>
<p class="footer-note">Contacto con menores solo con organización verificada y aprobación de la familia. El presupuesto de becas nunca sale de vuestra organización.</p>""",
    [("home", "Hoy"), ("search", "Descubrir"), ("list", "Listas"), ("users", "Candidatos")], who="JW")

PAGES = {"index.html": HOME, "agent-home.html": AGENT_HOME, "my-athletes.html": MY_ATHLETES, "athlete-360.html": ATH360,
         "opportunities.html": OPPORTUNITIES, "pipeline.html": PIPE, "athlete-home.html": ATH_HOME, "university-home.html": UNI_HOME}
for name, html in PAGES.items():
    (OUT / name).write_text(html, encoding="utf-8")
print("ok", len(PAGES))
