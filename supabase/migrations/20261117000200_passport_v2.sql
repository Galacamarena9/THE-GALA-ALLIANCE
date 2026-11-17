-- =============================================================================
-- Opportunity Passport v2 (fase 01). Todo es aditivo: no se borra ni se renombra nada.
-- Reversión: ver el bloque "ROLLBACK" al final del archivo.
-- =============================================================================

-- 1. Identidad y nuevos bloques de visibilidad ------------------------------------------
alter table public.athlete_profiles
  add column username text unique check (username ~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$'),
  add column nationality text check (nationality ~ '^[A-Z]{2}$'),
  add column weight_kg int check (weight_kg between 30 and 200),
  add column league text check (char_length(league) <= 120),
  add column years_experience int check (years_experience between 0 and 40),
  add column sport_visibility public.visibility_level not null default 'members',
  add column videos_visibility public.visibility_level not null default 'members',
  add column goals_visibility public.visibility_level not null default 'verified_orgs';

-- Nombres reservados para la URL pública /athlete/<username>.
alter table public.athlete_profiles add constraint username_not_reserved
  check (username is null or username not in ('admin', 'app', 'api', 'new', 'edit', 'me', 'settings', 'gala', 'thegalaalliance', 'support', 'help'));

-- 2. Quién puede ver cada bloque ---------------------------------------------------------
-- Bloques: profile (personal) · sport (trayectoria y logros) · stats · academics · videos · goals.
-- 'verified_orgs': solo miembros de universidades, colleges, clubes o academias verificadas.
-- Menores: nunca anónimos; solo reclutadores verificados aunque el bloque diga "público" (sin cambios).
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
  if v_uid is not null and public.is_blocked_by_athlete(p_athlete) then return false; end if;
  if v_uid is not null and public.is_blocked_by_user(p_athlete) then return false; end if;

  select case p_block
           when 'academics' then academics_visibility
           when 'stats' then stats_visibility
           when 'sport' then sport_visibility
           when 'videos' then videos_visibility
           when 'goals' then goals_visibility
           else profile_visibility
         end
    into v_vis
    from public.athlete_profiles where user_id = p_athlete;

  if v_vis is null or v_vis = 'private' then return false; end if;
  if p_block <> 'profile' and not public.can_view_athlete(p_athlete, 'profile') then
    return false;
  end if;
  if public.has_connection_with_athlete(p_athlete) then return true; end if;

  v_minor := public.is_minor(p_athlete);
  if v_minor then
    return v_uid is not null and v_vis in ('public', 'members', 'verified_orgs') and public.is_verified_recruiter();
  end if;

  return case v_vis
           when 'public' then true
           when 'members' then v_uid is not null
           when 'verified_orgs' then v_uid is not null and public.is_verified_recruiter()
           else false
         end;
end;
$$;

-- Menores: ningún bloque "público" ni nombre de usuario indexable; se rebajan a "solo usuarios".
create or replace function public.guard_minor_visibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_minor(new.user_id) then
    if new.profile_visibility = 'public' then new.profile_visibility := 'members'; end if;
    if new.sport_visibility = 'public' then new.sport_visibility := 'members'; end if;
    if new.stats_visibility = 'public' then new.stats_visibility := 'members'; end if;
    if new.academics_visibility = 'public' then new.academics_visibility := 'members'; end if;
    if new.videos_visibility = 'public' then new.videos_visibility := 'members'; end if;
    if new.goals_visibility = 'public' then new.goals_visibility := 'verified_orgs'; end if;
  end if;
  return new;
end;
$$;
create trigger t_guard_minor_visibility before insert or update on public.athlete_profiles
  for each row execute function public.guard_minor_visibility();

-- 3. Estadísticas: temporada → equipo → competición ------------------------------------
alter table public.athlete_statistics
  add column team text not null default '' check (char_length(team) <= 120),
  add column competition text not null default '' check (char_length(competition) <= 120);
alter table public.athlete_statistics drop constraint athlete_statistics_athlete_id_stat_definition_id_season_key;
alter table public.athlete_statistics add constraint athlete_statistics_unique_line
  unique (athlete_id, stat_definition_id, season, team, competition);

-- Más deportes y estadísticas (configuración: se amplía sin tocar código).
insert into public.sports (id, name_es, name_en) values
  ('volleyball', 'Voleibol', 'Volleyball'),
  ('swimming', 'Natación', 'Swimming'),
  ('golf', 'Golf', 'Golf'),
  ('field_hockey', 'Hockey hierba', 'Field Hockey'),
  ('softball', 'Softball', 'Softball'),
  ('baseball', 'Béisbol', 'Baseball'),
  ('padel', 'Pádel', 'Padel')
on conflict (id) do nothing;

insert into public.sport_positions (sport_id, code, name_es, name_en) values
  ('volleyball', 'S', 'Colocador/a', 'Setter'),
  ('volleyball', 'OH', 'Receptor/a-atacante', 'Outside Hitter'),
  ('volleyball', 'OPP', 'Opuesto/a', 'Opposite'),
  ('volleyball', 'MB', 'Central', 'Middle Blocker'),
  ('volleyball', 'L', 'Líbero', 'Libero'),
  ('swimming', 'FR', 'Libre', 'Freestyle'),
  ('swimming', 'BK', 'Espalda', 'Backstroke'),
  ('swimming', 'BR', 'Braza', 'Breaststroke'),
  ('swimming', 'FL', 'Mariposa', 'Butterfly'),
  ('swimming', 'IM', 'Estilos', 'Individual Medley'),
  ('golf', 'GOLF', 'Jugador/a', 'Player'),
  ('field_hockey', 'GK', 'Portero/a', 'Goalkeeper'),
  ('field_hockey', 'DEF', 'Defensa', 'Defender'),
  ('field_hockey', 'MID', 'Centrocampista', 'Midfielder'),
  ('field_hockey', 'FWD', 'Delantero/a', 'Forward'),
  ('softball', 'P', 'Pitcher', 'Pitcher'),
  ('softball', 'C', 'Catcher', 'Catcher'),
  ('softball', 'IF', 'Infield', 'Infielder'),
  ('softball', 'OF', 'Outfield', 'Outfielder'),
  ('baseball', 'P', 'Pitcher', 'Pitcher'),
  ('baseball', 'C', 'Catcher', 'Catcher'),
  ('baseball', 'IF', 'Infield', 'Infielder'),
  ('baseball', 'OF', 'Outfield', 'Outfielder'),
  ('padel', 'DRV', 'Drive', 'Right side'),
  ('padel', 'REV', 'Revés', 'Left side'),
  ('soccer', 'CDM', 'Pivote', 'Holding Midfielder')
on conflict (sport_id, code) do nothing;

insert into public.sport_stat_definitions (sport_id, code, label_es, label_en, unit, higher_is_better, sort_order) values
  ('basketball', 'games', 'Partidos', 'Games', null, true, 0),
  ('basketball', 'spg', 'Robos por partido', 'Steals per game', 'rob', true, 7),
  ('basketball', 'bpg', 'Tapones por partido', 'Blocks per game', 'tap', true, 8),
  ('basketball', 'ft_pct', '% tiros libres', 'Free throw %', '%', true, 9),
  ('soccer', 'starts', 'Titularidades', 'Starts', null, true, 6),
  ('tennis', 'itf_ranking', 'Ranking ITF', 'ITF ranking', '#', false, 5),
  ('volleyball', 'sets', 'Sets jugados', 'Sets played', null, true, 1),
  ('volleyball', 'kills_per_set', 'Puntos de ataque por set', 'Kills per set', null, true, 2),
  ('volleyball', 'aces', 'Aces', 'Aces', null, true, 3),
  ('volleyball', 'blocks_per_set', 'Bloqueos por set', 'Blocks per set', null, true, 4),
  ('volleyball', 'digs_per_set', 'Defensas por set', 'Digs per set', null, true, 5),
  ('volleyball', 'assists_per_set', 'Colocaciones por set', 'Assists per set', null, true, 6),
  ('swimming', 'pb_50_free', 'MMP 50 libre', '50 free PB', 's', false, 1),
  ('swimming', 'pb_100_free', 'MMP 100 libre', '100 free PB', 's', false, 2),
  ('swimming', 'pb_200_free', 'MMP 200 libre', '200 free PB', 's', false, 3),
  ('swimming', 'pb_100_back', 'MMP 100 espalda', '100 back PB', 's', false, 4),
  ('swimming', 'pb_100_breast', 'MMP 100 braza', '100 breast PB', 's', false, 5),
  ('swimming', 'pb_100_fly', 'MMP 100 mariposa', '100 fly PB', 's', false, 6),
  ('swimming', 'pb_200_im', 'MMP 200 estilos', '200 IM PB', 's', false, 7),
  ('golf', 'handicap', 'Hándicap', 'Handicap', null, false, 1),
  ('golf', 'scoring_avg', 'Media de golpes (18 hoyos)', 'Scoring average', null, false, 2),
  ('golf', 'national_ranking', 'Ranking nacional', 'National ranking', '#', false, 3),
  ('field_hockey', 'games', 'Partidos', 'Games', null, true, 1),
  ('field_hockey', 'goals', 'Goles', 'Goals', null, true, 2),
  ('field_hockey', 'assists', 'Asistencias', 'Assists', null, true, 3),
  ('softball', 'avg', 'Promedio de bateo', 'Batting average', null, true, 1),
  ('softball', 'era', 'ERA', 'ERA', null, false, 2),
  ('softball', 'hr', 'Home runs', 'Home runs', null, true, 3),
  ('baseball', 'avg', 'Promedio de bateo', 'Batting average', null, true, 1),
  ('baseball', 'era', 'ERA', 'ERA', null, false, 2),
  ('baseball', 'fastball_mph', 'Velocidad de bola rápida', 'Fastball velocity', 'mph', true, 3),
  ('padel', 'national_ranking', 'Ranking nacional', 'National ranking', '#', false, 1),
  ('padel', 'wins', 'Victorias (temporada)', 'Wins (season)', null, true, 2)
on conflict (sport_id, code) do nothing;

-- 4. Trayectoria deportiva ---------------------------------------------------------------
create table public.athlete_career (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  team text not null check (char_length(btrim(team)) between 2 and 120),
  league text check (char_length(league) <= 120),
  country text check (country ~ '^[A-Z]{2}$'),
  season_from text not null check (season_from ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  season_to text check (season_to is null or season_to ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  role text check (char_length(role) <= 120),
  created_at timestamptz not null default now()
);
create index athlete_career_athlete_idx on public.athlete_career (athlete_id, season_from desc);
alter table public.athlete_career enable row level security;
create policy career_select on public.athlete_career for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, 'sport'));
create policy career_write on public.athlete_career for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

-- 5. Logros con tipo y nivel; pasan al bloque "deportivo" ------------------------------------
alter table public.athlete_achievements
  add column kind text not null default 'other'
    check (kind in ('championship', 'national_team', 'award', 'recognition', 'ranking', 'captaincy', 'academic', 'other')),
  add column level text check (level in ('club', 'regional', 'national', 'international'));
drop policy achievements_select on public.athlete_achievements;
create policy achievements_select on public.athlete_achievements for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, case when kind = 'academic' then 'academics' else 'sport' end));

-- 6. Vídeos -------------------------------------------------------------------------------
create table public.athlete_videos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('highlight', 'full_game', 'training', 'clip', 'season')),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 500),
  title text check (char_length(title) <= 120),
  season text check (season is null or season ~ '^[0-9]{4}(-[0-9]{2,4})?$'),
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index athlete_videos_athlete_idx on public.athlete_videos (athlete_id, created_at desc);
create unique index athlete_videos_one_featured on public.athlete_videos (athlete_id) where is_featured;
alter table public.athlete_videos enable row level security;
create policy videos_select on public.athlete_videos for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, 'videos'));
create policy videos_write on public.athlete_videos for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

create or replace function public.guard_athlete_videos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.athlete_videos where athlete_id = new.athlete_id) >= 30 then
    raise exception 'too_many_videos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger t_guard_athlete_videos before insert on public.athlete_videos
  for each row execute function public.guard_athlete_videos();

-- El vídeo de highlights existente pasa a ser el vídeo destacado (sin borrar la columna antigua).
insert into public.athlete_videos (athlete_id, kind, url, title, is_featured)
select user_id, 'highlight', highlight_video_url, 'Highlights', true
  from public.athlete_profiles where highlight_video_url is not null;

-- 7. Académico internacional con procedencia -------------------------------------------
alter table public.athlete_academics
  add column education_system text check (education_system in ('es', 'us', 'uk', 'fr', 'it', 'de', 'pt', 'ib', 'latam', 'other')),
  add column school_name text check (char_length(school_name) <= 160),
  add column grade_display text check (char_length(grade_display) <= 40),
  add column toefl_score int check (toefl_score between 0 and 120),
  add column ielts_score numeric(2, 1) check (ielts_score between 0 and 9),
  add column cambridge_level text check (cambridge_level in ('b1', 'b2', 'c1', 'c2')),
  add column duolingo_score int check (duolingo_score between 10 and 160),
  add column gpa_source public.data_source not null default 'self_reported',
  add column english_source public.data_source not null default 'self_reported',
  add column tests_source public.data_source not null default 'self_reported';

-- Solo un admin (o, en el futuro, la entidad autorizada) eleva la procedencia; cambiar el dato la reinicia.
create or replace function public.guard_academic_sources()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.gpa_source := 'self_reported'; new.english_source := 'self_reported'; new.tests_source := 'self_reported';
    return new;
  end if;
  if new.gpa_source is distinct from old.gpa_source then new.gpa_source := old.gpa_source; end if;
  if new.english_source is distinct from old.english_source then new.english_source := old.english_source; end if;
  if new.tests_source is distinct from old.tests_source then new.tests_source := old.tests_source; end if;
  if (new.gpa, new.gpa_scale, new.grade_display) is distinct from (old.gpa, old.gpa_scale, old.grade_display) then
    new.gpa_source := 'self_reported';
  end if;
  if (new.english_test, new.english_score, new.toefl_score, new.ielts_score, new.cambridge_level, new.duolingo_score)
     is distinct from (old.english_test, old.english_score, old.toefl_score, old.ielts_score, old.cambridge_level, old.duolingo_score) then
    new.english_source := 'self_reported';
  end if;
  if (new.sat_score, new.act_score) is distinct from (old.sat_score, old.act_score) then
    new.tests_source := 'self_reported';
  end if;
  return new;
end;
$$;
create trigger t_guard_academic_sources before insert or update on public.athlete_academics
  for each row execute function public.guard_academic_sources();

-- 8. Objetivos (preparados para Gala Match) ------------------------------------------------
create table public.athlete_goals (
  athlete_id uuid primary key references public.athlete_profiles (user_id) on delete cascade,
  pathways text[] not null default '{}' check (pathways <@ array['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa',
    'intl_university', 'club', 'academy', 'professional', 'camp', 'showcase']::text[]),
  countries text[] not null default '{}' check (array_length(countries, 1) is null or array_length(countries, 1) <= 10),
  regions text[] not null default '{}' check (array_length(regions, 1) is null or array_length(regions, 1) <= 15),
  intended_majors text[] not null default '{}' check (array_length(intended_majors, 1) is null or array_length(intended_majors, 1) <= 5),
  school_size text check (school_size in ('small', 'medium', 'large', 'any')),
  sport_level text check (sport_level in ('top', 'competitive', 'development', 'any')),
  scholarship_need text check (scholarship_need in ('full', 'partial', 'none', 'unsure')),
  campus_setting text check (campus_setting in ('urban', 'suburban', 'rural', 'any')),
  start_term text check (start_term ~ '^20[2-4][0-9]-(0[1-9]|1[0-2])$'),
  updated_at timestamptz not null default now()
);
alter table public.athlete_goals enable row level security;
create policy goals_select on public.athlete_goals for select to authenticated
  using (public.can_view_athlete(athlete_id, 'goals'));
create policy goals_write on public.athlete_goals for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
create trigger t_goals_updated before update on public.athlete_goals for each row execute function public.set_updated_at();

-- 9. Visitas al Passport (tracking real; sin datos inventados) ------------------------------
create table public.passport_views (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  viewer_org_id uuid references public.organizations (id) on delete set null,
  viewer_kind text not null check (viewer_kind in ('anonymous', 'member', 'university', 'club', 'agent', 'brand', 'family')),
  viewed_on date not null default current_date,
  viewed_at timestamptz not null default now()
);
-- Una visita por persona identificada y día (las anónimas se cuentan, pero no como visitantes únicos).
create unique index passport_views_daily_member on public.passport_views (athlete_id, viewer_id, viewed_on) where viewer_id is not null;
create index passport_views_athlete_idx on public.passport_views (athlete_id, viewed_at desc);
alter table public.passport_views enable row level security;
-- Sin políticas: solo se escribe y se lee con las funciones de abajo.

create or replace function public.record_passport_view(p_athlete uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_kind text := 'anonymous';
begin
  if v_uid = p_athlete then return; end if;
  if not public.can_view_athlete(p_athlete, 'profile') then return; end if;
  if v_uid is not null then
    v_kind := 'member';
    if public.has_family_link(p_athlete, 'view_profile') then
      v_kind := 'family';
    else
      select o.id, case o.type when 'university' then 'university' when 'college' then 'university'
                               when 'club' then 'club' when 'academy' then 'club'
                               when 'agency' then 'agent' when 'brand' then 'brand' end
        into v_org, v_kind
        from public.organization_members m join public.organizations o on o.id = m.organization_id
       where m.user_id = v_uid and o.verification_status = 'verified'
       order by m.created_at limit 1;
      v_kind := coalesce(v_kind, 'member');
    end if;
  end if;
  insert into public.passport_views (athlete_id, viewer_id, viewer_org_id, viewer_kind)
  values (p_athlete, v_uid, v_org, v_kind)
  on conflict do nothing;
end;
$$;

create or replace function public.passport_view_stats(p_athlete uuid)
returns table (total_views bigint, unique_members bigint, university_views bigint, club_views bigint, organizations text[])
language sql stable security definer set search_path = public as $$
  select count(*),
         count(distinct v.viewer_id),
         count(*) filter (where v.viewer_kind = 'university'),
         count(*) filter (where v.viewer_kind = 'club'),
         coalesce(array_agg(distinct o.name) filter (where o.name is not null), '{}')
    from public.passport_views v
    left join public.organizations o on o.id = v.viewer_org_id
   where v.athlete_id = p_athlete
     and (auth.uid() = p_athlete or public.has_family_link(p_athlete, 'view_profile') or public.is_admin());
$$;

revoke all on function public.record_passport_view(uuid) from public;
grant execute on function public.record_passport_view(uuid) to anon, authenticated;
revoke all on function public.passport_view_stats(uuid) from public, anon;
grant execute on function public.passport_view_stats(uuid) to authenticated;

-- Privilegios de tabla para los clientes (RLS sigue mandando).
grant select on public.athlete_career, public.athlete_videos to anon;
grant select, insert, update, delete on public.athlete_career, public.athlete_videos, public.athlete_goals to authenticated;
revoke all on public.passport_views from anon, authenticated;

-- 10. Foto del atleta: bucket PRIVADO; se sirve con URL firmada solo a quien puede ver el perfil.
alter table public.athlete_profiles
  add column photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  add constraint photo_belongs_to_athlete check (photo_path is null or split_part(photo_path, '/', 1) = user_id::text);

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('athlete-photos', 'athlete-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$create policy photos_select on storage.objects for select to anon, authenticated
      using (bucket_id = 'athlete-photos' and public.can_view_athlete(public.document_owner(name), 'profile'))$p$;
    execute $p$create policy photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'athlete-photos' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'edit_profile')))$p$;
    execute $p$create policy photos_update on storage.objects for update to authenticated
      using (bucket_id = 'athlete-photos' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'edit_profile')))$p$;
    execute $p$create policy photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'athlete-photos' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'edit_profile')))$p$;
  end if;
end $$;

-- 11. Edad visible (nunca la fecha de nacimiento) para quien puede ver el perfil.
create or replace function public.athlete_age(p_athlete uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when public.can_view_athlete(p_athlete, 'profile')
              then extract(year from age(current_date, d.date_of_birth))::int end
    from public.private_profile_data d where d.user_id = p_athlete;
$$;
revoke all on function public.athlete_age(uuid) from public;
grant execute on function public.athlete_age(uuid) to anon, authenticated;

revoke execute on function public.guard_minor_visibility(), public.guard_athlete_videos(), public.guard_academic_sources()
  from public, anon, authenticated;

-- =============================================================================
-- ROLLBACK (manual, en este orden):
--   drop function public.athlete_age(uuid); drop function public.passport_view_stats(uuid); drop function public.record_passport_view(uuid);
--   drop table public.passport_views, public.athlete_goals, public.athlete_videos, public.athlete_career;
--   drop trigger t_guard_academic_sources on public.athlete_academics; drop function public.guard_academic_sources();
--   alter table public.athlete_academics drop column education_system, ... (columnas añadidas en 7);
--   drop policy achievements_select ...; recrear con can_view_athlete(athlete_id, 'profile');
--   alter table public.athlete_achievements drop column kind, drop column level;
--   alter table public.athlete_statistics drop constraint athlete_statistics_unique_line;
--   (antes, eliminar duplicados por equipo/competición) add unique (athlete_id, stat_definition_id, season);
--   alter table public.athlete_statistics drop column team, drop column competition;
--   drop trigger t_guard_minor_visibility ...; drop function public.guard_minor_visibility();
--   restaurar can_view_athlete desde 20261115000100_user_blocks.sql;
--   drop policy photos_select/photos_insert/photos_update/photos_delete on storage.objects; vaciar y borrar bucket athlete-photos;
--   alter table public.athlete_profiles drop column photo_path, username, nationality, weight_kg, league, years_experience,
--     sport_visibility, videos_visibility, goals_visibility.
-- =============================================================================
