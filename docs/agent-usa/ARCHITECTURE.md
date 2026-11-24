# ARCHITECTURE · arquitectura actual frente a la referencia de la skill

> Referencia: `references/architecture.md` de la skill. Regla: reconciliar con lo existente; **no** reestructurar a
> monorepo `apps/*`/`packages/*` mientras el monolito actual cumpla (la skill pide modular monolith, y ya lo es).

## 1. Decisión: monolito modular (ya vigente)

| Referencia skill | Repo real | Estado |
|---|---|---|
| Next.js 15+ App Router + TS | Next.js 16 App Router + TS (`package.json`, `src/app/`) | OK |
| Supabase Postgres/Auth/Storage/Realtime | Igual; Realtime en mensajes (`20261115000300_realtime_messages.sql`) | OK |
| Servicios de aplicación en servidor | Server Actions con zod (`src/app/actions/*.ts`) + RPC `security definer` | OK |
| Stripe Connect solo con transacciones validadas | Solo Checkout/Billing; Connect pendiente (`docs/BILLING.md`) | OK (prudente) |
| PostHog | Eventos propios `product_events` (`src/lib/events.ts`) | Alternativa deliberada (sin cookies) |
| Sentry | «Más adelante» (`docs/OBSERVABILITY.md`) | Hueco |
| Resend | Integrado, sin dominio verificado | Bloqueado por gate |
| Playwright + Vitest | 10 specs e2e (`e2e/`), unitarias `*.test.ts`, RLS `supabase/tests/rls.test.mjs` | OK |
| Vercel o equivalente UE | Netlify (`netlify.toml`) | Ver D-07 en `DECISION_LOG.md` |

## 2. Mapa de módulos de dominio (skill → repo)

| # | Módulo skill | Dónde vive | Notas |
|---|---|---|---|
| 1 | Identity & Profiles | `profiles`, `athlete_profiles`, `private_profile_data`; `src/app/actions/onboarding.ts` | |
| 2 | Organizations & Membership | `organizations`, `organization_members` (+ `agency_role`), `organization_invitations` | |
| 3 | Athlete Passport & Evidence | `athlete_*`, `athlete_documents`, `verification_*`; `src/lib/domain/passport.ts`, `readiness.ts` | |
| 4 | Professional CRM | Agencia: `recruiting_cases`, `agency_contacts`, `agency_athlete_notes`; Universidad: `org_candidates`, `org_notes` | Dos CRMs por tipo de organización |
| 5 | Searches, Lists, Evaluations | `saved_searches`, `org_saved_searches`, `org_shortlists`; `src/lib/domain/talent-search.ts` | Sin `evaluations` estructuradas |
| 6 | Opportunities / Needs | `opportunities` (58 columnas, `docs/ARCHITECTURE-AUDIT.md`), `recruiting_needs` | |
| 7 | Applications & Pipelines | `applications`, `pipeline_*`, `recruiting_cases` | Tres capas de pipeline (`docs/NCAA-1-AUDIT.md` §A) |
| 8 | Invitations & Claiming | `organization_invitations`, `club_roster_invites`, `representation_invitations`, `opportunity_invitations`, `recruiting_links` | **Falta reclamación de atleta importado** |
| 9 | Tasks, Notifications, Messages | `recruiting_case_tasks`, `org_tasks`, `pipeline_tasks`, `notifications`, `contact_requests/messages` | |
| 10 | Trust, Moderation, Audit | `safety_cases`, `moderation_*`, `content_reports`, `user_blocks`, `audit_logs` | |
| 11 | Billing & Entitlements | `plan_catalog`, `subscriptions`, `entitlements`, `usage_counters`, `feature_limit()` | |
| 12 | Analytics & Experiments | `product_events`, `metric_definitions`, `feature_flags` | Sin framework de experimentos |

Lógica pura en `src/lib/domain/` (equivale a `packages/domain`). Eventos tipados en `src/lib/events.ts` (equivale a
`packages/analytics`).

## 3. Seguridad de acceso

- Cliente nunca usa service role; la única excepción documentada es el webhook de Stripe
  (`src/app/api/stripe/webhook/route.ts`, `docs/DEPLOYMENT.md` §2) y `ensureCustomer` en `src/app/actions/billing.ts`.
- RLS es la última barrera (160/160 tablas). Helpers en `RLS_MATRIX.md`.
- Admin: `user_roles` + `admin_roles` + MFA (`src/lib/domain/mfa.ts`); nunca metadatos editables.

## 4. Storage

Bucket privado `athlete-documents` (migración `20261113000700_documents_clubs_analytics.sql`), acceso por
`document_access_grants` y `document_open()`. La skill propone 4 buckets privados (`athlete-evidence`,
`verification-documents`, `organization-documents`, `message-attachments`): **no migrar**; solo crear uno nuevo si
llega un caso real (p. ej., CSV de importación, que no debe almacenarse: procesar y descartar).

## 5. Embudo de la skill → eventos existentes (`src/lib/events.ts`)

| Paso skill | Evento(s) existente(s) | Estado | Hueco a cubrir |
|---|---|---|---|
| `professional_signed_up` | `signup_completed` + `onboarding_completed {role}` | Parcial | Segmentar por rol agente en el panel |
| `organization_verified` | — (solo `audit_logs` `organization.auto_verified`) | **Hueco** | Evento al pasar a `verified` (auto o admin) |
| `first_need_or_opportunity_created` | `recruiting_need_created` (universidad) | Parcial | Agencia: no emite nada al crear `recruiting_cases` → `agency_case_created` |
| `athlete_invited` | `representation_requested`, `trial_invitation_sent`; `agency_invited` es la dirección inversa | Parcial | `athlete_claim_invited` (E1) |
| `invite_opened` | `trial_invitation_opened` | Parcial | Apertura de invitación de reclamación/representación |
| `athlete_claimed` | `representation_accepted`, `roster_joined` | Parcial | `athlete_claimed` (E1) |
| `passport_critical_complete` | `passport_completed` (**reservado, no se emite**) | **Hueco** | Emitir al cruzar umbral de readiness |
| `professional_followup` | `interaction_logged` (pipeline del atleta), `note_added`, `agent_attention_opened` | Parcial | Agencia: actividades de `recruiting_case_activities` no emiten |
| `reciprocal_interaction` | `contact_accepted`, `document_shared`, `representation_accepted` | Parcial | Respuesta de coach (E2) |
| `pipeline_advanced` | `pipeline_stage_changed`, `candidate_stage_changed` | Parcial | Cambio de fase en `recruiting_cases` no emite |
| `professional_week_4_retained` | Derivable de `agent_home_viewed` (dedupe por hora) | Derivable | Métrica en `metric_definitions`, no evento |
| (ingresos) | `plan_requested`, `subscription_started` (**reservado**) | **Hueco** | Emitir desde webhook |

Añadir un evento requiere migración que reemplace `product_events_event_check` (`docs/ANALYTICS_EVENTS.md`
«Añadir un evento»). No se incluyen datos personales en `props`.

**North Star de la skill:** «weekly reciprocal professional-athlete workflows advanced». Hoy el panel usa
«conexiones cualificadas al mes» (`docs/BUSINESS_MODEL.md`). Propuesta: mantener la existente y añadir el corte
semanal por agencia cuando existan los eventos de agencia.

## 6. Entrega y fiabilidad

- Migraciones forward-only con comentario de ROLLBACK (patrón en `20261213000100_agency_message_authority.sql`).
- CI pedida por la skill: lint, tipos, unitarias, RLS, Playwright, accesibilidad, build, escaneo de dependencias y
  secretos. El repo tiene los scripts (`README.md` «Comandos»); **no verificado** aquí si el escaneo de secretos y
  dependencias corre en CI.
- Observabilidad: falta Sentry y comprobación sintética de alta y reclamación de invitación.

## 7. Deuda arquitectónica relevante para el agente

1. 45 FKs en cascada desde `organizations` (`docs/ARCHITECTURE-AUDIT.md` C1): borrar una agencia borra representaciones.
2. 0 de 4 fusiones del plan de datos ejecutadas (mismo doc).
3. Reglas NCAA fijas sin versión (`ncaa_contact_opens_on`, `src/lib/domain/ncaa.ts`).
