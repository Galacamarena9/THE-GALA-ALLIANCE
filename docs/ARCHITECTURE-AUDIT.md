# Auditoría de arquitectura de datos · 22-11-2026

Actualiza la auditoría del Prompt 8 (20-11-2026, 107 tablas) al estado real del repositorio. Desde entonces se han construido Supabase hardening, Family, Clubs & Academies, Agents (12–12C), Brands, Trust & Safety, Billing, Analytics, el CRM del agente y la lista de difusión.

**Cómo se ha hecho:** `npm run diagnose:db` (`scripts/erd/diagnose.mjs`, solo lectura) monta el esquema real en una base temporal (stub de Supabase + las migraciones), lo analiza y la borra. Cada número de este informe sale de esa ejecución o de leer la migración citada. **No se ha cambiado la base de datos.**

Diagramas (fuente versionable en Mermaid, regenerados con `npm run erd`):
- [`docs/erd/00-MASTER.md`](./erd/00-MASTER.md): Master ERD, AS-IS por dominio y TO-BE.
- [`docs/erd/01…14`](./erd/): ERD de cada dominio con su inventario.
- [`docs/DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md): principios, clasificación, mapa de acceso, convenciones y borrado.

## Resumen

| Indicador | Valor real | Antes (20-11) |
|---|---|---|
| Tablas | **160** en 14 dominios | 107 en 13 |
| Tablas con RLS | **160 / 160** | 107 / 107 |
| Tablas sin ninguna policy (deny-all, acceso solo por funciones del servidor) | 4: `outreach_suppressions`, `passport_views`, `rate_limit_events`, `stripe_events` | — |
| Columnas `*_id` uuid sin FK | 12: 7 polimórficas por diseño, 1 heredada, **4 a revisar** | — |
| Tablas que se **borran en cascada al borrar una organización** | **45**, de las que **11 contienen registros de otras personas o evidencia** | — |
| Fusiones del plan de migración ejecutadas | **0 de 4** (+ 1 renombre pendiente) | 0 de 4 |
| Conceptos duplicados o solapados | 6 grupos nuevos + 4 heredados | 4 |
| Tablas «dios» (≥ 25 columnas) | 7; la que más preocupa es `opportunities` (58) | — |
| Enums | 11 · estados validados con `check`: 44 · estados sin validar: **0** | — |
| Funciones `security definer` ejecutables sin sesión | 21; **1 a restringir** (`is_listed_adult_profile`) | — |
| Comprobaciones de datos (huérfanos y duplicados) | 9 preparadas, todas a 0 sobre el esquema limpio. Hay que ejecutarlas en staging | — |

**En una frase:** la seguridad por filas es sólida (RLS en todo, sin estados sin validar ni duplicados de identidad). El riesgo real está en **qué se pierde al borrar una organización** y en la **deuda de fusiones que no se ha pagado** mientras se añadían 53 tablas.

## 1. Problemas (Problema → Evidencia → Riesgo → Recomendación)

### CRITICAL

**C1 · Borrar una organización borra registros de atletas, evidencia y dinero**
- **Evidencia:** 45 FKs a `organizations` con `ON DELETE CASCADE`. Entre ellas:
  - `applications.organization_id`, y `applications.opportunity_id → opportunities`, que también cae en cascada desde la organización;
  - `contact_requests` y `agent_representations` (con sus 6 tablas `representation_*`);
  - `verification_requests` (con evidencias y decisiones) y `moderation_actions.subject_org`;
  - `payment_requirements`, `billing_accounts`, `opportunity_registrations`, `opportunity_attendance`, `opportunity_outcomes` e `info_requests`.
- **Riesgo:** al borrar una universidad, un club o una agencia (por ejemplo, una baja RGPD de la organización), el atleta pierde:
  - sus candidaturas y su historial de estados;
  - sus conversaciones;
  - la prueba de su representación, que en menores incluye el consentimiento del tutor;
  - sus inscripciones y pagos.

  Gala pierde la evidencia de moderación y de verificación, y los registros de facturación. Es la situación que el Prompt 8 pedía buscar.
- **Recomendación:**
  1. Las organizaciones se **archivan**, no se borran (`archived_at` y RLS que las oculta).
  2. Para las tablas que son del atleta o de evidencia, la FK pasa de `CASCADE` a `SET NULL` + nombre congelado, o a `RESTRICT`, según el caso (ver plan, fase A).
  3. El borrado RGPD de una organización anonimiza sus datos de contacto, pero conserva los registros ajenos.

### HIGH

**H1 · Las fusiones del plan no se han hecho, y una se ha agrandado**
- **Evidencia:**
  - `institution_claims` (3 usos en código), `saved_athletes` (4), `saved_searches` (2) y `club_roster_invites` (2) siguen vivas;
  - `saved_items` (7 usos) sigue sin renombrar;
  - en el Prompt 4 (PR #64) se **amplió** `saved_searches` para la búsqueda de talento del agente, aunque el catálogo dice «MERGE → `org_saved_searches`».
- **Riesgo:** cada pantalla nueva se apoya en la tabla antigua y el coste de fusionar crece.
- **Recomendación:** ejecutar la fase B antes de rediseñar pantallas del agente. Empezar por `saved_searches` → `org_saved_searches`, porque el agente es staff de su agencia.

**H2 · Seis «notas» con seis modelos distintos**
- **Evidencia:** `org_notes`, `agency_athlete_notes`, `application_notes`, `brand_application_notes`, `family_notes` y `support_case_notes`.
- **Riesgo:** reglas de privacidad repetidas seis veces; un fallo en una no se corrige en las demás.
- **Recomendación:** **KEEP las tablas** (cada una tiene un dueño y una privacidad distinta: organización, agencia, marca, familia o soporte), pero con **un único contrato**:
  - columnas `author_id`, `body`, `created_at`, `updated_at`, `visibility`;
  - el trigger común `guard_note`;
  - una prueba RLS parametrizada que recorra las seis.

  No se fusionan en una tabla polimórfica: eso rompería la integridad referencial.

**H3 · Cuatro sistemas de invitación**
- **Evidencia:** `organization_invitations`, `club_roster_invites`, `representation_invitations` y `opportunity_invitations`, además de `outreach_contacts` y `referral_codes`.
- **Riesgo:** caducidad, tokens y reglas de menores implementados varias veces.
- **Recomendación:**
  - MERGE `club_roster_invites` → `organization_invitations` (ya estaba en el plan).
  - KEEP `representation_invitations` (tiene permisos de representación) y `opportunity_invitations` (es el embudo de una oportunidad).
  - Unificar en una función común el **token** de todas: hash sha256, caducidad y un solo uso.

**H4 · Tres vocabularios para el mismo «cancelado / terminado»**
- **Evidencia:**
  - `subscriptions` usa `canceled` (como Stripe); `opportunity_registrations`, `campaign_deliverables` y `payment_requirements` usan `cancelled`;
  - `org_tasks` usa `done` y otras tablas usan `completed`;
  - `support_cases` usa `resolved` y `closed`, mientras `safety_cases` usa `actioned` y `closed`.
- **Riesgo:** filtros y métricas que cuentan mal y traducciones duplicadas en la interfaz.
- **Recomendación:**
  - No renombrar valores en producción.
  - Documentar un diccionario único en `docs/DATA_ARCHITECTURE.md §7` y mapearlo en una sola función de la interfaz.
  - Excepción: `subscriptions` mantiene `canceled` porque replica a Stripe.

### MEDIUM

**M1 · `opportunities` tiene 58 columnas**
- **Evidencia:** ya existen satélites (`trial_details`, `academy_program_details`, `opportunity_requirements` y `opportunity_cost_components`), pero quedan columnas de cada tipo en la tabla principal.
- **Recomendación:** mover las columnas que solo usa un tipo a su satélite cuando se toque cada flujo. Sin migración masiva.

**M2 · Instituciones nombradas por texto**
- **Evidencia:**
  - `recruiting_cases.institution_name` es obligatorio y forma parte del `unique (agency_id, athlete_id, institution_name, cycle)`, aunque existe `institution_id`;
  - `agency_contacts.institution_name` no tiene `institution_id`.
- **Riesgo:** «Univ. X» y «University X» cuentan como procesos distintos.
- **Recomendación:**
  - Índice único parcial por `institution_id` cuando exista.
  - Añadir `institution_id` opcional a `agency_contacts`.
  - `athlete_offers.university_name` se mantiene, porque recoge ofertas de fuera de la plataforma y ya tiene `institution_id`.

**M3 · `organizations.verification_status` convive con `verification_requests`** (heredado, sigue en REVIEW)
- **Recomendación:** derivarlo de la última decisión con un trigger. Lo mismo para `professional_credentials.status`, que ya pasa por la cola central.

**M4 · `is_listed_adult_profile(uuid)` se puede ejecutar sin sesión**
- **Evidencia:** `20261122000200_11d_pentest_fixes.sql:134`. La única policy que la usa ya exige `auth.uid() is not null`.
- **Riesgo:** con un uuid, un anónimo puede saber si es un adulto sin perfil de atleta. Es un oráculo pequeño, pero toca la frontera de menores.
- **Recomendación:** `revoke execute … from anon`. Riesgo LOW, no rompe nada.

**M5 · Logs sin FK**
- **Evidencia:** `org_assignment_log.athlete_id`, `candidate_id` y `shortlist_id`, y `audit_logs.program_id`.
- **Riesgo:** ids que apuntan a nada tras un borrado. Es aceptable en un log inmutable, pero no está documentado.
- **Recomendación:** documentarlos como «referencia histórica sin FK». No añadir FK, porque exigiría modificar evidencia.

### LOW

- **112 tablas sin `updated_at`.** La mayoría son de solo inserción (eventos, historiales, decisiones). Se añade solo a las editables cuando se toquen.
- **Polimórficas por diseño:** `audit_logs.entity_id`, `content_reports.entity_id`, `consents.target_id`, `match_signals.target_id`, `saved_items.target_id`, `document_access_grants.context_id` y `family_notes.context_id`. Se mantienen porque el destino varía y el acceso lo controla la RLS de la tabla, no la FK.
- **`verification_requests.legacy_claim_id`** desaparece con la fusión de `institution_claims` (H1).

## 2. Duplicados y solapamientos (actualizado)

| Entidad A | Entidad B | Solapamiento | Decisión |
|---|---|---|---|
| `institution_claims` | `verification_requests` | Alto | **MIGRATE** (pendiente desde 20-11) |
| `saved_athletes` | `org_shortlists` (privada) | Alto | **MERGE** (pendiente) |
| `saved_searches` | `org_saved_searches` | Alto | **MERGE** (pendiente y agrandada en #64, ver H1) |
| `club_roster_invites` | `organization_invitations` | Alto | **MERGE** (pendiente) |
| `saved_items` | — | Nombre engañoso | **RENAME** → `athlete_processes` (pendiente) |
| `applications` | `opportunity_registrations` | Medio | **KEEP**. Candidatura a una beca o puesto frente a inscripción en trial, campus o programa, con pagos y asistencia. Se enlazan por `opportunity_id` |
| `athlete_offers` | `campaign_offers` | Bajo | **KEEP**. Oferta de recruiting frente a oferta de marca (NIL); dominios y privacidad distintos |
| `org_tasks` / `pipeline_tasks` / `recruiting_case_tasks` / `athlete_task_state` | — | Medio | **KEEP**. Cuatro dueños; comparten convenciones, no tabla |
| 6 tablas de notas | — | Medio | **KEEP** con un contrato común (H2) |
| 4 tablas de invitaciones | — | Medio | **MERGE 1, KEEP 3** con token común (H3) |
| `agent_representations` | 7 tablas `representation_*` | — | **KEEP**. Es la normalización correcta (permisos, cobertura, asignaciones, acuerdos, conflictos) |
| `org_teams` / `club_roster` / `program_memberships` / `program_enrollments` | — | Medio | **REVIEW**. Equipo del club, plantilla de atletas, staff del programa y atletas inscritos en un programa de academia. Funciones distintas, pero los nombres confunden: hay que documentarlo en el dominio 14 |
| `audit_logs` / `org_activity` / `outreach_events` / `product_events` | — | — | **KEEP**. Auditoría, actividad visible para la organización, historial de difusión y analítica (13 meses). Producto y auditoría siguen separados, como pedía el Prompt 8 |
| `sport_stat_definitions` | `metric_definitions` | Ninguno | **KEEP**. La primera son estadísticas deportivas; la segunda, métricas de negocio |

**¿Dos plataformas paralelas, CRM del atleta y CRM de la universidad?** No en datos: el proceso del atleta (`saved_items` + `pipeline_*`), el pipeline interno de la organización (`org_candidates`) y los casos de la agencia (`recruiting_cases`) son **tres perspectivas enlazadas por claves**, no copias. Comparten `applications`, `athlete_offers` y `athlete_documents` (con `document_access_grants`). Así cada perspectiva tiene sus estados y su privacidad, y nunca se exponen estados internos al atleta. Se mantiene la decisión de 20-11.

## 3. Fuente de verdad (actualizado)

| Concepto | Fuente de verdad |
|---|---|
| Identidad | `auth.users` → `profiles` (1:1) + `user_roles` (varios roles por persona; no hay `*_users` separados) |
| Atleta / Passport | `athlete_profiles` y sus satélites. **El Passport es una vista agregada, no una tabla** |
| Estadísticas deportivas | `sport_stat_definitions` → `athlete_statistics` (deporte → métrica → temporada); sin tabla gigante por deporte |
| Universidad del mundo real | `institutions` (catálogo con datos de College Scorecard y su fuente) |
| Universidad, club, agencia o marca en Gala | `organizations` (`org_type`) enlazada opcionalmente a `institutions` |
| Fuentes oficiales externas (FIBA, federaciones, NCAA) | Registro en código (`src/content/official-sources.ts`) + `athlete_links`. Se enlaza; no se copia |
| Discovery | `athlete_directory` (vista **derivada y reconstruible**) + `athlete_discovery_settings` |
| Necesidad interna / oportunidad publicada | `recruiting_needs` / `opportunities` (separadas; enlace opcional) |
| Shortlist / proceso formal de la organización | `org_shortlists` + `org_shortlist_members` / `org_candidates` |
| Proceso del atleta | `saved_items` + `pipeline_*` |
| Proceso de la agencia | `recruiting_cases` (solo con representación activa) |
| Representación | `agent_representations` + `representation_*` |
| Candidatura | `applications` |
| Oferta de recruiting | `athlete_offers` |
| Documento y acceso | `athlete_documents` + `document_access_grants` |
| Verificación | `verification_requests` (+ checks, evidencias, decisiones) |
| Consentimiento y familia | `consents`, `parent_athlete_links` |
| Avisos | `notifications` |
| Auditoría / analítica | `audit_logs` / `product_events` |
| Lista de difusión | `outreach_contacts` + `outreach_events` + `outreach_suppressions` |

## 4. Plan de migración (sin ejecutar)

Cada paso:
- es su propia migración, con un comentario `Reversión:` y prueba RLS;
- se prueba en **staging con datos sintéticos**, con `npm run diagnose:db -- --data-only` antes y después;
- se aplica en producción solo con tu aprobación.

| Fase | Cambio | Riesgo | Datos afectados | Método | Validación | Reversión |
|---|---|---|---|---|---|---|
| **A1** | Organizaciones archivables: `archived_at`; las policies las ocultan; «borrar» en el panel archiva | MEDIUM | Ninguno | Añadir columna + cambiar acción | Prueba RLS: archivada invisible para terceros, visible para su admin | Quitar la columna y restaurar la acción |
| **A2** | FKs de tablas ajenas o de evidencia: de `CASCADE` a `SET NULL` + nombre congelado (`applications`, `contact_requests`, `agent_representations`, `opportunity_registrations`, `opportunity_attendance`, `opportunity_outcomes`) o a `RESTRICT` (`payment_requirements`, `billing_accounts`, `verification_requests`, `moderation_actions`) | **HIGH** | Ninguno al cambiar; sí afecta a borrados futuros | Recrear FK (`not valid` + `validate`) | Prueba: borrar una organización conserva las candidaturas del atleta, anonimizadas | Recrear la FK original |
| **A3** | `revoke execute on is_listed_adult_profile from anon` | LOW | Ninguno | `revoke` | Prueba RLS: un anónimo no puede llamarla; el perfil sigue visible con sesión | `grant` |
| **B1** | `saved_searches` → `org_saved_searches` (agentes y staff) | MEDIUM | Búsquedas guardadas | Copiar → leer de la nueva → vista de compatibilidad durante un ciclo → borrar a los 30 días sin escrituras | Recuento antes = después; e2e de búsqueda de talento | La vista y la tabla antigua siguen hasta el final |
| **B2** | `institution_claims` → `verification_requests` | MEDIUM | Reclamaciones | Igual que B1 (`legacy_claim_id` ya preparado) | Cola de verificación con el mismo número de casos | Igual |
| **B3** | `saved_athletes` → shortlist privada | MEDIUM | Listas personales | Igual | Mismo número de miembros por persona | Igual |
| **B4** | `club_roster_invites` → `organization_invitations` (`kind = 'roster'`) | MEDIUM | Invitaciones vivas | Igual | Las invitaciones abiertas siguen funcionando | Igual |
| **C1** | Contrato común de notas (trigger + prueba parametrizada) | LOW | Ninguno | Añadir trigger | 6 tablas pasan la misma prueba | Quitar el trigger |
| **C2** | Índice único parcial por `institution_id` en `recruiting_cases`; `institution_id` en `agency_contacts` | MEDIUM | Posibles duplicados existentes | Diagnóstico → fusión manual → índice `concurrently` | Sin duplicados | Quitar el índice |
| **C3** | `organizations.verification_status` derivado de `verification_requests` | MEDIUM | Estado de verificación | Trigger + reconciliación | Mismo estado antes y después | Quitar el trigger |
| **D** | Renombre `saved_items` → `athlete_processes` con vista de compatibilidad | MEDIUM | Ninguno | Renombrar + vista | e2e del pipeline del atleta | Renombrar de vuelta |

**Orden recomendado:**
1. Primero A3 y A1, que son de bajo riesgo y protegen de inmediato.
2. Después A2 (HIGH: necesita staging y tu aprobación).
3. Antes de rediseñar las pantallas del agente, B1, porque su búsqueda de talento usa la tabla antigua.
4. El resto, después.

## 5. Comprobaciones de datos para staging (solo lectura)

`DATABASE_URL=<staging> npm run diagnose:db -- --data-only` ejecuta en una transacción `READ ONLY` estas comprobaciones:
- miembros de organización duplicados;
- atleta repetido en una shortlist;
- candidaturas duplicadas;
- representaciones activas duplicadas;
- candidato con un programa de otra organización;
- proceso de agencia sin representación;
- documentos sin archivo desde hace más de 7 días;
- oportunidades publicadas por una organización no verificada;
- menores descubribles sin vínculo familiar aprobado.

**Nunca borra nada.** Si alguna da resultados, la limpieza se decide caso por caso.

**Estado:**
- **PASS** sobre el esquema limpio (0 en las 9).
- **BLOCKED sobre los datos reales:** falta ejecutarlo contra staging o producción, y para eso necesito la cadena de conexión de staging. No pido la de producción.

## 6. Rendimiento

- **Ya cubierto** (pruebas P18 y P9 en CI):
  - FKs indexadas;
  - búsqueda por nombre con trigramas;
  - sin índices duplicados;
  - policies sin `auth.uid()` por fila.
- **Pendiente de medir con datos reales:**
  - `athlete_directory` filtrado por deporte, posición, promoción y país (búsqueda del agente);
  - `notifications (user_id, read_at, created_at)`, que ya tiene índice;
  - `recruiting_cases (agency_id, stage)`.

  No se añaden índices sin `pg_stat_statements` en producción, que está pendiente de activar.
