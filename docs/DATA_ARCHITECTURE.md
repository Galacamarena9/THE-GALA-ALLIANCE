# Arquitectura de datos · The Gala Alliance (Prompt 8)

Este documento explica **qué datos tenemos, dónde viven, quién los ve, cuánto duran y cómo los vamos a ordenar**.
Los diagramas están en [`docs/erd/`](./erd/00-MASTER.md) y se generan solos a partir de las migraciones. No se dibujan a mano, así que no se quedan desactualizados.

| Pieza | Dónde | Cómo se actualiza |
|---|---|---|
| Diagramas ER (Mermaid) por dominio, AS-IS y TO-BE | `docs/erd/00-MASTER.md` … `13-ia-analitica.md` | `npm run erd` (aplica las migraciones en una base temporal y lee el esquema real) |
| Catálogo: dominio, clasificación, retención, exportación y decisión por tabla | `scripts/erd/catalog.mjs` | A mano, al crear o cambiar una tabla |
| Qué sale en la descarga RGPD | `src/lib/privacy/export-tables.ts` | A mano |
| Check de CI | `npm run check:erd` (job `app`) | Falla si una tabla nueva no está catalogada o documentada, o si la exportación no cuadra |

Estado actual: **107 tablas, 13 dominios, RLS en 107/107**.

---

## 1. Principios

1. **La seguridad vive en la base de datos.** Toda tabla tiene RLS. Las reglas de negocio sensibles van en triggers o funciones `security definer`: menores, verificación, inmutabilidad y cuotas. La interfaz solo refleja lo que la base de datos permite.
2. **Una entidad, un sitio.** Antes de crear una tabla se busca una existente. Los duplicados conocidos tienen decisión y plan (§5).
3. **Separar el catálogo del tenant.** El catálogo es el mundo real importado (`institutions`, `institution_programs`, `sports`). El tenant es la cuenta que opera en Gala (`organizations`, `org_programs`). Se enlazan, no se mezclan.
4. **Cada parte tiene su propio pipeline.** El atleta tiene su proceso privado (`saved_items` + `pipeline_*`). La organización tiene su pipeline interno (`org_candidates`). La agencia tiene sus casos (`recruiting_cases`). Los tres se enlazan con claves, nunca comparten filas, porque cada uno tiene una privacidad distinta.
5. **Las tablas de evidencia son inmutables pero anonimizables.** Auditoría, consentimientos, decisiones e historiales no se editan ni se borran. Solo se pueden anonimizar o borrar en cascada con su padre (§8).
6. **No se inventan datos.** Nada se rellena con valores ficticios. Lo «declarado» y lo «verificado» son columnas o estados distintos.

## 2. Dominios

| # | Dominio | Tablas principales |
|---|---|---|
| 01 | [Identidad y cuentas](./erd/01-identidad.md) | `profiles`, `private_profile_data`, `user_roles` |
| 02 | [Familia, consentimiento y privacidad](./erd/02-familia-privacidad.md) | `parent_athlete_links`, `consents`, `data_subject_requests` |
| 03 | [Passport del atleta](./erd/03-passport.md) | `athlete_profiles` y sus 16 tablas satélite |
| 04 | [Catálogo deportivo y eventos](./erd/04-catalogo.md) | `sports`, `sport_positions`, `sport_stat_definitions` |
| 05 | [Instituciones y organizaciones](./erd/05-organizaciones.md) | `institutions`, `organizations`, `organization_members`, `org_programs` |
| 06 | [Verificación](./erd/06-verificacion.md) | `verification_requests` (+ checks, evidencias, decisiones), `email_verifications` |
| 07 | [Oportunidades, candidaturas y trials](./erd/07-oportunidades.md) | `opportunities`, `applications`, `trial_registrations` |
| 08 | [Pipeline del atleta y Gala Match](./erd/08-pipeline-atleta.md) | `saved_items`, `pipeline_*`, `match_signals`, `athlete_offers` |
| 09 | [Discovery, shortlists y pipeline del staff](./erd/09-recruiting-staff.md) | `recruiting_needs`, `org_shortlists`, `org_candidates`, `org_notes` |
| 10 | [Agencias y clubes](./erd/10-agencias-clubes.md) | `agent_representations`, `recruiting_cases`, `club_roster` |
| 11 | [Comunicación, avisos y seguridad](./erd/11-comunicacion.md) | `contact_requests`, `notifications`, `content_reports` |
| 12 | [Marcas y negocio](./erd/12-marcas-negocio.md) | `brand_campaigns`, `campaign_applications`, `service_requests` |
| 13 | [IA, academia, analítica y auditoría](./erd/13-ia-analitica.md) | `ai_*`, `product_events`, `audit_logs` |

## 3. Clasificación

| Nivel | Qué es | Ejemplos | Reglas |
|---|---|---|---|
| **Pública** | Se puede mostrar sin sesión si está publicada | `sports`, `institutions`, `opportunities` publicadas | Solo lectura para el público. Escritura por la organización o por Gala |
| **Interna** | Trabajo interno de una organización o de Gala | `org_notes`, `org_candidates`, `audit_logs` | Nunca la ve el atleta ni otra organización. La controla `org_can()` |
| **Personal** | Identifica a una persona | `profiles`, `applications`, `notifications` | Propietario + quien la RLS autorice. Va en la exportación RGPD |
| **Sensible** | Su filtración causa daño real | `private_profile_data`, `athlete_academics`, `athlete_finances`, documentos, verificación, ofertas | Bloques de privacidad del atleta (`can_view_athlete`), menores con tutor, ficheros en Storage privado con URL firmada |

**Menores:** 38 tablas pueden contener datos de menores (columna «Menores» del inventario). Para ellas:
- `is_minor()` se calcula desde `private_profile_data` y nunca desde lo que diga la interfaz.
- El contacto exige la aprobación del tutor (`contact_requests.guardian_approved_by`).
- Los enlaces públicos los crea el tutor.
- Discovery solo devuelve atletas que lo hayan permitido (`athlete_discovery_settings`, `can_discover_athlete`).

## 4. Mapa de acceso

Quién puede leer qué, y qué función de la base de datos lo garantiza:

| Quién | Qué ve | Garantía en la base de datos |
|---|---|---|
| Anónimo | Passport público según la privacidad del atleta; oportunidades publicadas; ficha por enlace con token | `can_view_athlete(id, bloque)` con los bloques profile, stats, videos, academics, goals y sport; `get_recruiting_card(token)` |
| Atleta | Todo lo suyo: Passport, procesos, candidaturas, trials, IA y notificaciones | `athlete_id = auth.uid()` / `user_id = auth.uid()` |
| Familia (tutor) | Lo del atleta vinculado y aprobado; aprueba contactos y enlaces | `has_family_link`, `is_guardian_of` |
| Staff de universidad o club | Atletas descubribles o accesibles; lo interno de su organización según rol y programa | `org_can(org, capacidad, programa)` + `org_role_caps(rol)` (de owner a viewer, 13 roles) + `program_memberships` + `can_view_athlete` |
| Discovery | Solo ids de atletas que se dejan descubrir, con cuota | `discover_athlete_ids` (exige deporte), `discovery_consume` |
| Shortlists | Dueño, personas con acceso, staff del programa u organización según la visibilidad | `can_see_shortlist`, `shortlist_role`, `can_edit_shortlist` |
| Agente | Atletas con representación activa; casos y notas de su agencia | `agent_representations` (status active), `is_active_agent_for` |
| Admin de club | Plantilla y recomendaciones de su club | `is_club_admin` |
| Marca | Sus campañas y las candidaturas recibidas | `brand_campaigns.brand_org_id` + pertenencia |
| Gala (admin) | Colas de verificación, moderación, métricas agregadas, auditoría | `is_admin()`. No puede editar evidencia inmutable |
| Servidor (service role) | Solo para emitir tokens de verificación por correo y tareas del sistema | `email_verification_issue` restringido a service_role |

Las capacidades por rol son las de `org_role_caps`. Por ejemplo, `analyst` = discover, shortlist y candidates, mientras que `viewer` no tiene ninguna. Las notas internas (`org_notes`, `agency_athlete_notes`, `application_notes`) **nunca** son visibles para el atleta.

## 5. Duplicados y decisiones

| Solapamiento | Decisión | Por qué |
|---|---|---|
| `institutions` ↔ `organizations` | **KEEP** las dos | Catálogo real frente a cuenta en Gala. Enlace `organizations.institution_id`. Una universidad puede existir sin cuenta |
| `institution_programs` ↔ `org_programs` | **KEEP** | Igual que arriba, con `org_programs.institution_program_id` |
| `institution_claims` ↔ `verification_requests` | **MERGE → `verification_requests`** (tipo `institution_claim`) | Desde 7B, `verification_requests` es el flujo único. La columna `legacy_claim_id` ya está preparada |
| `saved_athletes` ↔ `org_shortlists` / `org_shortlist_members` | **MERGE → shortlist privada** | Las listas personales son anteriores a las shortlists y no tienen permisos, etiquetas ni promoción al pipeline |
| `saved_searches` ↔ `org_saved_searches` | **MERGE → `org_saved_searches`** (solo staff) | La versión de organización tiene programa, necesidad y alertas |
| `club_roster_invites` ↔ `organization_invitations` | **MERGE → `organization_invitations`** (tipo roster) | El mismo patrón de invitación con caducidad |
| `saved_items` | **RENAME → `athlete_processes`** (diferido) | Es el proceso del atleta, no un «guardado». Se renombra cuando no haya ramas abiertas que lo toquen |
| `applications` ↔ `saved_items` ↔ `org_candidates` | **KEEP** | Candidatura formal, proceso privado del atleta y pipeline interno de la organización. Se enlazan (`org_candidates.application_id`) |
| `pipeline_tasks` ↔ `org_tasks` ↔ `recruiting_case_tasks` | **KEEP** | Tienen tres dueños y tres privacidades. Comparten convenciones (§7), no tabla |
| `audit_logs` ↔ `org_activity` ↔ `org_assignment_log` ↔ `product_events` | **KEEP** | Seguridad (Gala), actividad visible para la organización, historial de asignaciones y analítica con retención de 13 meses |
| `athlete_offers` ↔ `applications.status = 'offer'` | **KEEP** | `athlete_offers` también recoge ofertas de fuera de la plataforma |
| `organizations.verification_status` ↔ `verification_requests` | **REVIEW** | Columna heredada que convive con la verificación de 7B. Objetivo: derivarla de la última decisión |

## 6. Plan de migración

**Fase 0 · Hecho en este PR (`20261120000700_delete_behavior.sql`)**

Al documentar el borrado encontré un fallo real:
- Borrar una cuenta desde el panel o con el service role **fallaba** si la persona había dejado auditoría, había revisado algo o había creado una organización u oportunidad.
- Borrar una organización también fallaba.
- La baja autoservicio (`delete_my_account`) sí funcionaba porque activa `gala.erasure`. Sigue igual: el staff que creó organizaciones, oportunidades, notas o campañas tiene que pedir la baja a soporte (es una regla de negocio y no se ha tocado), pero ahora soporte sí puede borrarlo.

Lo que se ha cambiado:
- 15 claves `NO ACTION` hacia `profiles` pasan a `ON DELETE SET NULL`. El contenido se conserva sin la persona.
- Los registros de evidencia aceptan solo anonimizar (`only_nulled`) o el borrado en cascada (`guard_evidence_record`). Siguen siendo inmutables para todo el mundo, admin incluido.
- 5 guardas de negocio aceptan la anonimización sin abrir otras ediciones: enlaces, recomendaciones, preguntas, solicitudes y asignaciones.
- Nueva prueba: al final de la batería, **todas las cuentas y organizaciones de prueba se borran sin error** y la auditoría queda anonimizada.
- La exportación RGPD pasa de 26 a 61 secciones, y una prueba comprueba que cada sección es legible por su titular (menor, adulto, coach y familia). Faltaban, entre otras, la trayectoria, los objetivos, los vídeos, los procesos, los trials, la IA, la verificación y los mensajes enviados.

**Fase 1 · Fusiones sin riesgo** (una migración por fusión, con copia de datos, vista de compatibilidad y prueba RLS):
1. `institution_claims` → `verification_requests`: copiar, rellenar `legacy_claim_id` y que `/app/verify` escriba solo en `verification_requests`. La tabla antigua queda en solo lectura durante un ciclo.
2. `saved_athletes` → shortlist privada por persona y organización. Hay que convertir antes la pantalla «Mis listas».
3. `saved_searches` → `org_saved_searches` para el staff. Las búsquedas de atletas, si las hay, se quedan donde están.
4. `club_roster_invites` → `organization_invitations` con `kind = 'roster'`.

**Fase 2 · Renombres** (cuando no haya PRs abiertos encima):
`saved_items` → `athlete_processes`, con una vista `saved_items` durante un ciclo para no romper el código desplegado.

**Fase 3 · Limpieza:**
- Derivar `organizations.verification_status`.
- Eliminar las tablas antiguas tras confirmar que llevan 30 días sin escrituras.

Reglas de cada migración:
- Debe poder revertirse (comentario `Reversión:` en la cabecera).
- No pierde datos (primero copia, después cambia las lecturas y, solo al final, borra).
- Incluye su prueba en `supabase/tests/rls.test.mjs`.
- Pasa `npm run check:erd`.

## 7. Convenciones de nombres

- Tablas en `snake_case`, en plural y en inglés: `athlete_videos`, `org_notes`. Lo exige el check de CI.
- Prefijos por dueño:
  - `athlete_*`: datos del atleta.
  - `org_*`: interno de la organización.
  - `agency_*` / `recruiting_case_*`: agencia.
  - `ai_*`: Gala IA.
  - `verification_*`: verificación.
- Claves:
  - `id uuid` como PK.
  - FK con nombre `<entidad>_id`.
  - El atleta es siempre `athlete_id → athlete_profiles(user_id)`.
  - Las personas son siempre `→ profiles(id)`.
- Autoría: `created_by`, `reviewed_by`, `assigned_to`, siempre `ON DELETE SET NULL`. Se exige desde la Fase 0.
- Tiempo: `created_at` y `updated_at` (`timestamptz`, con el trigger `set_updated_at`). Los estados con fecha usan `<estado>_at`: `revoked_at`, `verified_at`.
- Estados: `status text` con `check (status in (...))` y sin enums nuevos (son más fáciles de evolucionar). Los enums existentes se mantienen.
- Historiales: tabla `<entidad>_events` o `_history`, inmutable y con `guard_evidence_record`.
- Errores de la base de datos: códigos `snake_case` en inglés (`not_allowed`, `rate_limited`). La interfaz los traduce y nunca los muestra en crudo.

## 8. Borrado y retención

**Al borrar una cuenta:**
- Se borra lo que es solo suyo (CASCADE): Passport, procesos, IA y notificaciones.
- Lo que la persona creó para otros se conserva **anónimo** (SET NULL): notas de una organización, oportunidades publicadas, revisiones y auditoría.
- Ninguna clave hacia personas queda en `NO ACTION`. El inventario de cada dominio muestra la regla de cada tabla en la columna «Al borrar».

**Al borrar una organización:**
- Se borra su trabajo interno (shortlists, candidatos, notas, tareas y actividad).
- La auditoría de Gala conserva el hecho, sin la organización.

**Retención automática:**
- `run_retention()`, que se ejecuta cada día con pg_cron:
  - `product_events`: 13 meses.
  - Notificaciones: leídas 6 meses, todas 12 meses.
  - `athlete_updates` caducados: 30 días.
  - `ai_usage`: 90 días.
  - Invitaciones caducadas: 90 días.
  - `user_feedback`: 24 meses.
- Tareas propias:
  - `ai_events`: 13 meses.
  - Conversaciones de IA: 90 días sin actividad, y se borran al desactivar el historial.
  - Oportunidades sin confirmar: caducan a los 120 días.

Lo que no tiene una retención automática se conserva mientras exista su cuenta u organización. Así lo indica el inventario. Las nuevas retenciones se añaden a `run_retention()` y al catálogo a la vez.

## 9. Cómo mantenerlo

1. Al crear o cambiar una tabla en una migración, añádela a `scripts/erd/catalog.mjs` con su dominio, clasificación, decisión y si se exporta (o por qué no).
2. Ejecuta `DATABASE_URL=postgres://… npm run erd` para regenerar `docs/erd/`.
3. Si es personal, añádela a `src/lib/privacy/export-tables.ts`. La prueba RLS comprobará que su titular la puede leer.
4. `npm run check:erd` (también en CI) no deja pasar nada de lo anterior a medias.
