# Master Plan 2.0: clasificación y arquitectura objetivo

Fecha: 17 nov 2026 · Base: `main` @ `5c9b29a` · Complementa [README](README.md) (Fase 0) y [STRATEGY.md](../STRATEGY.md).
Principio de producto: **IDENTITY → DISCOVER → UNDERSTAND → IMPROVE → CONNECT → MANAGE → DECIDE**, sobre una única red.

## Diagnóstico central (confirmado en el código)

**El producto parece más pequeño de lo que es.** Existen y funcionan: Opportunity Passport con procedencia de datos, Mi plan
(roadmap generado desde el Passport), Academia SAT/TOEFL, explorador y comparador de universidades (datos de College Scorecard),
comparador de ofertas con memo de decisión, calculadora de becas (3 escenarios, 4 años, hasta 5 ofertas), Gala IA con fuentes,
CV deportivo imprimible, Showcase Day, pipeline de agencia, portal de club con validación de estadísticas, campañas de marca 18+
y panel de familia. **Casi todo vive detrás del login** y la web pública no lo enseña.

**Bloqueos de datos (no de código) en producción, comprobados el 17 nov 2026:**

| Dato | Filas | Consecuencia | Qué hace falta |
|---|---|---|---|
| `institutions` (universidades) | **0** | Explorador y comparador de universidades vacíos | `COLLEGE_SCORECARD_API_KEY` en Netlify + importar las universidades objetivo desde `/app/admin` |
| `opportunities` publicadas | **0** | Marketplace vacío | Organizaciones socias que publiquen (P0-04) |

Mientras sigan vacías, ni el explorador público de universidades ni el mapa global pueden enseñar nada real. **No se construyen con datos inventados.**

## Clasificación (KEEP / IMPROVE / MERGE / REMOVE / REBUILD / CREATE)

| Área | Rutas | Decisión | Motivo |
|---|---|---|---|
| Home | `/` | IMPROVE | Ya tiene producto vivo (#17); falta enseñar las herramientas que existen |
| Oportunidades públicas | `/oportunidades`, `/oportunidades/[id]` | IMPROVE | Estado vacío útil (alertas), filtros con URL y sello clicable |
| Calculadora pública | `/calculadora` | KEEP + exponer | Herramienta de captación sin registro; hoy solo está en el pie |
| Test de opciones | `/#test` | KEEP + exponer | Captación; ahora incluye el roadmap |
| Guía oficial | `/guia`, `/guia/[slug]` | KEEP | Contenido con fuentes oficiales, base de SEO |
| Para quién | `/para/[slug]` | KEEP | Puertas por actor; dejan de ser la única entrada |
| Precios, Inversores | `/precios`, `/inversores` | KEEP | — |
| Seguridad | `/seguridad` | IMPROVE | La confianza debe aparecer en cada pantalla, no solo aquí |
| **Herramientas** | — | **CREATE** `/herramientas` | Las herramientas reales son el mejor gancho y hoy no se ven |
| Explorador público de universidades | — | CREATE (**bloqueado por datos**) | Requiere importar universidades |
| Mapa global | — | CREATE (**bloqueado por datos**) | Solo con inventario real por país |
| Análisis de vídeo | — | **No se crea todavía** | No existe capacidad técnica; no se simula |
| Passport | `/app/athlete/passport`, `/athletes/[id]`, `/athletes/[id]/cv` | IMPROVE | Convertirlo en objeto icónico de marca (Super Prompt 3) |
| Onboarding | `/onboarding`, `/signup` | REBUILD | Primer valor antes del formulario; conservar el contexto (`from`) |
| Mi plan | `/app/plan` | IMPROVE | Base del Roadmap dinámico (Super Prompt 5) |
| Calculadora, ofertas, universidades | `/app/calculator`, `/app/offers`, `/app/universities/*` | MERGE (UX) | Un **Centro de decisión**: calcular, comparar y decidir en un solo flujo |
| Academia | `/app/academia` | KEEP | — |
| Gala IA | `/app/ia` | IMPROVE | De página aparte a ayuda contextual en cada pantalla |
| Panel por rol | `/app`, `/app/family`, `/app/club`, `/app/portfolio`, `/app/pipeline` | IMPROVE | Responder "qué ha cambiado, qué importa, qué hago ahora" |
| Descubrir talento | `/app/discover`, `/app/lists` | KEEP | — |
| Mensajes y notificaciones | `/app/inbox`, `/app/notifications` | KEEP | — |
| Actualidad | `/app/news` | IMPROVE | Feed de "inteligencia de oportunidades", no social |
| Centro de información privado | `/app/guia` | MERGE | Duplica `/guia` pública; unificar contenido |
| Marcas | `/app/campaigns/*` | KEEP (sin ampliar) | No sobredimensionar hasta que haya liquidez |
| Admin | `/app/admin`, `/app/admin/panel` | KEEP | — |
| Componente `Timeline` | — | REMOVE | Sin uso (CONT-06) |

## Arquitectura objetivo (mapeada a lo existente)

| Etapa | Público | Atleta (app) |
|---|---|---|
| IDENTITY | Crear Passport | Passport, CV, Compartir |
| DISCOVER | Oportunidades, Herramientas | Oportunidades, Universidades, Showcase |
| UNDERSTAND | Guía, Test, Calculadora | Gala IA, Academia, Match por áreas |
| IMPROVE | — | Mi plan (roadmap), Readiness |
| CONNECT | Para quién, Seguridad | Mensajes, Red (pendiente) |
| MANAGE | — | Candidaturas, Documentos, Notificaciones |
| DECIDE | — | Ofertas + memo, Comparador, Calculadora |

**Navegación pública nueva:** Oportunidades · Para quién · Herramientas · Recursos · Precios · Seguridad.
"Cómo funciona" se queda en la home, no en la cabecera.

## Orden de ejecución

1. **Super Prompt 2 (en curso):** `/herramientas` y la nueva navegación pública.
2. **Datos:** importar universidades (clave de Scorecard) y organizaciones socias. Desbloquea el explorador público de universidades y el mapa.
3. **Super Prompt 3:** Passport icónico y onboarding con valor en el primer minuto.
4. **Super Prompts 4-5:** oportunidades con filtros y alertas; Centro de decisión (calculadora + ofertas + universidades).
5. **Super Prompts 6-8:** paneles por rol, red y Gala IA contextual, y QA final en 320-1440 px.
