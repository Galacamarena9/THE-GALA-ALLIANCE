-- Fase 8 · Buscador de oportunidades del agente.
--
-- 1. agent_discovery_athlete(atleta): el ÚNICO camino para que el agente obtenga el contexto de encaje de un atleta.
--    · Solo si agent_can(atleta, 'passport.view') (representación activa, en fechas, agencia verificada, asignado,
--      y para menores con aprobación del tutor y familia activa). Si no, error 42501: un UUID ajeno no devuelve nada.
--    · Devuelve solo lo que el motor necesita, en forma mínima (sí/no en lugar de documentos, ningún presupuesto,
--      ninguna fecha de nacimiento, ningún dato de la familia ni notas internas).
-- 2. saved_searches admite búsquedas de oportunidades de un agente para un atleta concreto (scope 'opportunities'),
--    con su propia lista blanca de claves y la misma comprobación de representación al crearlas.
--
-- ROLLBACK:
--   drop function if exists public.agent_discovery_athlete(uuid);
--   alter table public.saved_searches drop constraint if exists saved_searches_filters_check;
--   alter table public.saved_searches add constraint saved_searches_filters_check check (jsonb_typeof(filters) = 'object'
--     and (filters - array['q','sport','position','grad','grad_min','grad_max','division','gpa','video','country','nationality','min_height',
--          'max_height','min_weight','max_weight','side','english','verified','exp_min','league']) = '{}'::jsonb);
--   alter table public.saved_searches drop constraint if exists saved_searches_scope_subject;
--   alter table public.saved_searches drop column if exists subject_id, drop column if exists scope;
--   (y restaurar guard_saved_search desde 20261113000500_business_and_lovable_port.sql)

-- 1 ---------------------------------------------------------------------------------------------------------
create or replace function public.agent_discovery_athlete(p_athlete uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if p_athlete is null or not public.agent_can(p_athlete, 'passport.view') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'sport_id', ap.sport_id,
    'primary_position_id', ap.primary_position_id,
    'secondary_position_id', ap.secondary_position_id,
    'graduation_year', ap.graduation_year,
    'country', coalesce(pr.country, ap.nationality),
    'pathways', coalesce(nullif(g.pathways, '{}'), ap.target_divisions::text[], '{}'),
    'countries', coalesce(g.countries, '{}'),
    'regions', coalesce(g.regions, '{}'),
    'intended_majors', coalesce(nullif(g.intended_majors, '{}'), case when ap.intended_major is not null then array[ap.intended_major] end, '{}'),
    'school_size', g.school_size,
    'sport_level', g.sport_level,
    'campus_setting', g.campus_setting,
    'scholarship_need', g.scholarship_need,
    'gpa', ac.gpa,
    'gpa_scale', ac.gpa_scale,
    'education_system', ac.education_system,
    'has_english_certificate', coalesce(ac.cambridge_level is not null or ac.toefl_score is not null or ac.ielts_score is not null
                                        or ac.duolingo_score is not null or (ac.english_test is not null and ac.english_test <> 'none' and ac.english_score is not null), false),
    'has_highlight', exists (select 1 from public.athlete_videos v where v.athlete_id = p_athlete and v.kind = 'highlight'),
    'has_full_game', exists (select 1 from public.athlete_videos v where v.athlete_id = p_athlete and v.kind = 'full_game'),
    'verified_stats', (select count(*) from public.athlete_statistics s where s.athlete_id = p_athlete and s.source = 'club_verified')
  ) into v
  from public.athlete_profiles ap
  left join public.profiles pr on pr.id = ap.user_id
  left join public.athlete_goals g on g.athlete_id = ap.user_id
  left join public.athlete_academics ac on ac.athlete_id = ap.user_id
  where ap.user_id = p_athlete;
  return v;
end;
$$;
revoke all on function public.agent_discovery_athlete(uuid) from public, anon;
grant execute on function public.agent_discovery_athlete(uuid) to authenticated;

-- 2 ---------------------------------------------------------------------------------------------------------
alter table public.saved_searches add column if not exists scope text not null default 'talent' check (scope in ('talent', 'opportunities'));
alter table public.saved_searches add column if not exists subject_id uuid references public.profiles (id) on delete cascade;
create index if not exists saved_searches_subject_idx on public.saved_searches (subject_id);
alter table public.saved_searches drop constraint if exists saved_searches_scope_subject;
alter table public.saved_searches add constraint saved_searches_scope_subject check ((scope = 'talent') = (subject_id is null));

alter table public.saved_searches drop constraint if exists saved_searches_filters_check;
alter table public.saved_searches add constraint saved_searches_filters_check check (
  jsonb_typeof(filters) = 'object'
  and case scope
    when 'opportunities' then (filters - array['sport', 'destination', 'level', 'aid', 'intake', 'type', 'closing', 'verified', 'eligible']) = '{}'::jsonb
    else (filters - array['q', 'sport', 'position', 'grad', 'grad_min', 'grad_max', 'division', 'gpa', 'video',
                          'country', 'nationality', 'min_height', 'max_height', 'min_weight', 'max_weight',
                          'side', 'english', 'verified', 'exp_min', 'league']) = '{}'::jsonb
  end
);

create or replace function public.guard_saved_search()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    if not (public.has_role('university') or public.has_role('coach') or public.has_role('agent')
            or public.has_role('brand') or public.is_admin()) then
      raise exception 'recruiter_role_required' using errcode = '42501';
    end if;
    if (select count(*) from public.saved_searches where owner_id = new.owner_id) >= 25 then
      raise exception 'saved_search_limit' using errcode = 'P0001';
    end if;
  elsif new.owner_id is distinct from old.owner_id or new.scope is distinct from old.scope or new.subject_id is distinct from old.subject_id then
    raise exception 'owner_immutable' using errcode = '42501';
  end if;
  -- Búsqueda de oportunidades: solo un agente y solo para un atleta que representa con acceso al perfil.
  if tg_op = 'INSERT' and new.scope = 'opportunities'
     and not (public.has_role('agent') and public.agent_can(new.subject_id, 'passport.view')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_saved_search() from public, anon, authenticated;
