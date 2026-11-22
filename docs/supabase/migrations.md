# Migraciones · procedimiento

## 1. Reglas

- Todo cambio de schema va en un archivo de `supabase/migrations/` con nombre `<timestamp>_<fase>_<qué>.sql`. **Nada de cambios a mano en el panel** (así apareció `application_tracking`, ver README §1).
- Una migración = un cambio con sentido; cabecera con el motivo y el riesgo; bloque `-- ROLLBACK` al final.
- Si un cambio toca datos existentes, va en **expand → migrate → switch → contract**:
  1. **Expand:** añadir columnas o tablas sin romper nada. Los constraints nuevos van `NOT VALID`.
  2. **Migrate:** copiar los datos y reconciliar (conteos antes y después; huérfanos y duplicados con `npm run diagnose:db -- --data-only`).
  3. **Switch:** la app pasa a la estructura nueva. Si hace falta, una vista de compatibilidad durante un ciclo.
  4. **Contract:** se elimina lo antiguo en una migración posterior, solo tras validar y con al menos 30 días sin escrituras.
- Ninguna migración destructiva llega a producción solo porque la CI esté en verde.

## 2. Flujo

Local (`test:rls`, 416 pruebas) → CI (`rls`, `app`, `e2e`) → **staging** (aplicar, advisors, `diagnose:db -- --data-only`, regenerar tipos, e2e contra staging) → **producción** con backup previo y tu aprobación.

## 3. Aplicar en un proyecto remoto cuyo historial no coincide (caso actual)

El proyecto remoto registró las migraciones con versiones propias (`20261113160830_foundation_part1`…). `supabase db push` no sabe que son las mismas que las locales e intentaría aplicarlas todas otra vez. Procedimiento seguro:
1. **Backup:** `supabase db dump --linked -f schema.sql` y `supabase db dump --linked --data-only -f data.sql`. Guardar los archivos fuera del repositorio.
2. **Confirmar el punto de partida:** `npm run drift -- <lista de tablas del remoto>` debe decir «migración 40».
3. **Reescribir solo el historial**, sin tocar el schema:
   - marcar como `reverted` las 43 versiones que solo existen en el remoto (`supabase migration repair <versión> --status reverted`). Si no, `db push` se niega porque el remoto tiene versiones que no están en local;
   - marcar como `applied` las 40 locales cuyo contenido ya está en el remoto (`supabase migration repair <versión> --status applied`).
4. **Aplicar las pendientes:** `supabase db push`, que ahora solo enviará las 39 restantes, en orden.
5. **Validar:** advisors de seguridad y rendimiento, `diagnose:db -- --data-only`, conteos de tablas críticas antes y después, y la prueba manual de login, alta y subida de un documento.
6. **Regenerar los tipos** (ver [local-development.md](local-development.md)).

Si algo falla en el paso 4, se para. Cada migración es transaccional, así que la que falla no deja cambios a medias. Se corrige en local y se reintenta. Si el schema queda inutilizable, se restaura el dump del paso 1.

## 4. Deriva

`npm run drift -- <archivo>` (sin conexión al remoto) dice:
- hasta qué migración local llega el remoto;
- qué tablas tiene el remoto que el repositorio no crea nunca;
- cuántas migraciones quedan por aplicar.

Ejecutarlo antes de cada lote y después de él. Instantánea del 22-11: `remote-tables-2026-11-22.txt`.


## 5. Cómo se puso al día STAGING (22-11-2026) y cómo se hará en producción

Sin la contraseña de la base ni la CLI enlazada, se aplicó con el conector de Supabase, sin copiar SQL a mano:
1. **Reconciliación previa:** se comparó la huella del remoto con la del repositorio en la migración 40. Coincidían las políticas; había una tabla, una columna y funciones antiguas que no salían de ninguna migración.
2. **Copia previa:** conteos y filas de las tablas con datos (1 usuario admin, catálogos), guardados fuera del repositorio.
3. **Aplicación:** una función temporal (`migration_tmp.apply`) descarga cada archivo de GitHub fijado a un commit, comprueba su **md5** y lo ejecuta en su propia transacción. Después lo registra en `supabase_migrations.schema_migrations` **con la versión del repositorio**, así que el historial nuevo ya coincide con el repo. Si una falla, no se aplica nada de ella y el proceso se para.
4. **Reconciliación:** `20261210000100_staging_reconcile.sql` (condicional: solo borra lo que está vacío).
5. **Validación:** la huella (`npm run schema:fingerprint` → `schema-fingerprint.json`) es igual a la del remoto, y los advisors coinciden con lo revisado en local.
6. **Limpieza pendiente:** el conector pide confirmación para sentencias `DROP` y nadie respondió a tiempo. Falta ejecutar en STAGING:
   `drop function migration_tmp.apply(text, text); drop function migration_tmp.apply(text, text, text); drop schema migration_tmp; drop extension http;`

El historial anterior (43 versiones con marcas de tiempo propias) sigue en la tabla. Para usar `supabase db push` en staging, primero hay que marcarlas como `reverted` (§3).
