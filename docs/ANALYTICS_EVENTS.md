# Eventos del embudo

Medición propia, sin herramientas de terceros ni cookies de analítica: los eventos se guardan en `product_events` (Supabase) mediante `log_event()`, solo para usuarios con sesión.

## Reglas

- **Lista cerrada.** La base de datos rechaza cualquier evento que no esté en esta tabla (restricción `check`).
- **Sin datos personales en las propiedades.** `props` es un objeto JSON de máximo 512 bytes con valores técnicos (plan, rol, tipo, número). Nunca nombres, emails, textos libres ni datos de menores.
- **Límite:** 300 eventos por persona y hora; por encima se descartan en silencio.
- **Nunca bloquea al usuario.** Si el registro falla, la acción sigue (`src/lib/events.ts`).
- **Acceso:** cada persona puede ver y exportar sus propios eventos (Privacidad → Descargar mis datos); el admin ve los agregados en el Panel de mando (`admin_event_counts`).
- **Retención:** se borran solos a los 13 meses (`run_retention`, diario).

## Catálogo

| Evento | Dónde se registra | Propiedades | Para qué sirve |
|---|---|---|---|
| `signup_completed` | `signUp` (si la sesión queda abierta) | — | Altas |
| `onboarding_completed` | `completeOnboarding` | `role` | Activación por actor |
| `passport_saved` | `saveProfile` | — | Atletas que trabajan su perfil |
| `opportunity_viewed` | Ficha de oportunidad (atletas) | — | Interés por la oferta |
| `application_submitted` | `applyToOpportunity` | — | Conversión a candidatura |
| `contact_requested` | `requestContact` | — | Demanda de las organizaciones |
| `contact_accepted` | `respondContact` (aceptado) | — | North Star (conexión cualificada) |
| `search_saved` | `saveSearch` | — | Retención de reclutadores |
| `plan_requested` | `requestPlan`, `startCheckout` | `plan`, `channel` (`request` / `checkout`) | Intención de compra |
| `academy_attempt` | `saveAcademyAttempt` | `exam` | Uso de la Academia |
| `document_uploaded` | `recordDocumentUpload` | `kind` | Avance documental |
| `roster_joined` | `acceptRosterInvite` | — | Canal B2B2C (academias) |
| `universities_compared` | Comparador de universidades (≥ 2) | `count` | Uso del comparador |
| `passport_shared` | `createRecruitingLink` | `channel` | Atletas que mueven su Passport |
| `video_uploaded` | `addVideo` | `kind` | Activación del bloque de vídeo |
| `university_viewed` | Ficha de universidad (atletas) | — | Interés por universidades |
| `university_saved` / `opportunity_saved` | `toggleSaved` (al guardar) | — | Construcción de shortlist |
| `match_viewed` | Detalle de Gala Match | `kind` | Uso de la explicación del encaje |
| `comparison_created` | Comparador (≥ 2) | `count` | Paso de descubrir a decidir |
| `task_completed` | `setTaskState` (hecho) | `task`, `priority` | Si el Next Best Action ayuda a avanzar |
| `dashboard_viewed` | Inicio del atleta (Command Center) | `stage`, `actions` | Retorno al panel por etapa |
| `pipeline_stage_changed` | `moveStage`, `quickMove` | `stage` | Avance real de los procesos |
| `pipeline_decision` | `moveStage` (comprometida / cerrada) | `stage` | Cierre de procesos |
| `interaction_logged` | `logInteraction` | `channel` | Uso del CRM del atleta |
| `offer_recorded` | `addProcessOffer` | `in_writing` | Ofertas y si llegan por escrito |
| `recruiting_need_created` · `athlete_discovered` · `athlete_shortlisted` | Portal de recruiting | — | Uso del lado universidad |
| `candidate_assigned` · `candidate_stage_changed` | Pipeline interno | `stage` | Colaboración del staff |
| `document_requested` · `document_shared` | Solicitudes de información | `kind` | Flujo de consentimiento |
| `offer_created` · `candidates_exported` · `coach_dashboard_viewed` | Portal | `rows` | Ofertas reales, exportaciones y retorno |
| `passport_completed` | Reservado (aún no se emite) | — | Se activará al medir el cruce del umbral de preparación |

## Añadir un evento

1. Nueva migración que sustituya la restricción `check` de `product_events.event`.
2. Añadir el nombre al tipo `FunnelEvent` en `src/lib/events.ts`.
3. Documentarlo en esta tabla con su propósito. Si no hay una decisión que dependa de él, no se añade.
