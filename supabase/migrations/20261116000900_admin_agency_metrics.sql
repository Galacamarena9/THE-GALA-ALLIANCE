-- =============================================================================
-- Métricas de uso de Agency Core para administración (solo admin).
-- Cifras agregadas: no devuelve nombres de atletas, agencias ni contactos.
-- =============================================================================
create or replace function public.admin_agency_metrics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'agencies_total', (select count(*) from public.organizations where type = 'agency'),
    'agencies_with_cases', (select count(distinct agency_id) from public.recruiting_cases),
    'agencies_active_period', (
      select count(distinct c.agency_id) from public.recruiting_case_activities a
      join public.recruiting_cases c on c.id = a.case_id where a.created_at >= v_since),
    'cases_total', (select count(*) from public.recruiting_cases),
    'cases_opened', (select count(*) from public.recruiting_cases where created_at >= v_since),
    'cases_committed', (select count(*) from public.recruiting_cases where stage = 'committed'),
    'stage_changes', (select count(*) from public.recruiting_case_activities where kind = 'stage_change' and from_stage is not null and created_at >= v_since),
    'interactions', (select count(*) from public.recruiting_case_activities where kind <> 'stage_change' and created_at >= v_since),
    'tasks_done', (select count(*) from public.recruiting_case_tasks where done and done_at >= v_since),
    'contacts_total', (select count(*) from public.agency_contacts),
    'shared_with_athlete', (select count(*) from public.recruiting_cases where shared_with_athlete),
    'by_stage', coalesce((select jsonb_object_agg(stage, n) from (select stage, count(*) n from public.recruiting_cases group by stage) s), '{}'::jsonb)
  );
end;
$$;
revoke execute on function public.admin_agency_metrics(int) from public, anon;
grant execute on function public.admin_agency_metrics(int) to authenticated;
