-- =============================================================================
-- Ciclo 3 · Confianza que se puede enseñar + cobro real
-- 1. Declaración de tarifas de la agencia, append-only y visible para el atleta y su familia
--    (riesgo NCAA bylaws 12.02.1 / 12.3.3: la tarifa no puede depender de conseguir la beca).
-- 2. Cupo fundador: solo las 15 primeras agencias con suscripción viva pagan 47/119 €; después, 79/199 €.
--    El catálogo guarda ambos precios (v3 fundador, v4 tarifa) y el pago elige según el cupo.
-- 3. El webhook registra «subscription_started» la primera vez que se crea una suscripción.
-- ROLLBACK:
--   drop function if exists public.representation_attest_fees(uuid, text);
--   drop table if exists public.representation_fee_attestations;
--   drop function if exists public.checkout_plan(text);
--   drop function if exists public.agency_founder_status();
--   update public.plan_catalog set active = true where code in ('agent_solo', 'agent_team') and version = 3;
--   delete from public.plan_catalog where code in ('agent_solo', 'agent_team') and version = 4;   -- solo si no hay suscripciones v4
--   restaurar billing_apply_event desde 20261130000100_15_billing.sql
-- =============================================================================

-- 1. Declaraciones de tarifas ---------------------------------------------------------
create table public.representation_fee_attestations (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.agent_representations (id) on delete cascade,
  agency_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  attested_by uuid references public.profiles (id) on delete set null,
  statement_version text not null check (statement_version ~ '^[0-9]{4}-[0-9]{2}$'),
  statement text not null check (char_length(statement) between 20 and 1000),
  attested_at timestamptz not null default now(),
  unique (representation_id, statement_version)
);
create index representation_fee_attestations_agency_idx on public.representation_fee_attestations (agency_id, attested_at desc);
create index representation_fee_attestations_athlete_idx on public.representation_fee_attestations (athlete_id);
create index representation_fee_attestations_by_idx on public.representation_fee_attestations (attested_by);
alter table public.representation_fee_attestations enable row level security;
revoke all on public.representation_fee_attestations from anon, authenticated;
grant select on public.representation_fee_attestations to authenticated;

create policy fee_attestations_select on public.representation_fee_attestations for select to authenticated
  using (public.is_org_member(agency_id) or athlete_id = (select auth.uid())
         or public.is_active_guardian(athlete_id) or public.has_role('admin'));

-- Append-only: nada se edita. Solo se borra en cascada al borrar la representación o la cuenta (RGPD);
-- attested_by puede quedar a null si se borra quien declaró.
create or replace function public.guard_fee_attestation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if public.only_nulled(to_jsonb(old), to_jsonb(new), '{attested_by}') then return new; end if;
    raise exception 'attestation_append_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_fee_attestation() from public, anon, authenticated;
create trigger guard_fee_attestation before update on public.representation_fee_attestations
  for each row execute function public.guard_fee_attestation();

-- Texto canónico por versión: lo fija el servidor, no el navegador.
create or replace function public.fee_statement(p_version text)
returns text language sql immutable set search_path = public as $$
  select case p_version
    when '2026-11' then 'Esta agencia declara que sus tarifas no dependen de que el atleta consiga una beca ni de su importe, y que no ofrece regalos, viajes ni beneficios para captar al atleta.'
  end
$$;

create or replace function public.representation_attest_fees(p_representation uuid, p_version text default '2026-11')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_rep public.agent_representations; v_text text := public.fee_statement(p_version); v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if v_text is null then raise exception 'unknown_statement' using errcode = 'P0001'; end if;
  select * into v_rep from public.agent_representations where id = p_representation;
  if not found or not (public.has_role('agent') and public.agency_can_write(v_rep.agency_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_rep.status not in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended') then
    raise exception 'representation_closed' using errcode = 'P0001';
  end if;
  insert into public.representation_fee_attestations (representation_id, agency_id, athlete_id, attested_by, statement_version, statement)
  values (v_rep.id, v_rep.agency_id, v_rep.athlete_id, auth.uid(), p_version, v_text)
  on conflict (representation_id, statement_version) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.representation_fee_attestations where representation_id = v_rep.id and statement_version = p_version;
  else
    perform public.audit('representation_fee_attested', 'representation_fee_attestation', v_id, v_rep.agency_id,
                         jsonb_build_object('version', p_version), null, 'security', null);
  end if;
  return v_id;
end;
$$;
revoke all on function public.representation_attest_fees(uuid, text) from public, anon;
grant execute on function public.representation_attest_fees(uuid, text) to authenticated;

-- 2. Cupo fundador ---------------------------------------------------------------------
insert into public.plan_catalog (code, version, audience, name, billing_interval, price_cents, seats_included, features, free_until, active)
select code, 4, audience, name, billing_interval,
       case code when 'agent_solo' then 7900 when 'agent_team' then 19900 end,
       seats_included, features, free_until, true
from public.plan_catalog
where code in ('agent_solo', 'agent_team') and version = 3
on conflict (code, version) do nothing;
-- La versión fundadora deja de ser la «pública»: solo la entrega checkout_plan() mientras queden plazas.
update public.plan_catalog set active = false where code in ('agent_solo', 'agent_team') and version = 3;

-- Plazas fundadoras ocupadas: cuentas con una suscripción v3 que no está cancelada ni caducada.
create or replace function public.agency_founder_status()
returns table (cap int, taken int, remaining int) language sql stable security definer set search_path = public as $$
  with t as (
    select count(distinct s.billing_account_id)::int n from public.subscriptions s
     where s.plan_code in ('agent_solo', 'agent_team') and s.plan_version = 3
       and s.status not in ('canceled', 'incomplete', 'incomplete_expired')
  )
  select 15, t.n, greatest(15 - t.n, 0) from t;
$$;
revoke all on function public.agency_founder_status() from public;
grant execute on function public.agency_founder_status() to anon, authenticated;

-- Plan que se cobra al contratar: la versión fundadora si quedan plazas (agente o agencia), si no la tarifa vigente.
create or replace function public.checkout_plan(p_code text)
returns table (code text, version int, name text, audience text, stripe_price_id text, price_cents int, currency text,
               billing_interval text, founder boolean)
language sql stable security definer set search_path = public as $$
  with f as (select remaining from public.agency_founder_status())
  select c.code, c.version, c.name, c.audience, c.stripe_price_id, c.price_cents, c.currency, c.billing_interval, c.version = 3
    from public.plan_catalog c, f
   where c.code = p_code
     and ((p_code in ('agent_solo', 'agent_team') and f.remaining > 0 and c.version = 3)
          or (c.active and not (p_code in ('agent_solo', 'agent_team') and f.remaining > 0)))
   order by c.version desc
   limit 1;
$$;
revoke all on function public.checkout_plan(text) from public, anon;
grant execute on function public.checkout_plan(text) to authenticated;

-- 3. Aplicar eventos de Stripe: versión del plan desde los metadatos del pago y evento «subscription_started».
create or replace function public.billing_apply_event(p_event jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id text := p_event->>'id';
  v_type text := p_event->>'type';
  v_created timestamptz := to_timestamp((p_event->>'created')::double precision);
  o jsonb := p_event->'data'->'object';
  v_account uuid; v_plan text; v_version int; v_meta_version int; v_sub public.subscriptions; v_outcome text := 'ignored';
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
        v_meta_version := case when (o->'metadata'->>'plan_version') ~ '^[0-9]{1,3}$' then (o->'metadata'->>'plan_version')::int end;
        v_version := coalesce(
          (select version from public.plan_catalog where code = v_plan and version = v_meta_version),
          case when v_sub.plan_code = v_plan then v_sub.plan_version end,
          (select max(version) from public.plan_catalog where code = v_plan));
        insert into public.subscriptions (billing_account_id, plan_code, plan_version, status, stripe_subscription_id, seats,
                                          current_period_start, current_period_end, cancel_at_period_end, trial_end, last_event_at)
        values (v_account, v_plan, v_version,
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
        -- Primera vez que vemos esta suscripción viva: evento de embudo (sin datos personales).
        if v_sub.id is null and v_type <> 'customer.subscription.deleted' and o->>'status' in ('trialing', 'active') then
          insert into public.product_events (user_id, event, props)
          values (null, 'subscription_started', jsonb_build_object('plan', v_plan, 'version', v_version, 'status', o->>'status'));
        end if;
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
