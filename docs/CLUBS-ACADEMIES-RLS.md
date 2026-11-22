# Clubs & Academies · RLS y seguridad (Prompt 11B)

> Una organización verificada obtiene herramientas para hacer recruiting, no la propiedad de los datos de los atletas.
> Cada acceso sigue limitado por tenant, programa, equipo, rol, privacidad del atleta, consentimiento, finalidad y
> estado del proceso.

Migración: `supabase/migrations/20261122000100_11b_clubs_rls.sql`. Pruebas: bloque «Prompt 11B» de
`supabase/tests/rls.test.mjs`, además de los bloques 7B, 11 y 11A.

## 1. Cadena de autorización

`auth.uid()` → `organization_members` (rol + alcance de programa + **alcance de equipo**) → `organizations`
(`org_status = active`, `verification_status = verified` para capacidades de recruiting) → capacidad del rol
(`org_role_caps`) → relación con el atleta (privacidad, bloqueo, tutor, representación) → consentimiento/concesión
→ RLS o RPC.

El rol **nunca** sale del JWT editable: sale de `organization_members.member_role` (que solo modifica quien tiene
`manage_members`) y de `user_roles` (que el cliente no puede escribir).

## 2. Helpers

| Función | Qué responde | Notas |
|---|---|---|
| `is_org_member(org)` | ¿Pertenezco a la organización? | Ya **no** se usa para datos sensibles de clubs. |
| `org_can(org, cap, program)` | Rol con esa capacidad, organización activa y verificada (salvo capacidades de gestión), dentro del programa | Base de todo. |
| `org_can_scope(org, cap, program, team)` | Lo anterior + equipo permitido (`team_scope = all` o equipo en `team_ids`) | Nuevo en 11B. |
| `org_can_opp(opportunity, cap)` | `org_can_scope` con la organización, programa y equipo **de la oportunidad** | No confía en ningún `organization_id` del cliente. |
| `opportunity_is_public(opportunity)` | Publicada, no retirada por moderación, organización activa y verificada (club/academia/agencia/marca) | Lo único que ve un anónimo. |
| `can_view_athlete(athlete, scope)` | Privacidad del Passport, verificación y menores | Existente (núcleo). |
| `has_family_link(athlete, cap)` | Tutor aprobado con ese permiso | Un tutor revocado pierde el acceso al instante. |
| `participation_actor(athlete, agency)` | Atleta, familia (tutor de un menor) o agente con representación activa | 11A. |
| `guardian_requirement_satisfied(...)` | Consentimiento vigente del tutor para esa finalidad y destino | 11A. |
| `minor_contact_mode(athlete, org)` | `contact_blocked` · `contact_allowed` · `guardian_visible` · `guardian_approval_required` | Regla única; la UI solo la muestra. |
| `org_has_document_grant(document)` | Petición compartida o concesión vigente; los documentos muy sensibles solo con concesión nominal | Usada por la RLS y por Storage. |
| `document_is_highly_restricted(kind)` | médico, financiero, pasaporte, I-20, DS-160, SEVIS | Clasificación. |

Todas son `security definer` con `search_path = public` y objetos cualificados, sin SQL dinámico. Solo **leen**
membresías y relaciones, sin recursión de RLS (la política de una tabla no consulta otra tabla cuya política la
consulte a ella). Esa es la única razón de ser `definer`.

## 3. Matriz (lectura / escritura)

Leyenda: **Propio** = solo sus filas · **Alcance** = según rol + programa + equipo · **Rel.** = solo si está relacionado
con su oportunidad · **RPC** = solo mediante función controlada · — = denegado.

| Recurso | Atleta | Tutor | Scout mismo club | Coach / Director | Admin org | Otro club | Anónimo |
|---|---|---|---|---|---|---|---|
| Trial publicado (público) | Ver | Ver | Ver / gestionar si alcance | Ver / gestionar | Gestionar | Ver público | Ver público |
| Trial en borrador | — | — | Alcance | Alcance | Sí | — | — |
| Trial de organización suspendida | — | — | Alcance (histórico) | Alcance | Sí | — | — |
| Costes, requisitos y detalles del trial | Ver si es público | Ver si es público | Gestionar si alcance | Gestionar | Gestionar | Ver si es público | Ver si es público |
| Necesidad de recruiting | — | — | Alcance | Alcance | Sí | — | — |
| Candidatura | Propia (crear, retirar) | `view_applications` | Rel. + alcance; decide vía RPC | Rel. + alcance | Sí | — | — |
| Invitación | Propia | `view_applications` | Crear vía RPC (contact + alcance) | Ídem | Sí | — | — |
| Inscripción | Propia (vía RPC) | `view_applications`; aprueba como tutor | Rel. + alcance; confirma vía RPC | Ídem | Sí | — | — |
| Asistencia | La suya | `view_applications` | Registra vía RPC tras el inicio | Ídem | Sí | — | — |
| Resultado interno | — (solo el mensaje compartido) | — | Alcance | Alcance | Sí | — | — |
| Matrícula de programa | Propia (acepta vía RPC) | `view_applications` | Rel. + alcance; matricula vía RPC | Ídem | Sí | — | — |
| Pago preparado | Propio (ver) | Ver | Ver | Ver | Ver | — | — |
| Shortlist y miembros | — | — | Alcance (`shortlist`) | Alcance | Sí | — | — |
| Notas internas (`org_notes`, `application_notes`) | — | — | `notes` + alcance | Ídem | Sí | — | — |
| Proceso de recruiting (`org_candidates`) | — | — | Alcance (`candidates` / `pipeline`) | Ídem | Sí | — | — |
| Documentos | Propios | `view_profile` / `edit_profile` | Solo con concesión vigente (muy sensibles: nominal) | Ídem | Ídem | — | — |
| Concesión de documento | Crea y revoca | Crea y revoca (`edit_profile`) | Ve las de su org (nominales: solo el destinatario) | Ídem | Ídem | — | — |
| Presupuesto familiar (`athlete_finances`) | Propio | Según permiso | — | — | — | — | — |
| Ofertas | Propias | `view_profile` | `offers` + proceso propio | Ídem | Sí | — | — |
| Solicitud de contacto | Participante | Menores: participa/aprueba | `contact` (verificada y activa) + reglas de menores | Ídem | Sí | — | — |
| Evidencia de verificación | — | — | — | — | Solicitante | — | — (solo el resultado «verificado») |

## 4. Escrituras críticas (solo RPC, idempotentes, autorizan dentro)

| Acción | RPC | Comprueba |
|---|---|---|
| Invitar a un trial | `trial_org_invite` | `contact` + programa/equipo, inscripción abierta, atleta visible, bloqueo, duplicado, 100/día por org. |
| Decidir candidatura | `application_org_decide` | `candidates` + programa/equipo, transición válida. En trials y academias el `UPDATE status` directo está **bloqueado** (`use_application_org_decide`). |
| Confirmar, lista de espera, rechazar | `trial_org_action` | Alcance, capacidad, consentimiento del tutor. |
| Asistencia | `attendance_record` | Alcance, que el evento haya empezado y que exista inscripción. |
| Resultado | `outcome_record` | Alcance; el mensaje al atleta va aparte. |
| Iniciar recruiting | `start_recruiting_from_trial` | `pipeline` + alcance, sin duplicar el proceso. |
| Matrícula | `enrollment_org_action` / `enrollment_respond` | Alcance y transición; el atleta acepta. |
| Inscribirse o responder | `trial_register`, `trial_respond`, `invitation_respond` | Atleta, tutor de un menor o agente con representación. |

**Asignación masiva:** los triggers (`guard_opportunity_status`, `guard_opportunity_core`, `guard_application`,
`guard_payment_status`, `guard_document_grant`, `guard_member_teams`…) congelan `organization_id`, `athlete_id`,
`created_by`, `reviewed_by`, `verification_status`, `payment_status`, la moderación y los estados internos.
Las concesiones de documentos solo admiten `UPDATE` de `revoked_at`/`expires_at` (privilegio de columna), y solo para
revocar o acortar.

## 5. Documentos y Storage

- Bucket `athlete-documents` privado. Las políticas de `storage.objects` delegan en
  `document_owner(path)` / `has_family_link` / `org_has_document_grant`. Conocer la ruta no da acceso.
- `document_access_grants`: la crea **solo** el atleta o su tutor con `edit_profile`, nunca la organización. Tiene
  finalidad (application_review, trial_registration, recruiting_process, enrollment…), contexto, caducidad
  (máx. 365 días) y revocación.
- Muy sensibles (médico, financiero, identidad): requieren `grantee_user_id` (una persona concreta de la organización)
  y un máximo de 30 días. Nunca se comparten con «todo el club», tampoco a través de las peticiones de información.
- Una concesión de Club A no sirve a Club B: el filtro es `org_can(g.organization_id, …)` del usuario actual.
- Las URL firmadas se generan en el servidor después de comprobar la concesión (`log_document_access`).

## 6. Menores

- **Contacto:** organización verificada y activa, rol con `contact`, sin bloqueo del atleta ni de la familia y
  ventana NCAA cuando aplica. Si el atleta es menor, la solicitud pasa por el tutor (`guard_contact_request`).
  El modo exacto lo da `minor_contact_mode`.
- **Discovery:** `discover_athlete_ids` exige `discover` (verificada) y respeta la visibilidad. Ningún listado expone
  email, teléfono, dirección, fecha de nacimiento, identidad del tutor, documentos ni presupuesto.
- **Participación:** sin consentimiento del tutor no se confirma ni se matricula.

## 7. Suspensión, bajas y bloqueos

- **Suspensión** (`org_status <> 'active'`): `org_can` devuelve false, así que se pierden Discovery, contacto,
  invitaciones, nuevas concesiones, publicación y herramientas de IA de la organización. Sus trials dejan de ser
  públicos. Los datos y el historial **no** se borran.
- **Baja de un miembro:** se borra su fila de `organization_members` y con ella todo acceso. Las notas conservan la
  autoría; si se borra la cuenta, la autoría se anula pero la nota se mantiene.
- **Bloqueo** del atleta o la familia: corta contacto, invitaciones (`athlete_blocks_org`) y peticiones de
  documentos. El historial se conserva.

## 8. Gala AI, Realtime, service role

- **Gala AI:** las herramientas (`src/lib/ai/tools.ts`) usan el cliente de servidor **con la sesión del usuario**, así
  que la RLS aplica igual. No hay acceso SQL libre, ni service role, ni lectura de notas, presupuestos o documentos.
  Las peticiones de acciones masivas («invita a todos») no se ejecutan: invitar es una RPC por atleta con límite diario.
- **Realtime:** solo `contact_messages` está en la publicación, con su RLS. Revocar la participación corta la entrega
  de mensajes nuevos.
- **Service role:** `grep` sin resultados en `src/` y sin funciones Edge. No existe en el bundle ni en variables
  `NEXT_PUBLIC_*`. Solo la usarán los webhooks de pago futuros (Prompt 15), que revalidarán usuario, recurso y estado.

## 9. Límites y anti-scraping

| Recurso | Límite |
|---|---|
| Discovery | Permiso `discover`, 20 páginas como máximo por consulta, cuota `discovery_consume`, sin acceso directo a la tabla. |
| Invitaciones a trials | 100 por organización y día. |
| Exportación de candidatos | Permiso `export`, datos mínimos (sin contacto, documentos ni notas) y evento auditado. |
| Contacto, mensajes y peticiones | Límites existentes (`rate_limited`) en sus funciones. |

## 10. Pruebas que lo demuestran

- **Bloque «Prompt 11B» de `rls.test.mjs`:**
  - el scout del U18 no ve el First Team ni actúa sobre él; el director sí;
  - un viewer no ve nada;
  - el Club B no accede a 12 tablas privadas del Club A, ni a sus RPC, ni insertando su `organization_id`;
  - el staff no acepta candidaturas por `UPDATE`; el atleta no se acepta ni aplica por otro;
  - documentos: sin concesión → nada; con concesión → sí; con el id desde otro club → nada; revocada o caducada → nada;
    médicos solo para el destinatario nominal; la organización no se concede acceso a sí misma;
  - un club sin verificar no invita ni contacta, y una organización suspendida deja de publicar e invitar;
  - un tutor revocado pierde visibilidad y no puede aprobar;
  - las notas y las shortlists son invisibles para atleta y familia; el presupuesto familiar, para todos los clubs.
- **Bloque 11A:** los cinco escenarios y la integridad.
- **Bloques 7B y 11:** verificación, Discovery, shortlists y notas.

## 11. Despliegue

Inventario → huecos → implementación local → pruebas automáticas → staging → producción, con la migración inversa
preparada. Las políticas se **sustituyen** (drop y create) solo en las tablas con huecos. Las correctas no se tocan.

## 12. Revisión del Prompt 11B (22-11-2026)

He contrastado el criterio de aceptación (§80) con las pruebas y he atacado en local los puntos con más riesgo de haber quedado sin cubrir (prueba «P11B revisión»).

| Criterio (§80) | Prueba | Estado |
|---|---|---|
| El club A no accede al club B (también cambiando `organization_id`) | 11B aislamiento | ✅ |
| El scout del U18 no ve equipos sin permiso | 11B equipos | ✅ |
| Un club sin verificar no tiene Discovery, invitaciones ni contacto | 11B suspensión y verificación, 7B | ✅ |
| El atleta no cambia estados internos ni se acepta a sí mismo | 11B candidaturas; **hoy:** no escribe asistencia, inscripciones ni matrículas (sin `GRANT` de escritura: solo por funciones del club) | ✅ |
| Un menor no recibe contacto prohibido | 11B suspensión y verificación, `minor_contact_mode` | ✅ |
| El tutor ve solo según sus permisos | 11B familia | ✅ |
| El club no recibe el presupuesto ni documentos sin concesión, y el club B no reutiliza concesiones del A | 11B documentos, P10C Storage, P10D | ✅ |
| El atleta no consulta las notas del scout; nadie ve resultados internos | 11B familia; **hoy:** `opportunity_outcomes` = 0 filas para atleta y familia | ✅ |
| Asistencia, inscripciones y lista de espera de otros atletas | **Hoy:** 0 filas; sin acceso anónimo a inscripciones | ✅ |
| Recuentos públicos de candidaturas | **Hoy:** ninguna función que cuente candidaturas, inscripciones o matrículas es ejecutable sin sesión | ✅ |
| **Shortlist: no se sustituye un candidato por UPDATE (§16, §56)** | **Hoy: fallaba → corregido (G-08)** | ✅ |
| Gala AI y Storage no saltan los límites | 11D, P10C | ✅ |
| Edge Functions con service role | No existen | ✅ |

### G-08 · High · Shortlist y candidatos · El atleta de un miembro se podía cambiar por UPDATE

| Campo | Detalle |
|---|---|
| Ataque | El dueño de una shortlist ejecuta `update org_shortlist_members set athlete_id = <otro atleta>` |
| Esperado | Denegado: para cambiar de atleta hay que quitarlo y añadir otro, y entonces se comprueba si se puede ver |
| Real | Se aplicaba. La política UPDATE solo pedía `can_edit_shortlist()`; la comprobación `can_view_athlete` estaba solo en INSERT |
| Impacto | Meter en una lista a un atleta que el club no puede ver (por ejemplo, un menor oculto en Discovery), mover miembros entre listas o cambiar su `organization_id`. `org_candidates` y `saved_athletes` (heredada) tenían el mismo patrón |
| Causa raíz | Comprobaciones de identidad solo en INSERT |
| Fix | `20261209000600_11r_identity_immutable.sql`: trigger `guard_identity_immutable` con la lista explícita de columnas de identidad de cada tabla. Rechaza cambios de usuarios de la API; las funciones del servidor no se ven afectadas. `agency_athlete_notes` ya tenía su propia guarda (`note_immutable`) |
| Retest | Cambiar `athlete_id` u `organization_id` → `identity_fields_immutable`. Priorizar o revisar sigue funcionando. 415 pruebas en verde, incluido el borrado RGPD |
| Estado | FIXED |
