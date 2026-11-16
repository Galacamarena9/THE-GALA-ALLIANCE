# The Gala Alliance · Estrategia de producto (prompt maestro v2)

> Promesa: convertir talento, información y conexiones en oportunidades deportivas reales, de forma transparente y segura.
> Complementa a [AUDIT_PLAN.md](AUDIT_PLAN.md) (inventario técnico de la Fase 0). Fecha: 16 nov 2026.

## A) Auditoría profesional (resumen)

El producto está **más avanzado de lo que comunica**. Ya tiene Passport con procedencia por dato, matching determinista
explicable (`rules-1.0`), readiness, oportunidades con sello de confianza de 5 niveles, candidaturas, pipeline de equipo,
mensajería en tiempo real con control familiar, normas NCAA de contacto, verificación por dominio, denuncias DSA, RGPD
(descarga, baja, borrado programado), Stripe y panel de mando. RLS en todas las tablas con 84 pruebas por actor.

Lo que limita su potencial no es la falta de funciones, sino **cómo se presentan y conectan**: posicionamiento "becas en
EE. UU.", home sobrecargada, ningún marketplace visible sin registro, liquidez no demostrada, capa de red inexistente
(follow/conexiones) y verticales no universitarias todavía en piloto.

| # | Hallazgo | Gravedad | Perfil | Solución | Esfuerzo | Prioridad | KPI |
|---|---|---|---|---|---|---|---|
| 1 | Posicionamiento limitado a becas EE. UU. | Alta | Todos | Marca global centralizada (`brand.ts`) | S | P0 | Conversión home → registro |
| 2 | Home con 12 secciones, promesa tarda en entenderse | Alta | Visitante | Home de 10 secciones, hero v2 | M | P0 | Rebote, clic en CTA |
| 3 | Marketplace invisible sin registro | Alta | Atleta, familia | `/oportunidades` público (solo publicadas y verificadas) | S | P0 | Visitas → Passport |
| 4 | Confianza dispersa en páginas legales | Media | Familia | Centro `/seguridad` con compromisos implementados | S | P0 | Conversión familias |
| 5 | Sin Open Graph: enlaces compartidos sin vista previa | Media | Atleta, club | Metadatos OG/Twitter (raíz hecha; falta por Passport) | S | P1 | CTR de enlaces compartidos |
| 6 | Liquidez no demostrada | Crítica | Negocio | Piloto con organizaciones socias que publiquen oportunidades reales | — | P0 | Oportunidades activas, tiempo al primer match |
| 7 | Gala Match sin subcategorías ni nivel de confianza | Media | Atleta | Subpuntuaciones (deportiva, académica, económica, plazos) + "confianza baja" | M | P1 | Candidaturas por match visto |
| 8 | Sin follow/conexión separados de listas | Media | Todos | Tablas `follows`/`connections` con RLS y límites para menores | L | P3 | Interacciones cualificadas |
| 9 | Interfaz solo en castellano, textos repartidos | Media | Internacional | Capa i18n (es/en) progresiva | L | P2 | Registros fuera de España |
| 10 | Eventos de analítica solo para usuarios con sesión | Baja | Negocio | Medición anónima sin cookies, con consentimiento | M | P1 | Embudo completo |

## B) Diez problemas

1. Se percibe como agencia/guía de becas, no como red.
2. La home explica antes de demostrar.
3. No se pueden ver oportunidades sin registrarse.
4. No hay prueba de liquidez (organizaciones y oportunidades reales visibles).
5. La confianza, el gran diferencial, vive en documentos legales.
6. El match no desglosa por áreas ni avisa de baja confianza.
7. No existe relación "seguir/conectar": no hay bucle de red ni retorno semanal fuera del proceso.
8. Clubes, academias y eventos tienen tipos en la BD pero poco flujo propio.
9. Sin internacionalización ni vista previa al compartir el Passport.
10. Medición incompleta del embudo anónimo (home → Passport).

## C) Diez cambios de mayor impacto

| # | Cambio | Estado |
|---|---|---|
| 1 | Marca "The Global Sports Opportunity Network" en un solo archivo | ✅ PR #11 |
| 2 | Home nueva (hero v2, 3 pasos, 4 verticales, Passport, match) | ✅ PR #11 |
| 3 | Marketplace público `/oportunidades` con filtros por vertical | ✅ PR #11 |
| 4 | Centro de confianza `/seguridad` | ✅ PR #11 |
| 5 | Navegación pública v2 (Oportunidades, Para quién, Cómo funciona, Recursos, Precios, Seguridad) | ✅ PR #11 |
| 6 | Passport público con OG propio y QR | Siguiente |
| 7 | Gala Match con subpuntuaciones y confianza | Siguiente |
| 8 | Flujo completo club: publicar prueba → candidatos → pipeline | Fase 1-2 |
| 9 | Kit de piloto: invitación de organizaciones socias y seguimiento de liquidez | Fase 1 |
| 10 | Medición anónima del embudo (sin cookies, agregada) | Fase 1 |

## D) Arquitectura objetivo (cinco motores)

| Motor | Qué es | Dónde vive hoy |
|---|---|---|
| **Identity** | Opportunity Passport: quién es el atleta, con procedencia y privacidad | `app/athlete/passport`, `athletes/[id]`, `lib/domain/readiness.ts` |
| **Opportunities** | Marketplace con sello, coste neto y match | `oportunidades/`, `app/opportunities`, `lib/domain/{match,trust,netCost}.ts` |
| **Network** | Relaciones y permisos (familia, agente, club, organización) | `parent_athlete_links`, `agent_representations`, `club_roster`, `contact_requests`, `user_blocks`; follow/conexión pendientes |
| **Media** | Actualidad, guía oficial, Showcase Day | `app/news`, `content/guide.ts`, `app/showcase` |
| **Operating System** | Paneles por rol, pipeline, documentos, plan | `app/page.tsx`, `app/pipeline`, `app/documents`, `app/plan` |

Regla: la RLS de Postgres es la fuente de verdad de permisos; la interfaz solo refleja lo que la base de datos permite.

## E) MVP para validar el negocio

**Hipótesis:** atletas de España crean Passports útiles, organizaciones verificadas publican oportunidades reales y ambas
partes generan interacciones cualificadas cada semana.

- **Beachhead propuesto:** España → EE. UU., **baloncesto** (autoridad de la fundadora, NCAA D-I) **+ un segundo deporte** a elegir
  con datos (fútbol por volumen o tenis por oferta de becas por plaza).
- **Flujo mínimo de principio a fin:** organización publica → aparece en `/oportunidades` → atleta crea Passport → ve su match →
  candidatura → la organización la gestiona en el pipeline → mensaje con control familiar.
- **North Star:** interacciones cualificadas semanales entre talento y organizaciones verificadas
  (candidaturas + contactos aceptados + shortlists).
- **Criterio de éxito del piloto (12 semanas):** objetivos a fijar con la fundadora (ver I).

## F) Roadmap

| Fase | Semanas | Contenido | Estado |
|---|---|---|---|
| 0 | 1-2 | Estabilidad, accesibilidad, seguridad, auditoría | ✅ base en verde |
| 1 | 4-8 | Home, marketplace público, confianza, Passport público, match por áreas, piloto | 🟡 en curso |
| 2 | 6-10 | Calendario unificado, CRM club/academia, comparador ampliado | Existe en gran parte |
| 3 | 6-12 | Follow, conexiones, referencias, alumni, publicaciones limitadas | Pendiente |
| 4 | 4-8 | CMS, newsletter, SEO editorial, historias autorizadas | Pendiente |
| 5 | 6-10 | Planes B2B con equipos, límites y facturación | Parcial (Stripe B2C) |
| 6 | continua | Gala IA contextual, i18n, PWA, API | Parcial |

## G) Módulos a modificar primero

`src/content/brand.ts` · `src/app/page.tsx` · `src/app/oportunidades/` · `src/app/seguridad/` ·
`src/app/athletes/[id]` (Passport público + OG) · `src/lib/domain/match.ts` (subpuntuaciones, con tests) ·
`src/components/OpportunityCard.tsx`.

## H) Riesgos

- **Negocio:** marketplace vacío al abrir (mitigación: piloto cerrado con socios, no abrir en abierto sin oportunidades reales).
- **Legal:** textos legales en borrador; menores; NIL; transferencias internacionales. Revisión jurídica antes de abrir registro.
- **Técnico:** analítica anónima sin violar el consentimiento de cookies; crecimiento del esquema al añadir la capa de red.
- **Marca:** prometer "global" sin oferta fuera de EE. UU. Por eso clubes aparece como **Piloto** y nada se inventa.

## I) Preguntas imprescindibles (para la fundadora)

1. ¿Qué segundo deporte entra en el piloto junto al baloncesto?
2. ¿Cuántas organizaciones socias puedes comprometer para publicar oportunidades reales antes de abrir?
3. ¿Con qué dominio público se lanza (para metadatos, OG y verificación)?

## J) Acción inmediata

1. Fusionar la PR #11 (marca, home, `/oportunidades`, `/seguridad`).
2. Siguiente PR: Passport público con vista previa propia + Gala Match por áreas con nivel de confianza.

## Backlog (siguientes tareas)

| ID | Épica | Título | Perfil | Prioridad | Esfuerzo | Archivos | Criterio de aceptación | KPI | Fase |
|---|---|---|---|---|---|---|---|---|---|
| ID-01 | Identity | OG y metadatos por Passport público | Atleta | P1 | S | `app/athletes/[id]` | Vista previa con nombre, deporte y posición; nunca para menores | CTR compartidos | 1 |
| ID-02 | Identity | QR del Passport | Atleta, club | P2 | S | `app/share` | QR descargable que apunta al enlace privado | Aperturas por QR | 1 |
| OP-01 | Opportunities | Match por áreas con confianza | Atleta | P1 | M | `lib/domain/match.ts`, tests | Subpuntuación deportiva/académica/económica/plazos; "confianza baja" si faltan ≥2 datos | Candidaturas/match visto | 1 |
| OP-02 | Opportunities | Detalle público de oportunidad (sin datos sensibles) | Visitante | P1 | M | `app/oportunidades/[id]` | Solo publicadas y verificadas; CTA a Passport | Visitas → Passport | 1 |
| OP-03 | Opportunities | Flujo de club: publicar prueba | Club | P1 | M | `app/opportunities/new` | Tipo `tryout` con campos propios, revisión automática | Pruebas publicadas | 2 |
| NW-01 | Network | Follow de organizaciones | Atleta | P3 | L | migración nueva, RLS, tests | Sin follows visibles en menores; denuncia y bloqueo | Retorno semanal | 3 |
| AN-01 | Analítica | Embudo anónimo agregado | Negocio | P1 | M | `lib/events.ts`, migración | Sin cookies ni IP; respeta consentimiento | Conversión home→Passport | 1 |
| I18N-01 | Plataforma | Capa de traducción es/en | Internacional | P2 | L | `content/`, componentes públicos | Home y públicas en inglés | Registros no ES | 6 |
