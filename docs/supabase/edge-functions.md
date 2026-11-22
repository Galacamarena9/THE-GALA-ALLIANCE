# Edge Functions, service role y secretos

**No hay Edge Functions**, ni en el repositorio ni en el proyecto remoto (comprobado el 22-11). Las tareas privilegiadas se ejecutan en el servidor de Next.js en Netlify, que ya tiene los secretos como variables de servidor. Añadir Edge Functions significaría duplicar despliegue y secretos sin ganar seguridad.

## Service role (`SUPABASE_SECRET_KEY`)

Se salta la RLS, así que usarla **no** autoriza nada por sí misma. Solo se usa en dos sitios:
1. **Webhook de Stripe:**
   - verifica la firma HMAC (tolerancia de 5 min);
   - el usuario y el plan salen de la sesión de pago que creó el servidor;
   - es idempotente por `(source, reference)`.
2. **Correo de verificación institucional** (`server-only`): el id sale de una RPC hecha con la sesión del usuario.

## Variables

| Pública (`NEXT_PUBLIC_`) | Privada (solo servidor) |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_URL`, `TURNSTILE_SITE_KEY`, `INVESTOR_EMAIL` | `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `COLLEGE_SCORECARD_API_KEY`, `CONSENT_IP_SALT`, `OUTREACH_*` |

- La clave publicable no es un secreto. Es segura solo porque la RLS, las políticas de Storage y las RPCs validan todo.
- `npm run check:secrets` (en CI) falla si una variable privada aparece en el repositorio, en una variable `NEXT_PUBLIC_`, en un componente de cliente o en el bundle del navegador.
- **No revisado por mí:** las variables configuradas en el panel de Netlify (no tengo acceso). Comprueba allí que `SUPABASE_SECRET_KEY` no tiene prefijo `NEXT_PUBLIC_` y que no está definida en el contexto de *deploy previews* si estas apuntan a otro proyecto.
- **Si una clave se expone:** rotarla primero en su proveedor, luego actualizarla en Netlify y redesplegar.
