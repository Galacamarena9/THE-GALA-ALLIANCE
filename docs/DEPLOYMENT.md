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
| `STRIPE_SECRET_KEY` | Cobro automático de Core y Elite (Stripe Checkout). Sin ella, el botón de pago pasa a "Solicitar" |
| `STRIPE_WEBHOOK_SECRET` | Firma del webhook `https://<tu-dominio>/api/stripe/webhook` (eventos `checkout.session.completed` y `charge.refunded`) |
| `SUPABASE_SECRET_KEY` | **Solo** para el webhook de Stripe (concede el plan sin sesión de usuario). Nunca con prefijo `NEXT_PUBLIC_` |

La clave secreta de Supabase solo la usa `src/app/api/stripe/webhook/route.ts`, que verifica la firma de Stripe antes de escribir. Ninguna otra parte de la web la lee.

### Stripe (cobro sin intervención)

1. Stripe → Developers → API keys: copia la clave secreta (modo test primero) a `STRIPE_SECRET_KEY`.
2. Stripe → Developers → Webhooks → Add endpoint: `https://<tu-dominio>/api/stripe/webhook`, eventos `checkout.session.completed` y `charge.refunded`. Copia el "Signing secret" a `STRIPE_WEBHOOK_SECRET`.
3. Prueba con la tarjeta `4242 4242 4242 4242`: tras pagar, la cuenta (y sus atletas vinculados) debe ver el plan en **Mi plan**.
4. Activa en Stripe los recibos por email y los datos fiscales de la empresa antes de pasar a modo real.

### Supabase: automatizaciones

- **Storage:** la migración 0700 crea el bucket privado `athlete-documents` (10 MB, PDF/JPG/PNG) y sus políticas.
- **pg_cron:** activa la extensión en Database → Extensions para el borrado diario (`gala-retention-daily`, 03:17 UTC). Si no está disponible, ejecútalo desde el Panel de mando.
- **Auth:** exige confirmación de email (Auth → Providers → Email → Confirm email): la verificación automática de organizaciones se basa en el email confirmado.

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
