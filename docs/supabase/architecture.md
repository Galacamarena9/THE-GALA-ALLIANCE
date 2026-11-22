# Arquitectura · cómo se usa Supabase

**Cadena de cada consulta:** Autenticación (Supabase Auth) → Pertenencia (`organization_members`, representación, vínculo familiar) → Verificación (`verification_requests`) → Permiso (capacidades por rol + alcance por programa) → **RLS en PostgreSQL** → Minimización de datos (columnas permitidas por `passport_field_policies` y vistas `security_invoker`).

| Capa | Qué hace | Dónde |
|---|---|---|
| Base de datos | Invariantes, RLS, RPCs transaccionales, triggers de guarda, auditoría | `supabase/migrations/` |
| Servidor Next.js (Netlify) | Acciones de servidor con la **sesión del usuario** (la RLS se aplica), validación Zod, integraciones (Stripe, Resend, Anthropic, College Scorecard) | `src/app/actions/`, `src/lib/data/` |
| Cliente | Presentación. Nunca decide permisos | `src/app/` |

- **Schemas:** `public` (producto, con RLS) y `extensions`. Por qué no se separan en `private`, `audit`, `analytics` o `external`: [`../SUPABASE_ARCHITECTURE.md §3`](../SUPABASE_ARCHITECTURE.md).
- **Capa de acceso a datos:** cargadores por dominio en `src/lib/data/*` (portafolio, atleta 360, CRM, búsqueda de talento, organización…). Componen consultas y aplican la minimización. La autorización no se repite en la app: la impone la RLS.
- **Gala AI:** lee con la sesión del usuario, así que hereda su RLS. No tiene clave de servicio ni SQL directo; sus herramientas son funciones de servidor con la misma autorización que la interfaz.
- **Realtime:** solo `contact_messages` (mensajería); la RLS filtra los eventos. No se activa en más tablas sin necesidad.
- **Tareas programadas:** pg_cron (caducidad de oportunidades, invitaciones, credenciales, representaciones y ofertas de marca, recordatorios, retención de IA y analítica, limpieza de límites de uso). Todas son idempotentes.
- **Notificaciones:** se escriben en `notifications` dentro de la misma transacción del evento. El correo se envía después desde el servidor (Resend) y, si falla, la notificación in-app ya está guardada.
- **Fuente de verdad de cada concepto:** [`../ARCHITECTURE-AUDIT.md §3`](../ARCHITECTURE-AUDIT.md).
