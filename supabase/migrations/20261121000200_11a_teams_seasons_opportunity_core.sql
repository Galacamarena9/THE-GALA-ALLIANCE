-- 11A · B: taxonomías (temporadas, categorías de edad), equipos y núcleo común de la oportunidad.
-- Principio: REUSE → EXTEND → SPECIALIZE. `opportunities` sigue siendo el supertipo con SOLO datos compartidos;
-- lo específico va en tablas 1:0..1 (trial_details, academy_program_details).
-- Decisión enum vs tabla: estados técnicos estables = text + check (fácil de ampliar sin bloquear transacciones);
-- taxonomías de negocio que se administran y se relacionan (temporadas, categorías) = tablas.
-- Reversión: drop table public.org_teams, public.age_categories, public.sports_seasons; quitar columnas añadidas a opportunities y recruiting_needs.

-- 1. Temporadas: «2027-28», nunca strings libres como «27/28» repartidos por el sistema.
-- only_nulled consciente de columnas generadas: en un BEFORE trigger NEW aún no las tiene calculadas (llegan null),
-- así que se excluyen de la comparación «el resto no cambia». Lo usan los guards que deben dejar pasar los FK «set null».
create or replace function public.only_nulled(p_old jsonb, p_new jsonb, p_cols text[], p_rel regclass)
returns boolean language sql stable set search_path = public as $$
  select public.only_nulled(
    p_old - coalesce((select array_agg(attname::text) from pg_attribute where attrelid = p_rel and attgenerated <> ''), '{}'::text[]),
    p_new - coalesce((select array_agg(attname::text) from pg_attribute where attrelid = p_rel and attgenerated <> ''), '{}'::text[]),
    p_cols);
$$;

create table public.sports_seasons (
  id text primary key check (id ~ '^\d{4}(-\d{2})?$'),
  label text not null check (char_length(label) between 4 and 20),
  starts_on date not null,
  ends_on date not null,
  constraint season_dates check (ends_on > starts_on)
);
alter table public.sports_seasons enable row level security;
create policy seasons_read on public.sports_seasons for select to anon, authenticated using (true);
create policy seasons_admin on public.sports_seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.sports_seasons to anon, authenticated;
grant insert, update, delete on public.sports_seasons to authenticated;
insert into public.sports_seasons (id, label, starts_on, ends_on) values
  ('2025-26', '2025/26', '2025-07-01', '2026-06-30'), ('2026-27', '2026/27', '2026-07-01', '2027-06-30'),
  ('2027-28', '2027/28', '2027-07-01', '2028-06-30'), ('2028-29', '2028/29', '2028-07-01', '2029-06-30');

-- 2. Categorías de edad: catálogo central con reglas cuando existen (U16 = menos de 16 al inicio de la temporada).
create table public.age_categories (
  code text primary key check (code ~ '^[A-Z0-9_]{2,20}$'),
  label text not null check (char_length(label) between 2 and 40),
  max_age smallint check (max_age between 5 and 45),
  min_age smallint check (min_age between 5 and 45),
  kind text not null default 'age_limit' check (kind in ('age_limit', 'level')),
  sort smallint not null default 100
);
alter table public.age_categories enable row level security;
create policy age_categories_read on public.age_categories for select to anon, authenticated using (true);
create policy age_categories_admin on public.age_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.age_categories to anon, authenticated;
grant insert, update, delete on public.age_categories to authenticated;
insert into public.age_categories (code, label, max_age, kind, sort) values
  ('U14', 'U14', 13, 'age_limit', 10), ('U15', 'U15', 14, 'age_limit', 20), ('U16', 'U16', 15, 'age_limit', 30),
  ('U17', 'U17', 16, 'age_limit', 40), ('U18', 'U18', 17, 'age_limit', 50), ('U19', 'U19', 18, 'age_limit', 60),
  ('U21', 'U21', 20, 'age_limit', 70), ('U23', 'U23', 22, 'age_limit', 75),
  ('SENIOR', 'Senior', null, 'level', 80), ('DEVELOPMENT', 'Development', null, 'level', 90), ('FIRST_TEAM', 'First Team', null, 'level', 100);

-- 3. Equipos: dependen de un programa deportivo de la misma organización.
create table public.org_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  program_id uuid not null references public.org_programs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  age_category_code text references public.age_categories (code),
  season_id text references public.sports_seasons (id),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint team_program_org check (public.program_in_org(program_id, organization_id))
);
create unique index org_teams_name_unique on public.org_teams (program_id, lower(name), coalesce(season_id, '')) where archived_at is null;
create index org_teams_org_idx on public.org_teams (organization_id);
alter table public.org_teams enable row level security;
grant select, insert, update on public.org_teams to authenticated;

create or replace function public.team_in_org(p_team uuid, p_org uuid, p_program uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select p_team is null or exists (select 1 from public.org_teams t where t.id = p_team and t.organization_id = p_org
                                   and (p_program is null or t.program_id = p_program));
$$;
grant execute on function public.team_in_org(uuid, uuid, uuid) to authenticated;

-- 4. Oportunidad: núcleo compartido (programa, equipo, temporada, categoría, ubicación estructurada, fechas con zona,
--    visibilidad, moderación ≠ estado, procedencia y archivo).
alter table public.opportunities
  add column program_id uuid references public.org_programs (id) on delete set null,
  add column team_id uuid references public.org_teams (id) on delete set null,
  add column season_id text references public.sports_seasons (id),
  add column age_category_code text references public.age_categories (code),
  add column age_category_custom text check (char_length(age_category_custom) <= 40),
  add column start_at timestamptz,
  add column end_at timestamptz,
  add column timezone text,
  add column country char(2) check (country ~ '^[A-Z]{2}$'),
  add column region text check (char_length(region) <= 80),
  add column city text check (char_length(city) <= 80),
  add column venue_name text check (char_length(venue_name) <= 120),
  add column address text check (char_length(address) <= 200),
  add column postal_code text check (char_length(postal_code) <= 20),
  add column latitude numeric(8, 5) check (latitude between -90 and 90),
  add column longitude numeric(8, 5) check (longitude between -180 and 180),
  add column visibility text not null default 'public' check (visibility in ('public', 'verified_organizations', 'invite_only')),
  add column moderation_status text not null default 'none' check (moderation_status in ('none', 'under_review', 'suspended', 'removed')),
  add column moderation_reason text check (char_length(moderation_reason) <= 500),
  add column moderated_by uuid references public.profiles (id) on delete set null,
  add column moderated_at timestamptz,
  add column updated_by uuid references public.profiles (id) on delete set null,
  add column source text not null default 'organization' check (source in ('organization', 'gala_admin', 'import')),
  add column archived_at timestamptz,
  add constraint opportunity_dates_ordered check (end_at is null or start_at is null or end_at >= start_at),
  add constraint opportunity_program_org check (public.program_in_org(program_id, organization_id)),
  add constraint opportunity_team_org check (public.team_in_org(team_id, organization_id, program_id));

-- Zona horaria IANA válida (PostgreSQL la conoce) y equipo coherente con su programa.
create or replace function public.guard_opportunity_core()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Borrado de cuenta/organización: los FK «set null» pasan sin reasignar autoría (si no, delete_my_account fallaría).
  if tg_op = 'UPDATE' and public.only_nulled(to_jsonb(old), to_jsonb(new), '{created_by,reviewed_by,updated_by,moderated_by,program_id,team_id}', tg_relid) then
    return new;
  end if;
  if new.timezone is not null then
    begin
      perform now() at time zone new.timezone;
    exception when others then
      raise exception 'invalid_timezone' using errcode = 'P0001';
    end;
  end if;
  if new.team_id is not null and new.program_id is null then
    new.program_id := (select program_id from public.org_teams where id = new.team_id);
  end if;
  if tg_op = 'UPDATE' then new.updated_by := coalesce(auth.uid(), new.updated_by); end if;
  -- Moderación: solo Gala la cambia.
  if tg_op = 'UPDATE' and (new.moderation_status, new.moderation_reason) is distinct from (old.moderation_status, old.moderation_reason)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'moderation_admin_only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.moderation_status is distinct from old.moderation_status then
    new.moderated_by := auth.uid(); new.moderated_at := now();
  end if;
  if tg_op = 'UPDATE' and new.status = 'archived' and old.status <> 'archived' then new.archived_at := now(); end if;
  return new;
end;
$$;
create trigger guard_opportunity_core before insert or update on public.opportunities for each row execute function public.guard_opportunity_core();

alter table public.recruiting_needs
  add column team_id uuid references public.org_teams (id) on delete set null,
  add column season_id text references public.sports_seasons (id),
  add column age_category_code text references public.age_categories (code),
  add constraint need_team_org check (public.team_in_org(team_id, organization_id, program_id));

-- Búsqueda de oportunidades (sin cargar todo al cliente): filtros reales de Discovery.
create index opportunities_discovery_idx on public.opportunities (status, type, sport_id) where status = 'published';
create index opportunities_location_idx on public.opportunities (country, city) where status = 'published';
create index opportunities_start_idx on public.opportunities (start_at) where status = 'published';
create index opportunities_org_status_idx on public.opportunities (organization_id, status);
create index opportunities_team_idx on public.opportunities (team_id) where team_id is not null;

-- Equipos: los ven los miembros de su organización y, por su nombre, quien ve una oportunidad publicada del equipo.
create policy org_teams_select on public.org_teams for select to authenticated using (
  public.is_org_member(organization_id) or public.is_admin()
  or exists (select 1 from public.opportunities o where o.team_id = org_teams.id and o.status = 'published'));
create policy org_teams_insert on public.org_teams for insert to authenticated
  with check (public.org_can(organization_id, 'manage_programs') and created_by = auth.uid());
create policy org_teams_update on public.org_teams for update to authenticated
  using (public.org_can(organization_id, 'manage_programs')) with check (public.org_can(organization_id, 'manage_programs'));
