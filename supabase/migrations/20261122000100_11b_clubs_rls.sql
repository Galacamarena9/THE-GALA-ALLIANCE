-- =====================================================================================================
-- 11B · Clubs & Academies · RLS y seguridad
-- Inventario → huecos → corrección. Documentación: docs/CLUBS-ACADEMIES-RLS.md
--
-- Huecos corregidos:
--   1. Límites por EQUIPO: pertenecer a un club no da acceso a todos sus equipos (team_scope/team_ids).
--   2. Oportunidades: el borrador ya no lo ve cualquier miembro; lo publicado solo es público si la
--      organización está activa (y verificada si es club/academia) y la moderación no lo retiró.
--   3. Candidaturas: el club solo ve/gestiona las de su programa/equipo; en trials y programas de academia
--      las decisiones pasan obligatoriamente por application_org_decide (nada de UPDATE status directo).
--   4. Participación (inscripciones, invitaciones, asistencia, resultados, matrículas, pagos): programa+equipo.
--   5. RPC de 11A: autorizan con org_can_opp (programa + equipo de la oportunidad), no solo con el tenant.
--   6. Documentos: document_access_grants ahora da acceso real (BD + Storage) con finalidad, caducidad y
--      revocación; los documentos muy sensibles (médico, financiero, identidad) exigen destinatario nominal.
--   7. Contacto: crear una solicitud exige el permiso 'contact' (organización verificada y activa), no solo
--      ser miembro. Modo de contacto con menores calculado en una sola función (minor_contact_mode).
--   8. Notas de candidatura: solo staff con permiso 'notes' sobre esa oportunidad.
--
-- Reversión: migración inversa que recree las políticas/funciones anteriores (definiciones en
-- 20261113000100, 20261113000400, 20261117001000, 20261121000400 y 20261121000500). No hay datos que migrar
-- salvo las columnas nuevas (team_scope/team_ids, grantee_user_id), que pueden quedarse.
-- =====================================================================================================

-- 1. Alcance por equipo de cada miembro ----------------------------------------------------------------
alter table public.organization_members
  add column if not exists team_scope text not null default 'all' check (team_scope in ('all', 'selected')),
  add column if not exists team_ids uuid[] not null default '{}';

-- Los equipos asignados deben ser de la misma organización (no se puede «colar» un equipo ajeno).
create or replace function public.guard_member_teams()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.team_scope = 'all' then new.team_ids := '{}'; return new; end if;
  if exists (select 1 from unnest(new.team_ids) t(id)
              where not exists (select 1 from public.org_teams ot where ot.id = t.id and ot.organization_id = new.organization_id)) then
    raise exception 'team_not_in_org' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_member_teams on public.organization_members;
create trigger guard_member_teams before insert or update of team_scope, team_ids on public.organization_members
  for each row execute function public.guard_member_teams();

-- 2. Helpers de autorización (security definer: leen membresías sin recursión de RLS; search_path fijo) --
-- org_can sigue siendo la base (rol → capacidades, organización activa y verificada salvo capacidades de
-- gestión, alcance de programa). org_can_scope añade el equipo.
create or replace function public.org_can_scope(p_org uuid, p_cap text, p_program uuid, p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_can(p_org, p_cap, p_program)
     and (p_team is null or exists (
           select 1 from public.organization_members m
            where m.organization_id = p_org and m.user_id = auth.uid()
              and (m.team_scope = 'all' or p_team = any (m.team_ids))));
$$;

-- Autorización sobre una oportunidad concreta: su organización, su programa y su equipo.
create or replace function public.org_can_opp(p_opportunity uuid, p_cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.org_can_scope(o.organization_id, p_cap, o.program_id, o.team_id)
                     from public.opportunities o where o.id = p_opportunity), false);
$$;

-- ¿Es pública esta oportunidad? (publicada, organización activa, verificada si es club/academia/agencia/
-- marca, y la moderación no la ha retirado). Una oportunidad «en revisión» por denuncias sigue visible hasta
-- que Gala decida: así una denuncia falsa no basta para tumbar un trial.
create or replace function public.opportunity_is_public(p_opportunity uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.opportunities o join public.organizations org on org.id = o.organization_id
     where o.id = p_opportunity and o.status = 'published'
       and o.moderation_status not in ('suspended', 'removed')
       and org.org_status = 'active'
       and (org.verification_status = 'verified' or org.type not in ('club', 'academy', 'agency', 'brand')));
$$;

revoke all on function public.org_can_scope(uuid, text, uuid, uuid) from public, anon;
revoke all on function public.org_can_opp(uuid, text) from public, anon;
grant execute on function public.org_can_scope(uuid, text, uuid, uuid) to anon, authenticated;   -- anon: siempre false (sin auth.uid)
grant execute on function public.org_can_opp(uuid, text) to authenticated;
grant execute on function public.opportunity_is_public(uuid) to anon, authenticated;

-- 3. Oportunidades ---------------------------------------------------------------------------------------
drop policy if exists opps_select on public.opportunities;
drop policy if exists opps_insert on public.opportunities;
drop policy if exists opps_update on public.opportunities;
drop policy if exists opps_delete on public.opportunities;

create policy opps_select on public.opportunities for select to anon, authenticated using (
  public.opportunity_is_public(id)
  or created_by = (select auth.uid())
  or public.org_can_scope(organization_id, 'opportunities', program_id, team_id)
  or public.org_can_scope(organization_id, 'candidates', program_id, team_id)
  or public.is_admin());
create policy opps_insert on public.opportunities for insert to authenticated with check (
  created_by = (select auth.uid())
  and public.org_can_scope(organization_id, 'opportunities', program_id, team_id)
  and exists (select 1 from public.organizations o where o.id = organization_id
               and o.type in ('university', 'college', 'club', 'academy')));
create policy opps_update on public.opportunities for update to authenticated
  using (public.org_can_scope(organization_id, 'opportunities', program_id, team_id) or public.is_admin())
  with check (public.org_can_scope(organization_id, 'opportunities', program_id, team_id) or public.is_admin());
create policy opps_delete on public.opportunities for delete to authenticated using (
  (status in ('draft', 'rejected') and public.org_can_scope(organization_id, 'opportunities', program_id, team_id))
  or public.is_admin());

-- 4. Candidaturas ----------------------------------------------------------------------------------------
drop policy if exists apps_select on public.applications;
drop policy if exists apps_update on public.applications;
create policy apps_select on public.applications for select to authenticated using (
  athlete_id = (select auth.uid())
  or public.has_family_link(athlete_id, 'view_applications')
  or public.org_can_opp(opportunity_id, 'candidates')
  or public.is_admin());
create policy apps_update on public.applications for update to authenticated
  using (athlete_id = (select auth.uid()) or public.org_can_opp(opportunity_id, 'pipeline'))
  with check (athlete_id = (select auth.uid()) or public.org_can_opp(opportunity_id, 'pipeline'));

-- En trials y programas de academia, aceptar/rechazar crea inscripciones, plazas y pagos: solo vía RPC.
create or replace function public.guard_application_participation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('gala.participation_write', true), '') <> 'on'
     and not (auth.uid() = new.athlete_id and new.status = 'withdrawn')
     and auth.uid() is not null
     and exists (select 1 from public.opportunities o where o.id = new.opportunity_id
                  and o.type in ('tryout', 'camp_showcase', 'club_recruitment', 'academy', 'development_program')) then
    raise exception 'use_application_org_decide' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_application_participation on public.applications;
create trigger guard_application_participation before update of status on public.applications
  for each row execute function public.guard_application_participation();

drop policy if exists notes_org_only on public.application_notes;
create policy notes_org_only on public.application_notes for all to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and public.org_can_opp(a.opportunity_id, 'notes')))
  with check (exists (select 1 from public.applications a where a.id = application_id and public.org_can_opp(a.opportunity_id, 'notes')));

-- 5. Participación (11A): programa + equipo de la oportunidad ---------------------------------------------
drop policy if exists registrations_select on public.opportunity_registrations;
create policy registrations_select on public.opportunity_registrations for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.is_active_agent_for(athlete_id)
  or public.org_can_opp(opportunity_id, 'candidates') or public.is_admin());

drop policy if exists invitations_select on public.opportunity_invitations;
create policy invitations_select on public.opportunity_invitations for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.is_active_agent_for(athlete_id)
  or public.org_can_opp(opportunity_id, 'candidates') or public.is_admin());

drop policy if exists attendance_select on public.opportunity_attendance;
create policy attendance_select on public.opportunity_attendance for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications')
  or public.org_can_opp(opportunity_id, 'candidates') or public.is_admin());

drop policy if exists outcomes_select on public.opportunity_outcomes;
create policy outcomes_select on public.opportunity_outcomes for select to authenticated using (
  public.org_can_opp(opportunity_id, 'candidates') or public.is_admin());

drop policy if exists enrollments_select on public.program_enrollments;
create policy enrollments_select on public.program_enrollments for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.is_active_agent_for(athlete_id)
  or public.org_can_opp(opportunity_id, 'candidates') or public.is_admin());

drop policy if exists payments_select on public.payment_requirements;
create policy payments_select on public.payment_requirements for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications')
  or public.org_can_opp(opportunity_id, 'candidates') or public.is_admin());

-- Necesidades de recruiting y procesos centrales: también por equipo.
drop policy if exists needs_select on public.recruiting_needs;
drop policy if exists needs_write on public.recruiting_needs;
create policy needs_select on public.recruiting_needs for select to authenticated using (
  public.org_can_scope(organization_id, 'candidates', program_id, team_id) or public.org_can_scope(organization_id, 'needs', program_id, team_id));
create policy needs_write on public.recruiting_needs for all to authenticated
  using (public.org_can_scope(organization_id, 'needs', program_id, team_id))
  with check (public.org_can_scope(organization_id, 'needs', program_id, team_id));

drop policy if exists candidates_select on public.org_candidates;
drop policy if exists candidates_update on public.org_candidates;
drop policy if exists candidates_write on public.org_candidates;
create policy candidates_select on public.org_candidates for select to authenticated using (
  public.org_can_scope(organization_id, 'candidates', program_id, team_id));
create policy candidates_update on public.org_candidates for update to authenticated
  using (public.org_can_scope(organization_id, 'pipeline', program_id, team_id))
  with check (public.org_can_scope(organization_id, 'pipeline', program_id, team_id));
create policy candidates_write on public.org_candidates for insert to authenticated with check (
  public.org_can_scope(organization_id, 'pipeline', program_id, team_id) and public.can_view_athlete(athlete_id, 'profile'));

-- 6. Contacto: hace falta el permiso 'contact' (verificada + activa + rol), no basta con ser miembro ------
drop policy if exists contact_insert on public.contact_requests;
create policy contact_insert on public.contact_requests for insert to authenticated with check (
  requested_by = auth.uid() and public.org_can(organization_id, 'contact') and public.can_view_athlete(athlete_id));

-- Modo de contacto con un menor (un único sitio para la regla; la UI solo la muestra).
--   contact_blocked              · organización no verificada/activa, sin permiso o bloqueada por el atleta/familia
--   contact_allowed              · atleta adulto
--   guardian_visible             · menor con consentimiento vigente del tutor para contacto con esta organización
--   guardian_approval_required   · menor sin ese consentimiento: la solicitud pasa por el tutor
create or replace function public.minor_contact_mode(p_athlete uuid, p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not public.org_can(p_org, 'contact') or public.athlete_blocks_org(p_athlete, p_org) then 'contact_blocked'
    when not public.is_minor(p_athlete) then 'contact_allowed'
    when public.consent_granted(p_athlete, 'contact', 'organization', p_org) then 'guardian_visible'
    else 'guardian_approval_required'
  end;
$$;
revoke all on function public.minor_contact_mode(uuid, uuid) from public, anon;
grant execute on function public.minor_contact_mode(uuid, uuid) to authenticated;

-- 7. Documentos: concesiones con finalidad, caducidad y revocación ----------------------------------------
alter table public.document_access_grants
  add column if not exists grantee_user_id uuid references public.profiles (id) on delete cascade;

-- Clasificación: estos tipos son «muy sensibles» y nunca se comparten con toda la organización.
create or replace function public.document_is_highly_restricted(p_kind text)
returns boolean language sql immutable set search_path = public as $$
  select p_kind in ('medical', 'financial', 'passport', 'i20', 'ds160', 'sevis_receipt');
$$;

create or replace function public.guard_document_grant()
returns trigger language plpgsql security definer set search_path = public as $$
declare d record;
begin
  -- Borrado de la cuenta que concedió el acceso (RGPD): anular la autoría no es «editar la concesión».
  if tg_op = 'UPDATE' and public.only_nulled(to_jsonb(old), to_jsonb(new), '{granted_by}', tg_relid) then return new; end if;
  select id, athlete_id, kind into d from public.athlete_documents where id = new.document_id;
  if d.id is null or d.athlete_id <> new.athlete_id then raise exception 'document_mismatch' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    -- Solo el atleta o su familia con permiso de edición conceden acceso; nunca la organización a sí misma.
    if auth.uid() is not null and not (auth.uid() = d.athlete_id or public.has_family_link(d.athlete_id, 'edit_profile')) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    new.granted_by := coalesce(auth.uid(), new.granted_by);
    new.revoked_at := null;
    if public.document_is_highly_restricted(d.kind) then
      if new.grantee_user_id is null then raise exception 'grantee_required_for_sensitive_document' using errcode = 'P0001'; end if;
      if new.expires_at > now() + interval '30 days' then raise exception 'sensitive_grant_too_long' using errcode = 'P0001'; end if;
    end if;
    if new.grantee_user_id is not null and not exists (select 1 from public.organization_members
         where organization_id = new.organization_id and user_id = new.grantee_user_id) then
      raise exception 'grantee_not_in_org' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- UPDATE: lo único que cambia es la revocación (o acortar la caducidad).
  if (new.document_id, new.athlete_id, new.organization_id, new.purpose, new.grantee_user_id, new.granted_by, new.created_at)
     is distinct from (old.document_id, old.athlete_id, old.organization_id, old.purpose, old.grantee_user_id, old.granted_by, old.created_at)
     or new.expires_at > old.expires_at or (old.revoked_at is not null and new.revoked_at is null) then
    raise exception 'grant_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_document_grant on public.document_access_grants;
create trigger guard_document_grant before insert or update on public.document_access_grants
  for each row execute function public.guard_document_grant();

-- Privilegios mínimos: crear concesiones y, al actualizar, solo revocar o acortar.
grant insert on public.document_access_grants to authenticated;
grant update (revoked_at, expires_at) on public.document_access_grants to authenticated;
create policy doc_grants_insert on public.document_access_grants for insert to authenticated with check (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
create policy doc_grants_revoke on public.document_access_grants for update to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

-- La organización ve sus concesiones vigentes; las nominales, solo el destinatario (y los gestores).
drop policy if exists doc_grants_select on public.document_access_grants;
create policy doc_grants_select on public.document_access_grants for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile') or public.is_admin()
  or (public.org_can(organization_id, 'candidates') and (grantee_user_id is null or grantee_user_id = auth.uid())));

-- Acceso de una organización a un documento: petición compartida (info_requests) o concesión vigente.
-- Un documento muy sensible nunca llega por la vía genérica: exige concesión nominal al usuario actual.
create or replace function public.org_has_document_grant(p_document uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.info_requests r join public.athlete_documents d on d.id = r.document_id
       where r.document_id = p_document and r.status = 'shared' and r.shared_until >= current_date
         and not public.document_is_highly_restricted(d.kind)
         and public.org_can(r.organization_id, 'candidates'))
    or exists (
      select 1 from public.document_access_grants g join public.athlete_documents d on d.id = g.document_id
       where g.document_id = p_document and g.revoked_at is null and g.expires_at > now()
         and public.org_can(g.organization_id, 'candidates')
         and (g.grantee_user_id = auth.uid()
              or (g.grantee_user_id is null and not public.document_is_highly_restricted(d.kind))));
$$;

-- 8. RPC de 11A: autorización por programa + equipo de la oportunidad (se redefinen abajo) ----------------
create or replace function public.trial_org_invite(p_opportunity uuid, p_athlete uuid, p_source text default 'discovery', p_shortlist uuid default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o record; v_id uuid;
begin
  select id, organization_id, program_id, team_id, title into o from public.opportunities where id = p_opportunity;
  -- 'contact' exige organización verificada y activa (org_can) y permiso sobre el programa del trial.
  if o.id is null or not public.org_can_opp(o.id, 'contact') then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform public.registration_open_check(p_opportunity);
  if not public.can_view_athlete(p_athlete, 'profile') then raise exception 'athlete_not_visible' using errcode = '42501'; end if;
  if public.athlete_blocks_org(p_athlete, o.organization_id) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_source not in ('discovery', 'shortlist', 'recruiting_need', 'gala_match', 'trial_follow_up', 'other') then raise exception 'invalid_source' using errcode = 'P0001'; end if;
  if p_shortlist is not null and not exists (select 1 from public.org_shortlists where id = p_shortlist and organization_id = o.organization_id) then
    raise exception 'shortlist_not_in_org' using errcode = 'P0001';
  end if;
  -- Ya invitado (activo) o ya inscrito: no se duplica.
  select id into v_id from public.opportunity_invitations where opportunity_id = p_opportunity and athlete_id = p_athlete and status in ('sent', 'viewed', 'interested');
  if v_id is not null then return v_id; end if;
  if exists (select 1 from public.opportunity_registrations where opportunity_id = p_opportunity and athlete_id = p_athlete and status not in ('withdrawn', 'cancelled')) then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;
  -- Anti-spam: 100 invitaciones por organización y día.
  if (select count(*) from public.opportunity_invitations where organization_id = o.organization_id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.opportunity_invitations (opportunity_id, organization_id, team_id, athlete_id, invited_by, source, source_shortlist_id, message, guardian_required)
  values (p_opportunity, o.organization_id, o.team_id, p_athlete, auth.uid(), p_source, p_shortlist, left(p_message, 600), public.is_minor(p_athlete))
  returning id into v_id;
  perform public.org_log(o.organization_id, p_athlete, 'trial_invited', jsonb_build_object('invitation', v_id, 'opportunity', p_opportunity));
  perform public.audit('invitation_sent', 'opportunity_invitation', v_id, o.organization_id, jsonb_build_object('opportunity', p_opportunity), null, 'normal', o.program_id);
  perform public.participation_notify(p_athlete, p_opportunity, 'application.trial', 'Invitación a un trial: ' || left(o.title, 110),
    'El club te invita a valorar su trial. Revisa fecha, lugar, coste y requisitos antes de responder. No es una oferta.');
  return v_id;
end;
$$;

create or replace function public.application_org_decide(p_application uuid, p_decision text, p_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare a record; o record; v_reg uuid; v_enr uuid; v_guardian text;
begin
  select * into a from public.applications where id = p_application for update;
  if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select id, organization_id, program_id, type::text as type, title, start_at, end_at into o from public.opportunities where id = a.opportunity_id;
  if not public.org_can_opp(o.id, 'candidates') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_decision not in ('reviewed', 'information_requested', 'accepted', 'waitlisted', 'declined') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  if a.status::text = p_decision then return p_decision; end if;   -- doble clic
  if a.status::text not in ('applied', 'reviewed', 'information_requested', 'waitlisted') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  perform set_config('gala.participation_write', 'on', true);
  update public.applications set status = p_decision::public.application_status, decided_at = now(), decided_by = auth.uid(),
         decision_message = coalesce(left(p_message, 1000), decision_message)
   where id = a.id;
  perform set_config('gala.participation_write', '', true);
  perform public.audit('application_status_changed', 'application', a.id, o.organization_id, jsonb_build_object('from', a.status, 'to', p_decision), null, 'normal', o.program_id);

  if p_decision = 'accepted' and o.type in ('tryout', 'camp_showcase', 'club_recruitment') then
    v_guardian := case when not public.is_minor(a.athlete_id) then 'not_required'
                       when public.guardian_requirement_satisfied(a.athlete_id, 'trial_participation', 'opportunity', o.id) then 'approved' else 'pending' end;
    insert into public.opportunity_registrations (opportunity_id, organization_id, athlete_id, status, origin, created_by, guardian_status, application_id)
    values (o.id, o.organization_id, a.athlete_id, case when v_guardian = 'pending' then 'pending' else 'registered' end, 'application', auth.uid(), v_guardian, a.id)
    on conflict (opportunity_id, athlete_id) do update set application_id = excluded.application_id
    returning id into v_reg;
    perform public.trial_log(v_reg, 'organization', null, case when v_guardian = 'pending' then 'pending' else 'registered' end, 'application_accepted');
    if v_guardian <> 'pending' then perform public.registration_became_registered(v_reg); end if;
  elsif p_decision = 'accepted' and o.type in ('academy', 'development_program') then
    insert into public.program_enrollments (opportunity_id, organization_id, athlete_id, application_id, status, starts_on, ends_on, created_by,
                                            guardian_status)
    values (o.id, o.organization_id, a.athlete_id, a.id, 'offered', (o.start_at at time zone 'UTC')::date, (o.end_at at time zone 'UTC')::date, auth.uid(),
            case when public.is_minor(a.athlete_id) then 'pending' else 'not_required' end)
    on conflict do nothing
    returning id into v_enr;
    perform public.audit('academy_application_accepted', 'application', a.id, o.organization_id, jsonb_build_object('enrollment', v_enr), null, 'normal', o.program_id);
  end if;
  return p_decision;
end;
$$;

create or replace function public.trial_org_action(p_registration uuid, p_action text, p_outcome text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; v_prog uuid; v_cap int; v_to text;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id into v_prog from public.opportunities where id = r.opportunity_id;
  if not public.org_can_opp(r.opportunity_id, 'candidates') then raise exception 'not_allowed' using errcode = '42501'; end if;

  if p_action in ('attended', 'no_show', 'partial', 'check_in') then
    return public.attendance_record(p_registration, case p_action when 'check_in' then 'attended' else p_action end);
  elsif p_action = 'outcome' then
    return public.outcome_record(p_registration, case p_outcome when 'continue_recruiting' then 'start_recruiting_process' when 'not_selected' then 'no_further_action' else p_outcome end);
  elsif p_action = 'confirm' and r.status in ('registered', 'waitlisted') then
    if r.guardian_status not in ('not_required', 'approved') then raise exception 'guardian_consent_missing' using errcode = 'P0001'; end if;
    select coalesce(td.capacity, apd.capacity) into v_cap from public.opportunities o
      left join public.trial_details td on td.opportunity_id = o.id left join public.academy_program_details apd on apd.opportunity_id = o.id where o.id = r.opportunity_id;
    if v_cap is not null and public.opportunity_confirmed_count(r.opportunity_id) >= v_cap then raise exception 'capacity_reached' using errcode = 'P0001'; end if;
    v_to := 'confirmed';
  elsif p_action = 'waitlist' and r.status = 'registered' then v_to := 'waitlisted';
  elsif p_action = 'decline' and r.status in ('pending', 'registered', 'waitlisted', 'confirmed') then v_to := 'cancelled';
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.opportunity_registrations
     set status = v_to, updated_at = now(),
         confirmed_at = case when v_to = 'confirmed' then now() else confirmed_at end,
         cancelled_at = case when v_to = 'cancelled' then now() else cancelled_at end,
         cancelled_by_side = case when v_to = 'cancelled' then 'organization' else cancelled_by_side end
   where id = r.id;
  perform public.trial_log(r.id, 'organization', r.status, v_to, null);
  perform public.org_log(r.organization_id, r.athlete_id, 'trial_status', jsonb_build_object('registration', r.id, 'from', r.status, 'to', v_to));
  if v_to = 'confirmed' then perform public.audit('registration_confirmed', 'opportunity_registration', r.id, r.organization_id, '{}'::jsonb, null, 'normal', v_prog); end if;
  perform public.trial_notify(r.id, 'application.trial', 'Trial actualizado',
    case v_to when 'confirmed' then 'Tu plaza está confirmada.' when 'waitlisted' then 'El club te ha puesto en su lista de espera.' else 'El club no continuará con esta inscripción.' end);
  return v_to;
end;
$$;

create or replace function public.attendance_record(p_registration uuid, p_status text, p_check_in timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; o record;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id, start_at into o from public.opportunities where id = r.opportunity_id;
  if not public.org_can_opp(r.opportunity_id, 'candidates') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_status not in ('attended', 'no_show', 'partial', 'cancelled_before_event', 'unknown') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if r.status not in ('confirmed', 'completed') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  if o.start_at is null then raise exception 'event_date_missing' using errcode = 'P0001'; end if;
  -- Check-in desde 12 h antes del inicio; «no presentado» solo después del inicio.
  if p_status in ('attended', 'partial') and now() < o.start_at - interval '12 hours' then raise exception 'event_not_started' using errcode = 'P0001'; end if;
  if p_status = 'no_show' and now() < o.start_at then raise exception 'event_not_started' using errcode = 'P0001'; end if;
  insert into public.opportunity_attendance (registration_id, opportunity_id, organization_id, athlete_id, status, check_in_at, recorded_by, recorded_at, source)
  values (r.id, r.opportunity_id, r.organization_id, r.athlete_id, p_status,
          case when p_status in ('attended', 'partial') then coalesce(p_check_in, now()) end, auth.uid(), now(), 'staff')
  on conflict (registration_id) do update set status = excluded.status,
         check_in_at = coalesce(public.opportunity_attendance.check_in_at, excluded.check_in_at), recorded_by = excluded.recorded_by, recorded_at = now();
  if p_status in ('attended', 'partial', 'no_show') and r.status = 'confirmed' then
    update public.opportunity_registrations set status = 'completed', updated_at = now() where id = r.id;
    perform public.trial_log(r.id, 'organization', r.status, 'completed', 'attendance:' || p_status);
  end if;
  perform public.audit('attendance_recorded', 'opportunity_registration', r.id, r.organization_id, jsonb_build_object('status', p_status), null, 'normal', o.program_id);
  return p_status;
end;
$$;

create or replace function public.outcome_record(p_registration uuid, p_outcome text, p_internal_note text default null, p_athlete_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; v_prog uuid; v_cand uuid;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id into v_prog from public.opportunities where id = r.opportunity_id;
  if not public.org_can_opp(r.opportunity_id, 'candidates') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_outcome not in ('no_further_action', 'follow_up', 'invite_again', 'start_recruiting_process', 'academy_offer', 'club_offer', 'closed') then
    raise exception 'invalid_outcome' using errcode = 'P0001';
  end if;
  if r.status <> 'completed' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  insert into public.opportunity_outcomes (registration_id, opportunity_id, organization_id, athlete_id, outcome, internal_note, decided_by)
  values (r.id, r.opportunity_id, r.organization_id, r.athlete_id, p_outcome, left(p_internal_note, 1000), auth.uid())
  on conflict (registration_id) do update set outcome = excluded.outcome, internal_note = coalesce(excluded.internal_note, public.opportunity_outcomes.internal_note),
         decided_by = excluded.decided_by, decided_at = now();
  if p_athlete_message is not null then
    update public.opportunity_registrations set athlete_update = left(p_athlete_message, 500), athlete_update_at = now() where id = r.id;
    perform public.trial_notify(r.id, 'application.trial', 'Novedades tras el trial', left(p_athlete_message, 300));
  end if;
  perform public.audit('outcome_recorded', 'opportunity_registration', r.id, r.organization_id, jsonb_build_object('outcome', p_outcome), null, 'normal', v_prog);
  if p_outcome = 'start_recruiting_process' then
    v_cand := public.start_recruiting_from_trial(r.id, null);
  end if;
  return p_outcome;
end;
$$;

create or replace function public.start_recruiting_from_trial(p_registration uuid, p_need uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r record; o record; v_cand uuid;
begin
  select * into r from public.opportunity_registrations where id = p_registration;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, program_id, team_id, need_id into o from public.opportunities where id = r.opportunity_id;
  if not public.org_can_opp(r.opportunity_id, 'pipeline') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if r.status not in ('confirmed', 'completed') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  if not public.can_view_athlete(r.athlete_id, 'profile') then raise exception 'athlete_not_accessible' using errcode = '42501'; end if;
  if public.athlete_blocks_org(r.athlete_id, r.organization_id) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_need is not null and not exists (select 1 from public.recruiting_needs where id = p_need and organization_id = r.organization_id and status = 'active') then
    raise exception 'need_not_active' using errcode = 'P0001';
  end if;
  insert into public.org_candidates (organization_id, athlete_id, program_id, team_id, need_id, opportunity_id, registration_id, invitation_id, internal_stage, source, created_by)
  values (r.organization_id, r.athlete_id, o.program_id, o.team_id, coalesce(p_need, o.need_id), o.id, r.id, r.invitation_id, 'active', 'trial', auth.uid())
  on conflict (organization_id, athlete_id) do update set
    archived_at = null, registration_id = coalesce(public.org_candidates.registration_id, excluded.registration_id),
    team_id = coalesce(public.org_candidates.team_id, excluded.team_id), need_id = coalesce(public.org_candidates.need_id, excluded.need_id),
    internal_stage = case when public.org_candidates.internal_stage in ('new', 'review', 'priority_review', 'shortlisted', 'closed') then 'active' else public.org_candidates.internal_stage end
  returning id into v_cand;
  update public.opportunity_outcomes set candidate_id = v_cand where registration_id = r.id;
  perform public.org_log(r.organization_id, r.athlete_id, 'stage_changed', jsonb_build_object('candidate', v_cand, 'via', 'trial', 'registration', r.id));
  perform public.audit('recruiting_process_started', 'org_candidate', v_cand, r.organization_id, jsonb_build_object('source', 'trial', 'registration', r.id), null, 'normal', o.program_id);
  return v_cand;
end;
$$;

create or replace function public.enrollment_org_action(p_enrollment uuid, p_action text, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare e record; v_prog uuid; v_to text;
begin
  select * into e from public.program_enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id into v_prog from public.opportunities where id = e.opportunity_id;
  if not public.org_can_opp(e.opportunity_id, 'candidates') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_action = 'enroll' and e.status = 'accepted' then
    if e.guardian_status not in ('not_required', 'approved') then raise exception 'guardian_consent_missing' using errcode = 'P0001'; end if;
    v_to := 'enrolled';
  elsif p_action = 'activate' and e.status = 'enrolled' then v_to := 'active';
  elsif p_action = 'complete' and e.status = 'active' then v_to := 'completed';
  elsif p_action = 'cancel' and e.status in ('offered', 'accepted', 'enrolled', 'active') then v_to := 'cancelled';
  else raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.program_enrollments set status = v_to, updated_at = now(),
         enrolled_at = case when v_to = 'enrolled' then now() else enrolled_at end,
         ended_at = case when v_to in ('completed', 'cancelled') then now() else ended_at end,
         end_reason = case when v_to = 'cancelled' then left(coalesce(p_reason, 'cancelled_by_organization'), 300) else end_reason end
   where id = e.id;
  if v_to = 'enrolled' then perform public.audit('enrollment_created', 'program_enrollment', e.id, e.organization_id, '{}'::jsonb, null, 'normal', v_prog); end if;
  perform public.participation_notify(e.athlete_id, e.opportunity_id, 'application.academy', 'Programa actualizado', 'Nuevo estado de tu plaza: ' || v_to);
  return v_to;
end;
$$;
