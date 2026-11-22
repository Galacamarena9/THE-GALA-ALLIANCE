# Problemas habituales

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `permission denied for table X` en una prueba o en la app | Falta el `grant` explícito al rol | Añadir `grant select/insert/… on X to authenticated` en la migración. La RLS no da permisos de tabla |
| `permission denied for function` | La función no tiene `EXECUTE` para ese rol (a propósito en triggers y helpers internos) | Si debe llamarse desde la API, `grant execute … to authenticated`; nunca a `anon` sin revisarlo (rls.md §4) |
| Prueba P18 §16 falla | La política usa `auth.uid()` directamente | Escribir `(select auth.uid())` para que se evalúe una vez por consulta |
| Prueba P9 falla: FK sin índice / sin `search_path` / trigger ejecutable | Catálogo | Índice en la FK; `set search_path = public` en la función; `revoke execute` en la función trigger |
| `check:erd` falla | Tabla nueva sin catalogar | Añadirla a `scripts/erd/catalog.mjs` y ejecutar `npm run erd` |
| El alta falla sin mensaje claro | Error dentro de `handle_new_user` (se ejecuta en la misma transacción) | Revisar los logs de Postgres. Desde el 22-11, una fecha imposible ya no lo provoca; un menor de 13 años sí, a propósito |
| `db push` dice «Remote migration versions not found» | Historial remoto distinto del local | [migrations.md §3](migrations.md) (`migration repair`) |
| Un usuario no ve datos que debería | Falta pertenencia, verificación, capacidad o concesión. No es un fallo de la app | Comprobar en este orden: sesión → pertenencia → verificación → capacidad → RLS. Nunca relajar la política para «arreglarlo» |
| Advisor «leaked password protection» | Ajuste de Auth del plan Pro | Activarlo en el panel al pasar a Pro |
| Advisor «security definer ejecutable por anon» | Ver la lista revisada en rls.md §4 | Si la función no está en esa lista, quitar el `EXECUTE` |
