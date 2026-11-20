# Operaciones de Gala (Prompt 16)

**Estado:** implementado en `20261201000100_16_admin_ops.sql` y en `/app/admin/ops` y `/app/support`. Probado en local (bloque P16).

**Principio:** Gala Admin no es un actor del marketplace. Opera la plataforma, no curiosea en ella. Cada bloque exige su rol interno (14) y la base de datos lo vuelve a comprobar.

| Área | Qué hay |
|---|---|
| Roles internos | Soporte, revisión de verificaciones, Trust & Safety, finanzas y super admin (`has_admin_role`) |
| Colas | Verificación y denuncias en `/app/admin`; T&S, casos y apelaciones en `/app/admin/safety`; operaciones en `/app/admin/ops` |
| Interruptores de emergencia | `feature_flags`: contactar, ofertas de marca, propuestas de representación, mensajes y Gala IA. Solo el super admin los cambia, siempre con motivo y auditoría. **Se aplican en la base de datos** y Gala IA respeta su interruptor |
| Búsqueda global | `admin_search`: solo nombre, rol o tipo y estado. Exige 3 letras como mínimo y cada búsqueda queda auditada |
| Soporte | `support_cases` y sus notas. Las internas solo las ve Gala; las públicas las ve la persona, que recibe un aviso. **Nunca se pide la contraseña ni se suplanta a nadie** |
| Doble aprobación | `admin_approvals`, solo para lo muy sensible: conceder un plan a mano y borrar una organización. Lo aprueba otra persona y caduca a las 72 h. Un admin ya no puede escribir planes directamente en la tabla |
| Conflictos de representación | `admin_representation_conflicts` con su contexto. Gala resuelve el conflicto operativo, **no la validez del contrato** |
| Break glass | De 14: caducable, auditado y revisado por otra persona |
| Jobs | `admin_jobs`: estado de pg_cron. Si no está activo, se dice claramente |
| Auditoría | `audit_logs`: inmutable y clasificada |

## Pendiente

- **MFA obligatoria para entrar como admin.** La MFA existe, pero falta exigirla al rol admin. Hay que activarla con Gala para no dejar a nadie fuera.
- **Panel de calidad de datos** (fuentes externas, taxonomías versionadas). Lo cubren en parte el panel actual y Gala Match.
- **Fusión segura de organizaciones duplicadas.** Requiere una revisión manual caso a caso, con doble aprobación.
