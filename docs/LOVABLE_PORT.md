# Portado desde la versión Lovable (feb–jun 2026)

Material revisado:
- Dossiers: Sports Opportunity OS definitivo, Revisión top tier por actores, Blueprint legal y Prompts de Lovable.
- Lote 1: Academia SAT/TOEFL, ThemeToggle, landing, 4 migraciones y documentación.
- Lote 2: paneles de admin y analítica, verificación, 17 edge functions, contextos, catálogos, 25 migraciones (ene–jun 2026), configuración, roadmap y AGENTS.

Criterio: se porta lo que aporta valor real, adaptado a la base de seguridad (RLS probada, protección de menores, organizaciones verificadas). Se descarta lo inventado, lo inseguro y lo que duplica algo que ya está mejor resuelto.

## Incorporado

| De Lovable | En la plataforma nueva | Cambios para hacerlo real y seguro |
|---|---|---|
| Academia SAT/TOEFL (AcademyHero, SATTOEFLAcademy, PracticeEngine, TestRegistrationGuide) | `/app/academia`, `src/content/academy.ts`, tablas `academy_progress` y `academy_attempts` | Actualizada al SAT digital y al TOEFL 2026 (escala 1–6). Se han quitado los "mínimos NCAA" de SAT/TOEFL, que no existen. Fechas oficiales 2026-27 y tarifas reales. Sin XP, rachas ni combos. Temporizador opcional con el ritmo real. El progreso lo ve la familia y no las organizaciones |
| `saved_searches` + trigger `match_saved_searches` | Búsquedas guardadas con alertas en Listas | El trigger original avisaba de cualquier atleta (también menores) a cualquier búsqueda. Ahora las coincidencias se calculan con la RLS de quien busca, solo hay filtros permitidos y un máximo de 25 |
| `quick_updates` (stories de 7 días, visibles para anónimos) | Novedades del atleta (`athlete_updates`, 30 días) | Siguen la visibilidad del perfil. Los menores no pueden publicar contacto ni redes. Son denunciables. Sin contadores de visitas |
| `blocked_users` / `messaging_restrictions` | Bloqueo efectivo | Bloquear una solicitud bloquea a toda la organización: deja de ver el perfil y no puede volver a pedir contacto |
| `notifications` + triggers `notify_on_*` | Notificaciones internas y campana | Las genera el sistema: contacto, candidaturas y verificación. Sin avisos de visitas al perfil (pensado para menores). Al rechazar o bloquear no se revela cuál de las dos cosas fue |
| AdminCommandCenter, TalentScarcityReport, MarketHeatmap, IncompleteProfiles, UserGrowth | `/app/admin/panel` | Solo datos reales, agregados y sin perfiles individuales: North Star (conexiones cualificadas), embudo, colas y liquidez por posición (oferta frente a demanda) |
| Revenue dashboards, `subscriptions`, Stripe | `/precios` + `service_requests` + pipeline comercial en el panel | Validación concierge: se solicita sin pagar y el admin gestiona el pipeline. Los cobros se activan tras la revisión legal (desistimiento, fiscalidad) |
| `user_feedback` | Feedback del piloto en Inicio y en el panel | Inserción propia; lectura solo del admin |
| ThemeToggle | Tema oscuro, claro y alto contraste | Tokens propios con contraste revisado y sin parpadeo al cargar |
| Index (Hero, HowItWorks, ObjectionFAQ, SEO JSON-LD) | Landing: Cómo funciona, FAQ de objeciones y JSON-LD (Organization + FAQPage) | Sin MarketStats inventados |
| plan.md (auditoría legal) | Bases jurídicas por tratamiento, encargados, planes de pago, resolución de conflictos | El enlace a la plataforma ODR **no** se añade: cerró el 20/07/2025 |
| CUSTOM_DOMAIN_SETUP / SELF_HOSTING | `docs/DEPLOYMENT.md` | Adaptado a Next.js + Netlify y a The Gala Alliance (no "The Recruit Hub") |
| `scholarship-ai`/`ai-fit-score`/`gala-ai` (Gemini vía Lovable) | Ya cubierto por Gala IA (Anthropic) y el matching explicable | — |
| SAT medio y tasa de admisión | Importados de College Scorecard en la ficha de universidad y en la Academia | — |

## Descartado (y por qué)

| Elemento | Motivo |
|---|---|
| `scholarships.ts` (becas de UT Austin y otras con `isVerified: true`) | Datos de demostración presentados como reales. Las oportunidades solo las publican organizaciones verificadas |
| CampusTourViewer (15 universidades con escenas fijas) | Medios no oficiales ni licenciados. Usamos el `virtual_tour_url` oficial de cada universidad |
| Escrow, `transactions`, `trust_records`, comisiones 15 % / 10 % | Puerta legal cerrada. Además, un club podía crear transacciones a nombre de cualquier atleta y `trust_records` era legible por anónimos |
| Gamificación (`user_xp`, `daily_challenges`, `xp_leaderboard`, rachas) | Patrones adictivos y rankings públicos, prohibidos para menores en nuestro diseño (DSA y directrices UE) |
| `profile_views` + `notify_on_profile_view`, `follows`/`follower_milestones` | Exponen a menores quién les mira o sigue; según la revisión por actores "una visita no es interés". Medimos respuestas reales |
| Edge function de elegibilidad con `service_role` y sin autenticación | Cualquiera podía leer el perfil completo de un atleta por id |
| Análisis de vídeo por IA (`video-analysis`) y scouting report con notas 1–100 | El modelo no ve el vídeo: inventaba jugadas con minuto y notas. También choca con la regla de no puntuar a personas |
| Análisis de contratos NIL por IA | Puede parecer asesoramiento jurídico; NIL está fuera del alcance hasta la revisión legal |
| `email-drip` (dominio theprospectportal.com) | Pertenece a otro producto; los emails irán por Resend cuando se activen con consentimiento |
| ArchitectChat, StagingPanel, ComingSoon | Herramientas de desarrollo, no producto |
| Rate limit en memoria de las edge functions | No funciona entre instancias. Los límites están en la base de datos (triggers) |
| CORS `*` en las funciones | Innecesario: Server Actions y rutas del mismo origen |
| Mínimos "NCAA D1 SAT 900 / TOEFL 61", fechas SAT 2026 en domingo, precio SAT 60 USD | Datos falsos o desactualizados (ver `src/content/academy.ts`) |

## Pendiente de recibir para seguir portando

- Las migraciones que crean `athletes`, `contracts`, `document_vault`, `family_links`, `scholarship_offers` y `recruiting_offers`: este lote solo trae parte del historial.
- Páginas (`src/pages/*`) y hooks como `useProfile` y `useDataSovereignty`, para revisar flujos de onboarding y del centro de privacidad.
- Si existe: la lógica de `document_vault` con almacenamiento privado, para el centro de documentos familiar (URLs firmadas).
