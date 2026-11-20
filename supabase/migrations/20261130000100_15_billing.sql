-- =============================================================================================================
-- Prompt 15 · Facturación y Stripe.
-- Principios:
--   - la visibilidad del atleta nunca se paga;
--   - el webhook firmado de Stripe es la única verdad de pago;
--   - un derecho de plan (entitlement) NO es una autorización: la RLS sigue decidiendo quién ve qué;
--   - los nombres de plan no se escriben en el código de permisos, todo sale del catálogo.
-- REUSE: entitlements (pagos únicos familiares), ai_usage/discovery_usage, el webhook existente.
-- NEW: catálogo de planes con sus funciones, cuentas de facturación, suscripciones con asientos, eventos de
-- Stripe idempotentes y tolerantes al desorden, libro contable inmutable y consumo atómico de cuotas.
-- =============================================================================================================

-- 1. Catálogo versionado de planes y lo que incluye cada uno (fuente única para las cuotas).
create table if not exists public.plan_catalog (
  code text not null,
  version integer not null default 1 check (version >= 1),
  audience text not null check (audience in ('athlete', 'family', 'organization', 'academy', 'agent', 'brand')),
  name text not null,
  billing_interval text not null check (billing_interval in ('free', 'one_time', 'month', 'year')),
  price_cents integer check (price_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  seats_included integer not null default 1 check (seats_included between 1 and 10000),
  features jsonb not null default '{}'::jsonb,   -- {"feature": límite entero; -1 = ilimitado; 0 = no incluido}
  stripe_price_id text unique,
  free_until date,                                -- periodo de lanzamiento: incluido gratis hasta esta fecha
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (code, version)
);
alter table public.plan_catalog enable row level security;
create policy plan_catalog_read on public.plan_catalog for select to anon, authenticated using (active);
grant select on public.plan_catalog to anon, authenticated;

insert into public.plan_catalog (code, audience, name, billing_interval, price_cents, seats_included, features, free_until) values
  ('athlete_free', 'athlete', 'Passport', 'free', 0, 1, '{"applications": -1, "ai_questions_day": 30, "compare_universities": 5}', null),
  ('family_core', 'family', 'Core', 'one_time', 24700, 1, '{"applications": -1, "ai_questions_day": 60, "compare_universities": 10, "passport_report": 1, "cv": 1, "shortlist": 1, "calendar": 1}', null),
  ('family_elite', 'family', 'Elite', 'one_time', 49700, 1, '{"applications": -1, "ai_questions_day": 100, "compare_universities": 20, "passport_report": 1, "cv": 1, "shortlist": 1, "calendar": 1, "offer_compare": 5, "decision_memo": 1, "visa_checklist": 1}', null),
  ('family_signature', 'family', 'Signature', 'one_time', null, 1, '{"applications": -1, "ai_questions_day": 200, "compare_universities": -1, "passport_report": 1, "cv": 1, "shortlist": 1, "calendar": 1, "offer_compare": -1, "decision_memo": 1, "visa_checklist": 1}', null),
  ('org_recruit', 'organization', 'Recruit', 'month', 0, 10, '{"discovery_searches_day": 100, "saved_athletes": -1, "seats": 10}', null),
  ('academy_portal', 'academy', 'Academia', 'month', 0, 5, '{"published_programs": -1, "seats": 5}', null),
  ('agent_solo', 'agent', 'Agente', 'month', 3900, 1, '{"represented_athletes": 25, "seats": 1, "discovery_searches_day": 50}', '2027-03-31'),
  ('agent_team', 'agent', 'Agencia', 'month', 9900, 5, '{"represented_athletes": 100, "seats": 5, "discovery_searches_day": 200}', '2027-03-31'),
  ('agent_scale', 'agent', 'Agencia grande', 'month', 24900, 15, '{"represented_athletes": -1, "seats": 15, "discovery_searches_day": -1}', null),
  ('brand_campaigns', 'brand', 'Campañas', 'month', null, 3, '{"active_campaigns": 3, "seats": 3}', null)
on conflict (code, version) do nothing;

-- 2. Cuenta de facturación: de una persona o de una organización (nunca ambas).
create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  stripe_customer_id text unique,
  billing_email text check (billing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  country text check (country ~ '^[A-Z]{2}$'),
  tax_id text check (char_length(tax_id) <= 40),
  created_at timestamptz not null default now(),
  constraint billing_owner check ((user_id is null) <> (organization_id is null))
);
create unique index if not exists billing_accounts_user on public.billing_accounts (user_id) where user_id is not null;
create unique index if not exists billing_accounts_org on public.billing_accounts (organization_id) where organization_id is not null;

-- 3. Suscripciones (las escribe solo el webhook) y asientos.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.billing_accounts (id) on delete cascade,
  plan_code text not null,
  plan_version integer not null default 1,
  status text not null check (status in ('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  stripe_subscription_id text unique,
  seats integer not null default 1 check (seats between 1 and 10000),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  last_event_at timestamptz,          -- para ignorar eventos que llegan desordenados
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_code, plan_version) references public.plan_catalog (code, version)
);
create index if not exists subscriptions_account on public.subscriptions (billing_account_id);
create index if not exists subscriptions_plan on public.subscriptions (plan_code, plan_version);

create table if not exists public.seat_assignments (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (subscription_id, user_id)
);
create index if not exists seat_assignments_user on public.seat_assignments (user_id);
create index if not exists seat_assignments_assigned_by on public.seat_assignments (assigned_by);

-- 4. Eventos de Stripe: idempotencia por id de evento.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  stripe_created timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (char_length(outcome) <= 200)
);

-- 5. Libro contable: solo se añade; nunca se edita ni se borra.
create table if not exists public.billing_ledger (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid references public.billing_accounts (id) on delete set null,
  kind text not null check (kind in ('charge', 'refund', 'dispute', 'dispute_closed', 'credit')),
  amount_cents bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  stripe_object_id text not null,
  description text check (char_length(description) <= 300),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (kind, stripe_object_id)
);
create index if not exists billing_ledger_account on public.billing_ledger (billing_account_id);
create or replace function public.ledger_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Única excepción: al borrar una cuenta (RGPD), la FK desvincula el apunte (billing_account_id → NULL);
  -- el importe, la fecha y la referencia se conservan por obligación fiscal.
  if tg_op = 'UPDATE' and new.billing_account_id is null and old.billing_account_id is not null
     and (to_jsonb(new) - 'billing_account_id') = (to_jsonb(old) - 'billing_account_id') then
    return new;
  end if;
  raise exception 'ledger_append_only' using errcode = '42501';
end;
$$;
drop trigger if exists ledger_append_only on public.billing_ledger;
create trigger ledger_append_only before update or delete on public.billing_ledger for each row execute function public.ledger_append_only();
revoke execute on function public.ledger_append_only() from public, anon, authenticated;

-- 6. Consumo de cuotas por periodo (atómico).
create table if not exists public.usage_counters (
  subject_id uuid not null,              -- persona u organización
  feature text not null check (char_length(feature) <= 60),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  primary key (subject_id, feature, period_start)
);

-- 7. RLS: la persona ve lo suyo; de una organización, quien la dirige. Nadie escribe desde la API.
alter table public.billing_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.stripe_events enable row level security;
alter table public.billing_ledger enable row level security;
alter table public.usage_counters enable row level security;

create or replace function public.can_see_billing_account(p_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.billing_accounts b where b.id = p_account
                  and (b.user_id = auth.uid() or (b.organization_id is not null and public.is_org_member(b.organization_id, true))
                       or public.has_admin_role('finance')));
$$;
create policy billing_accounts_select on public.billing_accounts for select to authenticated using (public.can_see_billing_account(id));
create policy subscriptions_select on public.subscriptions for select to authenticated using (public.can_see_billing_account(billing_account_id));
create policy seats_select on public.seat_assignments for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.subscriptions s where s.id = subscription_id and public.can_see_billing_account(s.billing_account_id)));
create policy ledger_select on public.billing_ledger for select to authenticated using (public.can_see_billing_account(billing_account_id));
create policy usage_select on public.usage_counters for select to authenticated using (subject_id = (select auth.uid()) or public.is_org_member(subject_id));
grant select on public.billing_accounts, public.subscriptions, public.seat_assignments, public.billing_ledger, public.usage_counters to authenticated;

-- 8. Motor de derechos: plan efectivo de una persona u organización y el límite de una función.
--    Suscripción activa/en prueba (o en past_due dentro de 7 días de gracia) > pago único > plan gratuito > lanzamiento.
create or replace function public.effective_features(p_user uuid, p_org uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with subs as (
    select c.features, c.seats_included from public.subscriptions s
      join public.billing_accounts b on b.id = s.billing_account_id
      join public.plan_catalog c on c.code = s.plan_code and c.version = s.plan_version
     where (s.status in ('active', 'trialing') or (s.status = 'past_due' and s.current_period_end > now() - interval '7 days'))
       and ((p_org is not null and b.organization_id = p_org
             and (exists (select 1 from public.seat_assignments sa where sa.subscription_id = s.id and sa.user_id = p_user)
                  or not exists (select 1 from public.seat_assignments sa where sa.subscription_id = s.id)))
            or (p_org is null and b.user_id = p_user))
  ), once as (
    select c.features from public.entitlements e join public.plan_catalog c on c.code = e.plan_code and c.version = 1
     where e.user_id = p_user and e.revoked_at is null
  ), launch as (
    -- Periodo de lanzamiento anunciado: un agente tiene el plan de agencia gratis hasta la fecha publicada.
    select c.features from public.plan_catalog c
     where c.active and c.free_until >= current_date and p_org is not null
       and exists (select 1 from public.organizations o where o.id = p_org and o.type = 'agency')
       and c.code = 'agent_team'
  ), base as (
    select c.features from public.plan_catalog c where c.code = 'athlete_free' and c.version = 1
  ), all_features as (
    select f from subs, jsonb_each(subs.features) f union all
    select f from once, jsonb_each(once.features) f union all
    select f from launch, jsonb_each(launch.features) f union all
    select f from base, jsonb_each(base.features) f
  )
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select (f).key as k,
           case when bool_or(((f).value)::text = '-1') then to_jsonb(-1) else to_jsonb(max((((f).value)::text)::integer)) end as v
      from all_features group by (f).key
  ) x;
$$;

create or replace function public.feature_limit(p_feature text, p_org uuid default null)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((public.effective_features(auth.uid(), p_org) ->> p_feature)::integer, 0);
$$;

-- Consumir cuota de forma atómica (sin carreras): devuelve lo usado o lanza quota_exceeded.
create or replace function public.consume_usage(p_feature text, p_amount integer default 1, p_org uuid default null, p_period text default 'day')
returns integer language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_subject uuid; v_start date; v_used integer;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if p_org is not null and not public.is_org_member(p_org) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(p_amount, 0) not between 1 and 1000 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  v_limit := public.feature_limit(p_feature, p_org);
  if v_limit = 0 then raise exception 'feature_not_included' using errcode = 'P0001'; end if;
  v_subject := coalesce(p_org, auth.uid());
  v_start := case p_period when 'month' then date_trunc('month', current_date)::date else current_date end;
  insert into public.usage_counters (subject_id, feature, period_start, used) values (v_subject, p_feature, v_start, 0)
  on conflict (subject_id, feature, period_start) do nothing;
  update public.usage_counters set used = used + p_amount
   where subject_id = v_subject and feature = p_feature and period_start = v_start and (v_limit = -1 or used + p_amount <= v_limit)
  returning used into v_used;
  if v_used is null then raise exception 'quota_exceeded' using errcode = 'P0001', hint = p_feature; end if;
  return v_used;
end;
$$;

-- 9. Asientos: solo quien dirige la organización; nunca por encima de lo contratado.
create or replace function public.seat_assign(p_subscription uuid, p_user uuid, p_assign boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select sub.*, b.organization_id into s from public.subscriptions sub join public.billing_accounts b on b.id = sub.billing_account_id where sub.id = p_subscription for update of sub;
  if s.id is null or s.organization_id is null or not public.is_org_member(s.organization_id, true) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not p_assign then
    delete from public.seat_assignments where subscription_id = p_subscription and user_id = p_user;
  else
    if not exists (select 1 from public.organization_members where organization_id = s.organization_id and user_id = p_user) then
      raise exception 'not_org_member' using errcode = 'P0001';
    end if;
    if (select count(*) from public.seat_assignments where subscription_id = p_subscription) >= s.seats
       and not exists (select 1 from public.seat_assignments where subscription_id = p_subscription and user_id = p_user) then
      raise exception 'no_seats_left' using errcode = 'P0001';
    end if;
    insert into public.seat_assignments (subscription_id, user_id, assigned_by) values (p_subscription, p_user, auth.uid()) on conflict do nothing;
  end if;
  perform public.audit(case when p_assign then 'seat_assigned' else 'seat_removed' end, 'subscription', p_subscription, s.organization_id,
                       jsonb_build_object('user', p_user), null, 'normal', null);
end;
$$;

-- Al salir alguien de la organización, su asiento se libera solo.
create or replace function public.release_seat_on_member_exit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.seat_assignments sa using public.subscriptions s, public.billing_accounts b
   where sa.subscription_id = s.id and s.billing_account_id = b.id and b.organization_id = old.organization_id and sa.user_id = old.user_id;
  return old;
end;
$$;
drop trigger if exists release_seat_on_member_exit on public.organization_members;
create trigger release_seat_on_member_exit after delete on public.organization_members for each row execute function public.release_seat_on_member_exit();
revoke execute on function public.release_seat_on_member_exit() from public, anon, authenticated;

-- 10. Aplicar un evento de Stripe (solo el servidor con la clave secreta, desde el webhook firmado).
--     Idempotente por id de evento y tolerante al desorden por fecha del evento.
create or replace function public.billing_apply_event(p_event jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id text := p_event->>'id';
  v_type text := p_event->>'type';
  v_created timestamptz := to_timestamp((p_event->>'created')::double precision);
  o jsonb := p_event->'data'->'object';
  v_account uuid; v_plan text; v_sub public.subscriptions; v_outcome text := 'ignored';
begin
  if v_id is null or v_type is null then raise exception 'invalid_event' using errcode = 'P0001'; end if;
  insert into public.stripe_events (id, type, stripe_created) values (v_id, v_type, v_created) on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;

  if v_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then
    select id into v_account from public.billing_accounts where stripe_customer_id = o->>'customer';
    v_plan := coalesce(o->'metadata'->>'plan_code', (select code from public.plan_catalog where stripe_price_id = o->'items'->'data'->0->'price'->>'id' limit 1));
    if v_account is null or v_plan is null or not exists (select 1 from public.plan_catalog where code = v_plan) then
      v_outcome := 'unknown_customer_or_plan';
    else
      select * into v_sub from public.subscriptions where stripe_subscription_id = o->>'id' for update;
      if v_sub.id is not null and v_sub.last_event_at is not null and v_sub.last_event_at > v_created then
        v_outcome := 'stale_event';   -- llegó tarde: no pisa un estado más reciente
      else
        insert into public.subscriptions (billing_account_id, plan_code, plan_version, status, stripe_subscription_id, seats,
                                          current_period_start, current_period_end, cancel_at_period_end, trial_end, last_event_at)
        values (v_account, v_plan, (select max(version) from public.plan_catalog where code = v_plan),
                case when v_type = 'customer.subscription.deleted' then 'canceled' else o->>'status' end, o->>'id',
                greatest(coalesce((o->'items'->'data'->0->>'quantity')::integer, 1), 1),
                to_timestamp((o->>'current_period_start')::double precision), to_timestamp((o->>'current_period_end')::double precision),
                coalesce((o->>'cancel_at_period_end')::boolean, false),
                case when o->>'trial_end' is null then null else to_timestamp((o->>'trial_end')::double precision) end, v_created)
        on conflict (stripe_subscription_id) do update set
          plan_code = excluded.plan_code, plan_version = excluded.plan_version, status = excluded.status, seats = excluded.seats,
          current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end, trial_end = excluded.trial_end, last_event_at = excluded.last_event_at, updated_at = now();
        v_outcome := 'subscription_' || case when v_type = 'customer.subscription.deleted' then 'canceled' else o->>'status' end;
      end if;
    end if;
  elsif v_type = 'invoice.paid' then
    select id into v_account from public.billing_accounts where stripe_customer_id = o->>'customer';
    insert into public.billing_ledger (billing_account_id, kind, amount_cents, currency, stripe_object_id, description, occurred_at)
    values (v_account, 'charge', coalesce((o->>'amount_paid')::bigint, 0), upper(coalesce(o->>'currency', 'eur')), o->>'id', 'Factura pagada', v_created)
    on conflict do nothing;
    v_outcome := 'ledger_charge';
  elsif v_type = 'invoice.payment_failed' then
    select id into v_account from public.billing_accounts where stripe_customer_id = o->>'customer';
    perform public.notify(coalesce(b.user_id, m.user_id), 'billing.payment_failed', 'No hemos podido cobrar tu suscripción',
            'Actualiza tu método de pago. Mantienes el acceso 7 días mientras lo resuelves.', '/app/plan')
       from public.billing_accounts b left join public.organization_members m on m.organization_id = b.organization_id and m.member_role::text in ('owner', 'admin')
      where b.id = v_account and coalesce(b.user_id, m.user_id) is not null;
    v_outcome := 'payment_failed_notified';
  elsif v_type = 'charge.refunded' then
    select id into v_account from public.billing_accounts where stripe_customer_id = o->>'customer';
    insert into public.billing_ledger (billing_account_id, kind, amount_cents, currency, stripe_object_id, description, occurred_at)
    values (v_account, 'refund', -coalesce((o->>'amount_refunded')::bigint, 0), upper(coalesce(o->>'currency', 'eur')), o->>'id', 'Reembolso', v_created)
    on conflict do nothing;
    v_outcome := 'ledger_refund';
  elsif v_type in ('charge.dispute.created', 'charge.dispute.closed') then
    select b.id into v_account from public.billing_ledger l join public.billing_accounts b on b.id = l.billing_account_id where l.stripe_object_id = o->>'charge' limit 1;
    insert into public.billing_ledger (billing_account_id, kind, amount_cents, currency, stripe_object_id, description, occurred_at)
    values (v_account, case when v_type = 'charge.dispute.created' then 'dispute' else 'dispute_closed' end,
            case when v_type = 'charge.dispute.created' then -coalesce((o->>'amount')::bigint, 0) else 0 end,
            upper(coalesce(o->>'currency', 'eur')), o->>'id', 'Disputa ' || coalesce(o->>'status', ''), v_created)
    on conflict do nothing;
    v_outcome := 'ledger_dispute';
  end if;

  update public.stripe_events set processed_at = now(), outcome = v_outcome where id = v_id;
  insert into public.audit_logs (actor_id, action, entity, details, classification)
  values (null, 'billing.event', 'stripe_event', jsonb_build_object('type', v_type, 'outcome', v_outcome), 'sensitive');
  return v_outcome;
end;
$$;

-- Crear (o devolver) la cuenta de facturación propia o de la organización que diriges.
create or replace function public.billing_account_ensure(p_org uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if p_org is not null and not public.is_org_member(p_org, true) then raise exception 'billing_owner_required' using errcode = '42501'; end if;
  select id into v_id from public.billing_accounts where (p_org is null and user_id = auth.uid()) or (p_org is not null and organization_id = p_org);
  if v_id is null then
    insert into public.billing_accounts (user_id, organization_id) values (case when p_org is null then auth.uid() end, p_org) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- El servidor guarda el id de cliente de Stripe tras crearlo (nunca el navegador).
create or replace function public.billing_set_customer(p_account uuid, p_customer text)
returns void language sql security definer set search_path = public as $$
  update public.billing_accounts set stripe_customer_id = p_customer where id = p_account and stripe_customer_id is null;
$$;

do $$
declare f text;
begin
  foreach f in array array['effective_features(uuid, uuid)', 'feature_limit(text, uuid)', 'consume_usage(text, integer, uuid, text)',
                           'seat_assign(uuid, uuid, boolean)', 'billing_account_ensure(uuid)', 'can_see_billing_account(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Solo el servidor (service_role, desde el webhook firmado y la creación de clientes) aplica eventos.
revoke execute on function public.billing_apply_event(jsonb) from public, anon, authenticated;
revoke execute on function public.billing_set_customer(uuid, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.billing_apply_event(jsonb) to service_role';
    execute 'grant execute on function public.billing_set_customer(uuid, text) to service_role';
  end if;
end $$;
-- effective_features con otro usuario solo tiene sentido para uno mismo: la función pública usa auth.uid().
revoke execute on function public.effective_features(uuid, uuid) from authenticated;

/* ROLLBACK: drop de usage_counters, billing_ledger (y su trigger), stripe_events, seat_assignments, subscriptions,
   billing_accounts, plan_catalog, del trigger release_seat_on_member_exit y de las funciones nuevas. Antes, exportar
   el libro contable: es registro financiero. */
