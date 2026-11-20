# Clubs & Academies · Modelo de datos (Prompt 11A)

Trials, programas de academia y su participación, construidos **sobre** el núcleo existente:
`organizations → org_programs → org_teams → opportunities → applications / invitations → registrations / enrollments`.
Este documento explica qué tabla es la fuente de verdad de cada concepto, cómo se borra, por qué algunas listas son
`check` en vez de tablas y cómo revertir la fase.

Migraciones: `20261121000100` … `20261121000600` (`supabase/migrations/`). Diagrama: `docs/erd/14-clubs-academias.md`.

## 1. Fuente de verdad

| Concepto | Tabla | Notas |
|---|---|---|
| Club / academia | `organizations` (`type` club · academy) | Verificación y RBAC centrales (`org_can`). |
| Programa (masculino, cantera…) | `org_programs` | Permisos por programa vía `program_scope`. |
| Equipo | `org_teams` | Siempre del mismo tenant (`team_program_org` + `team_in_org()`). |
| Temporada / categoría | `sports_seasons`, `age_categories` | Catálogos sembrados; `age_category_custom` para casos fuera de catálogo. |
| Trial, campus, programa | `opportunities` (`type` tryout · camp_showcase · club_recruitment · academy · development_program) | Una sola tabla de oportunidades; nada de «trials» paralelos. |
| Especialización del trial | `trial_details` (1:1) | Modo de inscripción, plazo, plazas, política de menores, vídeo. |
| Especialización del programa | `academy_program_details` (1:1) | Calendario, residencia, apoyo académico/idioma, becas. |
| Costes | `opportunity_cost_components` | Un componente por concepto: importe + moneda, obligatorio/opcional, incluido. Sin importe = «no indicado», nunca 0 €. |
| Requisitos | `opportunity_requirements` | `kind` + `strength` (required/preferred/informational) + `params` validados por tipo. |
| Materiales | `opportunity_required_materials` | `medical_clearance` siempre `highly_restricted`. |
| Candidatura | `applications` | Tenant (`organization_id`) lo fija un trigger desde la oportunidad. |
| Invitación del club | `opportunity_invitations` | Interesado ≠ inscrito. Una sola invitación activa por atleta y oportunidad. |
| Inscripción a trial | `opportunity_registrations` (antes `trial_registrations`) | Procedencia: athlete · family · agent · club_invite · application. |
| Asistencia | `opportunity_attendance` (PK = inscripción) | Solo el club, solo tras empezar el evento. Confirmado ≠ asistió. |
| Resultado interno | `opportunity_outcomes` | Solo el club. Al atleta le llega `athlete_update`, un mensaje que el club decide compartir. |
| Plaza / matrícula de programa | `program_enrollments` | offered → accepted → enrolled → active → completed. Aceptado ≠ matriculado. |
| Pago preparado | `payment_requirements` | Estados finales (`paid`, `failed`, `refunded`) solo `service_role` (futuro webhook de Stripe). |
| Consentimiento del tutor | `consents` (`purpose` trial_participation · academy_enrollment …, `target_*`) | Consentimiento granular por oportunidad; el tutor ve los que otorgó. |
| Acceso a documentos | `document_access_grants` | Acceso con finalidad, caducidad y revocación. |
| Proceso de recruiting | `org_candidates` | `start_recruiting_from_trial` reutiliza el pipeline central sin duplicar. |

## 2. Reglas que aplica la base de datos (no la UI)

- **Publicación**: `opportunity_publish_gaps()` lista lo que falta (fecha, lugar, categoría, coste, precio, requisitos, plazo);
  `guard_opportunity_publishable` impide pasar a revisión o publicada con huecos (`not_publishable:<huecos>`).
- **Transiciones**: inscripciones, invitaciones, candidaturas y matrículas solo cambian mediante RPC `security definer`
  (`trial_register`, `trial_respond`, `invitation_respond`, `application_org_decide`, `trial_org_action`,
  `attendance_record`, `outcome_record`, `enrollment_respond`, `enrollment_org_action`). Las RPC son idempotentes ante doble clic.
- **Menores**: sin aprobación del tutor no hay confirmación. La familia aprobada de un menor actúa como tutor
  (`participation_actor`) aunque no tenga permiso de edición del perfil.
- **Agentes**: solo con representación activa. Si la inscripción cuesta dinero, el atleta tiene que aceptar el coste antes.
- **Capacidad**: las plazas libres se derivan de las confirmadas (`opportunity_confirmed_count`). No se confirma por encima del cupo.
- **Multitenant**: otro club, universidad o marca no ve ni modifica nada de un trial ajeno (lo comprueba la prueba «escenario 5»).

## 3. Borrado (RGPD)

- Borrar una oportunidad borra en cascada sus especializaciones, costes, requisitos y materiales.
  Las inscripciones bloquean el borrado (`NO ACTION`): una oportunidad con participantes se archiva, no se borra.
- Borrar una cuenta anula la autoría (`created_by`, `updated_by`, `reviewed_by`, `moderated_by` → null) y borra en cascada
  su participación como atleta. Los guards de `opportunities` y `organizations` dejan pasar estas anulaciones
  mediante `only_nulled(old, new, cols, tg_relid)`. Esa variante ignora las columnas generadas, que en un trigger
  BEFORE todavía llegan a null. Sin ella, `delete_my_account` fallaba con «opportunities_created_by_fkey».
- Borrar una organización borra en cascada sus equipos, invitaciones, inscripciones, asistencia, resultados y matrículas.
- La exportación de datos (`src/lib/privacy/export-tables.ts`) incluye las inscripciones, invitaciones, asistencia,
  matrículas y pagos del titular. Nunca incluye `opportunity_outcomes`, porque son notas internas del club.

## 4. Enum o tabla

- **Enum de Postgres** (`opportunity_type`, `opportunity_status`, `application_status`): son valores compartidos con
  todo el producto y cambian poco; ampliarlos es `alter type … add value`.
- **`check` en texto** (estados de inscripción, invitación, asistencia, matrícula y pago; tipos de coste y de requisito):
  son propios de esta fase y se pueden cambiar con una migración, sin dependencias.
- **Tabla de catálogo** (`sports_seasons`, `age_categories`): datos que crecen, se ordenan y se muestran en la UI.

## 5. Reversión

1. Desplegar el código anterior (los formularios dejan de escribir en las tablas nuevas).
2. `drop` de `20261121000600` (vuelve a crear `guard_opportunity_status` y `guard_org_verification` desde sus migraciones de origen).
3. Las RPC de `000500` se pueden eliminar sin pérdida de datos.
4. `000400` / `000300` incluyen datos migrados: antes de revertir hay que exportar `opportunity_registrations`,
   `trial_details` y `opportunity_cost_components` y reconstruir `trial_registrations` / `opportunity_event_details`.
   **No revertir en producción sin staging, conciliación de filas y copia de seguridad.**
5. Los valores de enum añadidos en `000100` no se pueden eliminar en Postgres. Se quedan sin uso, lo cual es inocuo.

## 6. Pruebas

`supabase/tests/rls.test.mjs` cubre, en el bloque «Prompt 11A», los cinco escenarios de aceptación:

1. Trial gratuito con tutor, asistencia y recruiting.
2. Trial de pago (150 €) con alojamiento opcional de 80 € y pago preparado.
3. Invitación del club, aprobada por la familia.
4. Programa de academia hasta la matrícula.
5. Aislamiento multitenant.

También cubre los casos negativos de integridad: equipo de otro tenant, candidatura duplicada, trial de pago sin
precio, menor sin consentimiento, asistencia antes del evento, pago marcado desde el cliente y agente sin representación.

Variables útiles para depurar: `KEEP_DB=1` conserva la base de prueba, `DEBUG_SQL=1` añade al error el SQL y el usuario,
y `SKIP_ERASURE=1` omite la prueba final de borrado total.
