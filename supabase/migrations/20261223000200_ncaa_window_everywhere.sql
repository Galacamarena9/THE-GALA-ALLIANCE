-- =============================================================================================================
-- Cumplimiento NCAA · la ventana de primer contacto se aplica a TODO contacto iniciado por una universidad
-- (QA coach-club #1, #2 y #3).
-- Problema:
--   1. guard_info_request (solicitudes de información) no comprobaba la ventana: un coach D-I podía escribir a un
--      sophomore un mensaje libre y el atleta recibía una notificación con el nombre de la universidad.
--   2. trial_org_invite (invitaciones a campus/showcase, con mensaje) tampoco la comprobaba.
--   3. Si la universidad dejaba la división vacía, ncaa_contact_opens_on devolvía null y no había ningún bloqueo.
-- Arreglo:
--   - Nueva función interna public.ncaa_contact_closed(org, atleta): true si la organización es university/college
--     y la ventana de su deporte aún no se ha abierto. Con división desconocida (null) aplica la regla D-I por
--     defecto (decisión conservadora: es la más restrictiva; D-III/NAIA/NJCAA declaradas no se bloquean).
--     Sin acceso para anon/authenticated (revela el año de graduación): solo la usan las funciones de abajo.
--   - guard_contact_request (copia de 20261124000200_10a_family_rls.sql), guard_info_request (copia de
--     20261210000100_staging_reconcile.sql) y trial_org_invite (copia de 20261122000100_11b_clubs_rls.sql) usan
--     esa función y rechazan con 'ncaa_contact_window_closed'. El resto de cada función es idéntico.
-- Limitación conocida (NO COMPROBADO normativamente, pendiente de compliance): un atleta sin graduation_year no se
--   bloquea (no se puede calcular la ventana) y solo se modelan las excepciones D-I de béisbol y lacrosse.
-- ROLLBACK:
--   volver a aplicar guard_contact_request de 20261124000200, guard_info_request de 20261210000100 y
--   trial_org_invite de 20261122000100; drop function public.ncaa_contact_closed(uuid, uuid);
-- =============================================================================================================

create or replace function public.ncaa_contact_closed(p_org uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.organizations o
    join public.athlete_profiles ap on ap.user_id = p_athlete
    where o.id = p_org
      and o.type in ('university', 'college')
      and public.ncaa_contact_opens_on(ap.graduation_year, coalesce(o.division, 'ncaa_d1'::public.division), ap.sport_id) > current_date
  )
$$;
revoke all on function public.ncaa_contact_closed(uuid, uuid) from public, anon, authenticated;

-- Contacto directo (resto idéntico a 20261124000200).
create or replace function public.guard_contact_request()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_is_guardian boolean;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'verified_organization_required' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.contact_requests where organization_id = new.organization_id
               and athlete_id = new.athlete_id and status = 'blocked') then
      raise exception 'blocked_by_athlete' using errcode = '42501';
    end if;
    -- Cumplimiento NCAA: una universidad no inicia contacto antes de la ventana (división null → regla D-I).
    if public.ncaa_contact_closed(new.organization_id, new.athlete_id) then
      raise exception 'ncaa_contact_window_closed' using errcode = 'P0001';
    end if;
    new.requested_by := v_uid;
    new.is_minor_at_request := public.is_minor(new.athlete_id);
    new.guardian_approved_by := null;
    new.responded_at := null;
    if new.is_minor_at_request then
      if not exists (select 1 from public.parent_athlete_links where athlete_id = new.athlete_id and status = 'approved') then
        raise exception 'guardian_required' using errcode = 'P0001';
      end if;
      new.status := 'pending_guardian';
    else
      new.status := 'pending';
    end if;
    if (select count(*) from public.contact_requests where requested_by = v_uid and created_at > now() - interval '1 day') >= 20 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if (new.organization_id, new.requested_by, new.athlete_id, new.message, new.is_minor_at_request, new.created_at)
     is distinct from (old.organization_id, old.requested_by, old.athlete_id, old.message, old.is_minor_at_request, old.created_at) then
    raise exception 'contact_request_immutable' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then return new; end if;

  v_is_guardian := public.is_active_guardian(new.athlete_id);
  if old.status = 'pending_guardian' and v_is_guardian and new.status in ('pending', 'declined', 'blocked') then
    new.guardian_approved_by := case when new.status = 'pending' then v_uid else null end;
    new.responded_at := case when new.status = 'pending' then null else now() end;
  elsif old.status = 'pending' and v_uid = new.athlete_id and new.status in ('accepted', 'declined', 'blocked') then
    new.responded_at := now();
  elsif old.status in ('accepted', 'declined') and (v_uid = new.athlete_id or (new.is_minor_at_request and v_is_guardian)) and new.status = 'blocked' then
    new.responded_at := now();
  else
    raise exception 'contact_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

-- Solicitudes de información (resto idéntico a 20261210000100).
create or replace function public.guard_info_request()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_org text;
begin
  -- Cumplimiento NCAA: pedir información es correspondencia de reclutamiento; misma ventana que el contacto.
  if public.ncaa_contact_closed(new.organization_id, new.athlete_id) then
    raise exception 'ncaa_contact_window_closed' using errcode = 'P0001';
  end if;
  -- Menores: la familia decide.
  new.status := case when public.is_minor(new.athlete_id) then 'pending_guardian' else 'pending' end;
  if (select count(*) from public.info_requests where organization_id = new.organization_id and created_at > now() - interval '1 day') >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select name into v_org from public.organizations where id = new.organization_id;
  if new.status = 'pending' then
    perform public.notify(new.athlete_id, 'contact.info_request', left(v_org, 100) || ' te pide información', 'Decide si la compartes. Nada se envía sin tu permiso.', '/app/requests');
  end if;
  perform public.notify(l.parent_id, 'family.info_request', left(v_org, 100) || ' pide información de tu hijo/a', 'Revisa la solicitud: tú decides.', '/app/requests')
     from public.parent_athlete_links l where l.athlete_id = new.athlete_id and l.status = 'approved';
  perform public.org_log(new.organization_id, new.athlete_id, 'info_requested', jsonb_build_object('kind', new.kind));
  return new;
end;
$fn$;

-- Invitaciones a trial/campus (resto idéntico a 20261122000100).
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
  -- Cumplimiento NCAA: una universidad no invita (con o sin mensaje) antes de la ventana de contacto.
  if public.ncaa_contact_closed(o.organization_id, p_athlete) then
    raise exception 'ncaa_contact_window_closed' using errcode = 'P0001';
  end if;
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

-- Grants explícitos (sin privilegios por defecto desde 20261222000100).
revoke all on function public.trial_org_invite(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.trial_org_invite(uuid, uuid, text, uuid, text) to authenticated;
revoke all on function public.guard_contact_request() from public, anon, authenticated;
revoke all on function public.guard_info_request() from public, anon, authenticated;
