-- =============================================================================================================
-- Prompt 17 · Analítica. Sin nuevo silo: product_events (eventos) + tablas de negocio (verdad) + Stripe (dinero).
-- Cuatro capas separadas:
--   - auditoría (audit_logs): seguridad, inmutable;
--   - eventos de producto (product_events): comportamiento, 13 meses;
--   - métricas derivadas (funciones): se calculan, no se guardan a mano;
--   - finanzas (billing_ledger): la verdad del dinero.
-- Privacidad: los menores no llevan propiedades en sus eventos; los grupos con menos de 5 personas no se muestran;
-- no hay ranking de talento ni métricas por persona.
-- =============================================================================================================

-- 1. Taxonomía ampliada con los flujos de 12-16 (sintaxis objeto_acción, en pasado).
alter table public.product_events drop constraint if exists product_events_event_check;
alter table public.product_events add constraint product_events_event_check check (event in (
  'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
  'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
  'document_uploaded', 'roster_joined', 'universities_compared',
  'passport_completed', 'passport_shared', 'video_uploaded', 'university_viewed', 'university_saved',
  'match_viewed', 'opportunity_saved', 'comparison_created', 'task_completed', 'dashboard_viewed',
  'pipeline_stage_changed', 'interaction_logged', 'offer_recorded', 'pipeline_decision',
  'recruiting_need_created', 'athlete_discovered', 'athlete_shortlisted', 'candidate_assigned', 'candidate_stage_changed',
  'document_requested', 'document_shared', 'offer_created', 'coach_dashboard_viewed', 'candidates_exported',
  'trial_applied', 'trial_viewed', 'agent_trials_viewed',
  'athlete_search_performed', 'athlete_search_saved', 'athlete_promoted_to_pipeline', 'verification_requested',
  'athlete_quick_view', 'highlight_played', 'note_added',
  'trial_saved', 'trial_invitation_viewed', 'trial_invitation_sent', 'trial_registered', 'trial_checked_in',
  'academy_program_viewed', 'academy_program_applied', 'recruiting_process_started',
  'trial_mobile_viewed', 'trial_invitation_opened', 'trial_consent_reviewed', 'trial_consent_approved', 'mobile_discovery_search', 'scout_note_added',
  -- 12-16
  'representation_requested', 'representation_accepted', 'representation_revoked', 'agency_invited',
  'brand_offer_sent', 'brand_offer_accepted', 'deliverable_submitted', 'collaborations_viewed',
  'trust_center_viewed', 'support_case_opened', 'subscription_started', 'billing_viewed'));

-- 2. Registro de eventos: los menores nunca llevan propiedades (solo el hecho); idempotencia opcional por clave.
alter table public.product_events add column if not exists dedupe_key text check (char_length(dedupe_key) <= 80);
create unique index if not exists product_events_dedupe on public.product_events (user_id, dedupe_key) where dedupe_key is not null;

drop function if exists public.log_event(text, jsonb);
create or replace function public.log_event(p_event text, p_props jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.product_events where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.product_events (user_id, event, props, dedupe_key)
  values (auth.uid(), p_event, case when public.is_minor(auth.uid()) then '{}'::jsonb else coalesce(p_props, '{}') end, p_dedupe)
  on conflict do nothing;
end;
$$;
revoke execute on function public.log_event(text, jsonb, text) from public, anon;
grant execute on function public.log_event(text, jsonb, text) to authenticated;

-- 3. Definiciones de métricas: una sola definición escrita y versionada para cada número que se enseña.
create table if not exists public.metric_definitions (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,60}$'),
  name text not null,
  definition text not null,
  source text not null check (source in ('business_tables', 'product_events', 'stripe', 'mixed')),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.metric_definitions enable row level security;
create policy metric_definitions_read on public.metric_definitions for select to authenticated using (public.is_admin());
grant select on public.metric_definitions to authenticated;
insert into public.metric_definitions (key, name, definition, source) values
  ('north_star', 'Conexiones cualificadas', 'Contactos aceptados + candidaturas que avanzan a contacto, entrevista, prueba, shortlist u oferta en el periodo. Mide encuentros reales, no clics.', 'business_tables'),
  ('active_athletes', 'Atletas activos', 'Atletas distintos con al menos un evento de producto en el periodo (7 días = semanales, 30 = mensuales).', 'product_events'),
  ('athlete_activation', 'Activación de atletas', 'Atletas registrados en el periodo que en 14 días tienen Passport con deporte y promoción y al menos una candidatura o contacto.', 'business_tables'),
  ('org_activation', 'Activación de organizaciones', 'Organizaciones verificadas en el periodo con al menos una oportunidad publicada o un contacto enviado en 30 días.', 'business_tables'),
  ('liquidity', 'Liquidez', 'Oportunidades publicadas en el periodo que reciben al menos una candidatura en 14 días, sobre el total publicado.', 'business_tables'),
  ('time_to_value', 'Tiempo hasta valor', 'Mediana de días entre el alta de un atleta y su primer contacto aceptado o candidatura que avanza.', 'business_tables'),
  ('supply_demand', 'Oferta y demanda por deporte', 'Atletas activos frente a oportunidades publicadas por deporte. Grupos con menos de 5 se ocultan.', 'mixed'),
  ('retention', 'Retención por cohortes', 'Porcentaje de cada cohorte semanal de alta que vuelve a tener actividad en las semanas 1, 2 y 4.', 'product_events'),
  ('brand_declared_value', 'Valor comercial declarado', 'Dinero garantizado en ofertas de marca aceptadas. Es lo acordado, no lo cobrado: el dinero real sale de Stripe.', 'business_tables'),
  ('revenue', 'Ingresos', 'Cobros menos reembolsos y disputas del libro contable (Stripe).', 'stripe')
on conflict (key) do nothing;

-- 4. Métricas del marketplace (solo admin). Todo agregado; nada por persona; grupos pequeños ocultos.
create or replace function public.admin_marketplace_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => v_days);
  k constant integer := 5;   -- tamaño mínimo de grupo
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'period_days', v_days,
    'active', jsonb_build_object(
      'daily', (select count(distinct user_id) from public.product_events where created_at > now() - interval '1 day'),
      'weekly', (select count(distinct user_id) from public.product_events where created_at > now() - interval '7 days'),
      'monthly', (select count(distinct user_id) from public.product_events where created_at > now() - interval '30 days'),
      'athletes_weekly', (select count(distinct e.user_id) from public.product_events e join public.user_roles r on r.user_id = e.user_id and r.role = 'athlete'
                            where e.created_at > now() - interval '7 days'),
      'organizations_weekly', (select count(distinct m.organization_id) from public.product_events e join public.organization_members m on m.user_id = e.user_id
                                 where e.created_at > now() - interval '7 days')),
    'athlete_activation', (
      select jsonb_build_object('signups', count(*), 'activated', count(*) filter (where activated),
                                'rate', round(100.0 * count(*) filter (where activated) / nullif(count(*), 0), 1))
        from (select p.id, (exists (select 1 from public.athlete_profiles ap where ap.user_id = p.id and ap.sport_id is not null and ap.graduation_year is not null)
                            and (exists (select 1 from public.applications a where a.athlete_id = p.id and a.created_at <= p.created_at + interval '14 days')
                                 or exists (select 1 from public.contact_requests c where c.athlete_id = p.id and c.created_at <= p.created_at + interval '14 days'))) as activated
                from public.profiles p join public.user_roles r on r.user_id = p.id and r.role = 'athlete'
               where p.created_at >= v_since and p.created_at <= now() - interval '14 days') s),
    'liquidity', (
      select jsonb_build_object('published', count(*), 'with_application_14d', count(*) filter (where hit),
                                'rate', round(100.0 * count(*) filter (where hit) / nullif(count(*), 0), 1))
        from (select o.id, exists (select 1 from public.applications a where a.opportunity_id = o.id and a.created_at <= o.published_at + interval '14 days') as hit
                from public.opportunities o where o.published_at >= v_since and o.published_at <= now() - interval '14 days') s),
    'time_to_value_days', (
      select percentile_cont(0.5) within group (order by d)
        from (select extract(epoch from (min(c.responded_at) - p.created_at)) / 86400 as d
                from public.profiles p join public.contact_requests c on c.athlete_id = p.id and c.status = 'accepted' and c.responded_at is not null
               where p.created_at >= v_since group by p.id, p.created_at) s),
    'supply_demand', coalesce((
      select jsonb_agg(jsonb_build_object('sport', sport, 'athletes', athletes, 'opportunities', opps) order by athletes desc)
        from (select s.id as sport,
                     (select count(*) from public.athlete_profiles ap where ap.sport_id = s.id) as athletes,
                     (select count(*) from public.opportunities o where o.sport_id = s.id and o.status = 'published') as opps
                from public.sports s) x
       where athletes >= k), '[]'::jsonb),
    'retention', coalesce((
      select jsonb_agg(jsonb_build_object('cohort', cohort, 'size', size, 'w1', w1, 'w2', w2, 'w4', w4) order by cohort)
        from (select date_trunc('week', p.created_at)::date as cohort, count(*) as size,
                     round(100.0 * count(*) filter (where exists (select 1 from public.product_events e where e.user_id = p.id
                            and e.created_at >= p.created_at + interval '7 days' and e.created_at < p.created_at + interval '14 days')) / count(*), 0) as w1,
                     round(100.0 * count(*) filter (where exists (select 1 from public.product_events e where e.user_id = p.id
                            and e.created_at >= p.created_at + interval '14 days' and e.created_at < p.created_at + interval '21 days')) / count(*), 0) as w2,
                     round(100.0 * count(*) filter (where exists (select 1 from public.product_events e where e.user_id = p.id
                            and e.created_at >= p.created_at + interval '28 days' and e.created_at < p.created_at + interval '35 days')) / count(*), 0) as w4
                from public.profiles p where p.created_at >= now() - interval '12 weeks' group by 1) c
       where size >= k), '[]'::jsonb),
    'agents', jsonb_build_object(
      'active_representations', (select count(*) from public.agent_representations where status = 'active'),
      'pending_guardian', (select count(*) from public.agent_representations where status = 'pending_guardian'),
      'open_conflicts', (select count(*) from public.representation_conflicts where status = 'open')),
    'brands', jsonb_build_object(
      'offers_sent', (select count(*) from public.campaign_offers where created_at >= v_since and status <> 'superseded'),
      'offers_accepted', (select count(*) from public.campaign_offers where responded_at >= v_since and status = 'accepted'),
      'declared_cash', coalesce((select jsonb_object_agg(currency, total) from (
          select c.currency, sum(c.amount) as total from public.campaign_offer_components c join public.campaign_offers o on o.id = c.offer_id
           where o.status = 'accepted' and o.responded_at >= v_since and c.kind = 'cash' and c.guaranteed group by c.currency) s), '{}'::jsonb),
      'payments_disputed', (select count(*) from public.campaign_offers where payment_status = 'disputed')),
    'revenue', coalesce((select jsonb_object_agg(currency, total) from (
        select currency, sum(amount_cents) as total from public.billing_ledger where occurred_at >= v_since group by currency) s), '{}'::jsonb),
    'trust', jsonb_build_object(
      'reports', (select count(*) from public.content_reports where created_at >= v_since),
      'child_safety_reports', (select count(*) from public.content_reports where created_at >= v_since and reason = 'child_safety'),
      'actions', (select count(*) from public.moderation_actions where created_at >= v_since),
      'appeals_overturned', (select count(*) from public.moderation_appeals where decided_at >= v_since and status = 'overturned')),
    'top_events', coalesce((select jsonb_agg(jsonb_build_object('event', event, 'count', n) order by n desc) from (
        select event, count(*) n from public.product_events where created_at >= v_since group by event order by n desc limit 15) s), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.admin_marketplace_metrics(integer) from public, anon;
grant execute on function public.admin_marketplace_metrics(integer) to authenticated;

/* ROLLBACK: restaurar log_event(text, jsonb) y el check de eventos anterior; drop metric_definitions,
   admin_marketplace_metrics, la columna dedupe_key y su índice. */
