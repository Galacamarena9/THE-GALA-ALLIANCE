# Auditoría UX y producto · Agent-First (Prompt 1)

Fecha: 21 nov 2026 · Base: `main` @ PR #65 · **Sin cambios de código** (solo este informe).

**Método.** He revisado las 104 rutas del repositorio, la navegación (`src/lib/domain/navigation.ts`, `MobileNav.tsx`) y los permisos de cada página (`requireSession`). Para los permisos de datos he leído la RLS y los permisos de agente (migraciones 12A/12B). Las capturas son del preview local (`/preview/*`). Los clics se cuentan en escritorio desde `/app`.

**Límites.** No he tenido acceso a la deploy preview desplegada ni a datos reales en el navegador. Los recuentos de clics salen del código, no de una sesión grabada. No he ejecutado axe ni Lighthouse: la accesibilidad se ha revisado en el código y se marca así.

---

## Resumen ejecutivo

1. **Al agente le falta en la interfaz lo que la base de datos ya le permite.** La RLS 12B concede al agente `offers.view`, `documents.view`, `messages.participate` y `pipeline.manage`. Pero `/app/offers`, `/app/documents`, `/app/requests` y `/app/match` solo aceptan atleta o familia, y la ficha del atleta (`/app/portfolio/[athleteId]`) no tiene pestañas de Ofertas, Documentos ni Mensajes. **4 de las 10 tareas clave del agente no se pueden hacer dentro de Gala.** Es el hallazgo con más impacto comercial.
2. **La web pública vende al atleta, no al agente.** El titular de `/` («Un perfil. Todas tus oportunidades.») le habla al atleta, y la palabra «agente» o «agencia» aparece en solo 4 líneas de la página. Los planes de agencia existen (`agent_solo`, `agent_team`, `agent_scale`), pero el comprador principal no se ve reflejado en la portada.
3. **Hay sistemas paralelos visibles para el usuario.** Tres pipelines (`/app/pipeline`, `/app/process`, `/app/recruit/candidates`), tres tipos de listas (`/app/lists`, `/app/shortlist`, `/app/recruit/shortlists`) y rutas duplicadas entre la parte pública y la app. Técnicamente están justificados por actor, pero la terminología no los distingue.
4. **La seguridad está bien.** No he encontrado ninguna fuga. Los problemas son de producto e interfaz: falta exponer capacidades que ya están protegidas en la base de datos.

---

## A. Mapa completo de rutas (104)

Leyenda de la columna «Barra»:
- **V**: a la vista.
- **M**: tras «Ver más».
- **P**: sección plegada.
- **—**: fuera de la barra (se llega por enlace o por el buscador).
- **X**: fuera de la barra y sin enlace interno.

### Públicas (sin sesión)

| Ruta | Para quién | Nota |
|---|---|---|
| `/` | Todos | El titular habla al atleta (`src/app/page.tsx:88`) |
| `/precios` | Todos | Incluye la sección «Agencias» con programa fundador |
| `/para/[slug]` | Por actor | Portales por actor; duplica `/app/portal/[slug]` |
| `/oportunidades`, `/oportunidades/[id]` | Atleta | Duplica `/app/opportunities` (versión pública) |
| `/guia`, `/guia/[slug]` | Atleta y familia | Duplica `/app/guia` |
| `/calculadora` | Familia | Duplica `/app/calculator` |
| `/herramientas`, `/seguridad`, `/inversores`, `/legal/[doc]` | — | |
| `/deportes/[sport]`, `/organizaciones/[id]` | SEO | P20 |
| `/athletes/[id]`, `/athletes/[id]/cv`, `/athlete/[username]` | Perfil público | **Dos rutas de perfil público** (id y username) |
| `/r/[token]` | Enlace de recruiting | Título en inglés: «Recruiting profile» |
| `/invite/[token]`, `/join/[token]`, `/roster/[token]` | Invitaciones | Tres flujos de invitación con nombres distintos |
| `/print/cv`, `/print/memo` | Impresión | |
| `/preview/[screen]` | Interna | Solo con `ENABLE_PREVIEW` |
| `/(auth)/login`, `/signup`, `/forgot-password`, `/reset-password`, `/mfa` | Acceso | |
| `/onboarding` | Alta | |

### Autenticadas: comunes

| Ruta | Barra | Nota |
|---|---|---|
| `/app` | V | El agente y el atleta tienen inicio propio; el resto redirige a su espacio (PR #62/#63) |
| `/app/inbox`, `/app/inbox/[id]` | V | **Solo solicitudes de contacto organización ↔ atleta; el agente no participa** |
| `/app/notifications` | — (campana) | |
| `/app/discover` | V (agente/marca) | Buscador de talento (PR #64) |
| `/app/opportunities`, `/[id]`, `/new` | V atleta, M resto | |
| `/app/universities`, `/[id]`, `/compare` | V/M | |
| `/app/news`, `/app/showcase` | M / V | El Showcase está a la vista para organizaciones |
| `/app/ia`, `/app/calculator`, `/app/guia`, `/app/guia/[slug]`, `/app/portal/[slug]` | P | |
| `/app/settings`, `/app/support`, `/app/invitar`, `/app/trust`, `/app/billing` | P | Facturación solo para organizaciones |
| `/app/lists` | V agente/marca | Lista de guardados + búsquedas con alertas |
| `/app/campaigns`, `/[id]`, `/new`, `/app/collaborations` | V marca / M atleta | `collaborations` está fuera de la barra |
| `/app/organization`, `/app/verify`, `/app/verify/start`, `/app/verify/email` | M / — | `verify/email` solo se abre desde el email |

### Atleta

`/app/athlete` (M), `/app/athlete/passport` (V), `/app/athlete/passport/preview` (—), `/app/match` (V), `/app/match/[kind]/[id]` (—), `/app/shortlist` (M), `/app/share` (M), `/app/process` y `/[id]` (V), `/app/applications` (M), `/app/plan` (M), `/app/documents` (M), `/app/requests` (M), `/app/offers` (M), `/app/academia` (M), `/app/agents` (M).

### Familia

`/app/family` (Inicio), `/app/family/costs` (V), `/app/family/safety` (— en la barra, sí en móvil), más `share`, `process`, `requests`, `plan`, `documents` y `offers`, que son compartidas con el atleta.

### Agente

`/app/portfolio` (V), `/app/portfolio/[athleteId]` (—), `/app/portfolio/trials` (V), `/app/pipeline` (V), `/app/pipeline/[id]` (—), `/app/pipeline/team` (X), `/app/contacts` (M), `/app/lists` (V), `/app/discover` (V).

### Coach, universidad y club

`/app/recruit` (Inicio), `/discover`, `/shortlists`, `/shortlists/[id]`, `/candidates`, `/candidates/[athleteId]` (V/—), `/needs`, `/tasks`, `/compare`, `/trials` (— en la barra; algunos en móvil), `/app/club` (M), `/app/applications` («vista clásica», M).

### Admin

`/app/admin`, `/panel`, `/safety`, `/analytics`, `/ops`.

---

## B. Navegación por actor (estado actual)

| Actor | A la vista (barra) | Móvil (barra inferior) | Falta para su trabajo diario |
|---|---|---|---|
| **Agente** | Inicio · Escaparate · Cartera · Trials · Procesos · Listas · Mensajes · Showcase | Inicio · Cartera · Procesos · Mensajes | **Ofertas, Documentos, Mensajes con universidades y Oportunidades para mi atleta** |
| Atleta | Inicio · Passport · Gala Match · Mi pipeline · Becas · Universidades · Mensajes | Inicio · Passport · Match · Mensajes | Shortlist escondida («Ver más») |
| Familia | Inicio · Coste real · Su pipeline · Plan familiar · Becas · Universidades · Mensajes | Hoy · Costes · Documentos · Seguridad | — |
| Coach / universidad | Inicio · Descubrir atletas · Listas de seguimiento · Procesos (+ Nuestras becas en universidad) · Mensajes · Showcase | Inicio · Descubrir · Listas · Procesos/Trials | Necesidades y Tareas fuera de la barra |
| Marca | Inicio · Talento · Listas · Marca · Mensajes · Showcase | Inicio · Talento · Listas · Mensajes | Colaboraciones fuera de la barra |

---

## C. Los 25 problemas principales

Severidad: **C** = crítico, **A** = alto, **M** = medio, **B** = bajo. Tipo: **P** = producto, **V** = visual, **D** = datos o contrato.

| # | Sev. | Tipo | Problema | Evidencia | Impacto para el agente (ingresos y tiempo) |
|---|---|---|---|---|---|
| 1 | C | P | El agente no puede ver las **ofertas** de su atleta aunque tenga `offers.view` | `src/app/app/offers/page.tsx:27` (`['athlete','parent']`); RLS `offers_select_agent` en 12B | Revisar una beca es el momento de más valor del agente. Ahora pide capturas por WhatsApp, Gala no le ahorra ese trabajo y no hay motivo para pagar |
| 2 | C | P | El agente no puede ver ni pedir **documentos** con `documents.view` / `documents.request_share` | `src/app/app/documents/page.tsx:26`; `AthleteWorkspaceView.tsx` (pestañas sin documentos) | Los documentos que faltan bloquean admisiones. Se gestionan fuera, con riesgo de perder plazos |
| 3 | C | P | El agente no tiene **mensajería** con universidades ni con su atleta, pese a `messages.participate` | `src/app/app/inbox/page.tsx:19-30` (solo `contact_requests` org↔atleta) | «Leer respuesta» y «contactar universidad» ocurren en Gmail. Gala no es su herramienta de trabajo |
| 4 | C | P | El agente no puede lanzar **Gala Match para un atleta suyo** | `src/app/app/match/page.tsx:19` (`['athlete']`) | Encontrar oportunidades para su cartera es su trabajo principal y lo hace a mano en `/app/opportunities` |
| 5 | C | V/P | La portada vende al atleta; el comprador (el agente) no se ve | `src/app/page.tsx:88-91`; «agente» o «agencia» en solo 4 líneas | Baja la conversión de quien paga; el programa fundador solo aparece en `/precios` |
| 6 | A | P | Ficha del atleta (360) incompleta: Resumen · Notas · Actividad · Próximos pasos · Procesos | `AthleteWorkspaceView.tsx:15-19` | Para entender a un atleta el agente navega 3–4 pantallas; sin documentos ni ofertas, la vista 360 no está completa |
| 7 | A | P | No existen **visitas** (oficiales o no oficiales, entrevistas, trials universitarios) | No hay ninguna entidad (ver NCAA-1 §C) | El agente no puede revisar ni preparar visitas: un momento crítico del proceso queda fuera |
| 8 | A | P | Tres «pipelines» con el mismo nombre y significados distintos | `/app/pipeline` (agencia), `/app/process` (atleta), `/app/recruit/candidates` (organización); la barra los llama «Procesos» / «Mi pipeline» | Confusión en las demos y al compartir pantalla con familias |
| 9 | A | P | Tres sistemas de listas | `/app/lists`, `/app/shortlist`, `/app/recruit/shortlists`; textos «Guardado en shortlist» vs «Listas» | El agente no sabe dónde quedó un atleta guardado |
| 10 | A | P | «Contactar universidad» saca al agente de Gala | `/app/contacts` es una agenda («Ver más»), sin envío ni registro automático | Se pierde la trazabilidad, que es lo que justifica pagar la herramienta |
| 11 | A | P | No hay acción de **representar** desde el resultado de búsqueda: hay que ir al perfil público | `/app/discover` → `/athletes/[id]` → `RepresentationForm` (`AthletePage.tsx:101`) | Un clic más por atleta en la tarea de captar talento |
| 12 | A | V | Terminología mezclada en inglés | «portfolio» 28, «pipeline» 29, «shortlist» 34 veces en textos de interfaz; «Volver al portfolio» (`portfolio/[athleteId]/page.tsx`) | Parece una herramienta a medio traducir; resta confianza en España y Latinoamérica |
| 13 | A | P | El equipo de la agencia (`/app/pipeline/team`) no tiene entrada en la navegación | Ruta X | El propietario de la agencia, que es quien paga, no encuentra cómo gestiona su equipo |
| 14 | M | P | Rutas duplicadas pública/app | `/guia`↔`/app/guia`, `/calculadora`↔`/app/calculator`, `/oportunidades`↔`/app/opportunities`, `/para/[slug]`↔`/app/portal/[slug]` | Mantenimiento doble y contenido que puede divergir |
| 15 | M | P | Dos rutas de perfil público | `/athletes/[id]` y `/athlete/[username]` | Enlaces distintos para el mismo atleta: peor SEO y confusión al compartir |
| 16 | M | V | Abuso de tarjetas, bordes y etiquetas | 479 `<Card`, 274 `border border-line`, 145 `<Badge` | Ruido visual: cuesta ver qué es urgente |
| 17 | M | V | Tamaños de texto ad hoc | 151 `text-[Npx]` (82 de 11 px y 14 de 10 px) | Legibilidad baja en móvil y ritmo tipográfico inconsistente |
| 18 | M | P | «Candidaturas (vista clásica)» sigue en la barra de organizaciones | `navigation.ts` (coach/universidad) | Dos formas de ver lo mismo; «clásica» es jerga interna |
| 19 | M | P | Necesidades, Tareas y Comparar de recruiting no están en la barra | `/app/recruit/needs`, `/tasks`, `/compare` | El coach descubre funciones solo si alguien se las enseña |
| 20 | M | V | Tres flujos de invitación con nombres distintos | `/invite`, `/join`, `/roster` | Mensajes inconsistentes en los emails de alta |
| 21 | M | V | Título en inglés en el enlace que ven los coaches | `/r/[token]` → «Recruiting profile» | Aceptable para coaches de EE. UU., pero choca con el resto en castellano |
| 22 | M | P | Colaboraciones de marca fuera de la barra | `/app/collaborations` (solo se llega desde campañas) | Para la marca, el seguimiento de entregables no es evidente |
| 23 | B | V | Mayúsculas de display por todas partes | 121 `uppercase` | En tablas y listas largas reduce la legibilidad |
| 24 | B | P | `/app/admin` y `/app/admin/panel` son dos inicios de administración | `navigation.ts` (admin) | Solo afecta al uso interno |
| 25 | B | D | El GPA del filtro es una conversión lineal y no lo advierte en la tarjeta | `athlete_academics.gpa_4`; nota solo en `/app/discover` | Un agente podría prometer un encaje académico que no es oficial |

**Seguridad y contrato de datos frente a lo visual.** Solo el #25 es de datos, y es una aclaración, no una fuga. Los #1–4 son capacidades que la base de datos ya protege correctamente y a las que falta interfaz: se resuelven reutilizando las proyecciones existentes (`agent_can`, `offers_select_agent`, `document_access_grants`) sin tocar la RLS.

---

## D. Las 10 tareas del agente: clics actuales

| # | Tarea | Ruta actual | Clics | Bloqueo |
|---|---|---|---|---|
| 1 | Localizar un atleta | `/app` → «Tu cartera» (si sale en el carrusel) → ficha · o Cartera → buscar → ficha | 1–3 (+ escribir) | Ninguno |
| 2 | Entender su estado | Ficha → Resumen / Procesos | 2–4 | Falta una vista de estado única (documentos y ofertas fuera) |
| 3 | Ver su siguiente acción | `/app` → bloque «Hoy» | 0 | Ninguno |
| 4 | Encontrar una oportunidad para él | Ver más → Becas → filtros (sin encaje con el atleta) | 2 + filtros | **Sin Match para agentes (#4)** |
| 5 | Leer una respuesta de universidad | — | ∞ | **BLOCKED: no hay mensajería para el agente (#3)** |
| 6 | Resolver un documento que falta | — | ∞ | **BLOCKED: no hay pantalla de documentos para el agente (#2)** |
| 7 | Revisar una visita | — | ∞ | **BLOCKED: no existe la entidad (#7)** |
| 8 | Revisar una oferta | — | ∞ | **BLOCKED en la interfaz; la RLS la permite (#1)** |
| 9 | Contactar una universidad | Ver más → Universidades y coaches → contacto → email externo | 3 + sale de Gala | Sin envío ni registro (#10) |
| 10 | Ver su pipeline | Barra → Procesos | 1 | Ninguno |
| 11 | Proponer representación | Escaparate → filtros → perfil → formulario | 3 + filtros | Falta la acción en el resultado (#11) |

---

## E. Pantallas: fusionar, quitar, mover o conservar

| Decisión | Pantallas |
|---|---|
| **Fusionar** | `/app/applications` («vista clásica») dentro de `/app/recruit/candidates`; `/app/athlete` («Mi camino») dentro de `/app`; `/app/admin` + `/app/admin/panel`; `/app/portal/[slug]` → `/para/[slug]`; `/athlete/[username]` como alias de `/athletes/[id]` |
| **Añadir a la ficha del atleta (agente)** | Pestañas **Ofertas**, **Documentos** y **Mensajes**, más «Oportunidades para él» (Match) |
| **Quitar de la barra** | «Showcase Day» para organizaciones (pasa a «Ver más»); «Candidaturas (vista clásica)» |
| **Mover a «Ver más» / buscador** | Actualidad, Portales por perfil, Invitar |
| **Hacer visible** | `/app/pipeline/team` (en «Agencia»), `/app/recruit/needs` y `/tasks` (coach), `/app/collaborations` (marca) |
| **Conservar** | Inicio del agente, Cartera, Procesos, Listas, Buscador de talento, Trials, todo el espacio familiar, todo el Passport |

---

## F. Terminología

| Hoy | Problema | Propuesta |
|---|---|---|
| Cartera / portfolio | Las dos conviven en textos y metadatos | **Cartera** (o **Mis atletas**) |
| Procesos / Mi pipeline / Su pipeline / Candidatos | El mismo nombre para tres cosas distintas | Agente: **Procesos**; atleta: **Mis procesos**; organización: **Candidatos** |
| Listas / shortlist / Listas de seguimiento / Listas personales | Cuatro nombres | **Listas** (con el tipo como etiqueta) |
| Escaparate / Talento / Descubrir atletas / Buscar talento | Cuatro nombres para buscar atletas | **Buscar talento** |
| Becas / Oportunidades / Becas y oportunidades | Mezcla | **Oportunidades** (la beca es un tipo) |
| Trials y programas / Trials | | **Pruebas y programas** (o mantener «Trials» si es el término del sector, pero siempre igual) |
| Showcase Day | Inglés | **Jornada Showcase** |
| Recruiting profile (`/r`) | Inglés | **Perfil de recruiting** |

---

## G. Responsive y accesibilidad (revisión de código, sin axe)

- **Hecho bien:** pruebas e2e de desbordamiento a 375 px en familia y otros flujos (`e2e/*.spec.ts`), `aria-current` en la navegación, `role="search"` y textos de lectura en tablas nuevas.
- **Texto pequeño:** 96 textos de 10–11 px (`text-[10px]`/`text-[11px]`), por debajo de lo recomendable para lectura en móvil (**M**).
- **Tablas anchas:** las tablas comparativas (`/app/discover` en vista tabla, `/app/recruit/compare`) dependen del scroll horizontal; en móvil se debería ofrecer la vista de tarjetas por defecto (**B**).
- **Destino táctil:** botones `size="sm"` y enlaces de chips de unos 28–32 px de alto; por debajo de 44 px en móvil (**M**).
- **Contraste:** `text-faint` sobre `surface` se usa en metadatos (82 sitios con 11 px). **Pendiente de verificar con una herramienta**; no lo he medido.
- **Pendiente:** ejecutar axe y Lighthouse sobre la preview desplegada. **BLOCKED: no tengo acceso a la URL desplegada.**

---

## H. Inventario del lenguaje visual

- **Tokens** (`src/app/globals.css`):
  - colores `brass` (acento índigo), `lime` (acento de acción), `ink`/`night`/`paper`/`surface`/`line`, `ok`/`warn`/`danger`, `trust`, `lavender`, y 7 colores por deporte;
  - `--radius-card`;
  - sombras `elevated`, `gold` y `premium`;
  - tipografías `display` (condensada en mayúsculas), `sans` y `serif`;
  - animaciones `fade-in-up`, `float`, `shimmer`, `pulse-glow` y `gradient-shift`.
- **Componentes base** (`src/components/ui.tsx`): `Button`/`ButtonLink`/`buttonClass` (variantes y tamaños), `Card`, `CardTitle`, `Badge` (5 tonos), `Notice`, `PageHeader`, `Panel`, `EmptyState`, `Meter` e `inputClass`.
- **Firma visual:**
  - tarjeta Passport oscura con acento lima;
  - héroes con foto deportiva;
  - cabeceras «cromo» por deporte (`AthleteCard`);
  - titulares en mayúsculas condensadas.
- **Deriva:**
  - 75 radios ad hoc (`rounded-[…]`), 21 sombras ad hoc y 151 tamaños de texto ad hoc;
  - dos estilos de inicio (el de héroe con foto: `RoleHero`, `AgentHome`; el de tarjetas planas: Command Center).

---

## I. Archivos y componentes afectados (para las fases siguientes)

- `src/app/app/portfolio/[athleteId]/AthleteWorkspaceView.tsx` y `page.tsx`: pestañas de Ofertas, Documentos, Mensajes y Oportunidades.
- `src/lib/data/portfolio.ts` (`loadAthleteWorkspace`): añadir ofertas y documentos vía RLS existente.
- `src/app/app/offers/page.tsx`, `documents/page.tsx`, `match/page.tsx`: separar «vista del atleta» de «vista del agente» reutilizando dominio.
- `src/app/app/inbox/*` y el modelo de mensajes: participación del agente (`messages.participate`).
- `src/app/app/discover/page.tsx`: acción «Proponer representación» en el resultado.
- `src/lib/domain/navigation.ts`, `MobileNav.tsx`: entradas de equipo, ofertas y documentos; terminología.
- `src/app/page.tsx`, `src/app/para/[slug]`, `src/app/precios`: portada con el agente como comprador.
- `src/components/ui.tsx`, `src/app/globals.css`: escala tipográfica y de radios (Prompt 11).

---

## J. Principios del estado futuro

1. **Una ficha, toda la verdad:** cada atleta del agente en una sola pantalla (estado, siguiente acción, procesos, ofertas, documentos, mensajes), sin salir de la ficha.
2. **Del dato a la acción en un clic:** cada lista o tarjeta lleva su acción principal (representar, pedir documento, responder, revisar oferta).
3. **Lo urgente primero:** «Hoy» agrega plazos, documentos que faltan, ofertas que caducan y respuestas sin leer de toda la cartera.
4. **Un nombre por concepto**, en castellano, y siempre el mismo.
5. **La interfaz expone lo que la RLS permite, nada más:** cero lógica de permisos en el cliente; las proyecciones del servidor deciden.
6. **Menos contenedores:** jerarquía con tipografía y espacio, no con más tarjetas, bordes y etiquetas.
7. **Vende al que paga:** la portada, los precios y la demo cuentan el día de un agente.

---

## K. Cierre

- Informe sin cambios de código: solo se añade este documento.
- Criterios de aceptación:
  - Rutas contabilizadas (104): **PASS**.
  - Hallazgos con ruta o archivo: **PASS**.
  - Impacto en el agente para cada C/A: **PASS**.
  - Sin implementación: **PASS**.
  - Al menos 10 tareas del agente con clics: **PASS** (11).
  - Seguridad separada de lo visual: **PASS**.
- **BLOCKED:** inspección de la deploy preview desplegada, axe y Lighthouse. No tengo la URL; los hallazgos visuales se basan en el código y en el preview local.
- Comprobaciones ejecutadas: ninguna de código, porque no hay cambios de código. CI se ejecuta sobre este PR de documentación.

**Siguiente fase (Prompt 2: auditoría del diseño): pendiente de tu aprobación.**
