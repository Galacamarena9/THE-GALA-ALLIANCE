# RLS y autorización

**Principio:** denegar por defecto. Si ninguna política lo permite, no hay acceso. No hay `using (true)` en tablas sensibles, y los ids que envía el cliente se comprueban siempre en la base de datos.

## 1. Funciones de autorización (todas con `search_path` fijo)

| Función | Responde |
|---|---|
| `is_admin()` | ¿Es admin de Gala? (`user_roles`) |
| `is_org_member(org, admin_only)` | ¿Pertenece activamente a la organización? |
| `org_can(org, cap, program)` / `org_can_scope` / `org_can_opp` | ¿Tiene esa capacidad, y en ese programa o equipo? Un coach de Women's Basketball no ve Men's Soccer |
| `program_in_org`, `team_in_org` | ¿El programa o equipo es de esa organización? (evita mezclar tenants) |
| `can_view_athlete(athlete, block)` | ¿Puede ver ese bloque del Passport? (visibilidad, verificación, consentimiento, menores) |
| `athlete_field_allows(athlete, group, purpose)` | ¿El campo es visible, filtrable o comparable para este fin? |
| `can_discover_athlete(org, athlete)` | ¿Puede aparecer en el Discovery de esa organización? |
| `can_see_shortlist` / `can_edit_shortlist` | Acceso a la shortlist (`shortlist_access`) |
| `org_has_document_grant(document)` | ¿Hay concesión vigente y no revocada? |
| `has_family_link(athlete, perm)` | ¿Es tutor con ese permiso? |
| `agency_has_active_representation`, `agency_can_write` | Representación activa con alcance (ver `AGENT-RLS.md`) |
| `participation_actor` | ¿Quién actúa por un menor en trials o programas? |

## 2. Matriz de tablas sensibles (resumen)

Extraída de `pg_policies` tras aplicar las 74 migraciones (antes de los avisos de familia) (22-11):

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `org_shortlists` | `org_can(org,'shortlist',programa)` y (dueño o visibilidad de equipo o programa); nunca las `deleted` | Igual, siendo el dueño | Igual | Sin política: se borra con `status = 'deleted'` |
| `org_notes` | `org_can(org,'notes')` | Igual, siendo el autor | Autor con `notes` | Autor con `notes` |
| `agency_athlete_notes` | Roles con trabajo sobre atletas o asignado al atleta (`agency_can_read_notes`); nunca `viewer`/`scout` sin asignación | Autor agente, miembro y con relación con el atleta | Autor | Autor |
| `applications` | Atleta, tutor con `view_applications`, `org_can_opp(…,'candidates')`, admin | El propio atleta (rol `athlete`) | Atleta o `org_can_opp(…,'pipeline')` | Sin política: no se borra |
| `athlete_offers` | Atleta, tutor con alcance `athlete.offers.view`, organización emisora si es su candidato, agente con `offers.view` | Atleta o tutor con alcance | Igual | Igual |
| `athlete_documents` | Dueño, tutor con `view_documents`, concesión vigente (`org_has_document_grant`), acceso de emergencia auditado | Dueño o tutor con `edit_profile` | Igual | Igual |
| `verification_requests` | Solicitante, revisor asignado, admin, organización implicada con permiso | Solo por RPC | Solo por RPC (`verification_decide`) | No |
| `contact_messages` | Participantes del hilo; tutor con alcance solo en hilos de adultos | Participante (con reglas de menores) | No | No |
| `private_profile_data` | El propio usuario o admin | El propio usuario (o el trigger de alta) | El propio usuario | Cascada al borrar la cuenta |

Matrices completas por dominio: [`../FAMILY-RLS.md`](../FAMILY-RLS.md), [`../CLUBS-ACADEMIES-RLS.md`](../CLUBS-ACADEMIES-RLS.md), [`../AGENT-RLS.md`](../AGENT-RLS.md), [`../COACH_PORTAL.md`](../COACH_PORTAL.md).

## 3. Cómo se documenta cada política

En la migración que la crea, encima de la política: tabla, operación, roles, condición, funciones usadas y motivo. La prueba asociada en `supabase/tests/rls.test.mjs` lleva el mismo nombre de dominio. Nombre de la política: `<tabla>_<operación>[_<actor>]`.

## 4. `SECURITY DEFINER` ejecutables sin sesión (20, revisadas el 22-11)

Todas son helpers que las propias políticas de `anon` necesitan, o RPCs públicas por diseño:
- **Helpers de políticas:** `athlete_age`, `can_view_athlete`, `can_see_shortlist`, `can_edit_shortlist`, `is_admin`, `is_org_member`, `org_can`, `org_can_scope`, `org_has_document_grant`, `program_in_org`, `team_in_org`, `opportunity_is_public`, `flag_enabled`, `verified_credentials`, `viewer_is_minor`.
- **Públicas por diseño** (protegidas por token o datos ya públicos): `get_recruiting_card`, `preview_roster_invitation`, `outreach_preview`, `outreach_respond`, `record_passport_view`.

Todas devuelven solo lo que la persona sin sesión ya puede ver, o `null`. Hoy se ha cerrado `is_listed_adult_profile` (era un oráculo de minoría de edad). Una prueba falla si vuelve a estar abierta a `anon`.

## 5. Aislamiento multitenant probado

Universidad A ↔ B (shortlists, notas, candidatos, documentos, oportunidades), Club A ↔ B, agencia A ↔ B, coach sin permiso de programa, baja de staff con efecto inmediato y `organization_id` manipulado en la petición. La RLS lo impone; no depende de los filtros del frontend.

## 6. Hallazgo de esta revisión (corregido)

**`agency_athlete_notes`: un miembro `viewer` o `scout` de la agencia puede leer el texto de las notas pidiéndolo directamente a la API.** La ficha 360 se lo oculta, pero eso es ocultarlo solo en la interfaz, algo que nuestras reglas prohíben.
- **Riesgo:** medio. Es dentro de la misma agencia; no cruza tenants.
- **Arreglo propuesto:** la política SELECT exige un `agency_role` distinto de `viewer` y `scout`, o un rol de representación primario, secundario u operaciones, igual que `a360Access`.
- **Estado:** **corregido** en `20261209000400_12r_agents_review.sql` (revisión del Prompt 12), con prueba.

## 7. Pendiente

- Pruebas de concurrencia: dos coaches que añaden al mismo atleta a la vez y doble aprobación de una verificación (la constraint `unique` ya lo impide; falta la prueba explícita).
- Prueba de Realtime con un cliente real (hoy se prueba la RLS de la tabla publicada, no el canal).
