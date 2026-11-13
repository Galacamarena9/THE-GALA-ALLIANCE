# Despliegue (Next.js + Supabase + Netlify)

Adaptado de las guías de Lovable (SELF_HOSTING y CUSTOM_DOMAIN_SETUP), que describían una SPA Vite con 26 edge functions y otra marca ("The Recruit Hub").

## 1. Supabase

1. Crea el proyecto en la región UE (p. ej. `eu-west-1`).
2. Aplica las migraciones en orden (`supabase/migrations/*.sql`) con `supabase db push` o desde el SQL editor.
3. Revisa los advisors de seguridad del panel (RLS activa en todas las tablas).
4. En Auth → URL Configuration:
   - Site URL: `https://<tu-dominio>`;
   - Redirect URLs: `https://<tu-dominio>/auth/callback`.
5. Opcional: activa Google y Apple en Auth → Providers. La redirect URL de Google es `https://<ref>.supabase.co/auth/v1/callback`.
6. Crea tu usuario y asígnale el rol admin desde el SQL editor:
   `insert into user_roles (user_id, role) values ('<uuid>', 'admin');`
7. Activa MFA para las cuentas admin.

## 2. Variables de entorno (Netlify → Site settings → Environment)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente y servidor (claves públicas) |
| `NEXT_PUBLIC_SITE_URL` | Enlaces de invitación |
| `ANTHROPIC_API_KEY` (y opcional `ANTHROPIC_MODEL`) | Gala IA |
| `COLLEGE_SCORECARD_API_KEY` | Importar universidades (gratis en api.data.gov) |
| `CONSENT_IP_SALT` | Hash de IP en el registro de cookies (valor aleatorio largo) |

La clave `service_role` **no** se usa en la web y no debe estar en Netlify.

## 3. Dominio

- Netlify → Domain management → añade el dominio raíz y `www`. Usa los DNS de Netlify o los registros A/CNAME que indique el panel. El HTTPS se emite solo.
- Actualiza la Site URL de Supabase con el dominio final.

## 4. Correo (cuando se active Resend)

En el proveedor DNS (p. ej. IONOS):
- **SPF:** `v=spf1 include:_spf.resend.com ~all`. Si ya existe un SPF, combínalos en un solo registro.
- **DKIM:** el registro `resend._domainkey` que muestre Resend.
- **DMARC:** empieza con `v=DMARC1; p=none; rua=mailto:dmarc@<dominio>` y sube a `quarantine` tras revisar los informes.

Usa remitentes del propio dominio (`hola@`, `notificaciones@`). Antes de enviar correos comerciales hace falta consentimiento y enlace de baja.

## 5. Comprobaciones antes de abrir

- `npm run typecheck && npm run lint && npm run test:unit && npm run build` en CI. Las pruebas RLS van contra un Postgres local (`npm run test:rls`).
- Probar el alta de un menor (14–17), la vinculación familiar, el contacto con aprobación familiar y el bloqueo.
- Revisión jurídica de `src/content/legal.ts` y relleno de los campos entre corchetes: NIF, emails, DPA y entidad de resolución de litigios.
