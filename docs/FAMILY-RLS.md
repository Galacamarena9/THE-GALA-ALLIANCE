# Family RLS (Prompt 10A)

Rule: **deny by default**. Being logged in grants nothing. Each read or write requires this chain:
auth → identity → guardian relationship → status (active, not paused, review at 18 not overdue) → permission → (consent where applicable) → RLS.

Prueba de cada fila: `supabase/tests/rls.test.mjs`, bloques **P10** y **P10A** (más P9 para documentos).

## Actores probados

Atleta dueño · atleta menor · tutor activo (mamá) · tutor con permisos limitados (papá sin costes) · tutor pausado · tutor revocado · tutor con revisión de los 18 vencida · usuario sin relación · coach verificado del club · otro club · anónimo · admin de Gala. El *service role* no se usa nunca como identidad de usuario (lo prohíbe `check:secrets` y solo existe en el webhook de Stripe y el correo de verificación, ver `SUPABASE_ARCHITECTURE.md`).

## Helpers (PostgreSQL)

| Función | Qué responde |
|---|---|
| `has_family_link(atleta, permiso)` | Tutor con relación `approved`, no vencida a los 18, y con ese permiso |
| `is_active_guardian(atleta)` | Tutor activo con cualquier permiso |
| `guardian_has_scope(atleta, 'athlete.x.y')` | Scope legible → permiso real. Desconocido = **false** |
| `guardian_can_view_resource(atleta, recurso)` | Igual, por nombre de recurso (notas privadas del atleta: siempre false) |
| `requires_guardian_consent(atleta, acción)` | Menor + acción sensible |
| `family_link_lapsed(…)` | La revisión al cumplir 18 venció sin confirmación |

## Scopes → permisos

| Scope | Columna en la relación | Por defecto |
|---|---|---|
| `athlete.profile.view`, `.passport.view`, `.shortlist.view`, `.tasks.view` | `can_view_profile` | Sí |
| `athlete.pipeline.view`, `.deadlines.view` | `can_view_applications` | Sí |
| `athlete.offers.view` | `can_view_applications` **o** `can_view_costs` | Sí |
| `athlete.costs.view` | `can_view_costs` | Sí |
| `athlete.family_budget.view` | `can_view_budget` | Sí |
| `athlete.documents.view` | `can_view_documents` | Sí |
| `athlete.contacts.view`, `.safety.view` | `can_view_contacts` | Sí |
| `athlete.messages.view` | `can_view_messages` | **No** |
| `athlete.contacts.approve`, `.documents.approve_share`, `.consents.manage` | Tutor activo **y** atleta menor | — |

Solo el atleta cambia permisos (`guard_family_link`). Todo cambio queda en `audit_logs` (`family_link.scope_changed`).

## Matriz por recurso

| Recurso | Clasif. | Atleta | Tutor | Club relacionado | Otro club / otra familia / anónimo | Política (SELECT) | Escritura |
|---|---|---|---|---|---|---|---|
| Relación familiar `parent_athlete_links` | Sensible | Las suyas | Las suyas | No | No | `links_select` | Solo revocar; permisos solo el atleta; estados por RPC |
| Passport / perfil | Personal | Sí | `profile.view` | Según visibilidad del atleta | Según visibilidad | `athlete_select` | Atleta; tutor con `edit_profile` |
| Documentos `athlete_documents` | Confidencial | Sí | `documents.view` | Solo con concesión vigente | No | `docs_select`, `docs_select_org_grant` | Atleta / tutor con `edit_profile`; ruta en su carpeta |
| Concesiones de documento | Confidencial | Sí | `view_profile` | Las suyas | No | `doc_grants_select` | Conceder: atleta o tutor con edición; revocar no se deshace |
| Presupuesto `athlete_finances` | **Sensible** | Sí | `family_budget.view` | **Nunca** | **Nunca** | `athlete_or_guardian_view_family_budget` | Atleta / tutor con edición |
| Escenarios de coste | Sensible | Sí | `costs.view` | **Nunca** | **Nunca** | `fcs_select` | Atleta / tutor con costes; dueño inmutable |
| Ofertas `athlete_offers` | Personal | Sí | `offers.view` | Las que hizo esa organización | No | `athlete_or_guardian_view_offers`, `offers_select_org` | Atleta / tutor con edición |
| Notas familiares | Sensible | Solo las «compartidas» | Todas las de ese atleta | **Nunca** | **Nunca** | `family_notes_select` | Autor; el atleta solo puede compartir |
| Notas del club `org_notes`, `application_notes` | Interna org. | **Nunca** | **Nunca** | Con permiso `notes` | No | `org_notes_select`, `notes_org_only` | Staff con permiso |
| Estado interno del club `org_candidates` | Interna org. | No | No | Con alcance de programa/equipo | No | `candidates_select` | Staff con `pipeline` |
| Estado visible del proceso `applications` | Personal | Sí | `pipeline.view` | Su oportunidad | No | `apps_select` (sin columnas internas) | Transiciones por RPC |
| Tareas `pipeline_tasks` | Personal | Sí | `tasks.view` | **Nunca** | No | `pipeline_tasks_select` | Familia: solo tareas `guardian`/`both` |
| Solicitudes de contacto | Menores | Sí | Menor: tutor activo siempre · Adulto: `contacts.view` | La suya | No | `parties_and_guardians_view_contact_requests` | Aprobar: tutor **activo** de un menor |
| Mensajes | Menores | Sí | Menor: tutor activo (política «visible») · Adulto: `messages.view`, solo lectura | Su conversación | No | `cmsg_select`, `guardians_with_scope_view_adult_messages` | Partes; bloqueos aplicados |
| Consentimientos | Menores | Los suyos | Los que dio | No | No | `consents_select`, `consents_select_guardian` | Inmutables; revocar = nueva fila; cascada a concesiones |
| Bloqueos `user_blocks` | Seguridad | Los suyos | — | No | No | propia | Bloquear corta mensajes, contactos y Discovery |
| Denuncias `content_reports` | Seguridad | Las suyas | Las suyas | No | No | `reports_select` | Moderación solo admin |
| Evidencias de verificación | Sensible | Las suyas | **No** (no por ser tutor) | No | No | `ve_select` | Bucket privado, carpeta del remitente |
| Auditoría `audit_logs` | Interna | No | No | No | No | Solo admin | Solo funciones del sistema |

## Comportamiento por estado de la relación

| Estado | Lectura | Escritura | Notas |
|---|---|---|---|
| `approved` (activa) | Según permisos | Según permisos | — |
| `restricted` (pausada por el atleta) | **Nada** | **Nada** | Reanudar solo el atleta |
| Revisión de mayoría vencida | **Nada** | **Nada** | Vuelve solo si el atleta confirma |
| `revoked` / `expired` | **Nada** | **Nada** | Inmediato: se evalúa en cada consulta (sin caché de sesión) |

## Fugas indirectas revisadas

- **Presupuesto:** ninguna función, vista, RPC ni filtro de Discovery lee `athlete_finances` (comprobado en SQL y en el código). Gala Match lo usa solo con la sesión del atleta/familia; para un club la RLS lo devuelve vacío. Gala AI lo lee solo con la sesión del tutor y su permiso.
- **Notas familiares:** ninguna vista de coach las incluye; Gala AI de club no tiene herramienta que las lea.
- **Notas del club → familia:** no existe política que las exponga al atleta ni al tutor.
- **Fecha de nacimiento:** solo `is_minor` / `viewer_is_minor` (no invocables para terceros).

## Tiempo real

Solo `contact_messages` está en la publicación de Realtime; Supabase aplica la RLS a cada evento, así que un tutor pausado, revocado o vencido deja de recibirlos.

## Gala AI

`get_family_overview` usa la sesión del tutor (misma RLS), respeta cada permiso (sin `costs.view` no lee escenarios; sin `family_budget.view` no lee presupuesto) y nunca usa clave de servicio (prueba unitaria en `ai.test.ts`).

## Migración

Inventario → huecos (F-01…F-05) → local → pruebas → (proyecto de pruebas Supabase) → producción. Solo se añaden columnas con valores por defecto que mantienen el acceso actual y se endurecen políticas; cada migración tiene su bloque ROLLBACK.

## 10B · Policies implementadas (resumen)

| Tabla | Policy | Regla |
|---|---|---|
| `pipeline_events`, `pipeline_contacts`, `process_documents` | `athlete_or_guardian_view_*` | Atleta o `athlete.pipeline.view` (antes: «ver Passport») |
| `document_access_grants` (SELECT) | `parties_view_document_grants` | Atleta, `athlete.documents.view`, admin o la organización destinataria (nominal si es sensible) |
| `document_access_grants` (UPDATE = revocar) | `athlete_or_guardian_revoke_document_grants` | Atleta, tutor con edición o tutor activo de un menor; la revocación no se deshace (`guard_document_grant`) |
| `storage.objects` (athlete-documents) | `docs_storage_select` | Dueño de la carpeta o `view_documents`; organizaciones solo con concesión vigente |
| `consents` | RPC `consent_record` | Atleta para sí mismo o tutor activo de un menor; versión de política obligatoria; no caducado; documento del propio atleta; idempotente; revocar = nueva fila → cascada a concesiones + auditoría |

Escrituras de datos del atleta (`edit_profile`) siguen siendo un permiso explícito que el atleta concede.

## SECURITY DEFINER: por qué y con qué límites

Las funciones de autorización (`has_family_link`, `is_active_guardian`, `guardian_has_scope`, `family_link_lapsed`, `family_review_due_at`, `is_contact_participant`) son `SECURITY DEFINER` porque las usan las políticas RLS de otras tablas y leen `parent_athlete_links` / `private_profile_data`: con `SECURITY INVOKER` provocarían recursión de RLS o exigirían abrir esas tablas al usuario. Límites:

- Owner: el rol de migraciones (`postgres`), nunca un usuario.
- `search_path = public` fijo y objetos con esquema; sin SQL dinámico.
- Solo devuelven booleanos o una fecha, siempre sobre `auth.uid()`: no sirven de oráculo sobre terceros.
- `family_link_lapsed` y `family_review_due_at` no son invocables por `anon` ni `authenticated`; las demás, solo por `authenticated`.
- Las RPC con escritura (`consent_record`, `family_link_review`, `family_link_restrict`, `family_link_admin_verify`, `document_open`) validan identidad, relación, estado y permiso dentro de la transacción y auditan.
- Pruebas: P10, P10A, P10B (incluida la invariante de catálogo de P9: todas con `search_path` y ninguna función trigger expuesta).

## Pendiente para 10C

Ataques directos (sustitución de IDs, scopes inventados, sesión antigua tras revocar, Storage, Gala AI) contra todo lo anterior.

> Pentest (10C): ver [FAMILY-PENTEST.md](FAMILY-PENTEST.md) — 8 hallazgos corregidos con pruebas de regresión.

## Revisión del Prompt 10B (22-11-2026)

### Inspección del catálogo real (las 77 migraciones aplicadas en una base temporal)

| Comprobación | Resultado |
|---|---|
| Tablas sin RLS | 0 de 160 |
| Políticas `USING (true)` | 12, todas sobre catálogos públicos o de configuración (`sports`, `sport_positions`, `sport_stat_definitions`, `sports_seasons`, `age_categories`, `territory_regions`, `institutions`, `institution_programs`, `showcase_events`, `feature_flags`, `family_policies`) y `opportunity_questions` INSERT. Esta última está protegida por el trigger `opportunity_questions_guard`, que fija el autor y limita a 10 preguntas al día. **Ninguna sobre datos familiares** |
| Funciones ejecutables por `authenticated` que leen el presupuesto (`athlete_finances`, `annual_budget`) | 0. El presupuesto solo se lee por tabla, con `athlete.family_budget.view` |
| Vistas que incluyan presupuesto, notas familiares, notas de organización o notas de agencia | 0 |
| Buckets públicos | 0 (`athlete-documents`, `athlete-photos` y `verification-evidence`, todos privados) |
| Storage `athlete-documents` | Dueño, tutor con permiso o concesión vigente de la organización, la misma regla que en la tabla. La ruta no autoriza: `document_owner(name)` y la fila del documento deciden |
| Storage `verification-evidence` | Solo quien la sube y admins. Coaches, universidades y tutores, no |
| `content_reports` | El denunciante ve las suyas y el admin todas. La persona denunciada no ve la denuncia ni quién la hizo |
| Realtime | Solo `contact_messages`, con la misma RLS de participantes y tutores con permiso |

### Criterio final (§40) → pruebas

| Criterio | Pruebas |
|---|---|
| El atleta consulta sus datos; el tutor A, los recursos autorizados de A | P10A matriz, P10B proceso |
| El tutor A no consulta al atleta B | P10, P10C IDOR (9 recursos) |
| El tutor restringido solo ve sus alcances; el revocado pierde el acceso | P10 varios tutores, P10A presupuesto, FAM-SEC-006, P10C sesión revocada |
| Coach A solo con lo de la universidad A; coach B sin las concesiones de A | P10D, P10B concesiones, P10C Storage |
| Ningún coach ve el presupuesto; la familia no ve las notas internas del coach | P10 presupuesto privado, P10A (notas del club) |
| Documentos privados y Storage sin atajos | P10C Storage (ruta adivinada, otra familia, otro club, caducada, revocada) |
| Consentimiento caducado y concesión revocada no sirven | FAM-SEC-004, P10 consentimiento revocado, P10B consentimientos |
| La mayoría de edad revisa los accesos | P10 mayoría de edad + **P10B revisión (hoy)** |
| Realtime respeta la RLS | La tabla publicada tiene RLS probada. No hay prueba con un cliente Realtime real, porque el stub local no lo tiene |
| Gala AI respeta la RLS | Usa la sesión del usuario; filtro de otros atletas en 10C |
| Edge Functions y service role | No hay Edge Functions; la service role no se usa como atajo (`docs/supabase/edge-functions.md`) |

### Cambio de hoy: `20261209000500_10r_majority_review_notify.sql`

Hasta ahora la revisión por mayoría de edad era **pasiva**. El acceso del tutor se suspendía al vencer la ventana, pero nadie recibía aviso y no quedaba constancia de que la revisión se había abierto. Ahora una tarea diaria idempotente (`family_open_majority_reviews`, con pg_cron si está disponible):
- **Avisa al atleta** que acaba de cumplir 18 años: le da la fecha límite para confirmar y cuántos documentos suyos siguen compartidos con organizaciones, para que los revise.
- **Avisa al tutor** de que su acceso necesita la confirmación del atleta.
- **Registra** `family_link.majority_review_opened` en la auditoría, que también impide repetir el aviso.

No cambia permisos y solo la ejecuta el sistema (prueba «P10B revisión · mayoría de edad»).

**Pendiente:** que la revisión retire automáticamente los consentimientos que dio el tutor cuando el atleta era menor. Hoy siguen vigentes hasta que caducan o los retira el atleta. Cambiarlo es una decisión de política (§26 «según policy»), no técnica.
