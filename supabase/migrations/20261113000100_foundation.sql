-- =============================================================================
-- The Gala Alliance · Sports Opportunity OS · Fase 1 (foundation)
-- -----------------------------------------------------------------------------
-- Plataforma multilado para becas deportivas en EE. UU. con 6 tipos de usuario:
--   athlete · parent (familia) · university (cuenta institucional) · coach (persona que
--   recluta, de una universidad o de un club) · agent · brand
-- más admin (Trust & Safety).
--
-- Principios (ver Blueprint "Sports Opportunity OS"):
--   * Autorización en la base de datos (RLS), nunca solo en el frontend.
--   * Menores protegidos por defecto: no indexables, no visibles para marcas,
--     agentes ni anónimos; solo organizaciones educativas/deportivas verificadas.
--   * COPPA: no se admiten cuentas de menores de 13 años.
--   * Datos sensibles (fecha de nacimiento, email) separados del perfil visible.
--   * Historiales inmutables (estado de candidaturas, auditoría, consentimientos).
--   * Nada se publica sin revisión: oportunidades y organizaciones pasan por admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('athlete', 'parent', 'university', 'coach', 'agent', 'brand', 'admin');
create type public.visibility_level as enum ('public', 'members', 'connections', 'private');
create type public.data_source as enum ('self_reported', 'documented', 'club_verified');
create type public.link_status as enum ('pending', 'approved', 'revoked');
create type public.org_type as enum ('university', 'college', 'club', 'academy', 'agency', 'brand');
create type public.verification_status as enum ('unverified', 'submitted', 'verified', 'rejected');
create type public.division as enum ('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa');
create type public.opportunity_type as enum ('athletic_scholarship', 'university_recruitment', 'club_recruitment', 'academy', 'tryout', 'camp_showcase');
create type public.opportunity_status as enum ('draft', 'pending_review', 'published', 'rejected', 'expired');
create type public.application_status as enum (
  'applied', 'reviewed', 'contacted', 'information_requested', 'interview', 'tryout',
  'shortlist', 'offer', 'accepted', 'declined', 'withdrawn'
);
create type public.org_member_role as enum ('admin', 'recruiter', 'coach');

-- -----------------------------------------------------------------------------
-- 2. Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Identidad: perfil visible + datos privados + roles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  primary_role public.app_role,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Datos mínimos visibles de cualquier usuario. Nada sensible aquí.';

create table public.private_profile_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  date_of_birth date not null,
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dob_not_future check (date_of_birth <= current_date),
  -- COPPA: la plataforma no se dirige a menores de 13 ni acepta sus datos.
  constraint coppa_minimum_age check (date_of_birth <= (current_date - interval '13 years'))
);
comment on table public.private_profile_data is 'Solo propietario y admin. La edad se usa para reglas de menores vía funciones SECURITY DEFINER.';

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Crea el perfil vacío al registrarse (el email nunca se copia a tablas públicas).
-- La fecha de nacimiento llega en los metadatos del registro y se guarda aparte;
-- si implica menos de 13 años, la restricción COPPA hace fallar el alta completa:
-- la cuenta no llega a existir.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dob text := new.raw_user_meta_data ->> 'date_of_birth';
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 120), ''));
  if v_dob is not null and v_dob ~ '^\d{4}-\d{2}-\d{2}$' then
    insert into public.private_profile_data (user_id, date_of_birth) values (new.id, v_dob::date);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Funciones de autorización (SECURITY DEFINER para evitar recursión de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

create or replace function public.is_minor(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  -- Sin fecha de nacimiento se trata como menor: protección por defecto.
  select coalesce(
    (select date_of_birth > (current_date - interval '18 years')
       from public.private_profile_data where user_id = p_user),
    true
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. Catálogo deportivo extensible (no hardcodeado en React)
-- -----------------------------------------------------------------------------
create table public.sports (
  id text primary key check (id ~ '^[a-z_]+$'),
  name_es text not null,
  name_en text not null,
  active boolean not null default true
);

create table public.sport_positions (
  id serial primary key,
  sport_id text not null references public.sports (id) on delete cascade,
  code text not null,
  name_es text not null,
  name_en text not null,
  unique (sport_id, code)
);

create table public.sport_stat_definitions (
  id serial primary key,
  sport_id text not null references public.sports (id) on delete cascade,
  code text not null,
  label_es text not null,
  label_en text not null,
  unit text,
  higher_is_better boolean not null default true,
  sort_order int not null default 0,
  unique (sport_id, code)
);

-- -----------------------------------------------------------------------------
-- 6. Athlete Opportunity Passport
-- -----------------------------------------------------------------------------
create table public.athlete_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text check (char_length(headline) <= 160),
  bio text check (char_length(bio) <= 2000),
  sport_id text references public.sports (id),
  primary_position_id int references public.sport_positions (id),
  secondary_position_id int references public.sport_positions (id),
  graduation_year int check (graduation_year between 2020 and 2040),
  height_cm int check (height_cm between 100 and 250),
  dominant_side text check (dominant_side in ('left', 'right', 'both')),
  current_team text check (char_length(current_team) <= 160),
  competitive_level text check (char_length(competitive_level) <= 120),
  city text check (char_length(city) <= 120),
  target_divisions public.division[] not null default '{}',
  intended_major text check (char_length(intended_major) <= 160),
  open_to_opportunities boolean not null default true,
  highlight_video_url text check (highlight_video_url is null or highlight_video_url ~ '^https://'),
  -- Visibilidad por bloque. Los menores se protegen además en can_view_athlete().
  profile_visibility public.visibility_level not null default 'members',
  academics_visibility public.visibility_level not null default 'connections',
  stats_visibility public.visibility_level not null default 'members',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint positions_differ check (secondary_position_id is null or secondary_position_id <> primary_position_id)
);
create index athlete_profiles_search_idx on public.athlete_profiles (sport_id, graduation_year, primary_position_id)
  where open_to_opportunities;

create table public.athlete_academics (
  athlete_id uuid primary key references public.athlete_profiles (user_id) on delete cascade,
  gpa numeric(4, 2) check (gpa >= 0),
  gpa_scale numeric(4, 2) not null default 4.0 check (gpa_scale in (4.0, 5.0, 10.0, 20.0)),
  -- Aproximación lineal a escala 4.0 para filtrar y comparar. No es la conversión oficial NCAA.
  gpa_4 numeric(3, 2) generated always as (round(gpa / gpa_scale * 4, 2)) stored,
  english_test text check (english_test in ('toefl', 'ielts', 'duolingo', 'cambridge', 'none')),
  english_score text check (char_length(english_score) <= 20),
  sat_score int check (sat_score between 400 and 1600),
  act_score int check (act_score between 1 and 36),
  school_year text check (school_year in ('eso_3', 'eso_4', 'bach_1', 'bach_2', 'graduated', 'college')),
  updated_at timestamptz not null default now(),
  constraint gpa_within_scale check (gpa is null or gpa <= gpa_scale)
);

-- Datos económicos de la familia: nunca en el perfil visible.
create index athlete_academics_gpa4_idx on public.athlete_academics (gpa_4);

create table public.athlete_finances (
  athlete_id uuid primary key references public.athlete_profiles (user_id) on delete cascade,
  annual_budget_usd int check (annual_budget_usd between 0 and 200000),
  updated_at timestamptz not null default now()
);

create table public.athlete_statistics (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  stat_definition_id int not null references public.sport_stat_definitions (id),
  season text not null check (season ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  value numeric not null,
  source public.data_source not null default 'self_reported',
  created_at timestamptz not null default now(),
  unique (athlete_id, stat_definition_id, season)
);

create table public.athlete_languages (
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  language_code text not null check (language_code ~ '^[a-z]{2}$'),
  level text not null check (level in ('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native')),
  primary key (athlete_id, language_code)
);

create table public.athlete_achievements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  year int check (year between 2000 and 2040),
  description text check (char_length(description) <= 600),
  source public.data_source not null default 'self_reported',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 7. Familia ↔ atleta (invitación con token, permisos granulares, auditables)
-- -----------------------------------------------------------------------------
create table public.parent_athlete_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles (id) on delete cascade,
  athlete_id uuid references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  -- 244 bits aleatorios (gen_random_uuid es nativo de Postgres, sin extensiones).
  invitation_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status public.link_status not null default 'pending',
  relationship text not null default 'parent' check (relationship in ('parent', 'legal_guardian', 'other_family')),
  can_view_profile boolean not null default true,
  can_edit_profile boolean not null default false,
  can_view_applications boolean not null default true,
  can_view_academics boolean not null default true,
  guardian_consent_given boolean not null default false,
  expires_at timestamptz not null default now() + interval '14 days',
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint link_parties check (parent_id is not null or athlete_id is not null),
  constraint link_not_self check (parent_id is null or athlete_id is null or parent_id <> athlete_id),
  constraint approved_complete check (status <> 'approved' or (parent_id is not null and athlete_id is not null and approved_at is not null))
);
create unique index parent_athlete_unique_active on public.parent_athlete_links (parent_id, athlete_id)
  where status <> 'revoked' and parent_id is not null and athlete_id is not null;

create or replace function public.has_family_link(p_athlete uuid, p_capability text default 'view_profile')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'approved'
      and case p_capability
            when 'view_profile' then l.can_view_profile
            when 'edit_profile' then l.can_edit_profile
            when 'view_applications' then l.can_view_applications
            when 'view_academics' then l.can_view_academics
            else false
          end
  );
$$;

-- Aceptar una invitación: solo la otra parte puede aceptarla; queda registro.
create or replace function public.accept_family_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_link public.parent_athlete_links;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_link from public.parent_athlete_links
   where invitation_token = p_token for update;

  if not found or v_link.status <> 'pending' or v_link.expires_at < now() then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if v_link.invited_by = v_uid then
    raise exception 'cannot_accept_own_invitation' using errcode = 'P0001';
  end if;

  if v_link.athlete_id is null then
    -- La familia invitó; acepta el atleta.
    if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'athlete') then
      raise exception 'athlete_role_required' using errcode = 'P0001';
    end if;
    update public.parent_athlete_links
       set athlete_id = v_uid, status = 'approved', approved_at = now(),
           guardian_consent_given = public.is_minor(v_uid)
     where id = v_link.id;
  else
    -- El atleta invitó; acepta la familia.
    if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'parent') then
      raise exception 'parent_role_required' using errcode = 'P0001';
    end if;
    update public.parent_athlete_links
       set parent_id = v_uid, status = 'approved', approved_at = now(),
           guardian_consent_given = public.is_minor(v_link.athlete_id)
     where id = v_link.id;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (v_uid, 'family_link.approved', 'parent_athlete_links', v_link.id);

  return v_link.id;
end;
$$;

-- Llamadas directas (rol authenticated) solo pueden revocar o, si eres el atleta,
-- ajustar permisos. Aprobar solo es posible vía accept_family_invitation().
create or replace function public.guard_family_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if (new.parent_id, new.athlete_id, new.invited_by, new.invitation_token, new.expires_at,
      new.approved_at, new.created_at, new.guardian_consent_given, new.relationship)
     is distinct from
     (old.parent_id, old.athlete_id, old.invited_by, old.invitation_token, old.expires_at,
      old.approved_at, old.created_at, old.guardian_consent_given, old.relationship) then
    raise exception 'family_link_fields_immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if new.status <> 'revoked' or old.status = 'revoked' then
      raise exception 'family_link_can_only_be_revoked' using errcode = '42501';
    end if;
    new.revoked_at := now();
  else
    new.revoked_at := old.revoked_at;
  end if;
  if (new.can_view_profile, new.can_edit_profile, new.can_view_applications, new.can_view_academics)
     is distinct from
     (old.can_view_profile, old.can_edit_profile, old.can_view_applications, old.can_view_academics)
     and (auth.uid() is distinct from new.athlete_id or new.status <> 'approved') then
    raise exception 'only_athlete_sets_family_permissions' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_family_link before update on public.parent_athlete_links
  for each row execute function public.guard_family_link();

-- Vista previa segura de una invitación (sin exponer la tabla por token).
create or replace function public.preview_family_invitation(p_token text)
returns table (inviter_name text, inviter_role public.app_role, expects_role public.app_role, valid boolean)
language sql stable security definer set search_path = public as $$
  select p.display_name,
         case when l.athlete_id is null then 'parent'::public.app_role else 'athlete'::public.app_role end,
         case when l.athlete_id is null then 'athlete'::public.app_role else 'parent'::public.app_role end,
         l.status = 'pending' and l.expires_at > now()
    from public.parent_athlete_links l
    join public.profiles p on p.id = l.invited_by
   where l.invitation_token = p_token;
$$;

-- -----------------------------------------------------------------------------
-- 8. Organizaciones (universidades, clubes, agencias, marcas)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  type public.org_type not null,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  city text check (char_length(city) <= 120),
  website text check (website is null or website ~ '^https://'),
  division public.division,
  sport_ids text[] not null default '{}',
  description text check (char_length(description) <= 2000),
  verification_status public.verification_status not null default 'unverified',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.org_member_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.is_org_member(p_org uuid, p_admin_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
     where organization_id = p_org and user_id = auth.uid()
       and (not p_admin_only or member_role = 'admin')
  );
$$;

-- Reclutador verificado = miembro de una universidad/college/club/academia verificada.
-- Solo ellos pueden descubrir perfiles de menores.
create or replace function public.is_verified_recruiter()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
     where m.user_id = auth.uid()
       and o.verification_status = 'verified'
       and o.type in ('university', 'college', 'club', 'academy')
  );
$$;

-- Al crear una organización, quien la crea queda como admin de la misma.
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.organization_members (organization_id, user_id, member_role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- Solo admin verifica. Cambiar la identidad de una organización verificada
-- (nombre, tipo, web, país) la devuelve a revisión: así una marca no puede
-- convertirse en "universidad verificada" para ver perfiles de menores.
create or replace function public.guard_org_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if new.verification_status is distinct from old.verification_status
       and not (new.verification_status = 'submitted' and old.verification_status in ('unverified', 'rejected')) then
      raise exception 'verification_admin_only' using errcode = '42501';
    end if;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
    new.created_by := old.created_by;
    if old.verification_status = 'verified'
       and (new.name, new.type, new.website, new.country) is distinct from (old.name, old.type, old.website, old.country) then
      new.verification_status := 'submitted';
      new.verified_at := null;
      new.verified_by := null;
    end if;
  elsif new.verification_status = 'verified' and old.verification_status <> 'verified' then
    new.verified_at := now();
    new.verified_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger guard_org_verification before update on public.organizations
  for each row execute function public.guard_org_verification();

-- -----------------------------------------------------------------------------
-- 9. Oportunidades y candidaturas
-- -----------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  type public.opportunity_type not null,
  title text not null check (char_length(title) between 4 and 160),
  description text not null check (char_length(description) between 20 and 5000),
  sport_id text not null references public.sports (id),
  position_ids int[] not null default '{}',
  graduation_years int[] not null default '{}',
  division public.division,
  min_gpa_4 numeric(3, 2) check (min_gpa_4 between 0 and 4),
  english_required text check (char_length(english_required) <= 120),
  location text check (char_length(location) <= 160),
  start_term text check (char_length(start_term) <= 60),
  deadline date,
  places int check (places between 1 and 500),
  -- Transparencia financiera: los nulos son "desconocido", nunca cero inventado.
  annual_cost_usd int check (annual_cost_usd between 0 and 200000),
  aid_amount_usd int check (aid_amount_usd between 0 and 200000),
  aid_kind text check (aid_kind in ('full', 'partial', 'unknown')),
  financial_source text check (financial_source in ('organization_provided', 'platform_verified', 'unverified')),
  status public.opportunity_status not null default 'draft',
  review_note text,
  reviewed_by uuid references public.profiles (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aid_not_above_cost check (aid_amount_usd is null or annual_cost_usd is null or aid_amount_usd <= annual_cost_usd)
);
create index opportunities_published_idx on public.opportunities (sport_id, deadline) where status = 'published';

-- Transiciones de estado de una oportunidad: los miembros solo envían a revisión.
create or replace function public.guard_opportunity_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') and not public.is_admin() then
      raise exception 'opportunity_status_admin_only' using errcode = '42501';
    end if;
    if not public.is_admin() then
      new.review_note := null;
      new.reviewed_by := null;
      new.published_at := null;
    end if;
    return new;
  end if;

  if not public.is_admin() then
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.published_at := old.published_at;
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
  end if;

  if new.status is distinct from old.status and not public.is_admin() then
    if not (new.status in ('draft', 'pending_review') and old.status in ('draft', 'pending_review', 'rejected', 'published')) then
      raise exception 'opportunity_status_admin_only' using errcode = '42501';
    end if;
  end if;

  -- Si un miembro edita una oportunidad publicada, vuelve a revisión.
  if old.status = 'published' and not public.is_admin()
     and (new.title, new.description, new.annual_cost_usd, new.aid_amount_usd, new.aid_kind, new.deadline)
         is distinct from (old.title, old.description, old.annual_cost_usd, old.aid_amount_usd, old.aid_kind, old.deadline) then
    new.status := 'pending_review';
    new.published_at := null;
  end if;

  if new.status = 'published' and old.status <> 'published' then
    if not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'organization_not_verified' using errcode = 'P0001';
    end if;
    new.published_at := now();
    new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger guard_opportunity_status before insert or update on public.opportunities
  for each row execute function public.guard_opportunity_status();

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  status public.application_status not null default 'applied',
  athlete_message text check (char_length(athlete_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, athlete_id)
);

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  old_status public.application_status,
  new_status public.application_status not null,
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Notas internas del reclutador: nunca visibles para el atleta.
create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create or replace function public.application_org(p_application uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select o.organization_id from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
   where a.id = p_application;
$$;

create or replace function public.guard_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_athlete boolean := auth.uid() = new.athlete_id;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.opportunities where id = new.opportunity_id and status = 'published'
                   and (deadline is null or deadline >= current_date)) then
      raise exception 'opportunity_not_open' using errcode = 'P0001';
    end if;
    new.status := 'applied';
    return new;
  end if;

  if new.athlete_id <> old.athlete_id or new.opportunity_id <> old.opportunity_id then
    raise exception 'application_immutable_keys' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'withdrawn' then
      raise exception 'application_closed' using errcode = 'P0001';
    end if;
    -- El atleta solo puede retirarse; la organización gestiona el resto del pipeline.
    if v_is_athlete and new.status <> 'withdrawn' then
      raise exception 'athlete_can_only_withdraw' using errcode = '42501';
    end if;
    if not v_is_athlete and new.status = 'withdrawn' then
      raise exception 'only_athlete_can_withdraw' using errcode = '42501';
    end if;
  end if;
  -- El atleta no puede reescribir su mensaje cuando la organización ya la gestiona.
  if not v_is_athlete and new.athlete_message is distinct from old.athlete_message then
    raise exception 'application_message_owner_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_application before insert or update on public.applications
  for each row execute function public.guard_application();

create or replace function public.log_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_status_history (application_id, old_status, new_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger log_application_status after insert or update on public.applications
  for each row execute function public.log_application_status();

-- -----------------------------------------------------------------------------
-- 10. Visibilidad del atleta (núcleo de privacidad)
-- -----------------------------------------------------------------------------
create or replace function public.has_connection_with_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  -- "Conexión" = el atleta ha aplicado a una oportunidad de una organización de la que soy miembro.
  select exists (
    select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.organization_members m on m.organization_id = o.organization_id
     where a.athlete_id = p_athlete and m.user_id = auth.uid() and a.status <> 'withdrawn'
  );
$$;

create or replace function public.can_view_athlete(p_athlete uuid, p_block text default 'profile')
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_vis public.visibility_level;
  v_minor boolean;
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and v_uid = p_athlete then return true; end if;
  if public.is_admin() then return true; end if;
  if public.has_family_link(p_athlete, case p_block when 'academics' then 'view_academics' else 'view_profile' end) then
    return true;
  end if;

  select case p_block
           when 'academics' then academics_visibility
           when 'stats' then stats_visibility
           else profile_visibility
         end
    into v_vis
    from public.athlete_profiles where user_id = p_athlete;

  if v_vis is null or v_vis = 'private' then return false; end if;

  -- Un bloque nunca es más abierto que el perfil completo.
  if p_block <> 'profile' and not public.can_view_athlete(p_athlete, 'profile') then
    return false;
  end if;

  if public.has_connection_with_athlete(p_athlete) then return true; end if;

  v_minor := public.is_minor(p_athlete);
  if v_minor then
    -- Menores: nunca anónimos, marcas ni agentes; solo reclutadores verificados.
    return v_uid is not null and v_vis in ('public', 'members') and public.is_verified_recruiter();
  end if;

  return case v_vis
           when 'public' then true
           when 'members' then v_uid is not null
           else false
         end;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Listas de seguimiento (coach / agente / marca)
-- -----------------------------------------------------------------------------
create table public.saved_athletes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  list_name text not null default 'Shortlist' check (char_length(list_name) between 1 and 80),
  private_note text check (char_length(private_note) <= 2000),
  created_at timestamptz not null default now(),
  primary key (owner_id, athlete_id, list_name)
);

-- -----------------------------------------------------------------------------
-- 12. Consentimientos, cookies y auditoría (registros inmutables)
-- -----------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null check (purpose in ('terms', 'privacy_notice', 'profile_discoverable', 'guardian_consent', 'marketing_email')),
  document_version text not null,
  granted boolean not null,
  guardian_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.cookie_consent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  anonymous_id text not null check (char_length(anonymous_id) between 8 and 64),
  essential_allowed boolean not null default true check (essential_allowed),
  analytics_allowed boolean not null,
  functional_allowed boolean not null,
  third_party_allowed boolean not null,
  user_agent text check (char_length(user_agent) <= 400),
  ip_hash text check (char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);

-- Derechos RGPD (acceso, rectificación, supresión...). El borrado efectivo lo ejecuta
-- un admin o una función con service role tras verificar identidad (plazo legal: 1 mes).
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_type text not null check (request_type in ('access', 'rectification', 'erasure', 'restriction', 'objection', 'portability')),
  details text check (char_length(details) <= 2000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'immutable_record' using errcode = '42501';
end;
$$;
create trigger consents_immutable before update or delete on public.consents
  for each row execute function public.forbid_mutation();
create trigger cookie_logs_immutable before update or delete on public.cookie_consent_logs
  for each row execute function public.forbid_mutation();
create trigger audit_immutable before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();
create trigger status_history_immutable before update or delete on public.application_status_history
  for each row execute function public.forbid_mutation();

-- Auditoría de acciones sensibles (una función por tabla: plpgsql no garantiza
-- cortocircuito al evaluar campos de NEW).
create or replace function public.audit_organization_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'organization.verification', 'organizations', new.id,
            jsonb_build_object('from', old.verification_status, 'to', new.verification_status));
  end if;
  return new;
end;
$$;
create trigger audit_org after update on public.organizations
  for each row execute function public.audit_organization_verification();

create or replace function public.audit_opportunity_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'opportunity.status', 'opportunities', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger audit_opportunity after update on public.opportunities
  for each row execute function public.audit_opportunity_status();

-- updated_at
create trigger t_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_private_updated before update on public.private_profile_data for each row execute function public.set_updated_at();
create trigger t_athlete_updated before update on public.athlete_profiles for each row execute function public.set_updated_at();
create trigger t_academics_updated before update on public.athlete_academics for each row execute function public.set_updated_at();
create trigger t_finances_updated before update on public.athlete_finances for each row execute function public.set_updated_at();
create trigger t_orgs_updated before update on public.organizations for each row execute function public.set_updated_at();
create trigger t_opps_updated before update on public.opportunities for each row execute function public.set_updated_at();
create trigger t_apps_updated before update on public.applications for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 13. Búsqueda de talento (server-side, respeta RLS vía security_invoker)
-- -----------------------------------------------------------------------------
create view public.athlete_directory with (security_invoker = true) as
select
  ap.user_id,
  p.display_name,
  p.avatar_url,
  p.country,
  ap.headline,
  ap.sport_id,
  ap.primary_position_id,
  ap.secondary_position_id,
  ap.graduation_year,
  ap.height_cm,
  ap.current_team,
  ap.competitive_level,
  ap.target_divisions,
  ap.open_to_opportunities,
  (ap.highlight_video_url is not null) as has_video,
  ap.updated_at
from public.athlete_profiles ap
join public.profiles p on p.id = ap.user_id;

-- -----------------------------------------------------------------------------
-- 14. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.private_profile_data enable row level security;
alter table public.user_roles enable row level security;
alter table public.sports enable row level security;
alter table public.sport_positions enable row level security;
alter table public.sport_stat_definitions enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.athlete_academics enable row level security;
alter table public.athlete_finances enable row level security;
alter table public.athlete_statistics enable row level security;
alter table public.athlete_languages enable row level security;
alter table public.athlete_achievements enable row level security;
alter table public.parent_athlete_links enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.application_notes enable row level security;
alter table public.saved_athletes enable row level security;
alter table public.consents enable row level security;
alter table public.cookie_consent_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.data_subject_requests enable row level security;

-- profiles: nombre y avatar visibles para miembros; un menor solo para quien pueda ver su perfil.
create policy profiles_select on public.profiles for select to anon, authenticated
  using (
    id = auth.uid() or public.is_admin()
    or public.can_view_athlete(id)
    or (auth.uid() is not null and not public.is_minor(id)
        and not exists (select 1 from public.athlete_profiles a where a.user_id = profiles.id))
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- private_profile_data: solo propietario (y admin para soporte).
create policy private_select on public.private_profile_data for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy private_insert on public.private_profile_data for insert to authenticated
  with check (user_id = auth.uid());
create policy private_update on public.private_profile_data for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_roles: cada usuario gestiona sus roles, salvo admin (solo por SQL/service role).
create policy roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy roles_insert on public.user_roles for insert to authenticated
  with check (user_id = auth.uid() and role <> 'admin');
create policy roles_delete on public.user_roles for delete to authenticated
  using (user_id = auth.uid() and role <> 'admin');

-- catálogo: lectura abierta, escritura solo admin.
create policy sports_read on public.sports for select to anon, authenticated using (true);
create policy positions_read on public.sport_positions for select to anon, authenticated using (true);
create policy stats_def_read on public.sport_stat_definitions for select to anon, authenticated using (true);
create policy sports_admin on public.sports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy positions_admin on public.sport_positions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stats_def_admin on public.sport_stat_definitions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- athlete_profiles
create policy athlete_select on public.athlete_profiles for select to anon, authenticated
  using (public.can_view_athlete(user_id, 'profile'));
create policy athlete_insert on public.athlete_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.has_role('athlete'));
create policy athlete_update on public.athlete_profiles for update to authenticated
  using (user_id = auth.uid() or public.has_family_link(user_id, 'edit_profile'))
  with check (user_id = auth.uid() or public.has_family_link(user_id, 'edit_profile'));

-- athlete_academics
create policy academics_select on public.athlete_academics for select to authenticated
  using (public.can_view_athlete(athlete_id, 'academics'));
create policy academics_write on public.athlete_academics for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

-- finanzas: solo atleta, familia vinculada y admin. Nunca organizaciones.
create policy finances_select on public.athlete_finances for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile') or public.is_admin());
create policy finances_write on public.athlete_finances for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

-- estadísticas, idiomas, logros
create policy stats_select on public.athlete_statistics for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, 'stats'));
create policy stats_write on public.athlete_statistics for all to authenticated
  using (athlete_id = auth.uid() and source = 'self_reported')
  with check (athlete_id = auth.uid() and source = 'self_reported');
create policy stats_admin on public.athlete_statistics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy languages_select on public.athlete_languages for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, 'profile'));
create policy languages_write on public.athlete_languages for all to authenticated
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy achievements_select on public.athlete_achievements for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, 'profile'));
create policy achievements_write on public.athlete_achievements for all to authenticated
  using (athlete_id = auth.uid() and source = 'self_reported')
  with check (athlete_id = auth.uid() and source = 'self_reported');

-- parent_athlete_links: cada parte ve sus vínculos; el que invita crea; cualquiera de las partes revoca.
create policy links_select on public.parent_athlete_links for select to authenticated
  using (parent_id = auth.uid() or athlete_id = auth.uid() or invited_by = auth.uid() or public.is_admin());
create policy links_insert on public.parent_athlete_links for insert to authenticated
  with check (
    invited_by = auth.uid() and status = 'pending' and approved_at is null
    and (
      (parent_id = auth.uid() and athlete_id is null and public.has_role('parent'))
      or (athlete_id = auth.uid() and parent_id is null and public.has_role('athlete'))
    )
  );
create policy links_update on public.parent_athlete_links for update to authenticated
  using (parent_id = auth.uid() or athlete_id = auth.uid())
  with check (parent_id = auth.uid() or athlete_id = auth.uid());

-- organizations: verificadas visibles para todos; las demás solo para sus miembros y admin.
create policy orgs_select on public.organizations for select to anon, authenticated
  using (verification_status = 'verified' or created_by = auth.uid() or public.is_org_member(id) or public.is_admin());
create policy orgs_insert on public.organizations for insert to authenticated
  with check (
    created_by = auth.uid() and verification_status in ('unverified', 'submitted')
    and (
      (type in ('university', 'college') and public.has_role('university'))
      or (type in ('club', 'academy') and (public.has_role('coach') or public.has_role('university')))
      or (type = 'agency' and public.has_role('agent'))
      or (type = 'brand' and public.has_role('brand'))
    )
  );
create policy orgs_update on public.organizations for update to authenticated
  using (public.is_org_member(id, true) or public.is_admin())
  with check (public.is_org_member(id, true) or public.is_admin());

create policy members_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id) or public.is_admin());
create policy members_admin on public.organization_members for all to authenticated
  using (public.is_org_member(organization_id, true) or public.is_admin())
  with check (public.is_org_member(organization_id, true) or public.is_admin());

-- opportunities: publicadas para todos; borradores solo para la organización y admin.
create policy opps_select on public.opportunities for select to anon, authenticated
  using (status = 'published' or public.is_org_member(organization_id) or public.is_admin());
create policy opps_insert on public.opportunities for insert to authenticated
  with check (
    created_by = auth.uid() and public.is_org_member(organization_id)
    and exists (select 1 from public.organizations o where o.id = organization_id
                and o.type in ('university', 'college', 'club', 'academy'))
  );
create policy opps_update on public.opportunities for update to authenticated
  using (public.is_org_member(organization_id) or public.is_admin())
  with check (public.is_org_member(organization_id) or public.is_admin());
create policy opps_delete on public.opportunities for delete to authenticated
  using ((public.is_org_member(organization_id) and status in ('draft', 'rejected')) or public.is_admin());

-- applications: atleta (y familia con permiso) ven las suyas; la organización ve las de sus oportunidades.
create policy apps_select on public.applications for select to authenticated
  using (
    athlete_id = auth.uid()
    or public.has_family_link(athlete_id, 'view_applications')
    or public.is_org_member(public.application_org(id))
    or public.is_admin()
  );
create policy apps_insert on public.applications for insert to authenticated
  with check (athlete_id = auth.uid() and public.has_role('athlete'));
create policy apps_update on public.applications for update to authenticated
  using (athlete_id = auth.uid() or public.is_org_member(public.application_org(id)))
  with check (athlete_id = auth.uid() or public.is_org_member(public.application_org(id)));

create policy history_select on public.application_status_history for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id));

create policy notes_org_only on public.application_notes for all to authenticated
  using (public.is_org_member(public.application_org(application_id)))
  with check (author_id = auth.uid() and public.is_org_member(public.application_org(application_id)));

-- saved_athletes: privadas del propietario; solo se puede guardar a quien se puede ver.
create policy saved_select on public.saved_athletes for select to authenticated
  using (owner_id = auth.uid());
create policy saved_insert on public.saved_athletes for insert to authenticated
  with check (owner_id = auth.uid() and public.can_view_athlete(athlete_id)
              and (public.has_role('university') or public.has_role('coach') or public.has_role('agent') or public.has_role('brand')));
create policy saved_update on public.saved_athletes for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy saved_delete on public.saved_athletes for delete to authenticated
  using (owner_id = auth.uid());

-- consents / cookies / auditoría
create policy consents_select on public.consents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid() and guardian_id is null);
create policy cookies_insert on public.cookie_consent_logs for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy cookies_admin_read on public.cookie_consent_logs for select to authenticated
  using (public.is_admin());
create policy dsr_select on public.data_subject_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy dsr_insert on public.data_subject_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'received' and resolved_at is null);
create policy dsr_admin_update on public.data_subject_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated
  using (public.is_admin());

-- Privilegios de tabla (RLS decide fila a fila).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.sports, public.sport_positions, public.sport_stat_definitions,
  public.athlete_profiles, public.athlete_statistics, public.athlete_languages,
  public.athlete_achievements, public.organizations, public.opportunities to anon;
grant insert on public.cookie_consent_logs to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.athlete_directory to authenticated;
revoke update, delete on public.audit_logs, public.consents, public.cookie_consent_logs,
  public.application_status_history from authenticated;
revoke insert on public.audit_logs, public.application_status_history from authenticated;

revoke execute on all functions in schema public from public;
grant execute on function public.has_role, public.is_admin, public.is_minor, public.has_family_link,
  public.is_org_member, public.is_verified_recruiter, public.can_view_athlete,
  public.has_connection_with_athlete, public.application_org to anon, authenticated;
grant execute on function public.accept_family_invitation, public.preview_family_invitation to authenticated;
