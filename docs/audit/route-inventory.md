# Inventario de rutas

Generado automáticamente desde `src/app` (commit actual). Columnas: acceso, guardia de sesión, tablas y RPC de Supabase leídas/escritas desde el archivo, Server Actions usadas, estados detectados, indexación y eventos de embudo.

**Total:** 77 rutas (69 páginas, 8 rutas API).

| Ruta | Tipo | Acceso | Guardia | Tablas | RPC | Actions | Estados | Robots | Eventos | Archivo (líneas) |
|---|---|---|---|---|---|---|---|---|---|---|
| `/forgot-password` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/(auth)/forgot-password/page.tsx` (15) |
| `/login` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/(auth)/login/page.tsx` (16) |
| `/mfa` | Página | Pública | `auth.getUser` | — | — | — | redirect | noindex | — | `src/app/(auth)/mfa/page.tsx` (25) |
| `/reset-password` | Página | Pública | `auth.getUser` | — | — | — | error/aviso | noindex | — | `src/app/(auth)/reset-password/page.tsx` (26) |
| `/signup` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/(auth)/signup/page.tsx` (19) |
| `/api/agency/export` | API | API | `getSession` | `sports` | — | — | — | — | — | `src/app/api/agency/export/route.ts` (29) |
| `/api/documents/[id]` | API | API | `auth.getUser` | `athlete_documents` | — | — | error/aviso, redirect | — | — | `src/app/api/documents/[id]/route.ts` (17) |
| `/api/gala-ia` | API | API | `getSession` | — | `consume_ai_request` | — | error/aviso | — | — | `src/app/api/gala-ia/route.ts` (115) |
| `/api/lists/export` | API | API | `auth.getUser` | `athlete_directory`, `saved_athletes`, `sport_positions`, `sports` | — | — | — | — | — | `src/app/api/lists/export/route.ts` (45) |
| `/api/stripe/webhook` | API | API | `—` | `audit_logs`, `entitlements`, `notifications`, `parent_athlete_links` | — | — | error/aviso | — | — | `src/app/api/stripe/webhook/route.ts` (80) |
| `/app/academia` | Página | Privada (sesión) | `requireSession()` | `academy_attempts`, `academy_progress`, `applications`, `athlete_academics` | — | `growth` | error/aviso | — | — | `src/app/app/academia/page.tsx` (193) |
| `/app/admin` | Página | Privada (sesión) | `requireSession(['admin'])` | `athlete_links`, `brand_campaigns`, `content_reports`, `data_subject_requests`, `institutions`, `opportunities`, `organizations` | — | `admin` | redirect | — | — | `src/app/app/admin/page.tsx` (173) |
| `/app/admin/panel` | Página | Privada (sesión) | `requireSession(['admin'])` | `audit_logs`, `entitlements`, `profiles`, `service_requests`, `user_feedback` | `admin_agency_metrics`, `admin_event_counts`, `admin_liquidity`, `admin_metrics` | `autonomy`, `growth` | redirect | — | — | `src/app/app/admin/panel/page.tsx` (296) |
| `/app/agents` | Página | Privada (sesión) | `requireSession(['athlete'])` | `agent_representations`, `recruiting_case_activities`, `recruiting_cases` | — | `marketplace` | vacío, error/aviso | — | — | `src/app/app/agents/page.tsx` (98) |
| `/app/applications` | Página | Privada (sesión) | `requireSession(['athlete', 'university', 'coach'])` | `applications`, `athlete_directory`, `opportunities` | — | `opportunities` | vacío | — | — | `src/app/app/applications/page.tsx` (159) |
| `/app/athlete/calendar.ics` | API | Privada (sesión) | `auth.getUser` | `applications` | — | — | — | — | — | `src/app/app/athlete/calendar.ics/route.ts` (43) |
| `/app/athlete` | Página | Privada (sesión) | `requireSession(['athlete'])` | `applications`, `opportunities` | — | — | vacío | — | — | `src/app/app/athlete/page.tsx` (153) |
| `/app/athlete/passport` | Página | Privada (sesión) | `requireSession(['athlete'])` | `athlete_links`, `athlete_updates`, `club_recommendations` | — | `growth`, `marketplace`, `recommendations` | — | — | — | `src/app/app/athlete/passport/page.tsx` (105) |
| `/app/calculator` | Página | Privada (sesión) | `requireSession()` | — | — | — | — | — | — | `src/app/app/calculator/page.tsx` (17) |
| `/app/campaigns/[id]` | Página | Privada (sesión) | `requireSession(['athlete', 'brand'])` | `athlete_directory`, `brand_campaigns`, `campaign_applications`, `organization_members` | — | `marketplace` | vacío, error/aviso, 404 | — | — | `src/app/app/campaigns/[id]/page.tsx` (106) |
| `/app/campaigns/new` | Página | Privada (sesión) | `requireSession(['brand'])` | — | — | — | vacío | — | — | `src/app/app/campaigns/new/page.tsx` (21) |
| `/app/campaigns` | Página | Privada (sesión) | `requireSession(['athlete', 'brand'])` | `brand_campaigns` | — | — | vacío, error/aviso | — | — | `src/app/app/campaigns/page.tsx` (80) |
| `/app/club` | Página | Privada (sesión) | `requireSession(['coach', 'university'])` | `athlete_statistics`, `club_recommendations`, `club_roster_invites`, `organization_members` | `club_roster_summary` | `autonomy` | vacío, error/aviso | — | — | `src/app/app/club/page.tsx` (202) |
| `/app/contacts` | Página | Privada (sesión) | `requireSession(['agent'])` | `sports` | — | `agency-cases` | vacío | — | — | `src/app/app/contacts/page.tsx` (92) |
| `/app/discover` | Página | Privada (sesión) | `requireSession()` | `athlete_academics`, `athlete_directory`, `organization_members`, `saved_athletes` | — | `lists` | vacío, error/aviso | — | — | `src/app/app/discover/page.tsx` (171) |
| `/app/documents` | Página | Privada (sesión) | `requireSession(['athlete', 'parent'])` | `athlete_documents` | — | `autonomy` | vacío, error/aviso | — | — | `src/app/app/documents/page.tsx` (154) |
| `/app/family` | Página | Privada (sesión) | `requireSession(['parent'])` | `applications`, `parent_athlete_links` | — | `family` | vacío | — | — | `src/app/app/family/page.tsx` (142) |
| `/app/guia/[slug]` | Página | Privada (sesión) | `requireSession()` | — | — | — | 404 | — | — | `src/app/app/guia/[slug]/page.tsx` (23) |
| `/app/guia` | Página | Privada (sesión) | `requireSession()` | — | — | — | — | — | — | `src/app/app/guia/page.tsx` (17) |
| `/app/ia` | Página | Privada (sesión) | `requireSession()` | — | — | — | — | — | — | `src/app/app/ia/page.tsx` (22) |
| `/app/inbox/[id]` | Página | Privada (sesión) | `requireSession()` | `contact_messages`, `contact_requests`, `profiles` | `has_block_with` | — | 404 | — | — | `src/app/app/inbox/[id]/page.tsx` (74) |
| `/app/inbox` | Página | Privada (sesión) | `requireSession()` | `contact_requests`, `parent_athlete_links`, `profiles` | — | `connect` | vacío | — | — | `src/app/app/inbox/page.tsx` (92) |
| `/app/lists` | Página | Privada (sesión) | `requireSession(['university', 'coach', 'agent', 'brand'])` | `athlete_directory`, `saved_athletes`, `saved_searches` | — | `growth`, `lists` | vacío | — | — | `src/app/app/lists/page.tsx` (230) |
| `/app/news` | Página | Privada (sesión) | `requireSession()` | `news_posts` | — | `organization` | vacío | — | — | `src/app/app/news/page.tsx` (80) |
| `/app/notifications` | Página | Privada (sesión) | `requireSession()` | `notifications` | — | `growth` | vacío | — | — | `src/app/app/notifications/page.tsx` (53) |
| `/app/offers` | Página | Privada (sesión) | `requireSession(['athlete', 'parent'])` | — | — | `autonomy` | vacío, error/aviso | — | — | `src/app/app/offers/page.tsx` (148) |
| `/app/opportunities/[id]` | Página | Privada (sesión) | `requireSession()` | `applications`, `athlete_academics`, `athlete_directory`, `opportunities`, `opportunity_questions`, `organization_members` | — | `opportunities` | vacío, error/aviso, 404 | — | `opportunity_viewed` | `src/app/app/opportunities/[id]/page.tsx` (222) |
| `/app/opportunities/new` | Página | Privada (sesión) | `requireSession(['university', 'coach'])` | `organization_members` | — | — | vacío | — | — | `src/app/app/opportunities/new/page.tsx` (32) |
| `/app/opportunities` | Página | Privada (sesión) | `requireSession()` | `opportunities`, `organization_members` | — | — | vacío | — | — | `src/app/app/opportunities/page.tsx` (122) |
| `/app/organization` | Página | Privada (sesión) | `requireSession(['university', 'coach', 'agent', 'brand'])` | `institutions`, `organization_members` | — | `organization` | vacío, error/aviso | — | — | `src/app/app/organization/page.tsx` (111) |
| `/app` | Página | Privada (sesión) | `requireSession()` | `applications`, `athlete_documents`, `campaign_applications`, `contact_requests`, `notifications`, `organization_members`, `parent_athlete_links`, `recruiting_link_views` | — | — | — | — | — | `src/app/app/page.tsx` (245) |
| `/app/pipeline/[id]` | Página | Privada (sesión) | `requireSession(['agent'])` | `recruiting_case_activities`, `recruiting_case_tasks` | — | `agency-cases` | error/aviso, 404 | — | — | `src/app/app/pipeline/[id]/page.tsx` (153) |
| `/app/pipeline` | Página | Privada (sesión) | `requireSession(['agent'])` | `sports` | — | — | vacío | — | — | `src/app/app/pipeline/page.tsx` (145) |
| `/app/pipeline/team` | Página | Privada (sesión) | `requireSession(['agent'])` | — | — | `agency-cases` | vacío | — | — | `src/app/app/pipeline/team/page.tsx` (67) |
| `/app/plan` | Página | Privada (sesión) | `requireSession(['athlete', 'parent'])` | `athlete_documents` | — | `autonomy` | vacío, error/aviso | — | — | `src/app/app/plan/page.tsx` (180) |
| `/app/portal/[slug]` | Página | Privada (sesión) | `requireSession()` | — | — | — | error/aviso, 404, redirect | — | — | `src/app/app/portal/[slug]/page.tsx` (44) |
| `/app/portfolio/[athleteId]` | Página | Privada (sesión) | `requireSession(['agent'])` | — | — | — | vacío, 404 | — | — | `src/app/app/portfolio/[athleteId]/page.tsx` (31) |
| `/app/portfolio` | Página | Privada (sesión) | `requireSession(['agent'])` | — | — | — | — | — | — | `src/app/app/portfolio/page.tsx` (15) |
| `/app/settings/export` | API | Privada (sesión) | `auth.getUser` | `applications`, `athlete_documents`, `parent_athlete_links` | — | — | error/aviso | — | — | `src/app/app/settings/export/route.ts` (84) |
| `/app/settings` | Página | Privada (sesión) | `requireSession()` | `consents`, `data_subject_requests`, `parent_athlete_links`, `profiles`, `user_blocks` | — | `blocks`, `family` | — | — | — | `src/app/app/settings/page.tsx` (158) |
| `/app/share` | Página | Privada (sesión) | `requireSession(['athlete', 'parent'])` | `athlete_profiles`, `parent_athlete_links`, `profiles`, `recruiting_links`, `sport_positions`, `sports` | `is_minor` | — | — | — | — | `src/app/app/share/page.tsx` (73) |
| `/app/showcase` | Página | Privada (sesión) | `requireSession()` | `showcase_entries`, `showcase_events` | — | `showcase` | vacío | — | — | `src/app/app/showcase/page.tsx` (117) |
| `/app/universities/[id]` | Página | Privada (sesión) | `requireSession()` | `institutions`, `opportunities`, `organizations` | — | — | vacío, 404 | — | — | `src/app/app/universities/[id]/page.tsx` (141) |
| `/app/universities/compare` | Página | Privada (sesión) | `requireSession()` | `institutions` | — | — | vacío | — | `universities_compared` | `src/app/app/universities/compare/page.tsx` (122) |
| `/app/universities` | Página | Privada (sesión) | `requireSession()` | `institutions` | — | — | vacío | — | — | `src/app/app/universities/page.tsx` (91) |
| `/athletes/[id]/cv` | Página | Pública con RLS | `—` | `athlete_links` | — | — | 404 | noindex | — | `src/app/athletes/[id]/cv/page.tsx` (80) |
| `/athletes/[id]` | Página | Pública con RLS | `getSession` | `athlete_links`, `athlete_profiles`, `athlete_updates`, `club_recommendations`, `profiles` | `is_minor` | `lists` | vacío, 404 | noindex | — | `src/app/athletes/[id]/page.tsx` (232) |
| `/auth/callback` | API | Pública | `—` | — | — | — | error/aviso, redirect | — | — | `src/app/auth/callback/route.ts` (18) |
| `/calculadora` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/calculadora/page.tsx` (23) |
| `/guia/[slug]` | Página | Pública | `—` | — | — | — | 404 | — | — | `src/app/guia/[slug]/page.tsx` (37) |
| `/guia` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/guia/page.tsx` (24) |
| `/inversores` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/inversores/page.tsx` (193) |
| `/invite/[token]` | Página | Enlace con token | `getSession` | — | `preview_family_invitation` | `family` | error/aviso | noindex | — | `src/app/invite/[token]/page.tsx` (68) |
| `/join/[token]` | Página | Enlace con token | `getSession` | — | `accept_organization_invitation`, `preview_organization_invitation` | — | error/aviso, redirect | noindex | — | `src/app/join/[token]/page.tsx` (77) |
| `/legal/[doc]` | Página | Pública | `—` | — | — | — | 404 | — | — | `src/app/legal/[doc]/page.tsx` (39) |
| `/onboarding` | Página | Privada (sesión) | `getSession` | `sport_positions`, `sports` | — | — | redirect | — | — | `src/app/onboarding/page.tsx` (46) |
| `/oportunidades/[id]` | Página | Pública | `—` | — | — | — | vacío, 404 | noindex | — | `src/app/oportunidades/[id]/page.tsx` (64) |
| `/oportunidades` | Página | Pública | `—` | `opportunities` | — | — | vacío, error/aviso | — | — | `src/app/oportunidades/page.tsx` (137) |
| `/` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/page.tsx` (331) |
| `/para/[slug]` | Página | Pública | `—` | — | — | — | 404 | — | — | `src/app/para/[slug]/page.tsx` (56) |
| `/precios` | Página | Pública | `getSession` | `organization_members` | — | `autonomy` | — | — | — | `src/app/precios/page.tsx` (104) |
| `/preview/[screen]` | Página | Interna (ENABLE_PREVIEW) | `—` | — | — | — | 404 | noindex | — | `src/app/preview/[screen]/page.tsx` (84) |
| `/print/cv` | Página | Pública con RLS | `requireSession(['athlete', 'parent'])` | `sport_positions`, `sport_stat_definitions`, `sports` | — | — | redirect | — | — | `src/app/print/cv/page.tsx` (112) |
| `/print/memo` | Página | Pública con RLS | `requireSession(['athlete', 'parent'])` | — | — | — | redirect | — | — | `src/app/print/memo/page.tsx` (79) |
| `/r/[token]` | Página | Enlace con token | `—` | — | `get_recruiting_card` | — | — | noindex | — | `src/app/r/[token]/page.tsx` (36) |
| `/roster/[token]` | Página | Enlace con token | `getSession` | — | `preview_roster_invitation` | `autonomy` | error/aviso | noindex | — | `src/app/roster/[token]/page.tsx` (72) |
| `/seguridad` | Página | Pública | `—` | — | — | — | — | — | — | `src/app/seguridad/page.tsx` (95) |
