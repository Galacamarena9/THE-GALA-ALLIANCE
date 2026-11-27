-- =============================================================================================================
-- QA coach-club (hallazgos 7, 9 y 14): un coach NCAA y un club europeo encuentran talento rápido.
--
-- 1. discover_athlete_ids admite filtros nuevos, cada uno SOLO sobre atletas que permiten filtrar ese bloque
--    (athlete_field_allows(..., 'filter')): un dato que el atleta no deja filtrar nunca incluye a nadie.
--      min_gpa       nota media estimada a escala 4.0 (athlete_academics.gpa_4) · bloque academics
--      english       nivel de inglés mínimo (b1…c2/nativo, athlete_languages) · perfil (ya exigido por Discovery)
--      english_test  tiene TOEFL/IELTS/Duolingo/Cambridge · bloque academics
--      division      división objetivo (target_divisions o rutas de athlete_goals) · bloque goals
--      start         incorporación «AAAA-fall|spring» (athlete_goals.start_term) · bloque goals
--      open          abierto a ofertas de tu tipo de organización: lo dijo en Discovery (opportunity_types) o en sus
--                    objetivos (rutas: universidad / club) · goals
--      contactable   solo atletas con la ventana de contacto NCAA abierta para tu organización (ncaa_contact_closed)
--      sort          recent (actividad reciente, por defecto) · grad (promoción) · fit (encaje con una necesidad)
--      need          necesidad de recruiting DE TU organización (para ordenar por encaje)
--    El orden por encaje replica needFit (src/lib/domain/recruit.ts) con los permisos de «match» de cada bloque:
--    compatibilidad con criterios registrados, no valoración del talento. Presupuesto familiar: nunca.
--    La promoción no cambia (ya admite 2020-2040: graduados de años anteriores incluidos).
-- 2. org_saved_searches acepta esas claves (lista cerrada; sigue sin URL ni texto libre fuera de «q»).
-- 3. organization_is_public(id): la página pública /organizaciones/[id] leía organizations.org_status, columna que
--    anon no puede leer desde la fase 8 → la consulta fallaba y la página daba 404 siempre. Ahora pregunta a esta
--    función (verificada y activa) sin abrir la columna.
-- ROLLBACK:
--   restaurar discover_athlete_ids de 20261122000200_11d_pentest_fixes.sql (mismos grants);
--   restaurar el check filters de org_saved_searches de 20261120000500;
--   drop function public.organization_is_public(uuid);
-- =============================================================================================================

create or replace function public.discover_athlete_ids(p_org uuid, p_filters jsonb, p_page integer default 1, p_page_size integer default 24)
 returns table(user_id uuid, total bigint, match_blocked text[])
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare
  v_sport text := p_filters->>'sport';
  v_pos int := nullif(p_filters->>'position', '')::int;
  v_grad int := nullif(p_filters->>'grad', '')::int;
  v_country text := nullif(p_filters->>'country', '');
  v_min_h int := nullif(p_filters->>'min_height', '')::int;
  v_video boolean := coalesce((p_filters->>'video')::boolean, false);
  v_acad boolean := coalesce((p_filters->>'academics')::boolean, false);
  v_stats boolean := coalesce((p_filters->>'verified_stats')::boolean, false);
  v_q text := nullif(left(regexp_replace(coalesce(p_filters->>'q', ''), '[%_\\]', '', 'g'), 60), '');
  v_gpa numeric := nullif(p_filters->>'min_gpa', '')::numeric;
  v_eng text := nullif(p_filters->>'english', '');
  v_etest boolean := coalesce((p_filters->>'english_test')::boolean, false);
  v_div text := nullif(p_filters->>'division', '');
  v_start text := nullif(p_filters->>'start', '');
  v_open boolean := coalesce((p_filters->>'open')::boolean, false);
  v_contactable boolean := coalesce((p_filters->>'contactable')::boolean, false);
  v_sort text := coalesce(nullif(p_filters->>'sort', ''), 'recent');
  v_need_id uuid := nullif(p_filters->>'need', '')::uuid;
  v_from text; v_to text; v_y int;
  v_levels text[] := array['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'];
  v_org_type text;
  v_types public.opportunity_type[];
  v_paths text[];
  n record;
  v_size int := least(greatest(coalesce(p_page_size, 24), 1), 24);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  if not public.org_can(p_org, 'discover') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not public.discovery_consume() then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  if v_sport is null or not exists (select 1 from public.sports where id = v_sport) then raise exception 'sport_required' using errcode = 'P0001'; end if;
  if v_page > 20 then raise exception 'page_limit' using errcode = 'P0001'; end if;
  if (select count(*) from jsonb_object_keys(p_filters) k where k not in ('sport', 'position', 'grad', 'country', 'min_height', 'video',
      'academics', 'verified_stats', 'q', 'min_gpa', 'english', 'english_test', 'division', 'start', 'open', 'contactable', 'sort', 'need')) > 0
     or (v_gpa is not null and (v_gpa <= 0 or v_gpa > 4))
     or (v_eng is not null and v_eng not in ('b1', 'b2', 'c1', 'c2'))
     or (v_div is not null and v_div not in ('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'))
     or (v_start is not null and v_start !~ '^20[2-4][0-9]-(fall|spring)$')
     or v_sort not in ('recent', 'grad', 'fit')
     or (v_sort = 'fit' and v_need_id is null) then
    raise exception 'invalid_filter' using errcode = 'P0001';
  end if;
  -- Siempre se asigna (sin necesidad, todo null): la necesidad tiene que ser de esta organización.
  select * into n from public.recruiting_needs rn where rn.id = v_need_id and rn.organization_id = p_org;
  if v_need_id is not null and n.id is null then raise exception 'invalid_filter' using errcode = 'P0001'; end if;
  if v_start is not null then
    v_y := left(v_start, 4)::int;
    if v_start like '%-fall' then v_from := v_y || '-06'; v_to := v_y || '-10';
    else v_from := (v_y - 1) || '-11'; v_to := v_y || '-05'; end if;
  end if;
  select o.type::text into v_org_type from public.organizations o where o.id = p_org;
  if v_org_type in ('university', 'college') then
    v_types := array['athletic_scholarship', 'university_recruitment']::public.opportunity_type[];
    v_paths := array['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa', 'intl_university'];
  else
    v_types := array['club_recruitment', 'academy', 'tryout', 'camp_showcase', 'development_program']::public.opportunity_type[];
    v_paths := array['club', 'academy', 'professional'];
  end if;

  return query
  with base as (
    select ap.user_id as uid, ap.updated_at, ap.graduation_year as grad, ap.sport_id, ap.primary_position_id as pos1,
           ap.secondary_position_id as pos2, ap.height_cm, ap.highlight_video_url, p.country
      from public.athlete_profiles ap
      join public.profiles p on p.id = ap.user_id
     where ap.sport_id = v_sport
       and public.can_discover_athlete(p_org, ap.user_id)
       and public.athlete_field_allows(ap.user_id, 'sport', 'filter')
       and (v_pos is null or ap.primary_position_id = v_pos or ap.secondary_position_id = v_pos)
       and (v_grad is null or ap.graduation_year = v_grad)
       and (v_country is null or p.country = v_country)
       and (v_q is null or p.display_name ilike '%' || v_q || '%')
       and (v_min_h is null or (ap.height_cm >= v_min_h and public.athlete_field_allows(ap.user_id, 'physical', 'filter')))
       and (not v_video or (public.athlete_field_allows(ap.user_id, 'videos', 'filter')
            and (ap.highlight_video_url is not null or exists (select 1 from public.athlete_videos v where v.athlete_id = ap.user_id))))
       and (not v_acad or (public.athlete_field_allows(ap.user_id, 'academics', 'filter')
            and exists (select 1 from public.athlete_academics a where a.athlete_id = ap.user_id and a.gpa_source <> 'self_reported')))
       and (not v_stats or (public.athlete_field_allows(ap.user_id, 'stats', 'filter')
            and exists (select 1 from public.athlete_statistics s where s.athlete_id = ap.user_id and s.source <> 'self_reported')))
       and (v_gpa is null or (public.athlete_field_allows(ap.user_id, 'academics', 'filter')
            and exists (select 1 from public.athlete_academics a where a.athlete_id = ap.user_id and a.gpa_4 >= v_gpa)))
       and (not v_etest or (public.athlete_field_allows(ap.user_id, 'academics', 'filter')
            and exists (select 1 from public.athlete_academics a where a.athlete_id = ap.user_id and a.english_test is not null and a.english_test <> 'none')))
       and (v_eng is null or exists (select 1 from public.athlete_languages l where l.athlete_id = ap.user_id and l.language_code = 'en'
            and array_position(v_levels, l.level) >= array_position(v_levels, v_eng)))
       and (v_div is null or (public.athlete_field_allows(ap.user_id, 'goals', 'filter')
            and (v_div::public.division = any (ap.target_divisions)
                 or exists (select 1 from public.athlete_goals g where g.athlete_id = ap.user_id and v_div = any (g.pathways)))))
       and (v_start is null or (public.athlete_field_allows(ap.user_id, 'goals', 'filter')
            and exists (select 1 from public.athlete_goals g where g.athlete_id = ap.user_id and g.start_term between v_from and v_to)))
       and (not v_open or exists (select 1 from public.athlete_discovery_settings s where s.athlete_id = ap.user_id and s.opportunity_types && v_types)
            or (public.athlete_field_allows(ap.user_id, 'goals', 'filter')
                and exists (select 1 from public.athlete_goals g where g.athlete_id = ap.user_id and g.pathways && v_paths)))
       and (not v_contactable or not public.ncaa_contact_closed(p_org, ap.user_id))
  ),
  fit as (
    -- Espejo de needFit: 1 = cumple, 0 = no cumple, null = desconocido (no visible o sin permiso de Match).
    select b.*, s.*
      from base b
      cross join lateral (
        select
          case when n.id is null or cardinality(n.position_ids) = 0 then null
               when b.pos1 is null and b.pos2 is null then null
               when b.pos1 = any (n.position_ids) or b.pos2 = any (n.position_ids) then 1 else 0 end as s_pos,
          case when n.id is null or cardinality(n.class_years) = 0 then null
               when b.grad is null then null when b.grad = any (n.class_years) then 1 else 0 end as s_cls,
          case when n.id is null or n.min_height_cm is null then null
               when b.height_cm is null or not public.athlete_field_allows(b.uid, 'physical', 'match') then null
               when b.height_cm >= n.min_height_cm then 1 else 0 end as s_h,
          case when public.athlete_field_allows(b.uid, 'videos', 'match') and public.can_view_athlete(b.uid, 'videos')
                    and (b.highlight_video_url is not null or exists (select 1 from public.athlete_videos v where v.athlete_id = b.uid)) then 1
               when coalesce(n.requires_video, false) then 0 end as s_vid,
          case when n.id is null or not n.requires_documented_academics then null
               when not public.athlete_field_allows(b.uid, 'academics', 'match') or not public.can_view_athlete(b.uid, 'academics') then null
               else (select case when a.gpa_source <> 'self_reported' then 1 else 0 end from public.athlete_academics a where a.athlete_id = b.uid) end as s_acad,
          case when n.id is null or cardinality(n.countries) = 0 or b.country is null then null
               when b.country = any (n.countries) then 1 else 0 end as s_ctry,
          case when public.athlete_field_allows(b.uid, 'stats', 'match') and public.can_view_athlete(b.uid, 'stats')
                    and exists (select 1 from public.athlete_statistics st where st.athlete_id = b.uid and st.source <> 'self_reported') then 1 end as s_stats
      ) s
  ),
  scored as (
    select f.*,
           (n.id is not null and (f.sport_id is distinct from n.sport_id or f.s_pos = 0 or f.s_cls = 0 or (n.requires_video and f.s_vid = 0))) as blocked,
           w.total_w, w.known_w, w.met_w
      from fit f
      cross join lateral (
        select
          (case when cardinality(coalesce(n.position_ids, '{}')) > 0 then 30 else 0 end
           + case when cardinality(coalesce(n.class_years, '{}')) > 0 then 25 else 0 end
           + case when n.min_height_cm is not null then 15 else 0 end
           + case when coalesce(n.requires_video, false) then 15 else 8 end
           + case when coalesce(n.requires_documented_academics, false) then 15 else 0 end
           + case when cardinality(coalesce(n.countries, '{}')) > 0 then 8 else 0 end + 7)::numeric as total_w,
          (case when f.s_pos is not null then 30 else 0 end + case when f.s_cls is not null then 25 else 0 end
           + case when f.s_h is not null then 15 else 0 end + case when f.s_vid is not null then case when n.requires_video then 15 else 8 end else 0 end
           + case when f.s_acad is not null then 15 else 0 end + case when f.s_ctry is not null then 8 else 0 end
           + case when f.s_stats is not null then 7 else 0 end)::numeric as known_w,
          (case when f.s_pos = 1 then 30 else 0 end + case when f.s_cls = 1 then 25 else 0 end
           + case when f.s_h = 1 then 15 else 0 end + case when f.s_vid = 1 then case when n.requires_video then 15 else 8 end else 0 end
           + case when f.s_acad = 1 then 15 else 0 end + case when f.s_ctry = 1 then 8 else 0 end
           + case when f.s_stats = 1 then 7 else 0 end)::numeric as met_w
      ) w
  )
  select sc.uid, count(*) over (),
         array(select g from unnest(array['physical', 'academics', 'stats', 'videos', 'goals']) g where not public.athlete_field_allows(sc.uid, g, 'match'))
    from scored sc
   order by
     case when v_sort = 'fit' then sc.blocked end asc nulls last,
     case when v_sort = 'fit' and not sc.blocked and sc.known_w / nullif(sc.total_w, 0) >= 0.4 then sc.met_w / nullif(sc.known_w, 0) end desc nulls last,
     case when v_sort = 'grad' then sc.grad end asc nulls last,
     sc.updated_at desc, sc.uid
   limit v_size offset (v_page - 1) * v_size;
end;
$function$;
revoke all on function public.discover_athlete_ids(uuid, jsonb, integer, integer) from public, anon;
grant execute on function public.discover_athlete_ids(uuid, jsonb, integer, integer) to authenticated;

-- 2. Búsquedas guardadas: las claves nuevas (lista cerrada) -------------------------------------------------
alter table public.org_saved_searches drop constraint if exists org_saved_searches_filters_check;
alter table public.org_saved_searches add constraint org_saved_searches_filters_check check (
  jsonb_typeof(filters) = 'object' and filters ? 'sport'
  and (filters - array['sport', 'position', 'grad', 'country', 'min_height', 'video', 'academics', 'verified_stats', 'q',
                       'min_gpa', 'english', 'english_test', 'division', 'start', 'open', 'contactable', 'sort']) = '{}'::jsonb
);

-- 3. ¿Es pública esta organización? (verificada y activa) sin abrir organizations.org_status a anon -----------
create or replace function public.organization_is_public(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = p_org and o.verification_status = 'verified' and o.org_status = 'active');
$$;
revoke all on function public.organization_is_public(uuid) from public;
grant execute on function public.organization_is_public(uuid) to anon, authenticated;
