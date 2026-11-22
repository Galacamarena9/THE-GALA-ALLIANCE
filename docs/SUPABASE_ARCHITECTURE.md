# Arquitectura Supabase & PostgreSQL (Prompt 9)

Fecha: 2026-11-20 · Parte del trabajo del Prompt 8 (ERD por dominios en `docs/erd/`, `DATA_ARCHITECTURE.md`).

> **Actualizado el 22-11-2026:** la revisión contra el proyecto remoto real, el estado de cada entregable y los procedimientos están en [`docs/supabase/`](./supabase/README.md). Si este documento contradice esa carpeta, manda la carpeta (p. ej., §2: el proyecto remoto es plan Free y va 37 migraciones por detrás).
Secuencia seguida: **INSPECT → BACKUP → DESIGN → MIGRATE → SECURE → VALIDATE → TEST → DOCUMENT**.

## 1. Estado inspeccionado

| Elemento | Valor |
|---|---|
| Migraciones versionadas | 53 (`supabase/migrations/`, orden por timestamp) |
| Tablas en `public` | 120, **todas con RLS activada** (prueba de catálogo P9) |
| Políticas RLS | 288 |
| Funciones | 225 (192 `SECURITY DEFINER`, todas con `search_path` fijo) |
| Triggers | 119 |
| Vistas | 1 (`security_invoker`) · vistas materializadas: 0 |
| Pruebas de base de datos | 298 (RLS por rol, cross-tenant, menores, documentos, concurrencia, RGPD, catálogo) |
| Buckets de Storage | 3 privados (ver §6) · ninguno público |
| Realtime | solo `contact_messages` |
| Edge Functions | ninguna (ver §8) |

### Hallazgos de la inspección y estado

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| S9-01 | Media | `verification_evidence.storage_path` podía apuntar a la carpeta de otra persona. (Documentos y fotos ya lo impedían con `path_belongs_to_athlete` / `photo_belongs_to_athlete`; revalidado.) | Arreglado: constraint `verification_evidence_path_owner` |
| S9-02 | Media | Abrir un documento privado desde una organización no dejaba rastro. | Arreglado: RPC `document_open` (comprueba permiso y registra en `audit_logs` como `sensitive`/`security`); `/api/documents/[id]` la usa |
| S9-03 | Media | 124 claves foráneas sin índice (borrados RGPD en cascada y joins de RLS). | Arreglado: índices `fkx_*` |
| S9-04 | Baja | Funciones trigger `SECURITY DEFINER` ejecutables por `anon`/`authenticated`. | Arreglado: `revoke execute` (el disparo del trigger no depende de ese permiso; 298 pruebas verdes) |
| S9-05 | Baja | 2 funciones sin `search_path`. | Arreglado |
| S9-06 | Media | Sin bucket ni políticas para evidencias de verificación. | Arreglado: bucket privado `verification-evidence` (5 MB, PDF/JPG/PNG) |
| S9-07 | Media | La subida confiaba en el tipo que declara el navegador. | Arreglado: el servidor descarga el archivo, comprueba la firma real (magic bytes) y el tamaño, y guarda `content_sha256`; si no coincide, lo borra |
| S9-08 | Info | Sin comprobación automática de secretos. | Arreglado: `npm run check:secrets` en CI (repo, variables `NEXT_PUBLIC_`, componentes de cliente y bundle del navegador) |

## 2. Entornos

| Entorno | Qué es | Datos |
|---|---|---|
| Local | Postgres 16 + stub de Supabase (`supabase/tests/`), base desechable por ejecución | Sintéticos |
| CI | Mismo arnés en GitHub Actions (`rls`), más `app` (lint, tipos, ERD, unitarias, build, secretos) y `e2e` | Sintéticos |
| Supabase remoto (pruebas) | Proyecto separado elegido para cuentas demo por rol; **no es producción** | Demo |
| Producción | Aún no creada | — |

Regla: nada se prueba contra producción. Toda migración pasa primero por local + CI y después por el proyecto de pruebas.

## 3. Schemas

Se mantiene **`public`** para las entidades de producto (expuestas por la API y protegidas por RLS) y **`extensions`** para extensiones. No se crean `private`, `analytics`, `audit` ni `external`:

- **Seguridad**: lo que no debe exponerse ya no se expone; las tablas internas tienen RLS sin políticas o solo lectura de admin (`audit_logs`, `passport_views`), y las funciones internas no tienen `EXECUTE` para `anon`/`authenticated`.
- **Coste**: mover 120 tablas a otros schemas obliga a reescribir 288 políticas, 225 funciones y todas las consultas de la app, sin ganar aislamiento real.
- **Cuándo cambiar**: un schema `external` tendrá sentido cuando el import de College Scorecard (hoy bajo demanda vía API y cacheado en `institutions`) pase a ser una carga masiva programada.

## 4. Identidad y permisos

- **Supabase Auth** es la identidad; `handle_new_user` crea el `profile`. Los roles viven en `user_roles` (no en `user_metadata`: el usuario puede editar sus metadatos). Prueba: un usuario no puede insertarse el rol `admin`.
- **Organizaciones**: `organization_members` (rol + capacidades `org_role_caps`, alcance por programa y equipo). Funciones de autorización: `org_can`, `org_can_scope`, `org_can_opp`, `is_org_member`, `is_admin`, `can_view_athlete`, `participation_actor`, `has_family_link`.
- **Denegar por defecto**: sin política no hay acceso; los IDs que manda el cliente se recomprueban siempre en la base de datos.
- **Aislamiento multitenant**: probado (Universidad A ↔ B, Club A ↔ B, viewer sin permiso de candidatos, baja de staff con efecto inmediato).

## 5. Menores

Fecha de nacimiento en `private_profile_data` (nunca pública). `is_minor` no es invocable desde la API; `viewer_is_minor` solo responde sobre uno mismo o perfiles que ya puedes ver. Contacto, Discovery y participación de menores pasan por el tutor (`minor_contact_mode`, `participation_actor`, consentimientos). El presupuesto familiar nunca es visible para clubs ni agentes.

## 6. Storage

| Bucket | Público | Límite | Tipos | Quién lee |
|---|---|---|---|---|
| `athlete-documents` | No | 10 MB | PDF, JPG, PNG | Dueño, familia con permiso, organización con concesión vigente (solo archivos de la carpeta del atleta del documento) |
| `athlete-photos` | No | 5 MB | JPG, PNG, WebP | Quien puede ver el perfil (`can_view_athlete`) |
| `verification-evidence` | No | 5 MB | PDF, JPG, PNG | Quien la sube y admins |

- Ruta = `<uuid del dueño>/<archivo>`; constraints de base de datos impiden apuntar a carpetas ajenas.
- **Enlaces firmados** de 60 s (documentos) o 5 min (documentos compartidos por solicitud), generados tras comprobar permiso; nunca se guardan ni se registran.
- **Subidas**: límite y tipos en el bucket + verificación en servidor de la firma real y del tamaño + `content_sha256`.
- Pendiente cuando haya volumen: escaneo de malware y procesado de imagen/vídeo (estado de procesamiento).

## 7. Concesiones de documentos

`document_access_grants`: documento, organización, destinatario nominal (obligatorio para documentos muy sensibles), finalidad, contexto, caducidad (máx. 30 días si es sensible), revocación inmutable. `org_has_document_grant` decide; `document_open` registra cada apertura de terceros.

## 8. Edge Functions, service role y secretos

- **No hay Edge Functions.** Las tareas privilegiadas se hacen en el servidor de Next.js (Netlify), con la sesión del usuario (RLS aplicada) salvo dos excepciones auditadas que usan `SUPABASE_SECRET_KEY`:
  1. Webhook de Stripe: verifica la firma HMAC con tolerancia de 5 min; los datos de usuario y plan vienen de la sesión de pago creada por el servidor; idempotente por `(source, reference)`.
  2. Envío del correo de verificación institucional (`server-only`): el id de verificación sale de una RPC hecha con la sesión del usuario.
- Variables públicas: `NEXT_PUBLIC_SUPABASE_URL`, clave publicable/anon, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_INVESTOR_EMAIL`.
- Variables privadas: `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `COLLEGE_SCORECARD_API_KEY`, `CONSENT_IP_SALT`.
- `check:secrets` en CI garantiza que ninguna privada aparece en el repo, en una variable `NEXT_PUBLIC_`, en un componente de cliente ni en el bundle del navegador. Si algún día falla: rotar la clave en su proveedor antes de nada.

## 9. Integridad, transacciones e idempotencia

- Constraints `CHECK`, `UNIQUE` y uniques parciales en estados clave: una candidatura por atleta y oportunidad, una inscripción activa por programa, una invitación abierta, una solicitud de información abierta, un vídeo destacado, una reclamación de institución pendiente.
- Las transiciones críticas (decidir candidatura, inscribir, aceptar oferta, publicar) son RPCs transaccionales con bloqueo de fila y protección de doble clic.
- **Concurrencia probada**: dos candidaturas simultáneas → exactamente una (la segunda espera al índice único y falla).
- Borrado: matriz de `ON DELETE` (`20261120000700_delete_behavior.sql`); RGPD probado: toda cuenta y organización se borra y la auditoría se anonimiza.

## 10. Auditoría y analítica

- `audit_logs` (acciones de seguridad y negocio, clasificación `normal/sensitive/security`, solo lectura admin) ≠ `product_events` (analítica de producto, sin datos sensibles). Ver `ANALYTICS_EVENTS.md`.
- Gala AI lee con la sesión del usuario: hereda exactamente su RLS; no tiene clave de servicio.

## 11. Rendimiento

Índices en todas las FKs e índices de estado/fecha en colas de trabajo. Contra scraping, `discover_athlete_ids` aplica una cuota diaria por usuario (`discovery_usage` → `rate_limited`). Sin vistas materializadas: el volumen actual no las justifica; Gala Match se calcula bajo demanda. Revisar con los advisors de rendimiento de Supabase tras aplicar en remoto.

## 12. Tipos TypeScript

Los tipos se generarán con el conector de Supabase desde el proyecto remoto **una vez aplicadas las migraciones pendientes** (si se generan antes, saldrían desfasados). Hasta entonces la validación de entrada se hace con Zod en cada acción de servidor.

## 13. Backups y rollback

- **Antes de aplicar en remoto**: comprobar en el panel de Supabase el tipo de backup del plan (diario o PITR); si el plan no tiene PITR, exportar con `pg_dump` el schema y los datos del proyecto de pruebas antes de cada lote de migraciones.
- Cada migración termina con su bloque **ROLLBACK** comentado (orden inverso, sin pérdida de datos salvo columnas nuevas).
- Migraciones **expand → contract**: primero se añade (columnas, constraints `NOT VALID` + `VALIDATE` tras reconciliar), y solo en una fase posterior se elimina lo antiguo.
- Reconciliación previa: cada constraint nuevo se comprueba contra los datos existentes antes de validarlo.

## 14. Pendiente y fuera de alcance

- Generar tipos (`database.types.ts`) tras aplicar migraciones en remoto.
- Aplicar en el proyecto de pruebas las migraciones de 11A–11E y Prompt 9, y revisar los advisors de seguridad y rendimiento.
- Escaneo de malware y procesado de medios cuando haya subidas reales en volumen.
- Proyecto de producción: crear solo cuando el piloto lo requiera, con la misma cadena de migraciones.
