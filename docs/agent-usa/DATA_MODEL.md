# DATA_MODEL · entidades de referencia → tablas existentes

> Regla de la skill: `001_core_schema.sql` es un esqueleto de referencia, **no** permiso para sobrescribir el esquema.
> Aquí solo se mapea a lo que ya existe en `supabase/migrations/` y se listan huecos como migraciones **aditivas**
> futuras. Nada de esto se ha aplicado.

## 1. Identidad y tenencia

| Entidad skill | Tabla(s) existente(s) | Migración | Estado | Diferencias / huecos |
|---|---|---|---|---|
| `profiles` | `profiles` | `20261113000100_foundation.sql` | Existe | Clave `id` (no `user_id`); rol global en `app_role` + `user_roles` |
| `athlete_profiles` | `athlete_profiles`, `private_profile_data` (fecha de nacimiento separada) | foundation, `20261117000200_passport_v2.sql` | Existe | Estado de safeguarding derivado (`is_minor`, `minor_contact_mode`) |
| `professional_profiles` | `professional_credentials` | `20261126000100_12_agents_foundation.sql` | Parcial | Sin perfil profesional público separado |
| `guardian_links` | `parent_athlete_links` + `consents` + `family_policies` | foundation, `20261124000100_10_family.sql` | Existe | Más rico que la referencia |
| `organizations` | `organizations` (`org_type`: university, college, club, academy, agency, brand) | foundation | Existe | `verification_status`: unverified/submitted/verified/rejected (sin `under_review`, `suspended`) |
| `organization_memberships` | `organization_members` (+ `agency_role`), `organization_membership_records` | foundation, `20261116000700_agency_core.sql`, `20261120000500_…` | Existe | Rol en dos columnas (`member_role` y `agency_role`) |
| `organization_verifications` | `verification_requests/evidence/checks/decisions`, `organization_domains`, `email_verifications` | `20261120000500_verification_discovery_shortlists.sql` | Existe | |

## 2. Passport y confianza

| Entidad skill | Tabla(s) | Estado | Huecos |
|---|---|---|---|
| `athlete_sport_profiles` | Columnas en `athlete_profiles` + `athlete_career`, `athlete_statistics` | Parcial | Un deporte principal por atleta |
| `athlete_academics` | `athlete_academics` | Existe | `gpa_4` lineal, no oficial (`docs/NCAA-1-AUDIT.md` §A) |
| `evidence_items` | `athlete_videos`, `athlete_documents`, `athlete_achievements`, `athlete_links` | Existe (repartido) | |
| `evidence_verifications` | `verification_*` + enum `data_source` | Parcial | Falta caducidad por dato y «determinación oficial» |
| `profile_visibility_grants` | `document_access_grants`, `passport_field_policies`, `athlete_discovery_settings`, `shortlist_access` | Existe | |
| `professional_athlete_relationships` | `agent_representations` + `representation_*` (6 tablas) | `20261126000200_12a_representation_model.sql` | Existe | Aceptación del atleta/tutor obligatoria (bien) |

## 3. Sistema operativo profesional

| Entidad skill | Tabla(s) | Estado | Huecos |
|---|---|---|---|
| `recruiting_needs` | `recruiting_needs` | Existe | Falta temporada/plazas (`NCAA-1-AUDIT` §C) |
| `opportunities` | `opportunities` + `opportunity_*` (requisitos, costes, detalles) | Existe | 58 columnas |
| `talent_records` (CRM privado) | Universidad: `org_candidates`; Agencia: **solo vía `agent_representations` activa** | **Parcial** | **No hay registro privado de atleta «no reclamado»** → hueco de E1 |
| `pipeline_stages` / `pipeline_entries` | `recruiting_cases.stage` (13 pasos fijos, agrupados en 5 fases), `org_candidates.internal_stage`, `pipeline_*` | Existe | Fases no configurables por organización |
| `lists` / `list_members` | `org_shortlists`, `org_shortlist_members`, `saved_athletes`, `saved_items` | Existe | |
| `evaluations` / `evaluation_templates` | — (notas libres `org_notes`, `agency_athlete_notes`) | **Falta** | Rúbricas estructuradas |
| `tasks` | `recruiting_case_tasks`, `org_tasks`, `pipeline_tasks`, `athlete_task_state` | Existe | Tres tablas |
| `information_requests` | `info_requests` | Existe | |
| `applications` | `applications` + `application_status_history` | Existe | |
| `structured_messages` | `contact_requests` + `contact_messages` | Existe | Ligados a solicitud, no a objeto de flujo |

## 4. Crecimiento, cobro y seguridad

| Entidad skill | Tabla(s) | Estado | Huecos |
|---|---|---|---|
| `invitations` | `organization_invitations`, `club_roster_invites`, `representation_invitations`, `opportunity_invitations`, `outreach_contacts` | Existe (por tipo) | **Falta invitación agencia → atleta importado (reclamar)** |
| `connection_requests` (marketplace-core) | `contact_requests` (+ aprobación de tutor) | Parcial | Sin `purpose` estructurado ni `next_step_completed` |
| `notification_deliveries` | `notifications`, `notification_preferences` | Parcial | Sin estado de entrega por proveedor (Resend id) |
| `subscriptions`, `plans`, `entitlements`, `usage_counters` | Igual nombre + `plan_catalog`, `billing_accounts`, `billing_ledger`, `seat_assignments` | Existe | Falta cupo fundador (ver `BUSINESS_MODEL.md` I1) |
| `reports`, `moderation_cases`, `blocks` | `content_reports`, `safety_cases`, `moderation_actions/appeals`, `user_blocks` | Existe | |
| `audit_events` | `audit_logs` (append-only) | Existe | |
| `analytics_events` | `product_events` | Existe | Lista cerrada por `check` |
| `ai_runs` | `ai_events`, `ai_feedback`, `ai_conversations/messages` | Parcial | Sin `prompt_version` ni IDs de registros fuente (ver `AI_SYSTEM.md`) |

## 5. Estados (skill vs repo)

| Máquina | Skill | Repo | Nota |
|---|---|---|---|
| Verificación de organización | draft→submitted→under_review→verified/rejected/suspended | unverified→submitted→verified/rejected | Sin `suspended` a nivel de organización (existe suspensión de miembro: `org_suspend_member`) |
| Invitación | created→sent→opened→accepted/declined/expired/revoked | Varía por tabla | Unificar vocabulario solo en las nuevas |
| Relación | proposed→accepted→verified/... | requested→(pending_guardian)→(pending_review)→active→expired/revoked/terminated (+declined, suspended, disputed) | Repo más completo |
| Proceso de agencia | — | 13 pasos internos (`recruiting_cases.stage`) | 5 fases visibles: `CASE_PHASES` en `src/lib/domain/agency-cases.ts` |

## 6. Huecos priorizados (migraciones aditivas propuestas, no aplicadas)

1. **E1 · `agency_athlete_imports`** (nombre provisional): `agency_id`, nombre visible, deporte, promoción, email de contacto
   (hash + cifrado o solo para el envío), `is_minor_declared`, estado `pending|invited|claimed|declined|expired|revoked`,
   `claimed_by`, `token_hash`, `expires_at`, `created_by`. Al reclamar → `representation_request`/aceptación con la
   misma cadena `agent_can`. Nunca crea cuenta ni Passport sin la persona.
2. **E2 · Outreach a coaches**: extender `recruiting_case_activities` con `direction`, `delivery_status`,
   `provider_message_id`, `replied_at` o tabla hija `case_outreach_messages`. Reutilizar `agency_contacts`.
3. **E3 · `representation_fee_attestations`**: `representation_id`, `agency_id`, `attested_by`, `text_version`,
   `attested_at`; append-only como `billing_ledger`.
4. Cupo fundador en `plan_catalog`/tabla de cupos.
5. (Después) `evaluations` con plantilla por deporte; `ncaa_rule_sets` sin datos hasta tener fuente.

Cada una con RLS + pruebas negativas (ver `RLS_MATRIX.md`) y comentario de ROLLBACK.
