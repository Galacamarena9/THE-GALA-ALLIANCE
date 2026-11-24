-- =============================================================================================================
-- Fase 2 de la auditoría (hallazgo H1): los límites de plan se cumplen y se retira el «gratis hasta 2027».
-- Antes: el catálogo definía límites (atletas representados, puestos) pero nada los comprobaba, y cualquier
-- agencia tenía el plan Agencia gratis hasta el 31-03-2027 (sin motivo para pagar).
-- Ahora:
--   1. Prueba gratuita por agencia: 30 días desde que se crea (lo que ya anuncia la web), sin tarjeta.
--      Un administrador puede ampliarla con motivo (auditado). Las agencias existentes reciben 30 días desde hoy.
--   2. plan_catalog.free_until = null: deja de haber un periodo gratis general.
--   3. Plan efectivo de la agencia = suscripción viva (o past_due con 7 días de gracia) > prueba > nada.
--   4. Se comprueba al AÑADIR (nunca se borra nada): atletas representados (propuestas abiertas + activas +
--      invitaciones de cartera abiertas) y puestos (miembros de la agencia). Sin plan, la agencia conserva todo lo
--      que tiene pero no puede añadir más.
-- Solo se aplica con sesión (auth.uid() no nulo): semillas, webhook y tareas internas no se ven afectados.
-- ROLLBACK:
--   drop trigger if exists guard_plan_seats on public.organization_members;
--   drop trigger if exists guard_plan_athletes on public.agent_representations;
--   drop trigger if exists guard_plan_athletes on public.agency_athlete_invites;
--   drop function if exists public.guard_plan_seats(); drop function if exists public.guard_plan_athletes();
--   drop function if exists public.agency_plan_status(uuid); drop function if exists public.admin_agency_trial_extend(uuid, int, text);
--   drop function if exists public.agency_plan_features(uuid); drop function if exists public.agency_plan_usage(uuid);
--   drop function if exists public.agency_trial_ends_at(uuid); drop table if exists public.agency_trials;
--   update public.plan_catalog set free_until = '2027-03-31' where code in ('agent_solo', 'agent_team');
--   restaurar effective_features desde 20261130000100_15_billing.sql.
-- =============================================================================================================

-- 1. Prueba por agencia -------------------------------------------------------------------------------------
create table if not exists public.agency_trials (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  ends_at timestamptz not null,
  extended_by uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) between 5 and 300),
  updated_at timestamptz not null default now()
);
create index if not exists agency_trials_extended_by on public.agency_trials (extended_by);
alter table public.agency_trials enable row level security;
revoke all on public.agency_trials from anon, authenticated;
grant select on public.agency_trials to authenticated;
create policy agency_trials_select on public.agency_trials for select to authenticated
  using (public.is_org_member(organization_id) or public.is_admin());

-- Agencias existentes: 30 días desde hoy (nadie pierde acceso de golpe al retirar el periodo general).
insert into public.agency_trials (organization_id, ends_at, reason)
select o.id, greatest(o.created_at, now()) + interval '30 days', 'Paso del lanzamiento a prueba de 30 días'
  from public.organizations o where o.type = 'agency'
on conflict (organization_id) do nothing;

create or replace function public.agency_trial_ends_at(p_org uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce((select t.ends_at from public.agency_trials t where t.organization_id = p_org),
                  (select o.created_at + interval '30 days' from public.organizations o where o.id = p_org and o.type = 'agency'));
$$;
revoke all on function public.agency_trial_ends_at(uuid) from public, anon, authenticated;

-- 2. Sin periodo gratis general -------------------------------------------------------------------------------
update public.plan_catalog set free_until = null where free_until is not null;

-- 3. Plan efectivo de la agencia (independiente de qué miembro pregunta) ----------------------------------------
create or replace function public.agency_plan_features(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with subs as (
    select c.features from public.subscriptions s
      join public.billing_accounts b on b.id = s.billing_account_id
      join public.plan_catalog c on c.code = s.plan_code and c.version = s.plan_version
     where b.organization_id = p_org
       and (s.status in ('active', 'trialing') or (s.status = 'past_due' and s.current_period_end > now() - interval '7 days'))
  ), trial as (
    select c.features from public.plan_catalog c
     where c.code = 'agent_team' and c.active and public.agency_trial_ends_at(p_org) > now()
       and not exists (select 1 from subs)
  ), all_features as (
    select f from subs, jsonb_each(subs.features) f union all
    select f from trial, jsonb_each(trial.features) f
  )
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select (f).key as k,
           case when bool_or(((f).value)::text = '-1') then to_jsonb(-1) else to_jsonb(max((((f).value)::text)::integer)) end as v
      from all_features group by (f).key
  ) x;
$$;
revoke all on function public.agency_plan_features(uuid) from public, anon, authenticated;

create or replace function public.agency_plan_usage(p_org uuid)
returns table (athletes int, seats int) language sql stable security definer set search_path = public as $$
  select
    ((select count(*) from public.agent_representations r where r.agency_id = p_org and r.status in ('requested', 'active'))
     + (select count(*) from public.agency_athlete_invites i where i.agency_id = p_org and i.status in ('sent', 'opened') and i.expires_at > now()))::int,
    (select count(*) from public.organization_members m where m.organization_id = p_org)::int;
$$;
revoke all on function public.agency_plan_usage(uuid) from public, anon, authenticated;

-- Para la app: estado del plan de una agencia (solo sus miembros o un administrador).
create or replace function public.agency_plan_status(p_org uuid)
returns table (source text, plan_code text, trial_ends_at timestamptz, athletes_limit int, athletes_used int, seats_limit int, seats_used int)
language plpgsql stable security definer set search_path = public as $$
declare v_f jsonb; v_code text; v_u record;
begin
  if auth.uid() is null or not (public.is_org_member(p_org) or public.is_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select s.plan_code into v_code from public.subscriptions s join public.billing_accounts b on b.id = s.billing_account_id
   where b.organization_id = p_org
     and (s.status in ('active', 'trialing') or (s.status = 'past_due' and s.current_period_end > now() - interval '7 days'))
   order by s.created_at desc limit 1;
  v_f := public.agency_plan_features(p_org);
  select * into v_u from public.agency_plan_usage(p_org);
  return query select
    case when v_code is not null then 'subscription' when v_f <> '{}'::jsonb then 'trial' else 'none' end,
    coalesce(v_code, case when v_f <> '{}'::jsonb then 'agent_team' end),
    public.agency_trial_ends_at(p_org),
    coalesce((v_f ->> 'represented_athletes')::int, 0), v_u.athletes,
    coalesce((v_f ->> 'seats')::int, 0), v_u.seats;
end;
$$;
revoke all on function public.agency_plan_status(uuid) from public, anon;
grant execute on function public.agency_plan_status(uuid) to authenticated;

-- Ampliar la prueba: solo administración, con motivo, como máximo 90 días por vez; queda auditado.
create or replace function public.admin_agency_trial_extend(p_org uuid, p_days int, p_reason text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_end timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(p_days, 0) not between 1 and 90 then raise exception 'invalid_days' using errcode = 'P0001'; end if;
  if char_length(coalesce(trim(p_reason), '')) < 5 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.type = 'agency') then
    raise exception 'agency_required' using errcode = 'P0001';
  end if;
  v_end := greatest(coalesce(public.agency_trial_ends_at(p_org), now()), now()) + make_interval(days => p_days);
  insert into public.agency_trials (organization_id, ends_at, extended_by, reason, updated_at)
  values (p_org, v_end, auth.uid(), trim(p_reason), now())
  on conflict (organization_id) do update set ends_at = excluded.ends_at, extended_by = excluded.extended_by,
    reason = excluded.reason, updated_at = now();
  perform public.audit('agency_trial_extended', 'organization', p_org, p_org, jsonb_build_object('days', p_days, 'ends_at', v_end), trim(p_reason), 'security', null);
  return v_end;
end;
$$;
revoke all on function public.admin_agency_trial_extend(uuid, int, text) from public, anon;
grant execute on function public.admin_agency_trial_extend(uuid, int, text) to authenticated;

-- 4. Motor general de derechos: el «lanzamiento» pasa a ser la prueba de la agencia -----------------------------
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
    -- Prueba de 30 días de la agencia (sustituye al periodo gratis general hasta 2027).
    select c.features from public.plan_catalog c
     where c.active and c.code = 'agent_team' and p_org is not null
       and exists (select 1 from public.organizations o where o.id = p_org and o.type = 'agency')
       and public.agency_trial_ends_at(p_org) > now()
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

-- 5. Comprobaciones al añadir ------------------------------------------------------------------------------------
create or replace function public.guard_plan_athletes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int;
begin
  if auth.uid() is null then return new; end if;
  -- Serializa por agencia para que dos altas simultáneas no superen el límite.
  perform pg_advisory_xact_lock(hashtextextended('plan_athletes:' || new.agency_id::text, 0));
  v_limit := coalesce((public.agency_plan_features(new.agency_id) ->> 'represented_athletes')::int, 0);
  if v_limit <> -1 and (select u.athletes from public.agency_plan_usage(new.agency_id) u) >= v_limit then
    raise exception 'plan_athlete_limit' using errcode = 'P0001', hint = v_limit::text;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_plan_athletes() from public, anon, authenticated;
drop trigger if exists guard_plan_athletes on public.agent_representations;
create trigger guard_plan_athletes before insert on public.agent_representations
  for each row execute function public.guard_plan_athletes();

create or replace function public.guard_plan_seats()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int; v_used int;
begin
  if auth.uid() is null then return new; end if;
  if not exists (select 1 from public.organizations o where o.id = new.organization_id and o.type = 'agency') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('plan_seats:' || new.organization_id::text, 0));
  select u.seats into v_used from public.agency_plan_usage(new.organization_id) u;
  if v_used = 0 then return new; end if;   -- quien crea la agencia siempre entra
  v_limit := coalesce((public.agency_plan_features(new.organization_id) ->> 'seats')::int, 0);
  if v_limit <> -1 and v_used >= v_limit then
    raise exception 'plan_seat_limit' using errcode = 'P0001', hint = v_limit::text;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_plan_seats() from public, anon, authenticated;
drop trigger if exists guard_plan_seats on public.organization_members;
create trigger guard_plan_seats before insert on public.organization_members
  for each row execute function public.guard_plan_seats();

-- Las invitaciones de cartera también ocupan plaza (importar 300 nombres con el plan de 25 no tiene sentido).
drop trigger if exists guard_plan_athletes on public.agency_athlete_invites;
create trigger guard_plan_athletes before insert on public.agency_athlete_invites
  for each row execute function public.guard_plan_athletes();
