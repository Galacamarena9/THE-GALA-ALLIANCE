-- =============================================================================================================
-- Prompt 13 · Marcas: ofertas comerciales estructuradas, entregables con versiones, derechos de uso y
-- exclusividad explícitos antes de aceptar, y pago con estado verificable.
-- REUSE: organizations(type='brand'), brand_campaigns, campaign_applications. EXTEND: términos estructurados.
-- NEW: campaign_offers (+componentes), campaign_deliverables (+envíos versionados), brand_application_notes.
-- Principios: el acceso de una marca es mucho más estrecho que el de un coach; el atleta decide; nada de
-- «influence score»; producto ≠ dinero; «no especificado» antes que inventar un valor.
-- Menores: las colaboraciones comerciales siguen siendo solo para mayores de edad (decisión conservadora).
-- =============================================================================================================

-- 1. Campaña: términos estructurados (los textos libres siguen, pero ya no son la única fuente).
alter table public.brand_campaigns drop constraint if exists brand_campaigns_compensation_kind_check;
alter table public.brand_campaigns add constraint brand_campaigns_compensation_kind_check
  check (compensation_kind in ('product', 'fixed_fee', 'mixed', 'conditional', 'unknown'));
alter table public.brand_campaigns drop constraint if exists fee_needs_amount;
alter table public.brand_campaigns drop constraint if exists fee_needs_amount;
alter table public.brand_campaigns add constraint fee_needs_amount
  check (compensation_kind in ('product', 'conditional', 'unknown') or compensation_usd is not null);
alter table public.brand_campaigns
  add column if not exists product_description text check (char_length(product_description) <= 500),
  add column if not exists product_value_usd integer check (product_value_usd between 0 and 1000000),
  add column if not exists usage_months integer check (usage_months between 0 and 60),
  add column if not exists usage_channels text[] not null default '{}',
  add column if not exists paid_media boolean not null default false,
  add column if not exists exclusivity_category text check (char_length(exclusivity_category) <= 120),
  add column if not exists exclusivity_days integer check (exclusivity_days between 0 and 730),
  add column if not exists min_age integer not null default 18 check (min_age between 18 and 40);

-- Cambiar términos de una campaña publicada la devuelve a revisión (ahora también los estructurados).
create or replace function public.guard_brand_campaign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
      if not exists (select 1 from public.organizations where id = new.brand_org_id and type = 'brand' and verification_status = 'verified') then
        raise exception 'brand_not_verified' using errcode = 'P0001';
      end if;
      new.published_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') then raise exception 'campaign_status_admin_only' using errcode = '42501'; end if;
    new.review_note := null;
    new.published_at := null;
    return new;
  end if;
  new.review_note := old.review_note;
  new.published_at := old.published_at;
  new.brand_org_id := old.brand_org_id;
  new.created_by := old.created_by;
  if new.status is distinct from old.status
     and not (new.status in ('draft', 'pending_review', 'closed') and old.status <> 'closed') then
    raise exception 'campaign_status_admin_only' using errcode = '42501';
  end if;
  if old.status = 'published' and new.status = 'published'
     and (new.title, new.description, new.deliverables, new.compensation_kind, new.compensation_usd, new.usage_rights,
          new.product_description, new.product_value_usd, new.usage_months, new.usage_channels, new.paid_media,
          new.exclusivity_category, new.exclusivity_days, new.min_age)
         is distinct from (old.title, old.description, old.deliverables, old.compensation_kind, old.compensation_usd, old.usage_rights,
          old.product_description, old.product_value_usd, old.usage_months, old.usage_channels, old.paid_media,
          old.exclusivity_category, old.exclusivity_days, old.min_age) then
    new.status := 'pending_review';
    new.published_at := null;
  end if;
  return new;
end;
$$;

-- 2. Oferta comercial a un atleta seleccionado. Inmutable una vez enviada: cambiarla = nueva versión.
create table if not exists public.campaign_offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.brand_campaigns (id) on delete cascade,
  application_id uuid not null references public.campaign_applications (id) on delete cascade,
  brand_org_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn', 'expired', 'superseded')),
  compensation_unknown boolean not null default false,
  usage_months integer not null default 0 check (usage_months between 0 and 60),
  usage_channels text[] not null default '{}',
  usage_territory text not null default 'WORLD' check (char_length(usage_territory) <= 120),
  organic_use boolean not null default true,
  paid_media boolean not null default false,
  exclusivity_category text check (char_length(exclusivity_category) <= 120),
  exclusivity_days integer not null default 0 check (exclusivity_days between 0 and 730),
  terms text check (char_length(terms) <= 4000),
  starts_on date,
  ends_on date,
  expires_at timestamptz not null,
  sent_by uuid references auth.users (id) on delete set null,
  responded_at timestamptz,
  decline_reason text check (char_length(decline_reason) <= 500),
  payment_status text not null default 'not_applicable'
    check (payment_status in ('not_applicable', 'pending', 'paid_declared', 'confirmed', 'disputed')),
  payment_updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_offer_dates check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint campaign_offer_exclusivity check (exclusivity_days = 0 or exclusivity_category is not null)
);
create unique index if not exists campaign_offers_open on public.campaign_offers (application_id) where status = 'sent';
create unique index if not exists campaign_offers_version on public.campaign_offers (application_id, version);
create index if not exists campaign_offers_athlete on public.campaign_offers (athlete_id);
create index if not exists campaign_offers_brand on public.campaign_offers (brand_org_id);
create index if not exists campaign_offers_campaign on public.campaign_offers (campaign_id);
create index if not exists campaign_offers_sent_by on public.campaign_offers (sent_by);

-- Componentes de la compensación: dinero, producto, viaje, material, bonus condicionado u otro.
create table if not exists public.campaign_offer_components (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.campaign_offers (id) on delete cascade,
  kind text not null check (kind in ('cash', 'product', 'travel', 'equipment', 'performance_bonus', 'other')),
  amount numeric(12, 2) check (amount >= 0 and amount <= 10000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  guaranteed boolean not null default true,
  description text not null check (char_length(description) between 2 and 500),
  -- Un bonus por rendimiento nunca es garantizado; el dinero siempre lleva importe.
  constraint component_bonus_conditional check (kind <> 'performance_bonus' or not guaranteed),
  constraint component_cash_amount check (kind <> 'cash' or amount is not null)
);
create index if not exists campaign_offer_components_offer on public.campaign_offer_components (offer_id);

-- 3. Entregables y envíos versionados (nunca se sobrescribe un envío anterior).
create table if not exists public.campaign_deliverables (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.campaign_offers (id) on delete cascade,
  kind text not null check (kind in ('reel', 'story', 'post', 'video', 'appearance', 'event', 'photo_shoot', 'other')),
  platform text check (char_length(platform) <= 60),
  quantity integer not null default 1 check (quantity between 1 and 100),
  due_date date,
  description text not null check (char_length(description) between 3 and 1000),
  approval_required boolean not null default true,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted', 'changes_requested', 'approved', 'completed', 'cancelled')),
  feedback text check (char_length(feedback) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaign_deliverables_offer on public.campaign_deliverables (offer_id);

create table if not exists public.campaign_deliverable_submissions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.campaign_deliverables (id) on delete cascade,
  athlete_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version >= 1),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 500),
  note text check (char_length(note) <= 1000),
  submitted_at timestamptz not null default now(),
  unique (deliverable_id, version)
);
create index if not exists campaign_submissions_athlete on public.campaign_deliverable_submissions (athlete_id);

-- 4. Notas internas de la marca sobre una candidatura: nunca visibles para el atleta.
create table if not exists public.brand_application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.campaign_applications (id) on delete cascade,
  brand_org_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists brand_application_notes_app on public.brand_application_notes (application_id);
create index if not exists brand_application_notes_org on public.brand_application_notes (brand_org_id);
create index if not exists brand_application_notes_author on public.brand_application_notes (author_id);

-- Nada se escribe a mano en ofertas, componentes, entregables ni envíos: solo las funciones (marca gala.brand_rpc).
create or replace function public.guard_brand_rpc_only()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('gala.brand_rpc', true) = 'on' or current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  raise exception 'brand_rpc_only' using errcode = '42501';
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['campaign_offers', 'campaign_offer_components', 'campaign_deliverables', 'campaign_deliverable_submissions'] loop
    execute format('drop trigger if exists guard_brand_rpc_only on public.%I', t);
    execute format('create trigger guard_brand_rpc_only before insert or update or delete on public.%I for each row execute function public.guard_brand_rpc_only()', t);
  end loop;
end $$;

-- 5. Lectura: atleta, miembros de la marca, agente con offers.view y Gala. Nadie más.
create or replace function public.can_see_campaign_offer(p_offer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaign_offers o where o.id = p_offer
                  and (o.athlete_id = auth.uid() or public.is_org_member(o.brand_org_id) or public.is_admin()
                       or public.agent_can(o.athlete_id, 'offers.view', null, null, 'brand')));
$$;

alter table public.campaign_offers enable row level security;
alter table public.campaign_offer_components enable row level security;
alter table public.campaign_deliverables enable row level security;
alter table public.campaign_deliverable_submissions enable row level security;
alter table public.brand_application_notes enable row level security;

create policy campaign_offers_select on public.campaign_offers for select to authenticated using (public.can_see_campaign_offer(id));
create policy offer_components_select on public.campaign_offer_components for select to authenticated using (public.can_see_campaign_offer(offer_id));
create policy deliverables_select on public.campaign_deliverables for select to authenticated using (public.can_see_campaign_offer(offer_id));
create policy submissions_select on public.campaign_deliverable_submissions for select to authenticated
  using (exists (select 1 from public.campaign_deliverables d where d.id = deliverable_id and public.can_see_campaign_offer(d.offer_id)));
create policy brand_notes_select on public.brand_application_notes for select to authenticated using (public.is_org_member(brand_org_id));
create policy brand_notes_insert on public.brand_application_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_org_member(brand_org_id)
              and exists (select 1 from public.campaign_applications a join public.brand_campaigns c on c.id = a.campaign_id
                           where a.id = application_id and c.brand_org_id = brand_application_notes.brand_org_id));
create policy brand_notes_delete on public.brand_application_notes for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_org_member(brand_org_id));
grant select on public.campaign_offers, public.campaign_offer_components, public.campaign_deliverables, public.campaign_deliverable_submissions to authenticated;
grant select, insert, delete on public.brand_application_notes to authenticated;

-- 6. Funciones transaccionales
create or replace function public.brand_set(p_on boolean)
returns void language sql set search_path = public as $$
  select set_config('gala.brand_rpc', case when p_on then 'on' else '' end, true);
$$;
revoke execute on function public.brand_set(boolean) from public, anon, authenticated;

-- Enviar oferta (o nueva versión, que sustituye a la anterior pendiente). Todo explícito antes de que el atleta decida.
create or replace function public.campaign_offer_send(
  p_application uuid, p_components jsonb, p_deliverables jsonb, p_usage_months integer, p_usage_channels text[],
  p_paid_media boolean, p_exclusivity_category text, p_exclusivity_days integer, p_expires_days integer,
  p_terms text default null, p_compensation_unknown boolean default false, p_usage_territory text default 'WORLD',
  p_starts_on date default null, p_ends_on date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a record; v_id uuid; v_version integer; c jsonb; d jsonb;
begin
  select ap.id, ap.athlete_id, ap.status, cp.id as campaign_id, cp.brand_org_id, cp.status as campaign_status
    into a from public.campaign_applications ap join public.brand_campaigns cp on cp.id = ap.campaign_id where ap.id = p_application;
  if a.id is null or not public.is_org_member(a.brand_org_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.organizations where id = a.brand_org_id and type = 'brand' and verification_status = 'verified' and org_status = 'active') then
    raise exception 'brand_not_verified' using errcode = '42501';
  end if;
  if a.status <> 'selected' then raise exception 'athlete_not_selected' using errcode = 'P0001'; end if;
  if public.is_minor(a.athlete_id) then raise exception 'campaigns_adults_only' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_deliverables, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_components, '[]'::jsonb)) = 0 and not p_compensation_unknown then
    raise exception 'compensation_required' using errcode = 'P0001';  -- o componentes, o «no especificado» explícito
  end if;
  if jsonb_array_length(coalesce(p_deliverables, '[]'::jsonb)) = 0 then raise exception 'deliverables_required' using errcode = 'P0001'; end if;
  if coalesce(p_expires_days, 0) not between 1 and 60 then raise exception 'invalid_expiry' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtext('offer:' || p_application::text));
  select coalesce(max(version), 0) + 1 into v_version from public.campaign_offers where application_id = p_application;

  perform public.brand_set(true);
  update public.campaign_offers set status = 'superseded' where application_id = p_application and status = 'sent';
  insert into public.campaign_offers (campaign_id, application_id, brand_org_id, athlete_id, version, compensation_unknown, usage_months,
    usage_channels, usage_territory, paid_media, exclusivity_category, exclusivity_days, terms, starts_on, ends_on, expires_at, sent_by)
  values (a.campaign_id, p_application, a.brand_org_id, a.athlete_id, v_version, coalesce(p_compensation_unknown, false), coalesce(p_usage_months, 0),
    coalesce(p_usage_channels, '{}'), coalesce(nullif(btrim(p_usage_territory), ''), 'WORLD'), coalesce(p_paid_media, false),
    nullif(btrim(p_exclusivity_category), ''), coalesce(p_exclusivity_days, 0), left(p_terms, 4000), p_starts_on, p_ends_on,
    now() + make_interval(days => p_expires_days), auth.uid())
  returning id into v_id;
  for c in select * from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) loop
    insert into public.campaign_offer_components (offer_id, kind, amount, currency, guaranteed, description)
    values (v_id, c->>'kind', nullif(c->>'amount', '')::numeric, upper(coalesce(nullif(c->>'currency', ''), 'USD')),
            coalesce((c->>'guaranteed')::boolean, (c->>'kind') <> 'performance_bonus'), c->>'description');
  end loop;
  for d in select * from jsonb_array_elements(p_deliverables) loop
    insert into public.campaign_deliverables (offer_id, kind, platform, quantity, due_date, description, approval_required)
    values (v_id, d->>'kind', nullif(d->>'platform', ''), coalesce(nullif(d->>'quantity', '')::integer, 1), nullif(d->>'due_date', '')::date,
            d->>'description', coalesce((d->>'approval_required')::boolean, true));
  end loop;
  perform public.brand_set(false);

  perform public.notify(a.athlete_id, 'brand_offer.received', 'Tienes una oferta de una marca',
          'Revisa compensación, entregables, derechos de uso y exclusividad antes de decidir.', '/app/collaborations');
  perform public.audit('brand_offer_sent', 'campaign_offer', v_id, a.brand_org_id, jsonb_build_object('version', v_version), null, 'sensitive', null);
  return v_id;
end;
$$;

-- Responder: solo el atleta. Un agente autorizado puede verla y prepararla, pero no aceptarla.
create or replace function public.campaign_offer_respond(p_offer uuid, p_accept boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare o public.campaign_offers; v_new text; v_cash boolean;
begin
  select * into o from public.campaign_offers where id = p_offer for update;
  if o.id is null or o.athlete_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.status <> 'sent' then return o.status; end if;  -- idempotente
  perform public.brand_set(true);
  if o.expires_at <= now() then
    update public.campaign_offers set status = 'expired' where id = p_offer;
    perform public.brand_set(false);
    return 'expired';
  end if;
  v_new := case when p_accept then 'accepted' else 'declined' end;
  v_cash := exists (select 1 from public.campaign_offer_components where offer_id = p_offer and kind = 'cash' and amount > 0);
  update public.campaign_offers set status = v_new, responded_at = now(), decline_reason = case when p_accept then null else left(p_reason, 500) end,
         payment_status = case when p_accept and v_cash then 'pending' else 'not_applicable' end, payment_updated_at = now()
   where id = p_offer;
  perform public.brand_set(false);
  perform public.notify(m.user_id, 'brand_offer.' || v_new, case when p_accept then 'Oferta aceptada' else 'Oferta rechazada' end,
          case when p_accept then 'El atleta ha aceptado. Los entregables ya están en marcha.' else 'El atleta ha rechazado la oferta.' end,
          '/app/campaigns/' || o.campaign_id)
     from public.organization_members m where m.organization_id = o.brand_org_id;
  perform public.audit('brand_offer_' || v_new, 'campaign_offer', p_offer, o.brand_org_id, '{}'::jsonb, p_reason, 'sensitive', null);
  return v_new;
end;
$$;

create or replace function public.campaign_offer_withdraw(p_offer uuid)
returns text language plpgsql security definer set search_path = public as $$
declare o public.campaign_offers;
begin
  select * into o from public.campaign_offers where id = p_offer for update;
  if o.id is null or not public.is_org_member(o.brand_org_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.status <> 'sent' then return o.status; end if;
  perform public.brand_set(true);
  update public.campaign_offers set status = 'withdrawn' where id = p_offer;
  perform public.brand_set(false);
  perform public.notify(o.athlete_id, 'brand_offer.withdrawn', 'Una marca retiró su oferta', 'La oferta ya no está disponible.', '/app/collaborations');
  perform public.audit('brand_offer_withdrawn', 'campaign_offer', p_offer, o.brand_org_id, '{}'::jsonb, null, 'sensitive', null);
  return 'withdrawn';
end;
$$;

-- Entrega del atleta: una versión nueva cada vez; la anterior se conserva.
create or replace function public.campaign_deliverable_submit(p_deliverable uuid, p_url text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare d record; v_version integer;
begin
  select dl.*, o.athlete_id, o.status as offer_status, o.brand_org_id into d
    from public.campaign_deliverables dl join public.campaign_offers o on o.id = dl.offer_id where dl.id = p_deliverable for update of dl;
  if d.id is null or d.athlete_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0002'; end if;
  if d.offer_status <> 'accepted' then raise exception 'offer_not_accepted' using errcode = 'P0001'; end if;
  if d.status in ('approved', 'completed', 'cancelled') then raise exception 'deliverable_closed' using errcode = 'P0001'; end if;
  if p_url !~ '^https://[^\s]+$' then raise exception 'invalid_url' using errcode = 'P0001'; end if;
  select coalesce(max(version), 0) + 1 into v_version from public.campaign_deliverable_submissions where deliverable_id = p_deliverable;
  perform public.brand_set(true);
  insert into public.campaign_deliverable_submissions (deliverable_id, athlete_id, version, url, note) values (p_deliverable, auth.uid(), v_version, p_url, left(p_note, 1000));
  update public.campaign_deliverables set status = case when approval_required then 'submitted' else 'completed' end, updated_at = now() where id = p_deliverable;
  perform public.brand_set(false);
  perform public.notify(m.user_id, 'brand_deliverable.submitted', 'Entrega recibida', 'Un atleta ha enviado un entregable para revisar.', '/app/campaigns')
     from public.organization_members m where m.organization_id = d.brand_org_id;
  perform public.audit('deliverable_submitted', 'campaign_deliverable', p_deliverable, d.brand_org_id, jsonb_build_object('version', v_version), null, 'sensitive', null);
  return v_version;
end;
$$;

-- Revisión de la marca: aprobar o pedir cambios con un motivo. Nunca edita el contenido del atleta.
create or replace function public.campaign_deliverable_review(p_deliverable uuid, p_approve boolean, p_feedback text default null)
returns text language plpgsql security definer set search_path = public as $$
declare d record; v_new text;
begin
  select dl.*, o.athlete_id, o.brand_org_id into d
    from public.campaign_deliverables dl join public.campaign_offers o on o.id = dl.offer_id where dl.id = p_deliverable for update of dl;
  if d.id is null or not public.is_org_member(d.brand_org_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if d.status <> 'submitted' then return d.status; end if;
  if not p_approve and char_length(coalesce(btrim(p_feedback), '')) < 10 then raise exception 'feedback_required' using errcode = 'P0001'; end if;
  v_new := case when p_approve then 'approved' else 'changes_requested' end;
  perform public.brand_set(true);
  update public.campaign_deliverables set status = v_new, feedback = left(p_feedback, 1000), reviewed_at = now(), updated_at = now() where id = p_deliverable;
  perform public.brand_set(false);
  perform public.notify(d.athlete_id, 'brand_deliverable.' || v_new, case when p_approve then 'Entregable aprobado' else 'La marca pide cambios' end,
          coalesce(left(p_feedback, 200), 'Entra para ver el detalle.'), '/app/collaborations');
  perform public.audit('deliverable_' || v_new, 'campaign_deliverable', p_deliverable, d.brand_org_id, '{}'::jsonb, p_feedback, 'sensitive', null);
  return v_new;
end;
$$;

-- Pago: la marca declara que pagó; solo el atleta lo confirma o lo disputa. Gala no inventa estados de pago.
create or replace function public.campaign_payment_update(p_offer uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare o public.campaign_offers;
begin
  select * into o from public.campaign_offers where id = p_offer for update;
  if o.id is null or not (o.athlete_id = auth.uid() or public.is_org_member(o.brand_org_id)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if o.status <> 'accepted' or o.payment_status = 'not_applicable' then raise exception 'payment_not_applicable' using errcode = 'P0001'; end if;
  if o.payment_status = p_status then return p_status; end if;
  if public.is_org_member(o.brand_org_id) and o.athlete_id <> auth.uid() then
    if not (p_status = 'paid_declared' and o.payment_status in ('pending', 'disputed')) then raise exception 'payment_transition_not_allowed' using errcode = '42501'; end if;
  else
    if not (p_status in ('confirmed', 'disputed') and o.payment_status in ('pending', 'paid_declared')) then raise exception 'payment_transition_not_allowed' using errcode = '42501'; end if;
  end if;
  perform public.brand_set(true);
  update public.campaign_offers set payment_status = p_status, payment_updated_at = now() where id = p_offer;
  perform public.brand_set(false);
  perform public.notify(case when o.athlete_id = auth.uid() then o.sent_by else o.athlete_id end, 'brand_payment.' || p_status, 'Pago actualizado',
          case p_status when 'paid_declared' then 'La marca indica que ha pagado. Confírmalo cuando lo recibas.'
                        when 'confirmed' then 'El atleta confirma que ha recibido el pago.'
                        else 'El atleta indica un problema con el pago.' end, '/app/collaborations');
  perform public.audit('payment_' || p_status, 'campaign_offer', p_offer, o.brand_org_id, '{}'::jsonb, null, 'sensitive', null);
  return p_status;
end;
$$;

-- Caducidad de ofertas sin respuesta (job diario, idempotente).
create or replace function public.campaign_offers_expire_due()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.brand_set(true);
  update public.campaign_offers set status = 'expired' where status = 'sent' and expires_at <= now();
  get diagnostics n = row_count;
  perform public.brand_set(false);
  return n;
end;
$$;
revoke execute on function public.campaign_offers_expire_due() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-brand-offers', '35 3 * * *', 'select public.campaign_offers_expire_due()');
  end if;
exception when others then null;
end $$;

do $$
declare f text;
begin
  foreach f in array array['can_see_campaign_offer(uuid)',
    'campaign_offer_send(uuid, jsonb, jsonb, integer, text[], boolean, text, integer, integer, text, boolean, text, date, date)',
    'campaign_offer_respond(uuid, boolean, text)', 'campaign_offer_withdraw(uuid)', 'campaign_deliverable_submit(uuid, text, text)',
    'campaign_deliverable_review(uuid, boolean, text)', 'campaign_payment_update(uuid, text)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.guard_brand_rpc_only() from public, anon, authenticated;

/* ROLLBACK: drop campaign_deliverable_submissions, campaign_deliverables, campaign_offer_components, campaign_offers,
   brand_application_notes y las funciones nuevas; quitar las columnas añadidas a brand_campaigns y restaurar
   guard_brand_campaign y el check de compensation_kind ('product','fixed_fee','mixed') tras mapear conditional/unknown. */
