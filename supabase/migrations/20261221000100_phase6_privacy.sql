-- =============================================================================================================
-- Fase 6 de la auditoría: privacidad fina (hallazgos S4, S8 y S9; S5, S10 y S11 se resuelven en la app).
--
-- S4 · La visibilidad por bloque se podía saltar leyendo athlete_profiles directamente: la RLS de la fila solo mira
--      el bloque «profile», así que altura, peso, equipo, liga, objetivos o el vídeo destacado salían aunque el atleta
--      hubiera puesto esos bloques en privado. Ahora esas columnas no se pueden leer desde la API: se sirven con
--      athlete_block_fields(), que aplica el bloque de cada una (sport, goals, videos) con can_view_athlete.
--      athlete_directory sigue siendo security_invoker y toma esas columnas de la misma función.
-- S8 · El filtro de datos de contacto con menores se esquivaba escribiendo «arroba», «(at)» o el número con espacios
--      o letras. has_contact_data() normaliza el texto antes de buscar emails, teléfonos y redes.
-- S9 · La ficha /r/… de un menor mostraba sus académicos aunque la visibilidad fuera «miembros». Con un menor, la
--      ficha ya no enseña académicos (se ven en la plataforma, con la aprobación de la familia).
--
-- ROLLBACK:
--   grant select on public.athlete_profiles to anon, authenticated;
--   drop function if exists public.athlete_block_fields(uuid); drop function if exists public.athlete_block_fields_many(uuid[]);
--   restaurar athlete_directory (20261206000100), get_recruiting_card (20261114000300),
--   guard_contact_message (20261210000100) y guard_athlete_update (20261113000500);
--   drop function if exists public.has_contact_data(text);
-- =============================================================================================================

-- S4 · Campos por bloque ------------------------------------------------------------------------------------------
create or replace function public.athlete_block_fields_many(p_athletes uuid[])
returns table (
  user_id uuid,
  height_cm int, weight_kg int, dominant_side text, current_team text, competitive_level text,
  league text, years_experience int,
  target_divisions public.division[], intended_major text,
  highlight_video_url text
)
language sql stable security definer set search_path = public as $$
  select ap.user_id,
         case when v.sport then ap.height_cm end,
         case when v.sport then ap.weight_kg end,
         case when v.sport then ap.dominant_side end,
         case when v.sport then ap.current_team end,
         case when v.sport then ap.competitive_level end,
         case when v.sport then ap.league end,
         case when v.sport then ap.years_experience end,
         case when v.goals then ap.target_divisions else '{}'::public.division[] end,
         case when v.goals then ap.intended_major end,
         case when v.videos then ap.highlight_video_url end
    from public.athlete_profiles ap
    cross join lateral (
      select public.can_view_athlete(ap.user_id, 'sport') as sport,
             public.can_view_athlete(ap.user_id, 'goals') as goals,
             public.can_view_athlete(ap.user_id, 'videos') as videos
    ) v
   where ap.user_id = any (p_athletes)
     and cardinality(p_athletes) <= 200
     and public.can_view_athlete(ap.user_id, 'profile');
$$;

create or replace function public.athlete_block_fields(p_athlete uuid)
returns table (
  user_id uuid,
  height_cm int, weight_kg int, dominant_side text, current_team text, competitive_level text,
  league text, years_experience int,
  target_divisions public.division[], intended_major text,
  highlight_video_url text
)
language sql stable security definer set search_path = public as $$
  select * from public.athlete_block_fields_many(array[p_athlete]);
$$;

revoke execute on function public.athlete_block_fields_many(uuid[]) from public;
revoke execute on function public.athlete_block_fields(uuid) from public;
grant execute on function public.athlete_block_fields_many(uuid[]) to anon, authenticated;
grant execute on function public.athlete_block_fields(uuid) to anon, authenticated;

-- El directorio toma los campos protegidos de la función (sigue siendo security_invoker: misma RLS de filas).
create or replace view public.athlete_directory with (security_invoker = true) as
select
  ap.user_id,
  p.display_name,
  p.avatar_url,
  p.country,
  ap.headline,
  case when v.sport then ap.sport_id end as sport_id,
  case when v.sport then ap.primary_position_id end as primary_position_id,
  case when v.sport then ap.secondary_position_id end as secondary_position_id,
  ap.graduation_year,
  f.height_cm,
  f.current_team,
  f.competitive_level,
  f.target_divisions,
  ap.open_to_opportunities,
  (v.videos and (f.highlight_video_url is not null
     or exists (select 1 from public.athlete_videos av where av.athlete_id = ap.user_id))) as has_video,
  ap.updated_at,
  case when v.profile then ap.nationality end as nationality,
  case when v.profile then ap.city end as city,
  f.weight_kg,
  f.dominant_side,
  f.league,
  f.years_experience,
  case when v.profile then (
    select l.level from public.athlete_languages l
     where l.athlete_id = ap.user_id and l.language_code = 'en'
     order by array_position(array['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'], l.level) desc
     limit 1
  ) end as english_level,
  (v.stats and exists (
    select 1 from public.athlete_statistics st
     where st.athlete_id = ap.user_id and st.source = 'club_verified'
  )) as has_verified_stats
from public.athlete_profiles ap
join public.profiles p on p.id = ap.user_id
cross join lateral (
  select
    public.can_view_athlete(ap.user_id, 'profile') as profile,
    public.can_view_athlete(ap.user_id, 'sport') as sport,
    public.can_view_athlete(ap.user_id, 'videos') as videos,
    public.can_view_athlete(ap.user_id, 'stats') as stats
) v
left join lateral public.athlete_block_fields(ap.user_id) f on true;

grant select on public.athlete_directory to authenticated;

-- Las columnas protegidas dejan de leerse desde la API (escribir sigue igual: athlete_update).
revoke select on public.athlete_profiles from anon, authenticated;
grant select (user_id, headline, bio, sport_id, primary_position_id, secondary_position_id, graduation_year,
              city, open_to_opportunities, profile_visibility, academics_visibility, stats_visibility,
              sport_visibility, videos_visibility, goals_visibility, created_at, updated_at, username,
              nationality, photo_path)
  on public.athlete_profiles to anon, authenticated;

-- S8 · Datos de contacto aunque estén disfrazados ------------------------------------------------------------------
create or replace function public.has_contact_data(p_text text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  t text := lower(coalesce(p_text, ''));
  run text;
  groups text[];
begin
  if t = '' then return false; end if;
  -- «arroba», «(at)», «[at]», « at » → @ ; «punto», «(dot)», « dot » → .
  t := regexp_replace(t, '\s*(\(|\[|\{)\s*(at|arroba)\s*(\)|\]|\})\s*', '@', 'g');
  t := regexp_replace(t, '\s+(arroba|at)\s+', '@', 'g');
  t := regexp_replace(t, '\s*(\(|\[|\{)\s*(dot|punto)\s*(\)|\]|\})\s*', '.', 'g');
  t := regexp_replace(t, '\s+(punto|dot)\s+', '.', 'g');
  if t ~ '[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then return true; end if;
  if t ~ '(whatsapp|whats app|wasap|guasap|telegram|instagram|\minsta\M|snapchat|tiktok|tik tok|wa\.me|t\.me/|discord)' then return true; end if;
  -- Teléfono: 9 o más cifras en un tramo, aunque vayan separadas por espacios, puntos, guiones o barras.
  -- No cuenta una lista de años (2024 2025 2026).
  for run in select m[1] from regexp_matches(t, '(\+?\d[\d\s().\-/]{7,}\d)', 'g') as m loop
    groups := array(select g from regexp_split_to_table(run, '[^0-9]+') g where g <> '');
    if length(array_to_string(groups, '')) >= 9
       and not (select bool_and(g ~ '^(19|20)\d\d$') from unnest(groups) g) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;
revoke execute on function public.has_contact_data(text) from public, anon;
grant execute on function public.has_contact_data(text) to authenticated;

create or replace function public.guard_contact_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_req public.contact_requests;
begin
  select * into v_req from public.contact_requests where id = new.request_id;
  if v_req.status is distinct from 'accepted' then
    raise exception 'conversation_not_open' using errcode = 'P0001';
  end if;
  new.sender_id := auth.uid();
  -- Con menores no se comparten emails, teléfonos ni redes: todo dentro de la plataforma.
  if v_req.is_minor_at_request and public.has_contact_data(new.body) then
    raise exception 'contact_data_not_allowed_with_minors' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_messages where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.guard_athlete_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.athlete_id := auth.uid();
  new.created_at := now();
  new.expires_at := now() + interval '30 days';
  if public.is_minor(new.athlete_id) and public.has_contact_data(concat_ws(' ', new.body, new.link_url)) then
    raise exception 'contact_data_not_allowed_with_minors' using errcode = 'P0001';
  end if;
  if (select count(*) from public.athlete_updates where athlete_id = new.athlete_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_contact_message() from public, anon, authenticated;
revoke execute on function public.guard_athlete_update() from public, anon, authenticated;

-- S9 · Ficha /r/… de un menor sin académicos -----------------------------------------------------------------------
create or replace function public.get_recruiting_card(p_token text)
returns table (
  display_name text, avatar_url text, is_minor boolean, sport_name text, position_name text,
  graduation_year int, height_cm int, dominant_side text, current_team text, city text, country text,
  target_divisions public.division[], headline text, video_url text, intended_major text,
  gpa_4 numeric, english_test text, english_score text, sat_score int, expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_link public.recruiting_links;
  v_minor boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return; end if;
  select rl.* into v_link from public.recruiting_links rl
   where rl.token = p_token and rl.revoked_at is null and rl.expires_at > now();
  if not found then return; end if;

  insert into public.recruiting_link_views (link_id) values (v_link.id);
  v_minor := public.is_minor(v_link.athlete_id);

  return query
  select
    case when v_minor then
      split_part(btrim(p.display_name), ' ', 1)
      || case when position(' ' in btrim(p.display_name)) > 0
              then ' ' || left(split_part(btrim(p.display_name), ' ', 2), 1) || '.' else '' end
    else p.display_name end,
    p.avatar_url,
    v_minor,
    s.name_en,
    sp.name_en,
    ap.graduation_year,
    ap.height_cm,
    ap.dominant_side,
    case when v_minor then null else ap.current_team end,
    case when v_minor then null else ap.city end,
    case when v_minor then null else p.country end,
    ap.target_divisions,
    ap.headline,
    ap.highlight_video_url,
    ap.intended_major,
    case when not v_minor and ap.academics_visibility <> 'private' then ac.gpa_4 end,
    case when not v_minor and ap.academics_visibility <> 'private' then ac.english_test end,
    case when not v_minor and ap.academics_visibility <> 'private' then ac.english_score end,
    case when not v_minor and ap.academics_visibility <> 'private' then ac.sat_score end,
    v_link.expires_at
  from public.athlete_profiles ap
  join public.profiles p on p.id = ap.user_id
  left join public.sports s on s.id = ap.sport_id
  left join public.sport_positions sp on sp.id = ap.primary_position_id
  left join public.athlete_academics ac on ac.athlete_id = ap.user_id
  where ap.user_id = v_link.athlete_id;
end;
$$;
revoke execute on function public.get_recruiting_card(text) from public;
grant execute on function public.get_recruiting_card(text) to anon, authenticated;
