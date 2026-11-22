# Supabase & PostgreSQL · The Gala Alliance

Revisión del Prompt 9 del **22-11-2026** sobre el repositorio y el proyecto Supabase reales. El 20-11 ya se hizo una primera pasada, documentada en [`../SUPABASE_ARCHITECTURE.md`](../SUPABASE_ARCHITECTURE.md). Esta revisión comprueba qué sigue siendo cierto, mira por primera vez el proyecto remoto y cierra los huecos.

| Documento | Contenido |
|---|---|
| [architecture.md](architecture.md) | Cómo se usa Supabase y la cadena de seguridad |
| [auth.md](auth.md) | Identidad, perfil, roles y redirects |
| [rls.md](rls.md) | Políticas, funciones de autorización y matriz por tabla sensible |
| [storage.md](storage.md) | Buckets, rutas, enlaces firmados y subidas |
| [migrations.md](migrations.md) | Procedimiento: expand → contract, reconciliación y deriva |
| [local-development.md](local-development.md) | Base local, pruebas y comandos |
| [environments.md](environments.md) | Local, staging y producción, y estado real |
| [backup-recovery.md](backup-recovery.md) | Backups, RPO/RTO y restauración |
| [edge-functions.md](edge-functions.md) | Funciones privilegiadas, service role y secretos |
| [troubleshooting.md](troubleshooting.md) | Problemas habituales |

## 1. Qué hay en el proyecto remoto (inspección de solo lectura, 22-11)

Proyecto `the-gala-alliance` (`fkbnznccsoqdniaqviev`, eu-west-1, Postgres 17), en una organización con **plan Free**. Es el **único** proyecto Supabase de Gala. No hay ramas ni proyecto de staging.

> **Plan Free = sin backups automáticos ni PITR**, y sin protección contra contraseñas filtradas (ambas cosas son del plan Pro o superior). Hoy no hay nada que recuperar si el proyecto se rompe. Ver [backup-recovery.md](backup-recovery.md).

| Elemento | Remoto | Repositorio |
|---|---|---|
| Migraciones | 43 aplicadas; la última es `verification_discovery_shortlists` (20-11) | 74 |
| Tablas `public` | 108, todas con RLS | 160 |
| Datos | 1 usuario, 1 perfil, 0 organizaciones, 0 atletas, 0 candidaturas | — |
| Buckets | `athlete-documents` y `athlete-photos` (privados) | 3 (falta `verification-evidence`) |
| Edge Functions | 0 | 0 (decisión documentada) |
| pg_cron | Activo, 8 tareas | 13 tareas definidas |
| Realtime | Solo `contact_messages` | Igual |

**Conclusión:** el remoto se ha quedado en la migración 40 de 74. Le faltan **34 migraciones**: 11A–11E (clubs y academias), la revisión del Prompt 9 del 20-11, Family, Agents, Brands, Trust & Safety, Billing, Analytics, Rendimiento, Observabilidad, Growth, la búsqueda de talento, la lista de difusión y las dos de hoy. Como está casi vacío, aplicarlas no pone datos en riesgo. Aun así es el único proyecto que existe, y la decisión es tuya (ver §4).

### Advisors de seguridad del remoto

| Aviso | Nº | ¿Resuelto en el repositorio? |
|---|---|---|
| Funciones `SECURITY DEFINER` ejecutables por `anon` | 38 | **Sí, en parte.** Las migraciones pendientes retiran el permiso a las funciones trigger y a las internas. Localmente quedan 20, todas helpers de RLS o RPCs públicas por diseño (enlace de reclutamiento, invitación, respuesta de difusión). Ver [rls.md §4](rls.md) |
| Funciones `SECURITY DEFINER` ejecutables por `authenticated` | 99 | **Por diseño.** Son las RPCs de la app; cada una comprueba `auth.uid()` y permisos dentro |
| `search_path` mutable (`org_policy_version`, `domain_matches`) | 2 | **Sí**, en `20261123000100_09_supabase_hardening.sql` (la prueba P9 de catálogo falla si alguna función no lo fija) |
| Tabla con RLS y sin políticas (`passport_views`) | 1 | **Por diseño**: deny-all; solo se escribe desde una función |
| Protección contra contraseñas filtradas desactivada | 1 | **No.** Es un ajuste del panel (Auth), no de SQL, y solo existe en plan Pro o superior. Hoy la app exige una contraseña robusta con su propia validación (`password.test.ts`) |

### Deriva entre el remoto y el repositorio

`npm run drift -- docs/supabase/remote-tables-2026-11-22.txt` compara el remoto con el repositorio migración a migración:

- **`application_tracking`** existe en el remoto (0 filas, RLS con 4 políticas), pero **ninguna migración del repositorio la crea**. Alguien la aplicó directamente en el remoto. Al aplicar las migraciones pendientes, la tabla seguirá ahí sin que nada la use.
  - **Recomendación:** no borrarla en caliente. Primero confirmar en el remoto que sigue con 0 filas; después, una migración `contract` que la elimine, con rollback documentado.
- **El historial de versiones no coincide.** El remoto registra las migraciones con marcas de tiempo propias (`20261113160830_foundation_part1`…) y algunas partidas en dos. Si se ejecuta `supabase db push`, intentará aplicar de nuevo las 74. El procedimiento seguro está en [migrations.md §3](migrations.md).
- `opportunity_event_details`, `trial_registrations` y `trial_registration_events` desaparecen con 11A, que las sustituye por el modelo de participación. En el remoto tienen 0 filas, así que no se pierde nada.

## 2. Estado de los entregables del Prompt 9

✅ hecho y probado · 🟡 parcial o decidido de otra forma · ⛔ bloqueado

| # | Entregable | Estado | Evidencia o motivo |
|---|---|---|---|
| 1 | Arquitectura Supabase documentada | ✅ | Esta carpeta y `SUPABASE_ARCHITECTURE.md` |
| 2 | Schema PostgreSQL definitivo | 🟡 | 160 tablas en el repositorio; el remoto va 34 migraciones por detrás |
| 3 | Migraciones SQL versionadas | ✅ | 74 en `supabase/migrations/`, cada una con bloque ROLLBACK |
| 4 | Estrategia de entornos | 🟡 | [environments.md](environments.md). **No existe staging**; se propone cómo crearlo |
| 5 | Backup y plan de rollback | ⛔ | [backup-recovery.md](backup-recovery.md). Plan Free: sin backups automáticos ni PITR. Rollback por migración sí existe; la restauración no se ha probado |
| 6 | Matriz RLS | ✅ | [rls.md](rls.md) + `FAMILY-RLS.md`, `CLUBS-ACADEMIES-RLS.md`, `AGENT-RLS.md` |
| 7 | Policies implementadas | ✅ | RLS en 160/160; 407 pruebas |
| 8 | Roles y permisos | 🟡 | `user_roles` + `organization_members` + capacidades por rol (`org_role_caps`) + alcance por programa. No hay tabla `permissions` editable: las capacidades están fijadas en SQL (decisión: menos superficie) |
| 9 | Functions PostgreSQL | ✅ | Todas con `search_path` fijo (prueba P9) |
| 10 | Triggers documentados | 🟡 | Documentados en la cabecera de cada migración; no hay un índice único de triggers |
| 11 | Storage buckets y policies | ✅ local / ⛔ remoto | [storage.md](storage.md). Al remoto le falta `verification-evidence` hasta aplicar migraciones |
| 12 | Edge Functions revisadas | ✅ | No hay; las tareas privilegiadas van en el servidor Next.js ([edge-functions.md](edge-functions.md)) |
| 13 | Service role audit | ✅ | `SUPABASE_SECRET_KEY` solo en el webhook de Stripe y en el envío del correo de verificación; `check:secrets` en CI |
| 14 | Secrets audit | 🟡 | Repositorio y bundle comprobados en CI. **No he revisado las variables de Netlify** (las tienes tú en el panel) |
| 15 | Capa de datos de College Scorecard | 🟡 | `institutions` con fuente y fecha; sin tabla de vínculo origen ↔ organización ni cola de duplicados (§9–10 del prompt) |
| 16 | Estrategia del índice de Discovery | ✅ | `athlete_directory` derivada y reconstruible + cuota diaria (`discovery_usage`) |
| 17 | Estrategia de cálculo de Match | ✅ | Bajo demanda + `match_snapshot` versionado |
| 18 | Shortlists | ✅ | `org_shortlists` + miembros, accesos, etiquetas y notas; unique parcial |
| 19 | Recruiting Process central | 🟡 | Tres perspectivas enlazadas (atleta, organización, agencia), no una sola tabla. Ver `ARCHITECTURE-AUDIT.md §2` |
| 20 | Document access grants | ✅ | `document_access_grants` + `document_open` auditado |
| 21 | Protección de menores | ✅ | Prueba de hoy añadida: un anónimo ya no puede preguntar si un perfil es de adulto |
| 22 | Sistema de auditoría | ✅ | `audit_logs` |
| 23 | Analítica de producto separada | ✅ | `product_events` (retención de 13 meses) |
| 24 | Tipos TypeScript regenerados | ⛔ | Generarlos ahora daría tipos de la migración 40. Se generan después de aplicar las pendientes |
| 25 | Tests de base de datos | ✅ | `npm run test:rls`: **407 OK** |
| 26 | Tests de RLS | ✅ | Roles: anónimo, adulto, menor, tutor, coach sin verificar y verificado, admin de organización, agencia y admin de Gala |
| 27 | Tests cross-tenant | ✅ | Universidad A ↔ B, Club A ↔ B, agencia A ↔ B, baja inmediata |
| 28 | Tests de concurrencia | 🟡 | Candidatura doble y representación (12A.1). Faltan shortlist simultánea y doble aprobación de verificación |
| 29 | Performance review | 🟡 | Índices en todas las FKs y presupuesto de rendimiento en CI. Falta `EXPLAIN ANALYZE` con datos reales |
| 30 | Documentación técnica | ✅ | Esta carpeta |

**Prompt 9 no está completo.** Según su §92, la fase solo termina cuando staging funciona y existe rollback probado. Hoy no hay staging, el remoto va por detrás y la restauración no se ha probado.

## 3. Cambios de hoy (riesgo bajo, probados en local)

| Migración | Qué arregla | Prueba |
|---|---|---|
| `20261209000100_09r_anon_minor_oracle.sql` | A3 de la auditoría: `anon` ya no puede ejecutar `is_listed_adult_profile`, que dejaba saber sin sesión si un perfil era de un adulto. La política de `profiles` se separa por rol | Un anónimo recibe «permission denied» y con sesión el perfil adulto sigue visible. Lista los 20 `SECURITY DEFINER` que siguen abiertos a `anon` |
| `20261209000200_09r_profile_bootstrap.sql` | §6 del prompt. Una fecha de nacimiento imposible (2003-02-30) **tumbaba el alta entera**; ahora se ignora y se pide en el onboarding. El trigger es idempotente y se añade la RPC `ensure_my_profile()` para recuperar un perfil que falte. `getSession` la llama si no encuentra el perfil | Alta con fecha imposible, perfil borrado y recreado, segunda llamada sin efecto, anónimo rechazado |

`npm run drift` es la herramienta nueva de deriva (§1).

**Hallazgo no aplicado:** en `agency_athlete_notes`, un `viewer` o `scout` de la agencia puede leer el texto de las notas pidiéndolo directamente a la API. La interfaz se lo oculta, pero la base de datos no. Ver [rls.md §6](rls.md).

## 4. Decisiones que necesito de ti

1. **Aplicar las 34 migraciones pendientes al proyecto remoto.** Como no hay staging, el remoto hace de staging (tiene 1 usuario y ningún dato). Pasos:
   1. Exportar antes el schema.
   2. Aplicar en orden.
   3. Pasar advisors y `diagnose:db -- --data-only`.
   4. Regenerar tipos.

   Riesgo bajo por los datos; no se aplica sin tu OK.
2. **Pasar a plan Pro antes de tener usuarios reales.** Da backups diarios con 7 días de retención y la protección contra contraseñas filtradas; PITR es un extra de pago. Mientras tanto, exporta el schema y los datos antes de cada lote de migraciones (ver [backup-recovery.md](backup-recovery.md)).
3. **Cerrar las notas de agencia** a `viewer` y `scout` también en la base de datos (rls.md §6).
4. **Antes de tener usuarios reales**, decidir si el proyecto actual pasa a ser staging y se crea uno nuevo de producción (recomendado), o al revés. Ver [environments.md](environments.md).
