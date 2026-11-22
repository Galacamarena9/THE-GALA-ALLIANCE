# Backups y recuperación

## Situación real

El proyecto está en **plan Free**: **sin backups automáticos y sin PITR** (los backups diarios empiezan en Pro, con 7 días de retención; PITR es un extra de pago). Hoy, si el proyecto se rompe o se borra, no hay copia de la que restaurar. Tampoco hay datos reales que perder (1 usuario de prueba).

Además, **los backups de base de datos no incluyen los archivos de Storage**, y borrar un proyecto borra también sus backups.

## Antes de cada lote de migraciones (obligatorio mientras sea plan Free)

1. `supabase db dump --linked -f backup-<fecha>-schema.sql`
2. `supabase db dump --linked --data-only -f backup-<fecha>-data.sql`
3. Anotar la fecha, la última migración aplicada (`list_migrations`) y los conteos de las tablas críticas: `profiles`, `athlete_profiles`, `organizations`, `organization_members`, `applications`, `athlete_documents`, `agent_representations`, `consents`, `parent_athlete_links`, `verification_requests`.
4. **Probar la restauración** en una base local: aplicar el stub, el schema y los datos, y comparar los conteos. Un dump que nunca se ha restaurado no cuenta como backup.
5. Guardar los archivos fuera del repositorio. Contienen datos personales: no se suben a GitHub.

## Objetivos propuestos para producción

| | Plan Pro (backups diarios) | Pro + PITR |
|---|---|---|
| RPO (datos que se pueden perder) | Hasta 24 h | Unos minutos |
| RTO (tiempo hasta volver) | Horas (restauración desde el panel; el proyecto no está disponible mientras tanto) | Igual |

Recomendación: **Pro** al lanzar el piloto. PITR cuando haya candidaturas, ofertas o pagos reales cuya pérdida de un día no sea aceptable.

## Procedimiento de emergencia

1. Poner la app en mantenimiento (variable de entorno o desactivar el despliegue en Netlify).
2. Identificar el último punto bueno (hora del incidente).
3. Restaurar desde el panel (Database → Backups) o desde el dump.
4. Pasar `diagnose:db -- --data-only` y comparar los conteos.
5. Reactivar y documentar el incidente.

## Rollback de migraciones

Cada migración lleva al final su bloque `-- ROLLBACK`. Los cambios de datos siguen expand → contract (ver [migrations.md](migrations.md)), así que siempre se puede volver a la estructura anterior sin perder filas hasta la fase *contract*.
