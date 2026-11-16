# Auditoría · Fase 0 ("trusted opportunity operating system for global sport")

Fecha: 16 nov 2026 · Commit auditado: `d742f31` (main) · Sin cambios en el código de la aplicación.
Los inventarios de rutas, componentes y datos se **generan con scripts** que leen `src/` y `supabase/migrations/`, para que cada fila tenga su evidencia.

| Informe | Contenido |
|---|---|
| [route-inventory.md](route-inventory.md) | 77 rutas: acceso, guardia, tablas, RPC, actions, estados, indexación y eventos |
| [component-inventory.md](component-inventory.md) | 67 componentes: cliente o servidor, usos, accesibilidad y código muerto |
| [data-map.md](data-map.md) | 60 tablas con RLS, 161 políticas en su estado final y todo el acceso anónimo |
| [role-permission-matrix.md](role-permission-matrix.md) | Qué puede hacer cada rol y huecos frente a RBAC + ABAC |
| [privacy-gap-analysis.md](privacy-gap-analysis.md) | Controles existentes con evidencia y brechas de privacidad y menores |
| [threat-model.md](threat-model.md) | Amenazas, controles y huecos |
| [accessibility-audit.md](accessibility-audit.md) | axe WCAG 2.2 AA a 1440 y 320 px, resultados literales |
| [performance-audit.md](performance-audit.md) | LCP y CLS locales, peso del JS |
| [content-audit.md](content-audit.md) | Mensajes repetidos, promesas, microcopy, revisión de `/oportunidades` |
| [prioritized-backlog.md](prioritized-backlog.md) | P0/P1/P2 con criterios de aceptación y orden de PRs |

## Comprobaciones (resultados literales)

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0, sin avisos |
| `npm run typecheck` | exit 0 |
| `npm run test:unit` | # tests 86 # pass 86 # fail 0 · exit 0 |
| `npm run build` | exit 0 · `✓ Compiled successfully` |
| `npm run test:rls` | Necesita un Postgres (`DATABASE_URL`); se ejecuta en el CI (job `rls`), en verde en el último commit de main |
| E2E (Playwright + axe WCAG 2.0) | En verde en el CI del último commit de main |

## Arquitectura actual (resumen)

Next.js 16.4 (App Router, Server Components, Server Actions, `proxy.ts`) en Netlify · Supabase (Postgres 60 tablas con RLS, Auth con MFA,
Storage privado, Realtime en mensajes, `pg_cron` para la retención) · Stripe Checkout con webhook firmado · Claude API solo en el servidor ·
College Scorecard · Cloudflare Turnstile opcional · CSP y cabeceras de seguridad (`next.config.ts`). Lógica de negocio pura y testeada en `src/lib/domain/`.
