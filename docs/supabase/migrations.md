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

Local (`test:rls`, 412 pruebas) → CI (`rls`, `app`, `e2e`) → **staging** (aplicar, advisors, `diagnose:db -- --data-only`, regenerar tipos, e2e contra staging) → **producción** con backup previo y tu aprobación.

## 3. Aplicar en un proyecto remoto cuyo historial no coincide (caso actual)

El proyecto remoto registró las migraciones con versiones propias (`20261113160830_foundation_part1`…). `supabase db push` no sabe que son las mismas que las locales e intentaría aplicarlas todas otra vez. Procedimiento seguro:
1. **Backup:** `supabase db dump --linked -f schema.sql` y `supabase db dump --linked --data-only -f data.sql`. Guardar los archivos fuera del repositorio.
2. **Confirmar el punto de partida:** `npm run drift -- <lista de tablas del remoto>` debe decir «migración 40».
3. **Reescribir solo el historial**, sin tocar el schema:
   - marcar como `reverted` las 43 versiones que solo existen en el remoto (`supabase migration repair <versión> --status reverted`). Si no, `db push` se niega porque el remoto tiene versiones que no están en local;
   - marcar como `applied` las 40 locales cuyo contenido ya está en el remoto (`supabase migration repair <versión> --status applied`).
4. **Aplicar las pendientes:** `supabase db push`, que ahora solo enviará las 37 restantes, en orden.
5. **Validar:** advisors de seguridad y rendimiento, `diagnose:db -- --data-only`, conteos de tablas críticas antes y después, y la prueba manual de login, alta y subida de un documento.
6. **Regenerar los tipos** (ver [local-development.md](local-development.md)).

Si algo falla en el paso 4, se para. Cada migración es transaccional, así que la que falla no deja cambios a medias. Se corrige en local y se reintenta. Si el schema queda inutilizable, se restaura el dump del paso 1.

## 4. Deriva

`npm run drift -- <archivo>` (sin conexión al remoto) dice:
- hasta qué migración local llega el remoto;
- qué tablas tiene el remoto que el repositorio no crea nunca;
- cuántas migraciones quedan por aplicar.

Ejecutarlo antes de cada lote y después de él. Instantánea del 22-11: `remote-tables-2026-11-22.txt`.
