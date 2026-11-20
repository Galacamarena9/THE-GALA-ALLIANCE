-- Prompt 12A · Athlete Representation Data Model.
-- La representación Athlete ↔ Agency es la ÚNICA fuente de verdad de «quién representa a quién».
-- EXTEND sobre agent_representations (no se crea una tabla paralela). Todo cambio de estado pasa por
-- funciones transaccionales; el cliente no escribe estados. Regla: el atleta es dueño de su identidad;
-- la agencia recibe una autorización con alcance, fechas y auditoría.

-- -----------------------------------------------------------------------------------------------------------
-- 1. Estados, tipo, fechas y procedencia
-- -----------------------------------------------------------------------------------------------------------
alter table public.agent_representations drop constraint if exists agent_representations_status_check;
update public.agent_representations set status = 'terminated' where status = 'ended';
alter table public.agent_representations add constraint agent_representations_status_check
  check (status in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'expired', 'revoked', 'terminated', 'declined', 'disputed'));

alter table public.agent_representations
  add column if not exists representation_type text not null default 'non_exclusive'
    check (representation_type in ('exclusive', 'non_exclusive', 'opportunity_specific')),
  add column if not exists exclusivity_evidence text not null default 'declared'
    check (exclusivity_evidence in ('declared', 'documented', 'verified')),
  add column if not exists start_date date not null default current_date,
  add column if not exists end_date date,
  add column if not exists opportunity_id uuid references public.opportunities (id) on delete set null,
  add column if not exists source text not null default 'agency_request' check (source in ('agency_request', 'athlete_invite', 'import')),
  add column if not exists accepted_at timestamptz,
  add column if not exists guardian_approved_at timestamptz,
  add column if not exists guardian_approved_by uuid references public.profiles (id) on delete set null,
  add column if not exists activated_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles (id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists status_reason text check (char_length(status_reason) <= 500),
  add column if not exists updated_at timestamptz not null default now();
update public.agent_representations set end_date = coalesce(end_date, (created_at + interval '1 year')::date),
  start_date = least(start_date, created_at::date), accepted_at = coalesce(accepted_at, responded_at),
  activated_at = case when status = 'active' then coalesce(activated_at, responded_at, created_at) else activated_at end;
alter table public.agent_representations alter column end_date set not null;
alter table public.agent_representations add constraint rep_dates_valid check (end_date >= start_date and end_date <= start_date + 1830);
alter table public.agent_representations add constraint rep_opportunity_specific
  check ((representation_type = 'opportunity_specific') = (opportunity_id is not null));

drop index if exists public.agent_rep_open_unique;
create unique index agent_rep_open_unique on public.agent_representations (agency_id, athlete_id)
  where status in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'disputed');
create index if not exists rep_athlete_status_idx on public.agent_representations (athlete_id, status);
create index if not exists rep_agency_status_idx on public.agent_representations (agency_id, status, end_date);
create index if not exists fkx_agent_representations_opportunity_id on public.agent_representations (opportunity_id);
create index if not exists fkx_agent_representations_guardian_approved_by on public.agent_representations (guardian_approved_by);
create index if not exists fkx_agent_representations_revoked_by on public.agent_representations (revoked_by);

-- -----------------------------------------------------------------------------------------------------------
-- 2. Ámbito: deporte, territorio y tipo de oportunidad (estructurado, nunca texto libre)
-- -----------------------------------------------------------------------------------------------------------
create table if not exists public.territory_regions (
  region text not null check (region ~ '^[A-Z_]{2,16}$'),
  country text not null check (country ~ '^[A-Z]{2}$'),
  primary key (region, country)
);
alter table public.territory_regions enable row level security;
create policy territory_regions_read on public.territory_regions for select to anon, authenticated using (true);
grant select on public.territory_regions to anon, authenticated;
insert into public.territory_regions (region, country)
select 'EUROPE', c from unnest(array['ES','PT','FR','IT','DE','NL','BE','LU','IE','GB','AT','CH','DK','SE','NO','FI','IS','PL','CZ','SK','HU','SI','HR','RS','BA','ME','MK','AL','GR','CY','MT','RO','BG','EE','LV','LT','UA','MD','AD','MC','SM','LI','TR']) c
union all select 'NORTH_AMERICA', c from unnest(array['US','CA','MX']) c
union all select 'LATAM', c from unnest(array['MX','GT','HN','SV','NI','CR','PA','CU','DO','PR','CO','VE','EC','PE','BO','CL','AR','UY','PY','BR']) c
on conflict do nothing;

create table if not exists public.representation_coverage (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.agent_representations (id) on delete cascade,
  dimension text not null check (dimension in ('sport', 'territory', 'opportunity_type')),
  value text not null check (char_length(value) between 2 and 40),
  created_at timestamptz not null default now(),
  unique (representation_id, dimension, value)
);
alter table public.representation_coverage enable row level security;

create or replace function public.guard_representation_coverage()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('gala.rep_rpc', true) is distinct from 'on' and current_user in ('authenticated', 'anon') then
    raise exception 'representation_rpc_only' using errcode = '42501';
  end if;
  if new.dimension = 'sport' and not exists (select 1 from public.sports where id = new.value) then
    raise exception 'invalid_sport' using errcode = 'P0001';
  elsif new.dimension = 'territory' and not (new.value = 'WORLD' or new.value ~ '^[A-Z]{2}$'
        or exists (select 1 from public.territory_regions where region = new.value)) then
    raise exception 'invalid_territory' using errcode = 'P0001';
  elsif new.dimension = 'opportunity_type' and new.value not in ('university', 'club', 'academy', 'brand') then
    raise exception 'invalid_opportunity_type' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_representation_coverage before insert or update on public.representation_coverage
  for each row execute function public.guard_representation_coverage();

-- Categoría de representación de cada tipo de oportunidad central.
create or replace function public.opportunity_rep_category(p_type public.opportunity_type)
returns text language sql immutable set search_path = public as $$
  select case p_type
    when 'athletic_scholarship' then 'university' when 'university_recruitment' then 'university'
    when 'club_recruitment' then 'club' when 'tryout' then 'club'
    when 'academy' then 'academy' when 'development_program' then 'academy' when 'camp_showcase' then 'academy'
  end;
$$;

-- ¿Se solapan dos conjuntos de territorios? WORLD cubre todo; una región cubre sus países.
create or replace function public.territories_overlap(a text[], b text[])
returns boolean language sql stable set search_path = public as $$
  with ea as (select x from unnest(a) x union select r.country from public.territory_regions r where r.region = any(a)),
       eb as (select x from unnest(b) x union select r.country from public.territory_regions r where r.region = any(b))
  select 'WORLD' = any(a) or 'WORLD' = any(b) or exists (select 1 from ea join eb using (x));
$$;

create or replace function public.territory_covers(p_list text[], p_country text)
returns boolean language sql stable set search_path = public as $$
  select 'WORLD' = any(p_list) or p_country = any(p_list)
      or exists (select 1 from public.territory_regions r where r.region = any(p_list) and r.country = p_country);
$$;

-- -----------------------------------------------------------------------------------------------------------
-- 3. Permisos de la representación (granulares, con historial; nunca full_access)
-- -----------------------------------------------------------------------------------------------------------
create or replace function public.representation_permission_catalog()
returns text[] language sql immutable set search_path = public as $$
  select array['passport.view', 'passport.suggest_edit', 'opportunities.manage', 'pipeline.view', 'pipeline.manage',
               'tasks.manage', 'deadlines.manage', 'documents.view', 'documents.request_share', 'messages.participate',
               'organization.contact', 'offers.view', 'offers.negotiate', 'financial_context.view'];
$$;

create table if not exists public.representation_permissions (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.agent_representations (id) on delete cascade,
  permission text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  constraint permission_in_catalog check (permission = any (array['passport.view', 'passport.suggest_edit', 'opportunities.manage', 'pipeline.view', 'pipeline.manage',
               'tasks.manage', 'deadlines.manage', 'documents.view', 'documents.request_share', 'messages.participate',
               'organization.contact', 'offers.view', 'offers.negotiate', 'financial_context.view']))
);
create unique index if not exists rep_permission_active_unique on public.representation_permissions (representation_id, permission) where status = 'active';
create index if not exists fkx_representation_permissions_granted_by on public.representation_permissions (granted_by);
create index if not exists fkx_representation_permissions_revoked_by on public.representation_permissions (revoked_by);
alter table public.representation_permissions enable row level security;

-- -----------------------------------------------------------------------------------------------------------
-- 4. Asignaciones: qué agente trabaja con el atleta (no es autorización por sí sola)
-- -----------------------------------------------------------------------------------------------------------
create table if not exists public.representation_assignments (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.agent_representations (id) on delete cascade,
  agency_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('primary', 'secondary', 'operations', 'collaborator', 'viewer')),
  assigned_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint assignment_dates check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists rep_one_primary on public.representation_assignments (representation_id) where role = 'primary' and ended_at is null;
create unique index if not exists rep_assignment_active_unique on public.representation_assignments (representation_id, user_id) where ended_at is null;
create index if not exists rep_assignment_user_idx on public.representation_assignments (user_id) where ended_at is null;
create index if not exists fkx_representation_assignments_agency_id on public.representation_assignments (agency_id);
create index if not exists fkx_representation_assignments_assigned_by on public.representation_assignments (assigned_by);
alter table public.representation_assignments enable row level security;

-- Salir de la agencia cierra sus asignaciones (la historia de quién hizo qué se conserva).
create or replace function public.end_assignments_on_member_exit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.representation_assignments set ended_at = now()
   where agency_id = old.organization_id and user_id = old.user_id and ended_at is null;
  return old;
end;
$$;
revoke execute on function public.end_assignments_on_member_exit() from public, anon, authenticated;
drop trigger if exists end_assignments_on_member_exit on public.organization_members;
create trigger end_assignments_on_member_exit after delete on public.organization_members
  for each row execute function public.end_assignments_on_member_exit();

-- -----------------------------------------------------------------------------------------------------------
-- 5. Acuerdo (documento + versión). Subir un PDF no lo convierte en «verificado».
-- -----------------------------------------------------------------------------------------------------------
create table if not exists public.representation_agreements (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.agent_representations (id) on delete cascade,
  version integer not null check (version >= 1),
  document_id uuid references public.athlete_documents (id) on delete set null,
  effective_from date not null,
  effective_until date not null,
  evidence_status text not null default 'declared' check (evidence_status in ('declared', 'documented', 'verified')),
  acceptance_status text not null default 'pending' check (acceptance_status in ('pending', 'accepted', 'rejected')),
  created_by uuid references public.profiles (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (representation_id, version),
  constraint agreement_dates check (effective_until >= effective_from)
);
create index if not exists fkx_representation_agreements_document_id on public.representation_agreements (document_id);
create index if not exists fkx_representation_agreements_created_by on public.representation_agreements (created_by);
create index if not exists fkx_representation_agreements_verified_by on public.representation_agreements (verified_by);
alter table public.representation_agreements enable row level security;

create or replace function public.guard_representation_agreement()
returns trigger language plpgsql set search_path = public as $$
declare v_athlete uuid;
begin
  select athlete_id into v_athlete from public.agent_representations where id = new.representation_id;
  if new.document_id is not null and not exists (select 1 from public.athlete_documents where id = new.document_id and athlete_id = v_athlete) then
    raise exception 'agreement_document_mismatch' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'UPDATE' and (new.representation_id, new.version, new.created_at) is distinct from (old.representation_id, old.version, old.created_at) then
      raise exception 'agreement_immutable' using errcode = '42501';
    end if;
    -- «Verificado» solo lo pone Gala; con documento adjunto pasa a «documentado».
    new.verified_by := case when tg_op = 'UPDATE' then old.verified_by end;
    new.verified_at := case when tg_op = 'UPDATE' then old.verified_at end;
    new.evidence_status := case when tg_op = 'UPDATE' and old.evidence_status = 'verified' and new.document_id is not distinct from old.document_id then 'verified'
                                when new.document_id is not null then 'documented' else 'declared' end;
  end if;
  return new;
end;
$$;
create trigger guard_representation_agreement before insert or update on public.representation_agreements
  for each row execute function public.guard_representation_agreement();

-- -----------------------------------------------------------------------------------------------------------
-- 6. Conflictos (Gala detecta solapes; no decide qué contrato prevalece)
-- -----------------------------------------------------------------------------------------------------------
create table if not exists public.representation_conflicts (
  id uuid primary key default gen_random_uuid(),
  representation_id uuid not null references public.agent_representations (id) on delete cascade,
  conflicting_id uuid not null references public.agent_representations (id) on delete cascade,
  overlap jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution text check (char_length(resolution) <= 1000),
  constraint conflict_distinct check (representation_id <> conflicting_id)
);
create unique index if not exists rep_conflict_open_unique on public.representation_conflicts (representation_id, conflicting_id) where status = 'open';
create index if not exists fkx_representation_conflicts_conflicting_id on public.representation_conflicts (conflicting_id);
create index if not exists fkx_representation_conflicts_resolved_by on public.representation_conflicts (resolved_by);
alter table public.representation_conflicts enable row level security;

-- -----------------------------------------------------------------------------------------------------------
-- 7. Guarda de la tabla central: el cliente no escribe estados ni fechas; solo las RPC
-- -----------------------------------------------------------------------------------------------------------
create or replace function public.guard_agent_representation()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if current_setting('gala.rep_rpc', true) = 'on' or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'representation_rpc_only' using errcode = '42501';
  end if;
  -- Solo el mensaje es editable por la agencia mientras la solicitud está pendiente.
  if (to_jsonb(new) - 'message' - 'updated_at') is distinct from (to_jsonb(old) - 'message' - 'updated_at')
     or old.status <> 'requested' or not public.is_org_member(old.agency_id) then
    raise exception 'representation_rpc_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------------------------------------
-- 8. Helpers de lectura
-- -----------------------------------------------------------------------------------------------------------
create or replace function public.representation_effective(p_rep uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agent_representations r
                  where r.id = p_rep and r.status = 'active' and current_date between r.start_date and r.end_date);
$$;

-- ¿Cubre la representación esta combinación? null = dimensión no consultada.
create or replace function public.representation_covers(p_rep uuid, p_sport text, p_country text, p_category text, p_opportunity uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (p_sport is null or exists (select 1 from public.representation_coverage c where c.representation_id = p_rep and c.dimension = 'sport' and c.value = p_sport))
     and (p_country is null or public.territory_covers(array(select value from public.representation_coverage c where c.representation_id = p_rep and c.dimension = 'territory'), p_country))
     and (p_category is null or exists (select 1 from public.representation_coverage c where c.representation_id = p_rep and c.dimension = 'opportunity_type' and c.value = p_category))
     and (p_opportunity is null or not exists (select 1 from public.agent_representations r where r.id = p_rep and r.representation_type = 'opportunity_specific' and r.opportunity_id is distinct from p_opportunity));
$$;

-- Autorización central del agente (la usará 12B en cada policy): representación efectiva + asignación activa
-- del usuario + permiso activo + ámbito. Ser admin de la agencia NO basta.
create or replace function public.agent_can(p_athlete uuid, p_permission text, p_sport text default null, p_country text default null,
                                            p_category text default null, p_opportunity uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_representations r
      join public.representation_assignments a on a.representation_id = r.id and a.user_id = auth.uid() and a.ended_at is null
      join public.organization_members m on m.organization_id = r.agency_id and m.user_id = auth.uid()
      join public.organizations o on o.id = r.agency_id and o.verification_status = 'verified' and o.org_status = 'active'
      join public.representation_permissions p on p.representation_id = r.id and p.permission = p_permission and p.status = 'active'
                                              and (p.expires_at is null or p.expires_at > now())
     where r.athlete_id = p_athlete and r.status = 'active' and current_date between r.start_date and r.end_date
       and (a.role <> 'viewer' or p_permission in ('passport.view', 'pipeline.view', 'offers.view', 'documents.view'))
       and public.representation_covers(r.id, p_sport, p_country, p_category, p_opportunity)
  );
$$;

create or replace function public.agency_has_active_representation(p_agency uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agent_representations r
                  where r.agency_id = p_agency and r.athlete_id = p_athlete and r.status = 'active'
                    and current_date between r.start_date and r.end_date);
$$;

create or replace function public.is_active_agent_for(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_representations r
      join public.representation_assignments a on a.representation_id = r.id and a.user_id = auth.uid() and a.ended_at is null
      join public.organization_members m on m.organization_id = r.agency_id and m.user_id = auth.uid()
     where r.athlete_id = p_athlete and r.status = 'active' and current_date between r.start_date and r.end_date
  );
$$;

-- Roster derivado (nunca una lista manual). security_invoker: cada uno ve lo que su RLS le deja.
create or replace view public.agency_roster with (security_invoker = true) as
select r.id as representation_id, r.agency_id, r.athlete_id, r.representation_type, r.start_date, r.end_date,
       case when r.status = 'active' and current_date > r.end_date then 'expired'
            when r.status = 'active' and r.end_date - current_date <= 30 then 'expiring'
            else r.status end as roster_status,
       (select a.user_id from public.representation_assignments a where a.representation_id = r.id and a.role = 'primary' and a.ended_at is null) as primary_agent_id
  from public.agent_representations r
 where r.status in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'disputed');
grant select on public.agency_roster to authenticated;

-- El consentimiento del tutor para representar a un menor usa el modelo central de consentimientos.
alter table public.consents drop constraint if exists consents_purpose_check;
alter table public.consents add constraint consents_purpose_check check (purpose in ('terms', 'privacy_notice', 'profile_discoverable', 'guardian_consent',
  'marketing_email', 'media_rights', 'trial_participation', 'academy_enrollment', 'document_sharing', 'travel', 'contact', 'representation'));
alter table public.consents drop constraint if exists consents_target_type_check;
alter table public.consents add constraint consents_target_type_check check (target_type in ('opportunity', 'registration', 'application', 'enrollment', 'document', 'organization', 'representation'));

create or replace function public.is_minor_guardian_of(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_minor(p_athlete) and public.is_active_guardian(p_athlete);
$$;
revoke execute on function public.is_minor_guardian_of(uuid) from public, anon;
grant execute on function public.is_minor_guardian_of(uuid) to authenticated;


-- -----------------------------------------------------------------------------------------------------------
-- Invitación desde el lado del atleta: la vía para menores (no descubribles por agencias) y para quien prefiere
-- elegir agencia. Abre la puerta a UNA propuesta de esa agencia durante 30 días; no da acceso a nada más.
-- -----------------------------------------------------------------------------------------------------------
create table if not exists public.representation_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'used', 'cancelled')),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists rep_invitations_open on public.representation_invitations (agency_id, athlete_id) where status = 'open';
create index if not exists rep_invitations_athlete on public.representation_invitations (athlete_id);
create index if not exists rep_invitations_invited_by on public.representation_invitations (invited_by);
alter table public.representation_invitations enable row level security;

create or replace function public.representation_invite(p_agency uuid, p_athlete uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not (auth.uid() = p_athlete or public.is_minor_guardian_of(p_athlete)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = p_agency and type = 'agency' and verification_status = 'verified' and org_status = 'active') then
    raise exception 'agency_not_verified' using errcode = '42501';
  end if;
  select id into v_id from public.representation_invitations where agency_id = p_agency and athlete_id = p_athlete and status = 'open' and expires_at > now();
  if v_id is not null then return v_id; end if;
  update public.representation_invitations set status = 'cancelled' where agency_id = p_agency and athlete_id = p_athlete and status = 'open';
  insert into public.representation_invitations (agency_id, athlete_id, invited_by) values (p_agency, p_athlete, auth.uid()) returning id into v_id;
  perform public.notify(m.user_id, 'representation.invited', 'Te invitan a proponer una representación',
          'Un atleta quiere conocer vuestra propuesta. Tenéis 30 días para enviarla.', '/app/portfolio')
     from public.organization_members m where m.organization_id = p_agency and (m.member_role::text in ('owner', 'admin') or m.agency_role in ('owner', 'admin', 'manager'));
  perform public.audit('representation_invited', 'representation_invitation', v_id, p_agency, '{}'::jsonb, null, 'security', null);
  return v_id;
end;
$$;

create policy rep_invitations_select on public.representation_invitations for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_minor_guardian_of(athlete_id) or public.is_org_member(agency_id) or public.is_admin());
grant select on public.representation_invitations to authenticated;

-- -----------------------------------------------------------------------------------------------------------
-- 9. Transiciones (funciones transaccionales). Nadie activa una representación de forma unilateral.
-- -----------------------------------------------------------------------------------------------------------
create or replace function public.rep_set(p_on boolean)
returns void language sql set search_path = public as $$
  select set_config('gala.rep_rpc', case when p_on then 'on' else '' end, true);
$$;
revoke execute on function public.rep_set(boolean) from public, anon, authenticated;

create or replace function public.agency_manages(p_agency uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                  where m.organization_id = p_agency and m.user_id = auth.uid()
                    and (m.member_role::text in ('owner', 'admin') or m.agency_role in ('owner', 'admin', 'manager')));
$$;

create or replace function public.representation_request(
  p_agency uuid, p_athlete uuid, p_type text, p_sports text[], p_territories text[], p_categories text[],
  p_permissions text[], p_end date, p_start date default current_date, p_opportunity uuid default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_perm text;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if not (public.has_role('agent') and public.agency_can_write(p_agency)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = p_agency and type = 'agency' and verification_status = 'verified' and org_status = 'active') then
    raise exception 'agency_not_verified' using errcode = '42501';
  end if;
  -- Un menor no es descubrible por agencias: solo recibe propuestas de una agencia que él o su familia invitaron.
  if not exists (select 1 from public.athlete_profiles where user_id = p_athlete)
     or not (public.can_view_athlete(p_athlete)
             or exists (select 1 from public.representation_invitations i where i.agency_id = p_agency and i.athlete_id = p_athlete
                         and i.status = 'open' and i.expires_at > now())) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.athlete_blocks_org(p_athlete, p_agency) or public.is_blocked_by_athlete(p_athlete) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_type not in ('exclusive', 'non_exclusive', 'opportunity_specific') then raise exception 'invalid_type' using errcode = 'P0001'; end if;
  if coalesce(array_length(p_sports, 1), 0) = 0 or coalesce(array_length(p_categories, 1), 0) = 0 then raise exception 'scope_required' using errcode = 'P0001'; end if;
  if coalesce(array_length(p_permissions, 1), 0) = 0 or not (p_permissions <@ public.representation_permission_catalog()) then raise exception 'invalid_permission' using errcode = 'P0001'; end if;
  if p_start < current_date or p_end < p_start or p_end > p_start + 1095 then raise exception 'invalid_dates' using errcode = 'P0001'; end if;

  -- Idempotente: una petición abierta de esta agencia a este atleta se devuelve tal cual.
  select id into v_id from public.agent_representations
   where agency_id = p_agency and athlete_id = p_athlete and status in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'disputed');
  if v_id is not null then return v_id; end if;

  perform public.rep_set(true);
  insert into public.agent_representations (agency_id, agent_id, athlete_id, status, representation_type, start_date, end_date, opportunity_id, source, message)
  values (p_agency, auth.uid(), p_athlete, 'requested', p_type, p_start, p_end, p_opportunity, 'agency_request', left(p_message, 1000))
  returning id into v_id;
  insert into public.representation_coverage (representation_id, dimension, value)
  select v_id, 'sport', s from unnest(p_sports) s
  union select v_id, 'territory', t from unnest(coalesce(nullif(p_territories, '{}'), array['WORLD'])) t
  union select v_id, 'opportunity_type', c from unnest(p_categories) c;
  foreach v_perm in array (select array_agg(distinct x) from unnest(p_permissions) x) loop
    insert into public.representation_permissions (representation_id, permission, granted_by) values (v_id, v_perm, null);
  end loop;
  insert into public.representation_assignments (representation_id, agency_id, user_id, role, assigned_by)
  values (v_id, p_agency, auth.uid(), 'primary', auth.uid());
  perform public.rep_set(false);

  update public.representation_invitations set status = 'used', used_at = now()
   where agency_id = p_agency and athlete_id = p_athlete and status = 'open';
  perform public.notify(p_athlete, 'representation.requested', 'Solicitud de representación', 'Una agencia quiere representarte. Revisa el alcance antes de decidir.', '/app/agents');
  perform public.audit('representation_requested', 'agent_representation', v_id, p_agency, jsonb_build_object('type', p_type), null, 'security', null);
  return v_id;
end;
$$;

-- Activación: bloquea las representaciones del atleta, comprueba todas las condiciones y detecta conflictos.
create or replace function public.representation_activate(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; o record; v_conflicts integer := 0;
begin
  select * into r from public.agent_representations where id = p_id;
  perform pg_advisory_xact_lock(hashtext('rep:' || r.athlete_id::text));
  select * into r from public.agent_representations where id = p_id for update;
  if r.status not in ('requested', 'pending_guardian', 'pending_review') then return r.status; end if;
  if r.accepted_at is null then raise exception 'athlete_acceptance_required' using errcode = '42501'; end if;
  if public.is_minor(r.athlete_id) and r.guardian_approved_at is null then raise exception 'guardian_approval_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations where id = r.agency_id and verification_status = 'verified' and org_status = 'active') then
    raise exception 'agency_not_verified' using errcode = '42501';
  end if;

  for o in
    select x.id, x.representation_type from public.agent_representations x
     where x.athlete_id = r.athlete_id and x.id <> r.id and x.status in ('active', 'pending_review', 'suspended', 'disputed')
       and x.start_date <= r.end_date and r.start_date <= x.end_date
       and (x.representation_type = 'exclusive' or r.representation_type = 'exclusive')
       and exists (select 1 from public.representation_coverage a join public.representation_coverage b on b.value = a.value and b.dimension = 'sport'
                    where a.representation_id = r.id and a.dimension = 'sport' and b.representation_id = x.id)
       and exists (select 1 from public.representation_coverage a join public.representation_coverage b on b.value = a.value and b.dimension = 'opportunity_type'
                    where a.representation_id = r.id and a.dimension = 'opportunity_type' and b.representation_id = x.id)
       and public.territories_overlap(
             array(select value from public.representation_coverage where representation_id = r.id and dimension = 'territory'),
             array(select value from public.representation_coverage where representation_id = x.id and dimension = 'territory'))
  loop
    insert into public.representation_conflicts (representation_id, conflicting_id, overlap)
    values (r.id, o.id, jsonb_build_object('exclusive', true)) on conflict do nothing;
    v_conflicts := v_conflicts + 1;
  end loop;

  perform public.rep_set(true);
  if v_conflicts > 0 then
    update public.agent_representations set status = 'pending_review', status_reason = 'Solapa con otra representación exclusiva' where id = r.id;
    perform public.rep_set(false);
    perform public.notify(r.athlete_id, 'representation.conflict', 'Representación pendiente de revisión', 'Dos representaciones se solapan en deporte, territorio y tipo de oportunidad. Gala lo revisa antes de activarla.', '/app/agents');
    perform public.audit('representation_conflict_detected', 'agent_representation', r.id, r.agency_id, jsonb_build_object('conflicts', v_conflicts), null, 'security', null);
    return 'pending_review';
  end if;
  update public.agent_representations set status = 'active', activated_at = now(), status_reason = null where id = r.id;
  perform public.rep_set(false);
  perform public.notify(r.agent_id, 'representation.active', 'Representación activa', 'El atleta ha aceptado. Ya puedes trabajar dentro del alcance acordado.', '/app/portfolio');
  perform public.audit('representation_activated', 'agent_representation', r.id, r.agency_id, '{}'::jsonb, null, 'security', null);
  return 'active';
end;
$$;
revoke execute on function public.representation_activate(uuid) from public, anon, authenticated;

create or replace function public.representation_respond(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r public.agent_representations;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or r.athlete_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status <> 'requested' then return r.status; end if;  -- idempotente
  perform public.rep_set(true);
  if not p_accept then
    update public.agent_representations set status = 'declined', responded_at = now() where id = p_id;
    perform public.rep_set(false);
    perform public.audit('representation_declined', 'agent_representation', p_id, r.agency_id, '{}'::jsonb, null, 'security', null);
    return 'declined';
  end if;
  update public.agent_representations set accepted_at = now(), responded_at = now(),
         status = case when public.is_minor(r.athlete_id) then 'pending_guardian' else status end where id = p_id;
  perform public.rep_set(false);
  perform public.audit('athlete_approved', 'agent_representation', p_id, r.agency_id, '{}'::jsonb, null, 'security', null);
  if public.is_minor(r.athlete_id) then
    perform public.notify(l.parent_id, 'representation.guardian', 'Tu aprobación es necesaria', 'Una agencia quiere representar a tu hijo o hija. Revisa el alcance y decide.', '/app/family/safety')
       from public.parent_athlete_links l where l.athlete_id = r.athlete_id and l.status = 'approved';
    return 'pending_guardian';
  end if;
  return public.representation_activate(p_id);
end;
$$;

create or replace function public.representation_guardian_decide(p_id uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r public.agent_representations;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or not (public.is_minor(r.athlete_id) and public.is_active_guardian(r.athlete_id)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status <> 'pending_guardian' then return r.status; end if;
  perform public.rep_set(true);
  if not p_approve then
    update public.agent_representations set status = 'declined', status_reason = 'La familia no lo aprobó' where id = p_id;
    perform public.rep_set(false);
    perform public.audit('guardian_declined', 'agent_representation', p_id, r.agency_id, '{}'::jsonb, null, 'security', null);
    return 'declined';
  end if;
  update public.agent_representations set guardian_approved_at = now(), guardian_approved_by = auth.uid() where id = p_id;
  perform public.rep_set(false);
  insert into public.consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, expires_at)
  values (r.athlete_id, auth.uid(), 'representation', 'representation-2026-11', true, 'representation', r.id, r.agency_id, (r.end_date + 1)::timestamptz);
  perform public.audit('guardian_approved', 'agent_representation', p_id, r.agency_id, '{}'::jsonb, null, 'security', null);
  return public.representation_activate(p_id);
end;
$$;

-- Revocar (atleta o su tutor), terminar (la agencia) o retirar una propuesta. Efecto inmediato.
create or replace function public.representation_end(p_id uuid, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_new text;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status not in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'disputed') then return r.status; end if;
  if auth.uid() = r.athlete_id or (public.is_minor(r.athlete_id) and public.is_active_guardian(r.athlete_id)) then
    v_new := case when r.status in ('requested', 'pending_guardian') then 'declined' else 'revoked' end;
  elsif public.agency_manages(r.agency_id) or (r.status = 'requested' and r.agent_id = auth.uid()) then
    v_new := 'terminated';
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.rep_set(true);
  update public.agent_representations set status = v_new, revoked_at = now(), revoked_by = auth.uid(), ended_at = now(),
         status_reason = left(p_reason, 500) where id = p_id;
  update public.representation_assignments set ended_at = now() where representation_id = p_id and ended_at is null;
  perform public.rep_set(false);
  perform public.notify(case when auth.uid() = r.athlete_id then r.agent_id else r.athlete_id end, 'representation.ended',
          'Representación finalizada', 'La representación ha terminado. El proceso, los documentos y las ofertas del atleta no cambian.', '/app/agents');
  perform public.audit('representation_' || v_new, 'agent_representation', p_id, r.agency_id, '{}'::jsonb, p_reason, 'security', null);
  return v_new;
end;
$$;

create or replace function public.representation_suspend(p_id uuid, p_suspend boolean, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_new text;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into r from public.agent_representations where id = p_id for update;
  if p_suspend and r.status = 'active' then v_new := 'suspended';
  elsif not p_suspend and r.status = 'suspended' then v_new := case when current_date > r.end_date then 'expired' else 'active' end;
  else return r.status; end if;
  perform public.rep_set(true);
  update public.agent_representations set status = v_new, suspended_at = case when p_suspend then now() end, status_reason = left(p_reason, 500) where id = p_id;
  perform public.rep_set(false);
  perform public.audit(case when p_suspend then 'representation_suspended' else 'representation_reinstated' end, 'agent_representation', p_id, r.agency_id, '{}'::jsonb, p_reason, 'security', null);
  return v_new;
end;
$$;

-- Caducidad por fecha (job diario). Idempotente: una segunda ejecución no cambia nada.
create or replace function public.representation_expire_due()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.rep_set(true);
  with e as (
    update public.agent_representations set status = 'expired', ended_at = now()
     where status in ('active', 'suspended') and end_date < current_date returning id, agency_id
  ), a as (
    update public.representation_assignments set ended_at = now() where representation_id in (select id from e) and ended_at is null
  )
  select count(*) into n from e;
  perform public.rep_set(false);
  insert into public.audit_logs (action, entity, entity_id, details)
  select 'representation_expired', 'agent_representation', r.id, '{}'::jsonb from public.agent_representations r
   where r.status = 'expired' and r.ended_at >= now() - interval '1 minute';
  return n;
end;
$$;
revoke execute on function public.representation_expire_due() from public, anon, authenticated;

-- Renovar: decisión explícita del atleta (o de su tutor si es menor). Nunca automática.
create or replace function public.representation_renew(p_id uuid, p_end date)
returns void language plpgsql security definer set search_path = public as $$
declare r public.agent_representations;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or not (auth.uid() = r.athlete_id and not public.is_minor(r.athlete_id) or public.is_minor(r.athlete_id) and public.is_active_guardian(r.athlete_id)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'active' or p_end <= r.end_date or p_end > current_date + 1095 then raise exception 'invalid_renewal' using errcode = 'P0001'; end if;
  perform public.rep_set(true);
  update public.agent_representations set end_date = p_end where id = p_id;
  perform public.rep_set(false);
  perform public.audit('representation_renewed', 'agent_representation', p_id, r.agency_id, jsonb_build_object('from', r.end_date, 'to', p_end), null, 'security', null);
end;
$$;

-- El atleta (o su tutor) decide los permisos. Retirar uno conserva el historial.
create or replace function public.representation_set_permissions(p_id uuid, p_permissions text[])
returns void language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_perm text;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or not (auth.uid() = r.athlete_id or public.is_minor(r.athlete_id) and public.is_active_guardian(r.athlete_id)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (coalesce(p_permissions, '{}') <@ public.representation_permission_catalog()) then raise exception 'invalid_permission' using errcode = 'P0001'; end if;
  update public.representation_permissions set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
   where representation_id = p_id and status = 'active' and not (permission = any(coalesce(p_permissions, '{}')));
  foreach v_perm in array coalesce(p_permissions, '{}') loop
    insert into public.representation_permissions (representation_id, permission, granted_by)
    select p_id, v_perm, auth.uid()
     where not exists (select 1 from public.representation_permissions where representation_id = p_id and permission = v_perm and status = 'active');
  end loop;
  perform public.audit('representation_scope_changed', 'agent_representation', p_id, r.agency_id, jsonb_build_object('permissions', p_permissions), null, 'security', null);
end;
$$;

create or replace function public.representation_assign(p_id uuid, p_user uuid, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_id uuid;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or not public.agency_manages(r.agency_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_role not in ('primary', 'secondary', 'operations', 'collaborator', 'viewer') then raise exception 'invalid_role' using errcode = 'P0001'; end if;
  if r.status not in ('requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'disputed') then raise exception 'representation_closed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.organization_members where organization_id = r.agency_id and user_id = p_user) then raise exception 'not_agency_member' using errcode = 'P0001'; end if;
  update public.representation_assignments set ended_at = now()
   where representation_id = p_id and ended_at is null and (user_id = p_user or (p_role = 'primary' and role = 'primary'));
  insert into public.representation_assignments (representation_id, agency_id, user_id, role, assigned_by)
  values (p_id, r.agency_id, p_user, p_role, auth.uid()) returning id into v_id;
  perform public.audit(case when p_role = 'primary' then 'primary_agent_assigned' else 'agent_assigned' end, 'agent_representation', p_id, r.agency_id,
                       jsonb_build_object('user', p_user, 'role', p_role), null, 'security', null);
  return v_id;
end;
$$;

create or replace function public.representation_unassign(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.representation_assignments;
begin
  select * into a from public.representation_assignments where id = p_assignment for update;
  if a.id is null or not public.agency_manages(a.agency_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.representation_assignments set ended_at = now() where id = p_assignment and ended_at is null;
end;
$$;

create or replace function public.representation_add_agreement(p_id uuid, p_document uuid, p_from date, p_until date)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_id uuid;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or not (auth.uid() = r.athlete_id or public.agency_manages(r.agency_id)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.representation_agreements (representation_id, version, document_id, effective_from, effective_until, created_by)
  values (p_id, coalesce((select max(version) from public.representation_agreements where representation_id = p_id), 0) + 1, p_document, p_from, p_until, auth.uid())
  returning id into v_id;
  perform public.audit('representation_agreement_added', 'agent_representation', p_id, r.agency_id, jsonb_build_object('agreement', v_id), null, 'security', null);
  return v_id;
end;
$$;

-- Gala resuelve el conflicto operativo (no el jurídico) y, si procede, activa una de las dos.
create or replace function public.representation_conflict_resolve(p_conflict uuid, p_resolution text, p_activate uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.representation_conflicts;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  select * into c from public.representation_conflicts where id = p_conflict for update;
  if c.id is null or c.status <> 'open' then return; end if;
  update public.representation_conflicts set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), resolution = left(p_resolution, 1000) where id = p_conflict;
  if p_activate is not null and p_activate in (c.representation_id, c.conflicting_id)
     and not exists (select 1 from public.representation_conflicts where status = 'open' and p_activate in (representation_id, conflicting_id)) then
    perform public.rep_set(true);
    update public.agent_representations set status = 'active', activated_at = now(), status_reason = null where id = p_activate and status = 'pending_review';
    perform public.rep_set(false);
  end if;
  perform public.audit('representation_conflict_resolved', 'representation_conflict', p_conflict, null, jsonb_build_object('activated', p_activate), p_resolution, 'security', null);
end;
$$;

-- Relación (para notas internas e historial): cualquier estado salvo una solicitud rechazada.
create or replace function public.agency_has_relationship(p_agency uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_agency) and exists (
    select 1 from public.agent_representations r
     where r.agency_id = p_agency and r.athlete_id = p_athlete and r.status <> 'declined'
  );
$$;

-- -----------------------------------------------------------------------------------------------------------
-- 10. Visibilidad (12B la amplía a cada recurso del atleta)
-- -----------------------------------------------------------------------------------------------------------
create or replace function public.can_see_representation(p_rep uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agent_representations r
                  where r.id = p_rep and (r.athlete_id = auth.uid() or public.is_org_member(r.agency_id) or public.is_admin()
                                          or (public.is_minor(r.athlete_id) and public.is_active_guardian(r.athlete_id))));
$$;

drop policy if exists rep_select on public.agent_representations;
drop policy if exists rep_insert on public.agent_representations;
create policy rep_select on public.agent_representations for select to authenticated
  using (athlete_id = (select auth.uid()) or public.is_org_member(agency_id) or public.is_admin()
         or public.is_minor_guardian_of(athlete_id));

create policy coverage_select on public.representation_coverage for select to authenticated using (public.can_see_representation(representation_id));
create policy permissions_select on public.representation_permissions for select to authenticated using (public.can_see_representation(representation_id));
create policy assignments_select on public.representation_assignments for select to authenticated using (public.can_see_representation(representation_id));
create policy conflicts_select on public.representation_conflicts for select to authenticated
  using (public.is_admin() or public.can_see_representation(representation_id));
-- El acuerdo: atleta, su tutor (menor), quien gestiona la agencia o está asignado, y Gala. Nunca terceros.
create policy agreements_select on public.representation_agreements for select to authenticated
  using (exists (select 1 from public.agent_representations r where r.id = representation_id
                  and (r.athlete_id = (select auth.uid()) or public.is_admin() or public.agency_manages(r.agency_id)
                       or public.is_minor_guardian_of(r.athlete_id)
                       or exists (select 1 from public.representation_assignments a where a.representation_id = r.id and a.user_id = (select auth.uid()) and a.ended_at is null))));

grant select on public.representation_coverage, public.representation_permissions, public.representation_assignments,
  public.representation_agreements, public.representation_conflicts to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'agency_manages(uuid)', 'representation_effective(uuid)', 'representation_covers(uuid, text, text, text, uuid)',
    'agent_can(uuid, text, text, text, text, uuid)', 'can_see_representation(uuid)',
    'representation_request(uuid, uuid, text, text[], text[], text[], text[], date, date, uuid, text)',
    'representation_respond(uuid, boolean)', 'representation_guardian_decide(uuid, boolean)', 'representation_end(uuid, text)',
    'representation_suspend(uuid, boolean, text)', 'representation_renew(uuid, date)', 'representation_set_permissions(uuid, text[])',
    'representation_assign(uuid, uuid, text)', 'representation_unassign(uuid)', 'representation_add_agreement(uuid, uuid, date, date)',
    'representation_conflict_resolve(uuid, text, uuid)', 'representation_invite(uuid, uuid)', 'territories_overlap(text[], text[])', 'territory_covers(text[], text)',
    'opportunity_rep_category(public.opportunity_type)', 'representation_permission_catalog()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.guard_representation_coverage() from public, anon, authenticated;
revoke execute on function public.guard_representation_agreement() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-representations', '20 3 * * *', 'select public.representation_expire_due()');
  end if;
exception when others then null;
end $$;

/* ROLLBACK (manual): drop las tablas representation_* y territory_regions, la vista agency_roster y las funciones nuevas;
   restaurar el check de status ('requested','active','declined','ended') tras mapear terminated/revoked/expired → ended,
   y las policies rep_select/rep_insert de 20261113000300_portals.sql. */
