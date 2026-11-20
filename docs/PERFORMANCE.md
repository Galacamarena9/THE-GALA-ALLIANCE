# Rendimiento (Prompt 18)

**Estado:** implementado en `20261203000100_18_performance.sql` y en `scripts/perf/budget.mjs` (corre en el CI). Probado en local (bloque P18).

## Hecho

| Área | Cambio | Por qué |
|---|---|---|
| RLS | Las 59 policies que llamaban a `auth.uid()` fila a fila pasan a `(select auth.uid())`. Un test impide que vuelva a pasar | Postgres lo evalúa una vez por consulta en vez de una vez por fila |
| Revocación | Sin caché de permisos: revocar sigue siendo inmediato (comprobado) | Rendimiento sin relajar seguridad |
| Índices | Fuera 7 duplicados o redundantes. Dentro, compuestos para la bandeja del atleta, la actividad por usuario, las ofertas de marca, las sanciones activas y las asignaciones y permisos activos del agente | Menos escritura, lecturas directas |
| Búsqueda | `pg_trgm` y GIN en nombres de personas, organizaciones e instituciones | `ilike '%texto%'` usa índice (comprobado con EXPLAIN) |
| Autovacuum | Más frecuente en eventos, notificaciones, límites, cuotas y auditoría | Tablas de mucho movimiento sin hinchazón |
| Navegador | Presupuesto en el CI. Hoy: JS 502 KB, chunk máximo 70 KB, CSS 19 KB (gzip) | Si una página engorda, el CI falla |

## Ya existía

- Paginación y `limit` en las listas.
- Consultas en lote, sin N+1, en cartera, pipeline y familia.
- Límites de Gala IA por minuto y por día, con respuesta en streaming.
- Índices parciales de descubrimiento de oportunidades.

## Pendiente (con volumen real)

- **`pg_stat_statements` en producción** para ver las consultas reales más caras. Hay que activarlo en Supabase.
- **Vistas materializadas** para la analítica cuando la tabla de eventos crezca.
- **Precálculo de Gala Match** por lotes, con invalidación por cambio de Passport o de oportunidad. Hoy se calcula al momento, lo cual es suficiente con el volumen actual.
