-- 11A · E: operaciones transaccionales e idempotentes (RPC solo para invariantes, idempotencia y autorización compleja;
-- el CRUD simple de detalles/costes/requisitos sigue por RLS). Toda escritura de participación pasa por aquí.
-- Validación de publicación, caducidad y eventos de producto.
-- Reversión: recrear las funciones de 20261120000300 (trial_*) y borrar las nuevas.

-- 0. Utilidades ------------------------------------------------------------------------------------------------------
create or replace function public.trial_log(p_reg uuid, p_actor text, p_from text, p_to text, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into public.opportunity_registration_events (registration_id, actor_id, actor_kind, from_status, to_status, detail)
  values (p_reg, auth.uid(), p_actor, p_from, p_to, left(p_detail, 300));
$$;

-- Avisa al atleta, a su familia aprobada y a sus agentes activos; nunca a quien hizo la acción.
create or replace function public.participation_notify(p_athlete uuid, p_opp uuid, p_kind text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select p_athlete as uid
    union select l.parent_id from public.parent_athlete_links l where l.athlete_id = p_athlete and l.status = 'approved'
    union select rp.agent_id from public.agent_representations rp where rp.athlete_id = p_athlete and rp.status = 'active'
  loop
    if r.uid is not null and r.uid is distinct from auth.uid() then
      perform public.notify(r.uid, p_kind, left(p_title, 160), left(p_body, 500), '/app/opportunities/' || p_opp);
    end if;
  end loop;
end;
$$;
create or replace function public.trial_notify(p_reg uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  select public.participation_notify(r.athlete_id, r.opportunity_id, p_kind, p_title, p_body) from public.opportunity_registrations r where r.id = p_reg;
$$;
-- Avisa al staff con permiso de candidatos de la organización.
create or replace function public.org_staff_notify(p_org uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.organization_members where organization_id = p_org and 'candidates' = any (public.org_role_caps(member_role::text)) loop
    if r.user_id is distinct from auth.uid() then perform public.notify(r.user_id, p_kind, left(p_title, 160), left(p_body, 500), p_link); end if;
  end loop;
end;
$$;

-- Bloqueo: si el atleta (o su tutor) bloqueó a alguien del staff de la organización, nada nuevo le llega de ella.
create or replace function public.athlete_blocks_org(p_athlete uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks b join public.organization_members m on m.user_id = b.blocked_id
                  where m.organization_id = p_org and (b.blocker_id = p_athlete
                        or b.blocker_id in (select parent_id from public.parent_athlete_links where athlete_id = p_athlete and status = 'approved')));
$$;

-- Plazas confirmadas (las libres SIEMPRE se derivan: capacidad − confirmadas; null si la capacidad es desconocida).
create or replace function public.opportunity_confirmed_count(p_opp uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.opportunity_registrations where opportunity_id = p_opp and status in ('confirmed', 'completed');
$$;

-- Requisitos de cobro: una fila por coste OBLIGATORIO con importe (nunca opcionales ni «incluido»). Idempotente.
create or replace function public.create_payment_requirements(p_registration uuid, p_enrollment uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_opp uuid; v_org uuid; v_athlete uuid; v_refund text; n int;
begin
  if p_registration is not null then
    select opportunity_id, organization_id, athlete_id into v_opp, v_org, v_athlete from public.opportunity_registrations where id = p_registration;
    select refundable into v_refund from public.trial_details where opportunity_id = v_opp;
  else
    select opportunity_id, organization_id, athlete_id into v_opp, v_org, v_athlete from public.program_enrollments where id = p_enrollment;
  end if;
  insert into public.payment_requirements (organization_id, opportunity_id, athlete_id, registration_id, enrollment_id, cost_component_id, label, amount, currency, required, refundable)
  select v_org, v_opp, v_athlete, p_registration, p_enrollment, c.id, c.label, c.amount, c.currency, true, coalesce(v_refund, 'unknown')
    from public.opportunity_cost_components c
   where c.opportunity_id = v_opp and c.required and not c.included and c.amount is not null and c.amount > 0
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 and p_registration is not null then
    update public.opportunity_registrations set payment_status = 'pending' where id = p_registration and payment_status = 'not_required';
  end if;
  return n;
end;
$$;

-- 1. Validación de publicación (bloquea SOLO lo realmente obligatorio, con motivos concretos) -----------------------
create or replace function public.opportunity_publish_gaps(p_opp uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare o record; t record; a record; gaps text[] := '{}'; v_paid_ok boolean;
begin
  select * into o from public.opportunities where id = p_opp;
  if o.id is null then return array['not_found']::text[]; end if;
  if o.type::text not in ('tryout', 'camp_showcase', 'club_recruitment', 'academy', 'development_program') then return gaps; end if;
  if o.city is null or o.country is null then gaps := array_append(gaps, 'location'); end if;
  if o.age_category_code is null and o.age_category_custom is null
     and not exists (select 1 from public.opportunity_requirements r where r.opportunity_id = p_opp and r.kind in ('age', 'birth_year')) then
    gaps := array_append(gaps, 'age_category');
  end if;
  if not exists (select 1 from public.opportunity_requirements r where r.opportunity_id = p_opp)
     and not exists (select 1 from public.opportunity_required_materials m where m.opportunity_id = p_opp) then
    gaps := array_append(gaps, 'requirements');
  end if;
  if o.type::text in ('academy', 'development_program') then
    select * into a from public.academy_program_details where opportunity_id = p_opp;
    if a.opportunity_id is null then return array_append(gaps, 'details'); end if;
    if o.start_at is null and a.calendar_type <> 'rolling' then gaps := array_append(gaps, 'date'); end if;
    if a.price_status = 'price_not_provided' then gaps := array_append(gaps, 'cost_status'); end if;
    v_paid_ok := exists (select 1 from public.opportunity_cost_components c where c.opportunity_id = p_opp and c.required and c.amount is not null and c.component_type in ('program_fee', 'registration'));
    if a.price_status = 'paid' and not v_paid_ok then gaps := array_append(gaps, 'price'); end if;
  else
    select * into t from public.trial_details where opportunity_id = p_opp;
    if t.opportunity_id is null then return array_append(gaps, 'details'); end if;
    if o.start_at is null or o.timezone is null then gaps := array_append(gaps, 'date'); end if;
    if t.price_status = 'price_not_provided' then gaps := array_append(gaps, 'cost_status'); end if;
    v_paid_ok := exists (select 1 from public.opportunity_cost_components c where c.opportunity_id = p_opp and c.required and c.amount is not null and c.component_type = 'registration');
    if t.price_status = 'paid' and not v_paid_ok then gaps := array_append(gaps, 'price'); end if;
    if t.registration_mode = 'application_required' and o.deadline is null then gaps := array_append(gaps, 'deadline'); end if;
  end if;
  return gaps;
end;
$$;
grant execute on function public.opportunity_publish_gaps(uuid) to authenticated;

create or replace function public.guard_opportunity_publishable()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_gaps text[];
begin
  if new.status::text in ('pending_review', 'published') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if tg_op = 'INSERT' and new.type::text in ('tryout', 'camp_showcase', 'club_recruitment', 'academy', 'development_program') then
      raise exception 'not_publishable:details' using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' then
      v_gaps := public.opportunity_publish_gaps(new.id);
      if cardinality(v_gaps) > 0 then raise exception 'not_publishable:%', array_to_string(v_gaps, ',') using errcode = 'P0001'; end if;
    end if;
    -- Moderación ≠ estado: una suspendida o retirada no se publica.
    if new.moderation_status in ('suspended', 'removed') then raise exception 'moderation_blocked' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_opportunity_publishable after insert or update of status on public.opportunities for each row execute function public.guard_opportunity_publishable();

-- 2. ¿Admite inscripciones ahora? (oportunidad publicada, organización verificada y activa, sin moderación, en plazo)
create or replace function public.registration_open_check(p_opp uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare o record;
begin
  select op.status, op.type, op.deadline, op.expires_at, op.end_at, op.moderation_status, org.verification_status, org.org_status, td.registration_status, td.registration_deadline
    into o
    from public.opportunities op join public.organizations org on org.id = op.organization_id
    left join public.trial_details td on td.opportunity_id = op.id
   where op.id = p_opp;
  if o.status is null or o.status <> 'published' or o.moderation_status <> 'none' then raise exception 'opportunity_not_open' using errcode = 'P0001'; end if;
  if o.type::text not in ('tryout', 'camp_showcase', 'club_recruitment') then raise exception 'not_a_trial' using errcode = 'P0001'; end if;
  if o.verification_status <> 'verified' or o.org_status <> 'active' then raise exception 'organization_not_verified' using errcode = 'P0001'; end if;
  if (o.deadline is not null and o.deadline < current_date) or (o.expires_at is not null and o.expires_at < current_date)
     or (o.registration_deadline is not null and o.registration_deadline < now()) or (o.end_at is not null and o.end_at < now())
     or o.registration_status = 'closed' then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
end;
$$;

-- Efectos de pasar a «inscrito»: fecha, invitación convertida, cobros preparados, proceso en el pipeline del atleta.
create or replace function public.registration_became_registered(p_reg uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update public.opportunity_registrations set registered_at = coalesce(registered_at, now()) where id = p_reg returning * into r;
  if r.invitation_id is not null then
    update public.opportunity_invitations set status = 'converted_to_registration', updated_at = now() where id = r.invitation_id and status in ('sent', 'viewed', 'interested');
  end if;
  perform public.create_payment_requirements(p_reg, null);
  insert into public.saved_items (athlete_id, target_kind, target_id, status) values (r.athlete_id, 'opportunity', r.opportunity_id, 'applied')
  on conflict (athlete_id, target_kind, target_id) do update set status = 'applied' where public.saved_items.status in ('discovered', 'saved');
  perform public.org_log(r.organization_id, r.athlete_id, 'trial_status', jsonb_build_object('registration', p_reg, 'to', 'registered', 'origin', r.origin));
  perform public.audit('registration_created', 'opportunity_registration', p_reg, r.organization_id, jsonb_build_object('origin', r.origin), null, 'normal');
  perform public.org_staff_notify(r.organization_id, 'application.trial', 'Nueva inscripción', 'Revisa y confirma la plaza.', '/app/opportunities/' || r.opportunity_id);
end;
$$;

-- Quién responde por el atleta en una participación ya iniciada. A diferencia de trial_actor (que exige
-- edit_profile para inscribir en nombre del atleta), la familia vinculada y aprobada de un MENOR actúa como
-- tutor legal: aprueba, rechaza o retira aunque el menor no le haya dado permiso de edición.
create or replace function public.participation_actor(p_athlete uuid, p_agency uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(public.trial_actor(p_athlete, p_agency),
                  case when public.is_minor(p_athlete) and public.has_family_link(p_athlete, 'view_applications') then 'family' end);
$$;
revoke all on function public.participation_actor(uuid, uuid) from public, anon;

-- 3. Inscribirse: atleta, familia o agente activo. Idempotente; respeta el modo de inscripción, menores y coste. -----
create or replace function public.trial_register(p_opportunity uuid, p_athlete uuid, p_agency uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.participation_actor(p_athlete, p_agency);
  v_org uuid; v_title text; d record; v_inv record; v_app record; v_ex record;
  v_minor boolean := public.is_minor(p_athlete);
  v_status text; v_guardian text := 'not_required'; v_needs_ok boolean := false; v_origin text; v_id uuid;
begin
  if v_actor is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform public.registration_open_check(p_opportunity);
  select organization_id, title into v_org, v_title from public.opportunities where id = p_opportunity;
  if public.athlete_blocks_org(p_athlete, v_org) then raise exception 'blocked' using errcode = '42501'; end if;
  select * into d from public.trial_details where opportunity_id = p_opportunity;
  if v_minor and coalesce(d.minor_policy, 'guardian_consent_required') = 'adults_only' then raise exception 'adults_only' using errcode = 'P0001'; end if;
  select * into v_inv from public.opportunity_invitations where opportunity_id = p_opportunity and athlete_id = p_athlete and status in ('sent', 'viewed', 'interested') and expires_at > now();
  select * into v_app from public.applications where opportunity_id = p_opportunity and athlete_id = p_athlete;
  select * into v_ex from public.opportunity_registrations where opportunity_id = p_opportunity and athlete_id = p_athlete for update;
  if v_ex.id is null or v_ex.status = 'withdrawn' then
    if coalesce(d.registration_mode, 'direct') = 'invitation_only' and v_inv.id is null then raise exception 'invitation_required' using errcode = 'P0001'; end if;
    if coalesce(d.registration_mode, 'direct') = 'application_required' and coalesce(v_app.status::text, '') <> 'accepted' then raise exception 'application_required' using errcode = 'P0001'; end if;
  end if;
  -- Idempotente: lo que ya está en marcha no se duplica ni retrocede.
  if v_ex.id is not null and v_ex.status not in ('pending', 'withdrawn') then return v_ex.id; end if;

  v_origin := case when v_inv.id is not null then 'club_invite' when v_app.status::text = 'accepted' then 'application' else v_actor end;
  if v_actor = 'agent' and coalesce(d.price_status, 'price_not_provided') <> 'free' then
    v_status := 'pending'; v_needs_ok := true;     -- el agente no compromete dinero del atleta
  end if;
  if v_minor then
    if v_actor = 'family' then
      insert into public.consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, scope)
      values (p_athlete, auth.uid(), 'trial_participation', 'trial-consent-2026-11', true, 'opportunity', p_opportunity, v_org, 'participation')
      on conflict do nothing;
      v_guardian := 'approved';
    elsif public.guardian_requirement_satisfied(p_athlete, 'trial_participation', 'opportunity', p_opportunity) then
      v_guardian := 'approved';
    else
      v_guardian := 'pending'; v_status := 'pending';
    end if;
  end if;
  if v_status is null then v_status := 'registered'; end if;
  -- Si ya existía (pendiente), conservar lo ya resuelto (coste aceptado / tutor aprobado).
  if v_ex.id is not null and v_ex.status = 'pending' then
    if not v_ex.needs_athlete_ok and v_actor = 'agent' then v_needs_ok := false; end if;
    if v_ex.status = 'pending' and v_needs_ok = false and v_guardian <> 'pending' then v_status := 'registered'; end if;
  end if;

  if v_ex.id is not null then
    update public.opportunity_registrations
       set status = v_status, origin = v_origin, agency_id = coalesce(p_agency, agency_id), needs_athlete_ok = v_needs_ok, guardian_status = v_guardian,
           invitation_id = coalesce(v_inv.id, invitation_id), application_id = coalesce(v_app.id, application_id),
           cancelled_at = null, cancelled_by_side = null, cancellation_reason = null, updated_at = now()
     where id = v_ex.id;
    perform public.trial_log(v_ex.id, v_actor, v_ex.status, v_status, null);
    v_id := v_ex.id;
  else
    insert into public.opportunity_registrations (opportunity_id, organization_id, athlete_id, status, origin, agency_id, created_by, needs_athlete_ok, guardian_status, invitation_id, application_id)
    values (p_opportunity, v_org, p_athlete, v_status, v_origin, case when v_actor = 'agent' then p_agency end, auth.uid(), v_needs_ok, v_guardian, v_inv.id, v_app.id)
    returning id into v_id;
    perform public.trial_log(v_id, v_actor, null, v_status, null);
  end if;

  if v_status = 'registered' then
    perform public.registration_became_registered(v_id);
    perform public.participation_notify(p_athlete, p_opportunity, 'application.trial', 'Inscripción enviada: ' || left(v_title, 120), 'El club revisará y confirmará la plaza.');
  elsif v_needs_ok then
    perform public.participation_notify(p_athlete, p_opportunity, 'application.trial', 'Tu agente propone un trial: ' || left(v_title, 120), 'Tiene coste: revisa el importe y acepta antes de que se envíe la inscripción.');
  else
    perform public.participation_notify(p_athlete, p_opportunity, 'family.trial', 'Aprobación familiar pendiente: ' || left(v_title, 120), 'La inscripción se enviará cuando la familia la apruebe.');
  end if;
  return v_id;
end;
$$;

-- 4. Respuestas del lado del atleta sobre una inscripción ---------------------------------------------------------
create or replace function public.trial_respond(p_registration uuid, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare r record; v_actor text; v_to text; v_needs boolean; v_guardian text;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_actor := public.participation_actor(r.athlete_id, r.agency_id);
  if v_actor is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_needs := r.needs_athlete_ok; v_guardian := r.guardian_status;

  if p_action = 'confirm_cost' and r.needs_athlete_ok and v_actor in ('athlete', 'family') and r.status = 'pending' then
    v_needs := false;
  elsif p_action = 'guardian_approve' and r.guardian_status = 'pending' and v_actor = 'family' then
    insert into public.consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, scope)
    values (r.athlete_id, auth.uid(), 'trial_participation', 'trial-consent-2026-11', true, 'opportunity', r.opportunity_id, r.organization_id, 'participation');
    v_guardian := 'approved';
    perform public.audit('consent_granted', 'opportunity_registration', r.id, r.organization_id, jsonb_build_object('purpose', 'trial_participation'), null, 'sensitive');
  elsif p_action = 'guardian_decline' and r.guardian_status = 'pending' and v_actor = 'family' then
    insert into public.consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, scope)
    values (r.athlete_id, auth.uid(), 'trial_participation', 'trial-consent-2026-11', false, 'opportunity', r.opportunity_id, r.organization_id, 'participation');
    update public.opportunity_registrations set status = 'withdrawn', guardian_status = 'declined', cancelled_at = now(), cancelled_by_side = 'family', updated_at = now() where id = r.id;
    perform public.trial_log(r.id, v_actor, r.status, 'withdrawn', p_action);
    return 'withdrawn';
  elsif p_action = 'withdraw' and r.status in ('pending', 'registered', 'confirmed', 'waitlisted') then
    update public.opportunity_registrations set status = 'withdrawn', cancelled_at = now(), cancelled_by_side = case when v_actor = 'family' then 'family' else 'athlete' end, updated_at = now() where id = r.id;
    perform public.trial_log(r.id, v_actor, r.status, 'withdrawn', p_action);
    perform public.org_staff_notify(r.organization_id, 'application.trial', 'Un atleta se ha retirado de un trial', 'Revisa las inscripciones.', '/app/opportunities/' || r.opportunity_id);
    return 'withdrawn';
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_to := case when r.status = 'pending' and not v_needs and v_guardian <> 'pending' then 'registered' else r.status end;
  update public.opportunity_registrations set needs_athlete_ok = v_needs, guardian_status = v_guardian, status = v_to, updated_at = now() where id = r.id;
  perform public.trial_log(r.id, v_actor, r.status, v_to, p_action);
  if v_to = 'registered' and r.status <> 'registered' then perform public.registration_became_registered(r.id); end if;
  return v_to;
end;
$$;

-- 5. Invitaciones ---------------------------------------------------------------------------------------------------
drop function if exists public.trial_org_invite(uuid, uuid);
create or replace function public.trial_org_invite(p_opportunity uuid, p_athlete uuid, p_source text default 'discovery', p_shortlist uuid default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o record; v_id uuid;
begin
  select id, organization_id, program_id, team_id, title into o from public.opportunities where id = p_opportunity;
  -- 'contact' exige organización verificada y activa (org_can) y permiso sobre el programa del trial.
  if o.id is null or not public.org_can(o.organization_id, 'contact', o.program_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- viewed · interested · declined (atleta o familia) · guardian_approve (familia; crea la inscripción)
create or replace function public.invitation_respond(p_invitation uuid, p_action text, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare i record; v_actor text;
begin
  select * into i from public.opportunity_invitations where id = p_invitation for update;
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_actor := public.participation_actor(i.athlete_id, null);
  if v_actor is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if i.status in ('sent', 'viewed', 'interested') and i.expires_at <= now() then
    update public.opportunity_invitations set status = 'expired', updated_at = now() where id = i.id;
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if p_action = 'viewed' then
    if i.status = 'sent' then update public.opportunity_invitations set status = 'viewed', viewed_at = now(), updated_at = now() where id = i.id; return 'viewed'; end if;
    return i.status;
  elsif p_action = 'interested' and i.status in ('sent', 'viewed') then
    -- Interesado ≠ inscrito: el siguiente paso (requisitos → familia → inscripción) es explícito.
    update public.opportunity_invitations set status = 'interested', viewed_at = coalesce(viewed_at, now()), responded_at = now(), updated_at = now() where id = i.id;
    perform public.org_staff_notify(i.organization_id, 'application.trial', 'Un atleta está interesado en tu trial', 'Ha respondido a tu invitación.', '/app/opportunities/' || i.opportunity_id);
    if public.is_minor(i.athlete_id) and v_actor = 'athlete' then
      perform public.participation_notify(i.athlete_id, i.opportunity_id, 'family.trial', 'Tu revisión es necesaria', 'Hay una invitación a un trial pendiente de tu aprobación.');
    end if;
    return 'interested';
  elsif p_action = 'declined' and i.status in ('sent', 'viewed', 'interested') then
    update public.opportunity_invitations set status = 'declined', responded_at = now(), updated_at = now() where id = i.id;
    perform public.audit('invitation_declined', 'opportunity_invitation', i.id, i.organization_id,
      jsonb_build_object('reason', case when p_reason in ('timing', 'location', 'cost', 'not_interested', 'other') then p_reason end), null, 'normal');
    return 'declined';
  elsif p_action = 'guardian_approve' and v_actor = 'family' and i.status in ('sent', 'viewed', 'interested') then
    update public.opportunity_invitations set status = 'interested', responded_at = coalesce(responded_at, now()), updated_at = now() where id = i.id;
    perform public.trial_register(i.opportunity_id, i.athlete_id, null);
    return 'registered';
  end if;
  raise exception 'invalid_transition' using errcode = 'P0001';
end;
$$;

-- 6. Decisión del club sobre una candidatura (aceptar a un trial crea la inscripción; a un programa, la plaza ofrecida).
create or replace function public.application_org_decide(p_application uuid, p_decision text, p_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare a record; o record; v_reg uuid; v_enr uuid; v_guardian text;
begin
  select * into a from public.applications where id = p_application for update;
  if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select id, organization_id, program_id, type::text as type, title, start_at, end_at into o from public.opportunities where id = a.opportunity_id;
  if not public.org_can(o.organization_id, 'candidates', o.program_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- 7. Acciones del club sobre la inscripción (firma de 11 conservada) -------------------------------------------------
create or replace function public.trial_org_action(p_registration uuid, p_action text, p_outcome text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; v_prog uuid; v_cap int; v_to text;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id into v_prog from public.opportunities where id = r.opportunity_id;
  if not public.org_can(r.organization_id, 'candidates', v_prog) then raise exception 'not_allowed' using errcode = '42501'; end if;

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

-- 8. Asistencia: solo staff autorizado, solo inscripciones confirmadas, nunca antes del evento («unknown» por defecto).
create or replace function public.attendance_record(p_registration uuid, p_status text, p_check_in timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; o record;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id, start_at into o from public.opportunities where id = r.opportunity_id;
  if not public.org_can(r.organization_id, 'candidates', o.program_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- 9. Resultado (interno) + mensaje opcional que SÍ ve el atleta.
create or replace function public.outcome_record(p_registration uuid, p_outcome text, p_internal_note text default null, p_athlete_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r record; v_prog uuid; v_cand uuid;
begin
  select * into r from public.opportunity_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id into v_prog from public.opportunities where id = r.opportunity_id;
  if not public.org_can(r.organization_id, 'candidates', v_prog) then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- 10. Del trial al proceso de recruiting central (org_candidates). Idempotente; nunca crea una oferta.
create or replace function public.start_recruiting_from_trial(p_registration uuid, p_need uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r record; o record; v_cand uuid;
begin
  select * into r from public.opportunity_registrations where id = p_registration;
  if r.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select id, program_id, team_id, need_id into o from public.opportunities where id = r.opportunity_id;
  if not public.org_can(r.organization_id, 'pipeline', o.program_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- 11. Matrícula en academia ----------------------------------------------------------------------------------------
-- Atleta / familia: accept · decline · guardian_approve · guardian_decline · withdraw
create or replace function public.enrollment_respond(p_enrollment uuid, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare e record; v_actor text; v_to text; v_guardian text;
begin
  select * into e from public.program_enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_actor := public.participation_actor(e.athlete_id, null);
  if v_actor is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_guardian := e.guardian_status;
  if p_action in ('accept', 'guardian_approve') and e.status = 'offered' then
    if v_actor = 'family' then
      insert into public.consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, scope)
      values (e.athlete_id, auth.uid(), 'academy_enrollment', 'academy-consent-2026-11', true, 'enrollment', e.id, e.organization_id, 'enrollment');
      v_guardian := 'approved';
    elsif p_action = 'guardian_approve' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    v_to := case when v_guardian in ('not_required', 'approved') then 'accepted' else 'offered' end;
    update public.program_enrollments set guardian_status = v_guardian, status = v_to, accepted_at = case when v_to = 'accepted' then now() end, updated_at = now() where id = e.id;
    if v_to = 'accepted' then
      perform public.create_payment_requirements(null, e.id);
      perform public.org_staff_notify(e.organization_id, 'application.academy', 'Plaza aceptada', 'Formaliza la matrícula.', '/app/opportunities/' || e.opportunity_id);
    else
      perform public.participation_notify(e.athlete_id, e.opportunity_id, 'family.trial', 'Tu aprobación es necesaria', 'Hay una plaza en un programa de academia pendiente de tu aprobación.');
    end if;
    return case when v_to = 'accepted' then 'accepted' else 'pending_guardian' end;
  elsif p_action in ('decline', 'guardian_decline') and e.status = 'offered' and (p_action = 'decline' or v_actor = 'family') then
    update public.program_enrollments set status = 'declined', guardian_status = case when p_action = 'guardian_decline' then 'declined' else guardian_status end, updated_at = now() where id = e.id;
    return 'declined';
  elsif p_action = 'withdraw' and e.status in ('accepted', 'enrolled', 'active') then
    update public.program_enrollments set status = 'withdrawn', ended_at = now(), end_reason = 'withdrawn_by_athlete', updated_at = now() where id = e.id;
    return 'withdrawn';
  end if;
  raise exception 'invalid_transition' using errcode = 'P0001';
end;
$$;

-- Academia: enroll (aceptado → matriculado) · activate · complete · cancel
create or replace function public.enrollment_org_action(p_enrollment uuid, p_action text, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare e record; v_prog uuid; v_to text;
begin
  select * into e from public.program_enrollments where id = p_enrollment for update;
  if e.id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select program_id into v_prog from public.opportunities where id = e.opportunity_id;
  if not public.org_can(e.organization_id, 'candidates', v_prog) then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- 12. Caducidad: nunca se borra; pasa a «expired» por plazo, fin de evento o falta de confirmación.
create or replace function public.expire_stale_opportunities()
returns int language plpgsql security definer set search_path = public as $$
declare n int; m int;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  update public.opportunities set status = 'expired'
   where status = 'published'
     and ((deadline is not null and deadline < current_date)
          or (end_at is not null and end_at < now())
          or (deadline is null and end_at is null and coalesce(last_confirmed_at, published_at, updated_at) < now() - interval '120 days'));
  get diagnostics n = row_count;
  update public.opportunity_invitations set status = 'expired', updated_at = now() where status in ('sent', 'viewed', 'interested') and expires_at < now();
  get diagnostics m = row_count;
  return n + m;
end;
$$;

-- 13. Permisos de ejecución -----------------------------------------------------------------------------------------
revoke all on function public.trial_log(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.trial_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.participation_notify(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.org_staff_notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_payment_requirements(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registration_became_registered(uuid) from public, anon, authenticated;
revoke all on function public.registration_open_check(uuid) from public, anon, authenticated;
revoke all on function public.athlete_blocks_org(uuid, uuid) from public, anon;
revoke all on function public.opportunity_confirmed_count(uuid) from public, anon;
grant execute on function public.opportunity_confirmed_count(uuid) to authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.trial_register(uuid, uuid, uuid)', 'public.trial_respond(uuid, text)', 'public.trial_org_invite(uuid, uuid, text, uuid, text)',
    'public.invitation_respond(uuid, text, text)', 'public.application_org_decide(uuid, text, text)', 'public.trial_org_action(uuid, text, text)',
    'public.attendance_record(uuid, text, timestamptz)', 'public.outcome_record(uuid, text, text, text)', 'public.start_recruiting_from_trial(uuid, uuid)',
    'public.enrollment_respond(uuid, text)', 'public.enrollment_org_action(uuid, text, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- 14. Eventos de producto (analítica separada de la auditoría; sin datos sensibles) --------------------------------
alter table public.product_events drop constraint product_events_event_check;
alter table public.product_events add constraint product_events_event_check check (event in (
  'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
  'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
  'document_uploaded', 'roster_joined', 'universities_compared',
  'passport_completed', 'passport_shared', 'video_uploaded', 'university_viewed', 'university_saved',
  'match_viewed', 'opportunity_saved', 'comparison_created', 'task_completed', 'dashboard_viewed',
  'pipeline_stage_changed', 'interaction_logged', 'offer_recorded', 'pipeline_decision',
  'recruiting_need_created', 'athlete_discovered', 'athlete_shortlisted', 'candidate_assigned', 'candidate_stage_changed',
  'document_requested', 'document_shared', 'offer_created', 'coach_dashboard_viewed', 'candidates_exported',
  'trial_applied', 'trial_viewed', 'agent_trials_viewed',
  'athlete_search_performed', 'athlete_search_saved', 'athlete_promoted_to_pipeline', 'verification_requested',
  'athlete_quick_view', 'highlight_played', 'note_added',
  'trial_saved', 'trial_invitation_viewed', 'trial_invitation_sent', 'trial_registered', 'trial_checked_in',
  'academy_program_viewed', 'academy_program_applied', 'recruiting_process_started',
  'trial_mobile_viewed', 'trial_invitation_opened', 'trial_consent_reviewed', 'trial_consent_approved', 'mobile_discovery_search', 'scout_note_added'));
