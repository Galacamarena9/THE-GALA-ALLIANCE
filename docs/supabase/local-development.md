# Desarrollo local

El repositorio **no usa la pila Docker de Supabase CLI**. Usa un Postgres 16 normal más un *stub* de Supabase (`supabase/tests/supabase_stub.sql`: schema `auth`, roles `anon`/`authenticated`, `auth.uid()`, `storage` y `cron` mínimos). Así arranca en segundos, sirve igual en CI y aplica las migraciones desde cero en cada ejecución.

| Comando | Qué hace |
|---|---|
| `DATABASE_URL=postgres://postgres@localhost:5433/postgres npm run test:rls` | Crea una base temporal, aplica stub y migraciones, ejecuta las **412 pruebas** (roles, multitenant, menores, documentos, concurrencia, catálogo, RGPD) y borra la base. `SKIP_ERASURE=1` omite la de borrado RGPD; `KEEP_DB=1` conserva la base |
| `npm run diagnose:db` | Diagnóstico de arquitectura de solo lectura (`--data-only` contra staging) |
| `npm run drift -- <archivo>` | Deriva entre el remoto y el repositorio |
| `npm run erd` / `check:erd` | Regenera y comprueba los ERD y el catálogo de tablas |
| `npm run check:secrets` | Ningún secreto en el repositorio, el cliente ni el bundle |
| `npm run test:unit`, `npm run lint`, `npx tsc --noEmit` | Resto de comprobaciones de la CI (`app`) |

- **Seeds:** solo sintéticos y creados por las pruebas (`*@test.dev`). Nunca datos reales.
- **Tipos TypeScript:** se generan desde el proyecto **después** de aplicar allí las migraciones: `supabase gen types typescript --linked > src/lib/database.types.ts`, o con el conector de Supabase. Hasta entonces, las entradas se validan con Zod en cada acción de servidor y no hay tipos generados que puedan estar desfasados.
- **Limitación conocida:** el stub no reproduce Realtime ni el servidor de Storage. Las políticas de esas piezas se prueban como SQL sobre sus tablas, no con un cliente real.
