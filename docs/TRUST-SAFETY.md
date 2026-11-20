# Trust & Safety (Prompt 14)

**Estado:** implementado en `20261129000100_14_trust_safety.sql` y probado en local (bloque P14, 380 pruebas RLS en verde). La regla de siempre: **la seguridad vive en la base de datos**, no en la interfaz.

## Qué ya existía (REUSE)

| Área | Dónde |
|---|---|
| Denuncias DSA con prioridad y auto-protección (seguridad infantil o 3 denunciantes) | `content_reports`, `auto_protect_on_report` |
| Bloqueos de persona y de organización, efecto inmediato en contacto, mensajes, invitaciones y peticiones de documentos | `user_blocks`, `athlete_blocks_org`, `is_blocked_*` |
| Auditoría inmutable, clasificada, anonimizada al borrar la cuenta | `audit_logs` + `audit_immutable` |
| Consentimientos centrales, verificación central, credenciales que caducan | 9, 10, 12 |
| Paso a la mayoría de edad: el acceso familiar caduca a los 18 si no se revisa; marcas y agencias se recalculan con `is_minor()` en cada consulta | `family_link_lapsed`, `agent_can`, guards de marcas |
| MFA, cabeceras de seguridad (CSP, noindex en `/app`), escaneo de secretos, ficheros verificados por firma | 8, `next.config.ts`, `check:secrets`, `file-sniff` |
| Gala IA sin service role y con filtro de datos de terceros y de inyección | 10C, `src/lib/ai/safety.ts` |
| Exportación y borrado RGPD | `export-tables.ts`, pruebas RGPD |

## Nuevo (EXTEND / NEW)

- **Roles internos de Gala** (`admin_roles`, `has_admin_role`): soporte, revisión de verificaciones, Trust & Safety, finanzas y super admin. Un admin sin rol asignado conserva el comportamiento anterior; en cuanto tiene un rol, solo hace lo de ese rol.
- **Casos de seguridad** (`safety_cases` + `safety_case_events`). Agrupan denuncias, persona u organización, pruebas, medidas e historia. Así un caso complejo no se resuelve con una sola columna.
- **Medidas proporcionales** (`moderation_actions`):
  - tipos: aviso, retirar contenido, pausar una oportunidad, **restringir por ámbito**, suspender, retirar la verificación o escalar;
  - ámbitos: contactar, mensajes, descubrir, publicar, ofertas, representar, candidaturas;
  - cada medida lleva motivo (mínimo 10 caracteres), duración y quién la tomó, y se puede revertir;
  - se aplican **en la base de datos** con triggers en contacto, mensajes, representación, ofertas, candidaturas y publicación.
- **Apelaciones** (`moderation_appeals`). Solo apela el afectado (o quien dirige la organización afectada) y hay una sola apelación abierta por medida. **Quien sancionó no resuelve la apelación** si hay otro revisor.
- **Break glass** (`break_glass_grants`): acceso de emergencia de un admin a los documentos de una persona concreta.
  - Requiere motivo y dura como máximo 4 horas.
  - Queda auditado y lo revisa otro super admin.
  - Solo lo ve quien lo abrió.
- **Límites anti-spam** en la base de datos (`rate_limit_hit`). Contadores privados que se purgan a los 7 días.

  | Acción | Límite |
  |---|---|
  | Contactos | 20 al día |
  | Mensajes | 120 por hora |
  | Propuestas de representación | 60 al día |
  | Ofertas de marca | 50 al día |
  | Candidaturas | 30 al día |
  | Denuncias | 20 al día |

## En la app

- **`/app/trust`** (cualquier usuario):
  - medidas activas, con su motivo y el botón de apelar;
  - para atletas, el **mapa de acceso**: familia, agencias, documentos compartidos y organizaciones con las que habla;
  - los controles de seguridad.
- **`/app/admin/safety`** (solo Trust & Safety): denuncias sin caso, apelaciones, casos por prioridad con su línea de tiempo y formulario de medida, y medidas activas, que se pueden retirar.

## Pendiente (honesto)

- **Re-autenticación para acciones críticas** (cambiar el dueño de una organización, exportaciones masivas). Ya existe MFA; falta pedirla en el momento.
- **Detección automática de patrones de fraude** (cuentas que se crean en serie, pagos). Por ahora la detección es humana más los límites anti-spam.
- **Plan de respuesta ante brechas.** Va en Observabilidad (19).
