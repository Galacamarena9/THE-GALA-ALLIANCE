-- Búsqueda de talento (LinkedIn deportivo · herramienta de agentes y clubes).
-- EXTEND del directorio existente: mismas filas (security_invoker + RLS de athlete_profiles),
-- más columnas filtrables, cada una protegida por el mismo bloque de visibilidad que en el Passport.
-- Un dato oculto sale NULL, así que filtrar por él tampoco revela nada (no es un oráculo).
-- Nada de fecha de nacimiento, contacto ni finanzas: la edad se aproxima con el año de promoción.
-- Rendimiento: cada permiso se calcula una vez por fila (lateral), no una vez por columna.

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
  case when v.sport then ap.height_cm end as height_cm,
  case when v.sport then ap.current_team end as current_team,
  case when v.sport then ap.competitive_level end as competitive_level,
  case when v.goals then ap.target_divisions else '{}'::public.division[] end as target_divisions,
  ap.open_to_opportunities,
  (v.videos and (ap.highlight_video_url is not null
     or exists (select 1 from public.athlete_videos av where av.athlete_id = ap.user_id))) as has_video,
  ap.updated_at,
  -- Nuevas columnas filtrables (al final: la vista conserva el orden anterior).
  case when v.profile then ap.nationality end as nationality,
  case when v.profile then ap.city end as city,
  case when v.sport then ap.weight_kg end as weight_kg,
  case when v.sport then ap.dominant_side end as dominant_side,
  case when v.sport then ap.league end as league,
  case when v.sport then ap.years_experience end as years_experience,
  -- Nivel de inglés declarado (el más alto), solo si el perfil es visible para quien busca.
  case when v.profile then (
    select l.level from public.athlete_languages l
     where l.athlete_id = ap.user_id and l.language_code = 'en'
     order by array_position(array['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'], l.level) desc
     limit 1
  ) end as english_level,
  -- Estadísticas validadas por un club (no declaradas): señal de confianza para filtrar.
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
    public.can_view_athlete(ap.user_id, 'goals') as goals,
    public.can_view_athlete(ap.user_id, 'videos') as videos,
    public.can_view_athlete(ap.user_id, 'stats') as stats
) v;

grant select on public.athlete_directory to authenticated;

-- Índices para los filtros nuevos más usados (solo perfiles abiertos a oportunidades).
create index if not exists athlete_profiles_height_idx on public.athlete_profiles (height_cm) where open_to_opportunities;
create index if not exists athlete_profiles_nationality_idx on public.athlete_profiles (nationality) where open_to_opportunities;
create index if not exists athlete_statistics_verified_idx on public.athlete_statistics (athlete_id) where source = 'club_verified';
create index if not exists athlete_languages_en_idx on public.athlete_languages (athlete_id) where language_code = 'en';

-- Búsquedas guardadas: admiten los filtros nuevos (misma lista blanca que la app, nada más).
alter table public.saved_searches drop constraint if exists saved_searches_filters_check;
alter table public.saved_searches add constraint saved_searches_filters_check check (
  jsonb_typeof(filters) = 'object'
  and (filters - array['q', 'sport', 'position', 'grad', 'grad_min', 'grad_max', 'division', 'gpa', 'video',
                       'country', 'nationality', 'min_height', 'max_height', 'min_weight', 'max_weight',
                       'side', 'english', 'verified', 'exp_min', 'league']) = '{}'::jsonb
);
