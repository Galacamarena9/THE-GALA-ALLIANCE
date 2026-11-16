# Mapa de datos y RLS

Generado desde `supabase/migrations/` aplicando las 24 migraciones en orden (las políticas borradas y recreadas se muestran en su estado final). `anon` = visitante sin sesión.

**Tablas:** 60 · **con RLS activada explícitamente:** 60 · **políticas vigentes:** 161

## Resumen por tabla

| Tabla | Creada en | RLS | Políticas (comando → roles) | ¿Lectura anónima? |
|---|---|---|---|---|
| `academy_attempts` | 20261113000500_business_and_lovable_port.sql | sí | `academy_attempts_insert`: insert → authenticated<br>`academy_attempts_select`: select → authenticated | no |
| `academy_progress` | 20261113000500_business_and_lovable_port.sql | sí | `academy_progress_delete`: delete → authenticated<br>`academy_progress_insert`: insert → authenticated<br>`academy_progress_select`: select → authenticated | no |
| `agency_athlete_notes` | 20261114000100_agent_workspace.sql | sí | `agency_notes_delete`: delete → authenticated<br>`agency_notes_insert`: insert → authenticated<br>`agency_notes_select`: select → authenticated<br>`agency_notes_update`: update → authenticated | no |
| `agency_contacts` | 20261116000700_agency_core.sql | sí | `agency_contacts_delete`: delete → authenticated<br>`agency_contacts_insert`: insert → authenticated<br>`agency_contacts_select`: select → authenticated<br>`agency_contacts_update`: update → authenticated | no |
| `agent_representations` | 20261113000300_portals.sql | sí | `rep_insert`: insert → authenticated<br>`rep_select`: select → authenticated<br>`rep_update`: update → authenticated | no |
| `ai_usage` | 20261113000300_portals.sql | sí | `ai_usage_select`: select → authenticated | no |
| `application_notes` | 20261113000100_foundation.sql | sí | `notes_org_only`: all → authenticated | no |
| `application_status_history` | 20261113000100_foundation.sql | sí | `history_select`: select → authenticated | no |
| `applications` | 20261113000100_foundation.sql | sí | `apps_insert`: insert → authenticated<br>`apps_select`: select → authenticated<br>`apps_update`: update → authenticated | no |
| `athlete_academics` | 20261113000100_foundation.sql | sí | `academics_select`: select → authenticated<br>`academics_write`: all → authenticated | no |
| `athlete_achievements` | 20261113000100_foundation.sql | sí | `achievements_select`: select → anon, authenticated<br>`achievements_write`: all → authenticated | **sí, con condición** |
| `athlete_documents` | 20261113000700_documents_clubs_analytics.sql | sí | `docs_delete`: delete → authenticated<br>`docs_insert`: insert → authenticated<br>`docs_select`: select → authenticated<br>`docs_update`: update → authenticated | no |
| `athlete_finances` | 20261113000100_foundation.sql | sí | `finances_select`: select → authenticated<br>`finances_write`: all → authenticated | no |
| `athlete_languages` | 20261113000100_foundation.sql | sí | `languages_select`: select → anon, authenticated<br>`languages_write`: all → authenticated | **sí, con condición** |
| `athlete_links` | 20261113000400_trust_and_connectivity.sql | sí | `alinks_admin`: update → authenticated<br>`alinks_delete`: delete → authenticated<br>`alinks_insert`: insert → authenticated<br>`alinks_read`: select → anon, authenticated | **sí, con condición** |
| `athlete_offers` | 20261113000800_autonomous_operations.sql | sí | `offers_select`: select → authenticated<br>`offers_write`: all → authenticated | no |
| `athlete_profiles` | 20261113000100_foundation.sql | sí | `athlete_insert`: insert → authenticated<br>`athlete_select`: select → anon, authenticated<br>`athlete_update`: update → authenticated | **sí, con condición** |
| `athlete_statistics` | 20261113000100_foundation.sql | sí | `stats_admin`: all → authenticated<br>`stats_select`: select → anon, authenticated<br>`stats_write`: all → authenticated | **sí, con condición** |
| `athlete_updates` | 20261113000500_business_and_lovable_port.sql | sí | `athlete_updates_delete`: delete → authenticated<br>`athlete_updates_insert`: insert → authenticated<br>`athlete_updates_select`: select → anon, authenticated | **sí, con condición** |
| `audit_logs` | 20261113000100_foundation.sql | sí | `audit_admin_read`: select → authenticated | no |
| `brand_campaigns` | 20261113000300_portals.sql | sí | `campaigns_delete`: delete → authenticated<br>`campaigns_insert`: insert → authenticated<br>`campaigns_select`: select → authenticated<br>`campaigns_update`: update → authenticated | no |
| `campaign_applications` | 20261113000300_portals.sql | sí | `capps_insert`: insert → authenticated<br>`capps_select`: select → authenticated<br>`capps_update`: update → authenticated | no |
| `club_recommendations` | 20261116000400_club_recommendations.sql | sí | `recs_delete`: delete → authenticated<br>`recs_insert`: insert → authenticated<br>`recs_select`: select → authenticated<br>`recs_select_public`: select → anon<br>`recs_update`: update → authenticated | **sí, con condición** |
| `club_roster` | 20261113000700_documents_clubs_analytics.sql | sí | `roster_select`: select → authenticated<br>`roster_update`: update → authenticated | no |
| `club_roster_invites` | 20261113000700_documents_clubs_analytics.sql | sí | `roster_inv_insert`: insert → authenticated<br>`roster_inv_revoke`: update → authenticated<br>`roster_inv_select`: select → authenticated | no |
| `consents` | 20261113000100_foundation.sql | sí | `consents_insert`: insert → authenticated<br>`consents_select`: select → authenticated | no |
| `contact_messages` | 20261113000400_trust_and_connectivity.sql | sí | `cmsg_insert`: insert → authenticated<br>`cmsg_select`: select → authenticated | no |
| `contact_requests` | 20261113000400_trust_and_connectivity.sql | sí | `contact_insert`: insert → authenticated<br>`contact_select`: select → authenticated<br>`contact_update`: update → authenticated | no |
| `content_reports` | 20261113000400_trust_and_connectivity.sql | sí | `reports_admin`: update → authenticated<br>`reports_insert`: insert → authenticated<br>`reports_select`: select → authenticated | no |
| `cookie_consent_logs` | 20261113000100_foundation.sql | sí | `cookies_admin_read`: select → authenticated<br>`cookies_insert`: insert → anon, authenticated | no |
| `data_subject_requests` | 20261113000100_foundation.sql | sí | `dsr_admin_update`: update → authenticated<br>`dsr_insert`: insert → authenticated<br>`dsr_select`: select → authenticated | no |
| `entitlements` | 20261113000800_autonomous_operations.sql | sí | `entitlements_admin`: all → authenticated<br>`entitlements_select`: select → authenticated | no |
| `institutions` | 20261113000400_trust_and_connectivity.sql | sí | `institutions_admin_delete`: delete → authenticated<br>`institutions_admin_insert`: insert → authenticated<br>`institutions_read`: select → anon, authenticated<br>`institutions_update`: update → authenticated | **sí, con condición** |
| `news_posts` | 20261113000400_trust_and_connectivity.sql | sí | `news_insert`: insert → authenticated<br>`news_read`: select → anon, authenticated<br>`news_update`: update → authenticated | **sí, con condición** |
| `notifications` | 20261113000500_business_and_lovable_port.sql | sí | `notifications_delete`: delete → authenticated<br>`notifications_select`: select → authenticated<br>`notifications_update`: update → authenticated | no |
| `opportunities` | 20261113000100_foundation.sql | sí | `opps_delete`: delete → authenticated<br>`opps_insert`: insert → authenticated<br>`opps_select`: select → anon, authenticated<br>`opps_update`: update → authenticated | **sí, con condición** |
| `opportunity_questions` | 20261116000500_opportunity_questions.sql | sí | `oq_insert`: insert → authenticated<br>`oq_select`: select → authenticated<br>`oq_select_public`: select → anon<br>`oq_update`: update → authenticated | **sí, con condición** |
| `organization_invitations` | 20261113000300_portals.sql | sí | `org_inv_insert`: insert → authenticated<br>`org_inv_revoke`: update → authenticated<br>`org_inv_select`: select → authenticated | no |
| `organization_members` | 20261113000100_foundation.sql | sí | `members_admin`: all → authenticated<br>`members_select`: select → authenticated | no |
| `organizations` | 20261113000100_foundation.sql | sí | `orgs_insert`: insert → authenticated<br>`orgs_select`: select → anon, authenticated<br>`orgs_update`: update → authenticated | **sí, con condición** |
| `parent_athlete_links` | 20261113000100_foundation.sql | sí | `links_insert`: insert → authenticated<br>`links_select`: select → authenticated<br>`links_update`: update → authenticated | no |
| `private_profile_data` | 20261113000100_foundation.sql | sí | `private_insert`: insert → authenticated<br>`private_select`: select → authenticated<br>`private_update`: update → authenticated | no |
| `product_events` | 20261113000700_documents_clubs_analytics.sql | sí | `events_admin_read`: select → authenticated<br>`events_own_read`: select → authenticated | no |
| `profiles` | 20261113000100_foundation.sql | sí | `profiles_select`: select → anon, authenticated<br>`profiles_update_own`: update → authenticated | **sí, con condición** |
| `recruiting_case_activities` | 20261116000700_agency_core.sql | sí | `case_activities_delete`: delete → authenticated<br>`case_activities_insert`: insert → authenticated<br>`case_activities_select`: select → authenticated | no |
| `recruiting_case_tasks` | 20261116000700_agency_core.sql | sí | `case_tasks_delete`: delete → authenticated<br>`case_tasks_insert`: insert → authenticated<br>`case_tasks_select`: select → authenticated<br>`case_tasks_update`: update → authenticated | no |
| `recruiting_cases` | 20261116000700_agency_core.sql | sí | `recruiting_cases_insert`: insert → authenticated<br>`recruiting_cases_select`: select → authenticated<br>`recruiting_cases_update`: update → authenticated | no |
| `recruiting_link_views` | 20261114000300_recruiting_links.sql | sí | `rlink_views_select`: select → authenticated | no |
| `recruiting_links` | 20261114000300_recruiting_links.sql | sí | `rlinks_insert`: insert → authenticated<br>`rlinks_select`: select → authenticated<br>`rlinks_update`: update → authenticated | no |
| `saved_athletes` | 20261113000100_foundation.sql | sí | `saved_delete`: delete → authenticated<br>`saved_insert`: insert → authenticated<br>`saved_select`: select → authenticated<br>`saved_update`: update → authenticated | no |
| `saved_searches` | 20261113000500_business_and_lovable_port.sql | sí | `saved_searches_owner`: all → authenticated | no |
| `service_requests` | 20261113000500_business_and_lovable_port.sql | sí | `service_requests_admin`: update → authenticated<br>`service_requests_insert`: insert → authenticated<br>`service_requests_select`: select → authenticated | no |
| `showcase_entries` | 20261116000600_showcase_day.sql | sí | `sen_delete`: delete → authenticated<br>`sen_insert`: insert → authenticated<br>`sen_select`: select → authenticated | no |
| `showcase_events` | 20261116000600_showcase_day.sql | sí | `sev_admin`: all → authenticated<br>`sev_select`: select → anon, authenticated | **sí, con condición** |
| `sport_positions` | 20261113000100_foundation.sql | sí | `positions_admin`: all → authenticated<br>`positions_read`: select → anon, authenticated | **sí, con condición** |
| `sport_stat_definitions` | 20261113000100_foundation.sql | sí | `stats_def_admin`: all → authenticated<br>`stats_def_read`: select → anon, authenticated | **sí, con condición** |
| `sports` | 20261113000100_foundation.sql | sí | `sports_admin`: all → authenticated<br>`sports_read`: select → anon, authenticated | **sí, con condición** |
| `user_blocks` | 20261115000100_user_blocks.sql | sí | `user_blocks_delete`: delete → authenticated<br>`user_blocks_insert`: insert → authenticated<br>`user_blocks_select`: select → authenticated | no |
| `user_feedback` | 20261113000500_business_and_lovable_port.sql | sí | `feedback_insert`: insert → authenticated<br>`feedback_select`: select → authenticated | no |
| `user_roles` | 20261113000100_foundation.sql | sí | `roles_delete`: delete → authenticated<br>`roles_insert`: insert → authenticated<br>`roles_select`: select → authenticated | no |

## Condiciones de las políticas con acceso anónimo

- `athlete_achievements.achievements_select` (select, 20261113000100_foundation.sql): `using (public.can_view_athlete(athlete_id, 'profile'))`
- `athlete_languages.languages_select` (select, 20261113000100_foundation.sql): `using (public.can_view_athlete(athlete_id, 'profile'))`
- `athlete_links.alinks_read` (select, 20261113000400_trust_and_connectivity.sql): `using (public.can_view_athlete(athlete_id, 'profile'))`
- `athlete_profiles.athlete_select` (select, 20261113000100_foundation.sql): `using (public.can_view_athlete(user_id, 'profile'))`
- `athlete_statistics.stats_select` (select, 20261113000100_foundation.sql): `using (public.can_view_athlete(athlete_id, 'stats'))`
- `athlete_updates.athlete_updates_select` (select, 20261113000500_business_and_lovable_port.sql): `using (expires_at > now() and public.can_view_athlete(athlete_id, 'profile'))`
- `club_recommendations.recs_select_public` (select, 20261116000400_club_recommendations.sql): `using (status = 'published' and public.can_view_athlete(athlete_id, 'profile'))`
- `cookie_consent_logs.cookies_insert` (insert, 20261113000100_foundation.sql): `with check (user_id is null or user_id = auth.uid())`
- `institutions.institutions_read` (select, 20261113000400_trust_and_connectivity.sql): `using (true)`
- `news_posts.news_read` (select, 20261113000400_trust_and_connectivity.sql): `using (status = 'published' or author_id = auth.uid() or athlete_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id)) or public.is_admin())`
- `opportunities.opps_select` (select, 20261113000100_foundation.sql): `using (status = 'published' or public.is_org_member(organization_id) or public.is_admin())`
- `opportunity_questions.oq_select_public` (select, 20261116000500_opportunity_questions.sql): `using (answered_at is not null and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'published'))`
- `organizations.orgs_select` (select, 20261113000100_foundation.sql): `using (verification_status = 'verified' or created_by = auth.uid() or public.is_org_member(id) or public.is_admin())`
- `profiles.profiles_select` (select, 20261113000100_foundation.sql): `using ( id = auth.uid() or public.is_admin() or public.can_view_athlete(id) or (auth.uid() is not null and not public.is_minor(id) and not exists (select 1 from public.athlete_profiles a where a.user_id = profiles.id)) )`
- `showcase_events.sev_select` (select, 20261116000600_showcase_day.sql): `using (true)`
- `sport_positions.positions_read` (select, 20261113000100_foundation.sql): `using (true)`
- `sport_stat_definitions.stats_def_read` (select, 20261113000100_foundation.sql): `using (true)`
- `sports.sports_read` (select, 20261113000100_foundation.sql): `using (true)`
