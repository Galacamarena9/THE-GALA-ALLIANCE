-- =============================================================================
-- Portales por actor: equipo de la universidad (coaches), cartera de agentes,
-- ofertas de marcas, perfil público de universidad y control de uso de Gala IA.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfil de universidad (directorio)
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column state text check (char_length(state) <= 60),
  add column conference text check (char_length(conference) <= 120),
  add column logo_url text check (logo_url is null or logo_url ~ '^https://'),
  add column international_support text check (char_length(international_support) <= 2000),
  add column annual_cost_usd int check (annual_cost_usd between 0 and 200000),
  add column cost_source_url text check (cost_source_url is null or cost_source_url ~ '^https://');

-- -----------------------------------------------------------------------------
-- 2. Invitaciones al equipo de una organización (universidad → coaches)
-- -----------------------------------------------------------------------------
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  member_role public.org_member_role not null default 'coach',
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  accepted_by uuid references public.profiles (id),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
alter table public.organization_invitations enable row level security;

create policy org_inv_select on public.organization_invitations for select to authenticated
  using (public.is_org_member(organization_id, true) or public.is_admin());
create policy org_inv_insert on public.organization_invitations for insert to authenticated
  with check (invited_by = auth.uid() and status = 'pending' and accepted_by is null and public.is_org_member(organization_id, true));
create policy org_inv_revoke on public.organization_invitations for update to authenticated
  using (public.is_org_member(organization_id, true))
  with check (public.is_org_member(organization_id, true) and status = 'revoked');

create or replace function public.accept_organization_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv public.organization_invitations;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select * into v_inv from public.organization_invitations where token = p_token for update;
  if not found or v_inv.status <> 'pending' or v_inv.expires_at < now() then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role in ('coach', 'university')) then
    raise exception 'coach_role_required' using errcode = 'P0001';
  end if;
  if public.is_minor(v_uid) then raise exception 'adults_only' using errcode = 'P0001'; end if;

  insert into public.organization_members (organization_id, user_id, member_role)
  values (v_inv.organization_id, v_uid, v_inv.member_role)
  on conflict (organization_id, user_id) do nothing;
  update public.organization_invitations set status = 'accepted', accepted_by = v_uid where id = v_inv.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (v_uid, 'organization.member_joined', 'organizations', v_inv.organization_id);
  return v_inv.organization_id;
end;
$$;

create or replace function public.preview_organization_invitation(p_token text)
returns table (organization_name text, organization_type public.org_type, valid boolean)
language sql stable security definer set search_path = public as $$
  select o.name, o.type, i.status = 'pending' and i.expires_at > now()
    from public.organization_invitations i join public.organizations o on o.id = i.organization_id
   where i.token = p_token;
$$;

-- -----------------------------------------------------------------------------
-- 3. Cartera de agentes: la representación exige aceptación expresa del atleta.
--    v1: solo atletas mayores de edad (normativa de agentes y menores pendiente de revisión legal).
-- -----------------------------------------------------------------------------
create table public.agent_representations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'active', 'declined', 'ended')),
  message text check (char_length(message) <= 1000),
  responded_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index agent_rep_open_unique on public.agent_representations (agency_id, athlete_id)
  where status in ('requested', 'active');
alter table public.agent_representations enable row level security;

create or replace function public.guard_agent_representation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_minor(new.athlete_id) then
      raise exception 'representation_adults_only' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.organizations where id = new.agency_id and type = 'agency') then
      raise exception 'agency_required' using errcode = 'P0001';
    end if;
    new.status := 'requested';
    new.responded_at := null;
    new.ended_at := null;
    return new;
  end if;
  if (new.agency_id, new.agent_id, new.athlete_id, new.created_at) is distinct from (old.agency_id, old.agent_id, old.athlete_id, old.created_at) then
    raise exception 'representation_immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    -- El atleta acepta o rechaza; cualquiera de las partes termina una representación activa.
    if old.status = 'requested' and new.status in ('active', 'declined') and auth.uid() = new.athlete_id then
      new.responded_at := now();
    elsif old.status = 'requested' and new.status = 'ended' and public.is_org_member(new.agency_id) then
      new.ended_at := now();
    elsif old.status = 'active' and new.status = 'ended' then
      new.ended_at := now();
    else
      raise exception 'representation_transition_not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_agent_representation before insert or update on public.agent_representations
  for each row execute function public.guard_agent_representation();

create policy rep_select on public.agent_representations for select to authenticated
  using (athlete_id = auth.uid() or public.is_org_member(agency_id) or public.is_admin());
create policy rep_insert on public.agent_representations for insert to authenticated
  with check (agent_id = auth.uid() and public.has_role('agent') and public.is_org_member(agency_id)
              and public.can_view_athlete(athlete_id));
create policy rep_update on public.agent_representations for update to authenticated
  using (athlete_id = auth.uid() or public.is_org_member(agency_id))
  with check (athlete_id = auth.uid() or public.is_org_member(agency_id));

-- -----------------------------------------------------------------------------
-- 4. Ofertas de marcas (campañas) y candidaturas. Solo atletas mayores de 18.
--    Sin contratos ni pagos en la plataforma hasta completar la revisión legal NIL.
-- -----------------------------------------------------------------------------
create table public.brand_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_org_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title text not null check (char_length(title) between 4 and 160),
  description text not null check (char_length(description) between 20 and 4000),
  kind text not null check (kind in ('ambassador', 'social_content', 'event', 'product_testing', 'sponsorship')),
  sport_ids text[] not null default '{}',
  deliverables text not null check (char_length(deliverables) between 5 and 2000),
  compensation_kind text not null check (compensation_kind in ('product', 'fixed_fee', 'mixed')),
  compensation_usd int check (compensation_usd between 0 and 1000000),
  usage_rights text check (char_length(usage_rights) <= 1000),
  territory text check (char_length(territory) <= 160),
  application_deadline date,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'closed', 'rejected')),
  review_note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_needs_amount check (compensation_kind = 'product' or compensation_usd is not null)
);
create trigger t_campaigns_updated before update on public.brand_campaigns for each row execute function public.set_updated_at();
alter table public.brand_campaigns enable row level security;

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
     and (new.title, new.description, new.deliverables, new.compensation_kind, new.compensation_usd, new.usage_rights)
         is distinct from (old.title, old.description, old.deliverables, old.compensation_kind, old.compensation_usd, old.usage_rights) then
    new.status := 'pending_review';
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger guard_brand_campaign before insert or update on public.brand_campaigns
  for each row execute function public.guard_brand_campaign();

create policy campaigns_select on public.brand_campaigns for select to authenticated
  using (status = 'published' or public.is_org_member(brand_org_id) or public.is_admin());
create policy campaigns_insert on public.brand_campaigns for insert to authenticated
  with check (created_by = auth.uid() and public.has_role('brand') and public.is_org_member(brand_org_id)
              and exists (select 1 from public.organizations o where o.id = brand_org_id and o.type = 'brand'));
create policy campaigns_update on public.brand_campaigns for update to authenticated
  using (public.is_org_member(brand_org_id) or public.is_admin())
  with check (public.is_org_member(brand_org_id) or public.is_admin());
create policy campaigns_delete on public.brand_campaigns for delete to authenticated
  using (public.is_org_member(brand_org_id) and status in ('draft', 'rejected'));

create table public.campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.brand_campaigns (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'shortlisted', 'selected', 'declined', 'withdrawn')),
  message text check (char_length(message) <= 1500),
  -- El atleta confirma que revisará la normativa de su universidad/federación antes de comprometerse.
  rules_acknowledged boolean not null default false check (rules_acknowledged),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, athlete_id)
);
create trigger t_campaign_apps_updated before update on public.campaign_applications for each row execute function public.set_updated_at();
alter table public.campaign_applications enable row level security;

create or replace function public.campaign_org(p_campaign uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select brand_org_id from public.brand_campaigns where id = p_campaign;
$$;

create or replace function public.guard_campaign_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_athlete boolean := auth.uid() = new.athlete_id;
begin
  if tg_op = 'INSERT' then
    if public.is_minor(new.athlete_id) then raise exception 'campaigns_adults_only' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.brand_campaigns where id = new.campaign_id and status = 'published'
                   and (application_deadline is null or application_deadline >= current_date)) then
      raise exception 'campaign_not_open' using errcode = 'P0001';
    end if;
    new.status := 'applied';
    return new;
  end if;
  if (new.campaign_id, new.athlete_id) is distinct from (old.campaign_id, old.athlete_id) then
    raise exception 'application_immutable_keys' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'withdrawn' then raise exception 'application_closed' using errcode = 'P0001'; end if;
    if v_is_athlete and new.status <> 'withdrawn' then raise exception 'athlete_can_only_withdraw' using errcode = '42501'; end if;
    if not v_is_athlete and new.status = 'withdrawn' then raise exception 'only_athlete_can_withdraw' using errcode = '42501'; end if;
  end if;
  if not v_is_athlete and new.message is distinct from old.message then
    raise exception 'application_message_owner_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_campaign_application before insert or update on public.campaign_applications
  for each row execute function public.guard_campaign_application();

create policy capps_select on public.campaign_applications for select to authenticated
  using (athlete_id = auth.uid() or public.is_org_member(public.campaign_org(campaign_id)) or public.is_admin());
create policy capps_insert on public.campaign_applications for insert to authenticated
  with check (athlete_id = auth.uid() and public.has_role('athlete'));
create policy capps_update on public.campaign_applications for update to authenticated
  using (athlete_id = auth.uid() or public.is_org_member(public.campaign_org(campaign_id)))
  with check (athlete_id = auth.uid() or public.is_org_member(public.campaign_org(campaign_id)));

-- Auditoría de publicación de campañas.
create or replace function public.audit_campaign_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'campaign.status', 'brand_campaigns', new.id, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger audit_campaign after update on public.brand_campaigns for each row execute function public.audit_campaign_status();

-- -----------------------------------------------------------------------------
-- 5. "Conexión" ampliada: candidatura a beca, candidatura a campaña o representación activa
--    permiten a esa organización ver los bloques marcados como "connections".
-- -----------------------------------------------------------------------------
create or replace function public.has_connection_with_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.organization_members m on m.organization_id = o.organization_id
     where a.athlete_id = p_athlete and m.user_id = auth.uid() and a.status <> 'withdrawn'
  ) or exists (
    select 1 from public.campaign_applications ca
      join public.brand_campaigns c on c.id = ca.campaign_id
      join public.organization_members m on m.organization_id = c.brand_org_id
     where ca.athlete_id = p_athlete and m.user_id = auth.uid() and ca.status <> 'withdrawn'
  ) or exists (
    select 1 from public.agent_representations r
      join public.organization_members m on m.organization_id = r.agency_id
     where r.athlete_id = p_athlete and m.user_id = auth.uid() and r.status = 'active'
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. Gala IA: solo se cuenta el uso diario (no se guardan las conversaciones).
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  requests int not null default 0 check (requests >= 0),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_select on public.ai_usage for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Reserva atómica de una petición; devuelve false si se supera el límite diario (40).
-- El límite vive aquí, no en el cliente, para que nadie pueda ampliárselo.
create or replace function public.consume_ai_request()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, day, requests) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set requests = public.ai_usage.requests + 1
  returning requests into v_count;
  return v_count <= 40;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Privilegios
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.organization_invitations, public.agent_representations,
  public.brand_campaigns, public.campaign_applications to authenticated;
grant select on public.ai_usage to authenticated;
revoke execute on function public.accept_organization_invitation, public.preview_organization_invitation,
  public.campaign_org, public.consume_ai_request, public.guard_agent_representation,
  public.guard_brand_campaign, public.guard_campaign_application, public.audit_campaign_status from public;
grant execute on function public.accept_organization_invitation, public.preview_organization_invitation,
  public.consume_ai_request to authenticated;
grant execute on function public.campaign_org to anon, authenticated;
