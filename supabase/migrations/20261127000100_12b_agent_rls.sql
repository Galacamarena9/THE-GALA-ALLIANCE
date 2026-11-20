-- =============================================================================================================
-- Prompt 12B · RLS del agente y matriz de consentimiento.
-- Cadena: usuario → miembro de agencia verificada y activa → asignado a la representación → representación
-- efectiva hoy → permiso activo → alcance (deporte, territorio, tipo de oportunidad, oportunidad) → recurso.
-- Ser dueño o admin de la agencia NO salta la cadena. Presupuesto familiar y notas de familia: nunca.
-- =============================================================================================================

-- 1. Autorización con agencia concreta (para acciones «en nombre de» una agencia).
create or replace function public.agent_can_via(p_agency uuid, p_athlete uuid, p_permission text, p_sport text default null,
                                                p_country text default null, p_category text default null, p_opportunity uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.agent_representations r
      join public.representation_assignments a on a.representation_id = r.id and a.user_id = auth.uid() and a.ended_at is null
      join public.organization_members m on m.organization_id = r.agency_id and m.user_id = auth.uid()
      join public.organizations o on o.id = r.agency_id and o.verification_status = 'verified' and o.org_status = 'active'
      join public.representation_permissions p on p.representation_id = r.id and p.permission = p_permission and p.status = 'active'
                                              and (p.expires_at is null or p.expires_at > now())
     where r.athlete_id = p_athlete and (p_agency is null or r.agency_id = p_agency)
       and r.status = 'active' and current_date between r.start_date and r.end_date
       and (a.role <> 'viewer' or p_permission in ('passport.view', 'pipeline.view', 'offers.view', 'documents.view'))
       and (not public.is_minor(r.athlete_id) or (r.guardian_approved_at is not null and public.minor_has_active_family(r.athlete_id)))
       and public.representation_covers(r.id, p_sport, p_country, p_category, p_opportunity)
  );
$$;

create or replace function public.agent_can(p_athlete uuid, p_permission text, p_sport text default null, p_country text default null,
                                            p_category text default null, p_opportunity uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.agent_can_via(null, p_athlete, p_permission, p_sport, p_country, p_category, p_opportunity);
$$;

-- 2. Perfil: la representación da «conexión» solo a quien tiene passport.view (antes: cualquier miembro de la agencia).
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
  ) or public.agent_can(p_athlete, 'passport.view')
  or exists (
    select 1 from public.club_roster cr
      join public.organization_members m on m.organization_id = cr.organization_id
     where cr.athlete_id = p_athlete and m.user_id = auth.uid() and cr.status = 'active'
  );
$$;

-- 2b. Passport: el agente con passport.view lo ve aunque sea privado; académico, nunca por representación.
CREATE OR REPLACE FUNCTION public.can_view_athlete(p_athlete uuid, p_block text DEFAULT 'profile'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- 12B: el agente asignado con passport.view ve el Passport aunque sea privado (lo eligió el atleta).
  -- Académico no: no hay permiso de agente para ello.
  if p_block <> 'academics' and public.agent_can(p_athlete, 'passport.view') then return true; end if;

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
$function$;

-- 3. Trials, campus e inscripciones en nombre del atleta: opportunities.manage de ESA agencia.
create or replace function public.trial_actor(p_athlete uuid, p_agency uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() = p_athlete then 'athlete'
    when public.has_family_link(p_athlete, 'edit_profile') then 'family'
    when p_agency is not null and public.agency_can_write(p_agency) and public.agent_can_via(p_agency, p_athlete, 'opportunities.manage') then 'agent'
    else null
  end;
$$;

-- 4. Pipeline de la agencia (recruiting_cases, procesos con universidades): ver = pipeline.view; crear y mover =
--    pipeline.manage, dentro del deporte del caso y del tipo «university».
--    La dirección de la agencia (owner/admin/manager) conserva el historial de sus casos para supervisar,
--    pero no abre casos nuevos ni actúa sin estar asignada.
create or replace function public.case_access(p_agency uuid, p_athlete uuid, p_write boolean, p_sport text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_agency) and (
    public.agent_can_via(p_agency, p_athlete, case when p_write then 'pipeline.manage' else 'pipeline.view' end, p_sport, null, 'university')
    or (not p_write and public.agency_manages(p_agency)));
$$;

drop policy if exists recruiting_cases_select on public.recruiting_cases;
drop policy if exists recruiting_cases_insert on public.recruiting_cases;
drop policy if exists recruiting_cases_update on public.recruiting_cases;
create policy recruiting_cases_select on public.recruiting_cases for select to authenticated
  using (public.case_access(agency_id, athlete_id, false, sport_id) or (athlete_id = (select auth.uid()) and shared_with_athlete));
create policy recruiting_cases_insert on public.recruiting_cases for insert to authenticated
  with check (public.agency_can_write(agency_id) and public.case_access(agency_id, athlete_id, true, sport_id));
create policy recruiting_cases_update on public.recruiting_cases for update to authenticated
  using (public.agency_can_write(agency_id) and public.case_access(agency_id, athlete_id, true, sport_id))
  with check (public.agency_can_write(agency_id) and public.case_access(agency_id, athlete_id, true, sport_id));

create or replace function public.case_access_by_id(p_case uuid, p_write boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recruiting_cases c where c.id = p_case
                  and (not p_write or public.agency_can_write(c.agency_id)) and public.case_access(c.agency_id, c.athlete_id, p_write, c.sport_id));
$$;

drop policy if exists case_tasks_select on public.recruiting_case_tasks;
drop policy if exists case_tasks_insert on public.recruiting_case_tasks;
drop policy if exists case_tasks_update on public.recruiting_case_tasks;
drop policy if exists case_tasks_delete on public.recruiting_case_tasks;
create policy case_tasks_select on public.recruiting_case_tasks for select to authenticated using (public.case_access_by_id(case_id, false));
create policy case_tasks_insert on public.recruiting_case_tasks for insert to authenticated with check (public.case_access_by_id(case_id, true));
create policy case_tasks_update on public.recruiting_case_tasks for update to authenticated using (public.case_access_by_id(case_id, true)) with check (public.case_access_by_id(case_id, true));
create policy case_tasks_delete on public.recruiting_case_tasks for delete to authenticated using (public.case_access_by_id(case_id, true));

drop policy if exists case_activities_select on public.recruiting_case_activities;
drop policy if exists case_activities_insert on public.recruiting_case_activities;
create policy case_activities_select on public.recruiting_case_activities for select to authenticated
  using (public.case_access_by_id(case_id, false)
         or (kind = 'stage_change' and exists (select 1 from public.recruiting_cases c where c.id = case_id and c.athlete_id = (select auth.uid()) and c.shared_with_athlete)));
create policy case_activities_insert on public.recruiting_case_activities for insert to authenticated
  with check (kind <> 'stage_change' and actor_id = (select auth.uid()) and public.case_access_by_id(case_id, true));

-- 5. Documentos: una concesión a una agencia solo la usa quien además tiene documents.view sobre ese atleta.
create or replace function public.org_has_document_grant(p_document uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.info_requests r join public.athlete_documents d on d.id = r.document_id
        join public.organizations o on o.id = r.organization_id
       where r.document_id = p_document and r.status = 'shared' and r.shared_until >= current_date
         and not public.document_is_highly_restricted(d.kind)
         and public.org_can(r.organization_id, 'candidates')
         and (o.type <> 'agency' or public.agent_can_via(r.organization_id, d.athlete_id, 'documents.view')))
    or exists (
      select 1 from public.document_access_grants g join public.athlete_documents d on d.id = g.document_id
        join public.organizations o on o.id = g.organization_id
       where g.document_id = p_document and g.revoked_at is null and g.expires_at > now()
         and public.org_can(g.organization_id, 'candidates')
         and (o.type <> 'agency' or public.agent_can_via(g.organization_id, d.athlete_id, 'documents.view'))
         and (g.grantee_user_id = auth.uid()
              or (g.grantee_user_id is null and not public.document_is_highly_restricted(d.kind))));
$$;

-- 6. Ofertas: el agente con offers.view las ve. Aceptar, editar o borrar sigue siendo del atleta (o su familia).
--    Nunca toca la oferta original: una negociación se registra aparte (12C).
drop policy if exists offers_select_agent on public.athlete_offers;
create policy offers_select_agent on public.athlete_offers for select to authenticated
  using (public.agent_can(athlete_id, 'offers.view'));

-- 7. Las notas internas de la agencia: solo quien tiene relación con el atleta en la agencia las escribe;
--    leerlas exige ser de la agencia (no se exponen en ninguna vista compartida). Sin cambios de fondo,
--    pero la relación ya no cuenta las propuestas rechazadas.

-- 8. Privilegios
revoke execute on function public.agent_can_via(uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.agent_can_via(uuid, uuid, text, text, text, text, uuid) to authenticated;
revoke execute on function public.case_access(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.case_access(uuid, uuid, boolean, text) to authenticated;
revoke execute on function public.case_access_by_id(uuid, boolean) from public, anon;
grant execute on function public.case_access_by_id(uuid, boolean) to authenticated;

/* ROLLBACK: restaurar las policies de recruiting_cases*, recruiting_case_tasks, recruiting_case_activities desde
   20261114000100/agency_core, y las funciones has_connection_with_athlete, trial_actor y org_has_document_grant desde
   su última versión anterior; borrar agent_can_via, case_access, case_access_by_id y offers_select_agent. */

-- 9. Corrección encontrada por la prueba RGPD: borrar una cuenta que creó escenarios de coste fallaba porque el
--    guard impedía que la FK pusiera created_by a NULL. El borrado (cascada del sistema) sí puede anonimizar.
create or replace function public.guard_cost_scenario()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.athlete_id is distinct from old.athlete_id
     or (new.created_by is distinct from old.created_by and not (new.created_by is null and current_user not in ('authenticated', 'anon'))) then
    raise exception 'scenario_owner_immutable' using errcode = '42501';
  end if;
  return new;
end $$;
