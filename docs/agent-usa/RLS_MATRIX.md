# RLS_MATRIX · modelo de permisos (skill → repo)

> Referencia: `references/rls-model.md`. Fuente real: políticas en `supabase/migrations/`, pruebas en
> `supabase/tests/rls.test.mjs`. **No re-ejecutado en esta revisión.** Recuentos declarados por los docs del repo:
> `README.md` 198 casos (desfasado), `docs/AGENT-RLS.md` 364, `docs/AGENT-HOME.md` §G «401 OK».

## 1. Roles contextuales

| Rol skill | Equivalente real | Dónde |
|---|---|---|
| `athlete` | Dueño de `athlete_profiles` (`user_id = auth.uid()`) | foundation |
| `guardian` | `parent_athlete_links` aprobado + `is_active_guardian`, `is_minor_guardian_of`, `guardian_has_scope` | foundation, `20261124000*_10_family*.sql` |
| `org_owner` / `org_admin` | `organization_members.member_role = 'admin'`; agencias: `agency_role` owner/admin | foundation, `20261116000700_agency_core.sql` |
| `recruiter` / `coach` / `agent` | `member_role` recruiter/coach; `agency_role` manager/recruiter/scout/compliance; asignación en `representation_assignments` | `20261120000400_org_roles_v2.sql`, 12A |
| `scout` | `agency_role = 'scout'`; capacidades por `org_can(p_org, p_cap, p_program)` | `20261120000400_org_roles_v2.sql` |
| `viewer` | `agency_role = 'viewer'` / asignación `viewer` → solo lectura | 12A/12B |
| `moderator` / `platform_admin` | `user_roles` (admin) + `admin_roles` + `break_glass_grants` (auditado) + MFA | `20261129000100_14_trust_safety.sql` |

## 2. Helpers (skill → existentes)

| Helper skill | Existente | Notas |
|---|---|---|
| `is_org_member(org_id)` | `is_org_member(p_org, p_admin_only)` | Existe |
| `has_org_role(org_id, roles[])` | `org_can(p_org, p_cap, p_program)`, `org_can_scope`, `agency_can_write`, `agency_manages` | Por **capacidad**, no por lista de roles (mejor) |
| `can_view_athlete(athlete)` | `can_view_athlete(p_athlete, p_block)` | Por bloque del Passport |
| `is_guardian_of(athlete)` | `is_guardian_of`, `is_minor_guardian_of`, `is_active_guardian` | Existe |
| `can_manage_opportunity(id)` | `org_can_opp(p_opportunity, p_cap)` | Existe |
| `can_access_pipeline_entry(id)` | `case_access`, `case_access_by_id` (agencia); `application_org` (universidad) | Existe |
| — (específico agente) | `agent_can(atleta, permiso, deporte, país, categoría, oportunidad)`, `agent_can_via`, `agency_may_message` | Cadena de 6 condiciones (`docs/AGENT-RLS.md`) |

Todas `security definer` con `search_path` fijo y `revoke … from public, anon` (patrón visto en 12B y en
`20261213000100_agency_message_authority.sql`). Pendiente según `docs/ARCHITECTURE-AUDIT.md`: restringir
`is_listed_adult_profile` (ejecutable sin sesión).

## 3. Matriz por entidad (estado real)

| Tabla real | Select | Insert/Update | Delete | ¿Como la skill? |
|---|---|---|---|---|
| `profiles` | Propio + vistas seguras (`athlete_directory`) | Propio, campos permitidos; identidad inmutable (`guard_identity_immutable`) | Baja RGPD por RPC (`delete_my_account`) | Sí |
| `athlete_profiles` y bloques | Atleta; tutor según vínculo; agente con `passport.view`; organizaciones según `can_view_athlete` | Atleta/tutor con reglas de edad | Flujo servidor | Sí |
| `organizations` | Públicos verificados (permisos por columna para `anon`, `20261116001000_public_column_privileges.sql`); miembros | Admin; verificación solo admin/auto (`auto_verify_organization`) | Servidor (riesgo cascada C1) | Sí, con riesgo C1 |
| `organization_members` | Misma organización | Admin; suspensión/transferencia por RPC | Admin/servidor | Sí |
| `athlete_documents` + `document_access_grants` | Dueño/tutor; concesión explícita + `documents.view` para agente | Dueño/tutor | Dueño | Sí |
| `recruiting_cases` (+tareas, actividades) | `case_access(..., false)`: asignado con `pipeline.view` o dirección de agencia (solo lectura) | `case_access(..., true)` + `guard_recruiting_case` (representación activa) | No hard delete | Sí |
| `agency_contacts` | Miembros de la agencia | `agency_can_write` (no viewer) | Miembros que escriben | Sí; **revisar** si deben ser visibles a todo miembro o por asignación |
| `org_candidates`, `org_notes`, `org_tasks` | Misma organización por capacidad | `org_can` | Archivo | Sí |
| `opportunities` | Publicadas de orgs verificadas; borradores de la gestora | `org_can_opp` + `guard_opportunity_*` | Archivo/erasure (`20261121000600_11a_opportunity_erasure.sql`) | Sí |
| `applications` | Atleta/tutor y organización gestora | Atleta su respuesta; organización transiciones vía RPC | Sin hard delete | Sí |
| `agent_representations` + `representation_*` | Partes y asignados (`can_see_representation`) | Solo RPC `representation_*` (marca `gala.rep_rpc`) | Transición de estado | Sí (más estricto) |
| `representation_invitations` | Atleta/tutor que invita y agencia invitada | RPC | Caducidad | Sí |
| `contact_requests` / `contact_messages` | Participantes | Participante sin bloqueo; agencia con `agency_may_message` | Inmutables | Sí |
| `content_reports`, `safety_cases`, `user_blocks` | Reportante (acuse); moderación servidor | Propio | No cliente | Sí |
| `audit_logs` | Sin select de cliente general | Servidor | Nunca | Sí |
| `subscriptions`, `billing_*` | `can_see_billing_account` | Solo webhook (`billing_apply_event`) | Nunca (`ledger_append_only`) | Sí |
| `product_events` | Propios (export RGPD); agregados admin | `log_event()` | Retención 13 meses | Sí |
| `ai_conversations/messages` | Solo dueño | Solo si historial activo (`ai_history_off`) | Dueño / 90 días | Sí |

## 4. Pruebas negativas obligatorias (skill) → cobertura conocida

| Caso | Cubierto (según docs) | Evidencia |
|---|---|---|
| Anónimo denegado | Sí | `docs/AGENT-RLS.md`, `docs/FAMILY-PENTEST.md`, `20261209000100_09r_anon_minor_oracle.sql` |
| Otro atleta / tutor no vinculado | Sí | `docs/FAMILY-RLS.md` |
| Miembro de otra organización | Sí | `docs/CLUBS-ACADEMIES-RLS.md`, `docs/AGENT-RLS.md` |
| Membresía suspendida | Sí (miembro) | `org_suspend_member` |
| Concesión/representación caducada o revocada | Sí | `docs/AGENT-RLS.md` «Revocación, caducidad y suspensión» |
| Invitación revocada | Parcial (por tipo de invitación) | `docs/REPRESENTATION-TESTS.md` |
| Service role aislado | Sí (solo webhook) | `docs/DEPLOYMENT.md` §2 |

## 5. Políticas necesarias para las épicas nuevas (diseño, no aplicado)

| Épica | Tabla nueva / cambio | Select | Insert/Update | Delete | Pruebas negativas mínimas |
|---|---|---|---|---|---|
| E1 importar + reclamar | `agency_athlete_imports` | Miembros de la agencia con capacidad de cartera; **nunca** otras agencias; el atleta solo vía RPC de reclamación (token) | Insert `agency_can_write`; estado solo por RPC; reclamar = RPC `security definer` que valida token hash, email, identidad, caducidad y un solo uso | Revocar (estado), no borrar | Otra agencia no ve filas; viewer no importa; token caducado/revocado/reusado falla; menor sin tutor no activa representación; reclamar no da a la agencia más permisos que `representation_request` |
| E2 outreach | `recruiting_case_activities` extendida | Igual que hoy (`case_access`) | `case_access(..., true)`; estado de entrega solo servidor (webhook Resend) | No | Cliente no puede marcar «respondido» falso desde otra agencia; webhook sin firma rechazado |
| E3 atestación | `representation_fee_attestations` | Partes de la representación + admin | Solo dentro de `representation_request` (RPC) | Nunca (append-only) | Update/delete denegados incluso a admin de agencia |

Ninguna política nueva puede saltarse `agent_can`; ser owner/admin de la agencia **no** basta (`docs/AGENT-RLS.md`).
