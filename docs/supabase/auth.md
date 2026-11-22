# Auth · identidad, perfil y roles

- **Identidad:** `auth.users`. No hay contraseñas ni credenciales en tablas de producto.
- **Perfil:** el trigger `handle_new_user` crea solo la fila mínima de `profiles` (idempotente, tolera metadatos incompletos). El onboarding ocurre después, en la app.
  - Desde el 22-11, una fecha de nacimiento imposible (p. ej. 2003-02-30) ya no tumba el alta: se ignora y se vuelve a pedir en el onboarding. El alta de un menor de 13 años sigue fallando entera, a propósito.
  - **Recuperación:** si falta el perfil, `getSession` llama a la RPC `ensure_my_profile()`, que crea la fila mínima solo para `auth.uid()` y es idempotente. Prueba en `test:rls`.
- **Roles:** `user_roles` (varios por persona: atleta, coach, staff de organización, tutor, agente, marca, admin). **Nunca** se usan `user_metadata.role`, `organization` ni `is_admin` como permiso, porque el usuario puede editar sus metadatos. Hay una prueba de que nadie puede insertarse el rol `admin`.
- **Contextos:** pertenencia a organización (`organization_members` con rol y capacidades), programa (`program_memberships`), representación (`agent_representations`) y familia (`parent_athlete_links`). Una persona puede tener varios contextos con una sola cuenta.
- **MFA:** obligatoria para admins de Gala (`/mfa`).
- **Redirects:** `/auth/callback` solo acepta un `next` relativo que empiece por `/` y no por `//`. No hay redirect abierto.
- **Configuración del panel** (Auth → URL Configuration):
  - Site URL: el dominio de producción.
  - Redirect URLs: `https://<dominio>/auth/callback`, más las de las previews de Netlify **solo en el proyecto de staging**.
  - Previews y producción no deben compartir proyecto (ver [environments.md](environments.md)).
- **Límites de frecuencia:** los de Auth (alta, login, recuperación) los gestiona Supabase. Los de la app están en la base de datos y funcionan aunque haya varias instancias del servidor:
  - `rate_limit_events` (mensajes, solicitudes y otras acciones);
  - `discovery_usage` (búsqueda de atletas);
  - `ai_usage` (Gala AI).
- **Bots:** Turnstile en los formularios públicos.
- **Protección contra contraseñas filtradas:** desactivada; el plan Free no la ofrece. Mientras tanto, la app valida la fortaleza de la contraseña (`src/lib/domain/password.ts`).
