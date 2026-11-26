# Hosting en Cloudflare Workers (gratis)

Sustituye a Netlify (sin créditos). Decisión D-29.

## Comprobado (26-11-2026)
- `npm run cf:build` compila la app con OpenNext para Cloudflare.
- Tamaño del worker: 14,9 MB sin comprimir (límite del plan gratis: 64 MiB).
- `wrangler dev` sirve portada, precios, login y las pantallas de demo con respuesta 200.
- Aviso: el `proxy.ts` (middleware en Node) es «experimental» en OpenNext. Probar login y sesión en cuanto esté online.
- Límites del plan gratis: 100.000 peticiones al día y 10 ms de CPU por petición. Si alguna página da el error 1102 (CPU), el plan Workers Paid cuesta 5 $/mes.

## Conectar (lo hace Gala, una vez)
1. Cloudflare → Workers & Pages → Create → Import a repository → `Galacamarena9/THE-GALA-ALLIANCE`, rama `main`.
2. Build command: `npx opennextjs-cloudflare build` · Deploy command: `npx opennextjs-cloudflare deploy`.
3. Variables (Settings → Variables and Secrets), valores de staging:
   - Texto: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (la URL `*.workers.dev`), `ENABLE_PREVIEW=1` mientras sea demo, `ANTHROPIC_MODEL`, `EMAIL_FROM`.
   - Secretos (los pega Gala, nunca en el chat): `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `CONSENT_IP_SALT`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` (modo test), `COLLEGE_SCORECARD_API_KEY`.
   - Las `NEXT_PUBLIC_*` también como variables de build.
4. Supabase → Authentication → URL Configuration: añadir la URL `*.workers.dev` a Site URL y Redirect URLs.
5. Cuando funcione: quitar `netlify.toml` y el sitio de Netlify.
