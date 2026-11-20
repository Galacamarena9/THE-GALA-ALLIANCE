-- =============================================================================
-- CLUBS & ACADEMIES · 11A · Trials y programas (enfocado al agente). Solo aditiva.
--
-- Arquitectura (sin sistema paralelo):
--   · La oportunidad sigue siendo la entidad central (opportunities, tipos tryout / camp_showcase / academy /
--     club_recruitment). Los detalles propios de trials y programas viven en una tabla 1:1
--     (opportunity_event_details), no en 40 columnas nuevas de opportunities.
--   · La participación en un trial es trial_registrations: un registro por atleta y oportunidad (idempotente),
--     con estados separados: invitado ≠ interesado ≠ inscrito ≠ confirmado ≠ asistió. Nada se salta.
--   · Toda escritura pasa por funciones transaccionales que comprueban quién actúa:
--       atleta · familia (permiso de edición) · agente con representación ACTIVA · club con permiso de candidatos.
--   · Para el agente (el cliente que paga): puede inscribir a sus representados en trials GRATUITOS de
--     organizaciones verificadas; si el trial cuesta dinero, queda en «interesado» hasta que el atleta acepte el coste.
--     Recibe avisos de cada cambio del club sobre sus atletas.
--
-- Reversión (orden inverso):
--   drop function public.trial_org_action(uuid, text, text), public.trial_org_invite(uuid, uuid),
--     public.trial_respond(uuid, text), public.trial_register(uuid, uuid, uuid), public.trial_actor(uuid, uuid),
--     public.trial_log(uuid, text, text, text, text), public.trial_notify(uuid, text, text, text);
--   drop table public.trial_registration_events, public.trial_registrations, public.opportunity_event_details;
--   restaurar los checks originales de org_activity.kind y org_candidates.source (20261117001000).
-- =============================================================================

-- 1. Detalles de trial / programa ----------------------------------------------------------------
create table public.opportunity_event_details (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  -- Categoría configurable (U16, U18, Senior, Development, First Team…): texto libre corto + límites reales opcionales.
  age_category text check (char_length(age_category) between 1 and 40),
  age_min smallint check (age_min between 5 and 45),
  age_max smallint check (age_max between 5 and 45),
  -- Ubicación estructurada (nunca datos de un menor).
  country char(2) check (country ~ '^[A-Z]{2}$'),
  region text check (char_length(region) <= 80),
  city text check (char_length(city) <= 80),
  venue text check (char_length(venue) <= 120),
  -- Fecha y hora LOCALES del evento + zona horaria IANA: no se convierten para quien lo ve desde otro país.
  event_start_date date,
  event_end_date date,
  start_time_local time,
  timezone text check (timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){1,2}$' or timezone = 'UTC'),
  duration_days smallint check (duration_days between 1 and 365),
  -- Capacidad solo si está confirmada. No se usa para mostrar «quedan X plazas».
  capacity int check (capacity between 1 and 10000),
  -- Coste transparente desde el principio.
  fee_type text not null default 'unknown' check (fee_type in ('free', 'paid', 'unknown')),
  fee_amount numeric(10, 2) check (fee_amount >= 0 and fee_amount <= 1000000),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  fee_includes text[] not null default '{}' check (cardinality(fee_includes) <= 12),
  refundable text not null default 'unknown' check (refundable in ('yes', 'no', 'partial', 'unknown')),
  refund_details text check (char_length(refund_details) <= 500),
  -- Otros costes obligatorios u opcionales: [{label, amount, currency, required}]
  extra_costs jsonb not null default '[]' check (jsonb_typeof(extra_costs) = 'array' and jsonb_array_length(extra_costs) <= 12),
  accommodation text not null default 'unknown' check (accommodation in ('included', 'available_paid', 'not_included', 'unknown')),
  meals text not null default 'unknown' check (meals in ('included', 'not_included', 'unknown')),
  travel text not null default 'unknown' check (travel in ('included', 'not_included', 'unknown')),
  education_support text not null default 'unknown' check (education_support in ('yes', 'no', 'unknown')),
  program_schedule text check (char_length(program_schedule) <= 500),
  video_requirements text check (char_length(video_requirements) <= 500),
  minor_policy text not null default 'guardian_consent_required' check (minor_policy in ('guardian_consent_required', 'adults_only')),
  updated_at timestamptz not null default now(),
  constraint event_dates_ordered check (event_end_date is null or event_start_date is null or event_end_date >= event_start_date),
  constraint ages_ordered check (age_min is null or age_max is null or age_max >= age_min),
  -- Un trial de pago siempre muestra importe y moneda; uno gratuito no tiene importe.
  constraint paid_has_price check (fee_type <> 'paid' or (fee_amount is not null and currency is not null)),
  constraint free_has_no_price check (fee_type <> 'free' or fee_amount is null)
);
alter table public.opportunity_event_details enable row level security;
-- Se ve si se ve la oportunidad (la RLS de opportunities se aplica dentro de la subconsulta).
create policy event_details_select on public.opportunity_event_details for select to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id));
create policy event_details_write on public.opportunity_event_details for all to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.org_can(o.organization_id, 'opportunities')))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.org_can(o.organization_id, 'opportunities')));
grant select, insert, update, delete on public.opportunity_event_details to authenticated;

create or replace function public.guard_event_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.opportunities where id = new.opportunity_id and type in ('tryout', 'camp_showcase', 'academy', 'club_recruitment')) then
    raise exception 'not_a_trial_or_program' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_event_details before insert or update on public.opportunity_event_details
  for each row execute function public.guard_event_details();

-- 2. Participación en trials ----------------------------------------------------------------------
create table public.trial_registrations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  -- invited: el club invita · interested: el atleta (o su agente) muestra interés · registered: inscripción enviada
  -- confirmed: el club confirma la plaza · waitlisted: lista de espera (no es un rechazo) · declined: el club no continúa
  -- withdrawn: el atleta se retira · attended / no_show: registrado explícitamente por el club tras el evento
  status text not null check (status in ('invited', 'interested', 'registered', 'confirmed', 'waitlisted', 'declined', 'withdrawn', 'attended', 'no_show')),
  outcome text check (outcome in ('follow_up', 'continue_recruiting', 'not_selected')),
  origin text not null check (origin in ('athlete', 'family', 'agent', 'club_invite')),
  agency_id uuid references public.organizations (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  -- Inscripción hecha por el agente en un trial con coste: el atleta debe aceptar el coste antes de inscribirse.
  needs_athlete_ok boolean not null default false,
  guardian_status text not null default 'not_required' check (guardian_status in ('not_required', 'pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, athlete_id),
  constraint outcome_after_attendance check (outcome is null or status = 'attended')
);
create index trial_reg_athlete_idx on public.trial_registrations (athlete_id, updated_at desc);
create index trial_reg_org_idx on public.trial_registrations (organization_id, status);
create index trial_reg_agency_idx on public.trial_registrations (agency_id) where agency_id is not null;
alter table public.trial_registrations enable row level security;

-- ¿El usuario actual es agente (con escritura) de una agencia que representa ACTIVAMENTE a este atleta?
create or replace function public.is_active_agent_for(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_representations r
      join public.organization_members m on m.organization_id = r.agency_id and m.user_id = auth.uid()
     where r.athlete_id = p_athlete and r.status = 'active'
  );
$$;
revoke all on function public.is_active_agent_for(uuid) from public, anon;
grant execute on function public.is_active_agent_for(uuid) to authenticated;

create policy trial_reg_select on public.trial_registrations for select to authenticated using (
  athlete_id = auth.uid()
  or public.has_family_link(athlete_id, 'view_profile')
  or public.is_active_agent_for(athlete_id)
  or public.org_can(organization_id, 'candidates')
  or public.is_admin()
);
-- Sin insert/update/delete directos: todo pasa por las funciones (transaccionales y con reglas).
grant select on public.trial_registrations to authenticated;

create table public.trial_registration_events (
  id bigint generated always as identity primary key,
  registration_id uuid not null references public.trial_registrations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_kind text not null check (actor_kind in ('athlete', 'family', 'agent', 'organization', 'system')),
  from_status text,
  to_status text not null,
  detail text check (char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index trial_reg_events_idx on public.trial_registration_events (registration_id, id);
alter table public.trial_registration_events enable row level security;
create policy trial_reg_events_select on public.trial_registration_events for select to authenticated
  using (exists (select 1 from public.trial_registrations r where r.id = registration_id));
grant select on public.trial_registration_events to authenticated;

-- Auditoría del club y procedencia del candidato.
alter table public.org_activity drop constraint org_activity_kind_check;
alter table public.org_activity add constraint org_activity_kind_check check (kind in ('candidate_created', 'stage_changed', 'assigned', 'shortlisted', 'unshortlisted', 'reviewed',
    'note_added', 'task_created', 'task_done', 'info_requested', 'info_shared', 'info_declined', 'document_accessed',
    'offer_recorded', 'member_added', 'member_role_changed', 'member_removed', 'need_created', 'need_updated',
    'opportunity_status', 'ownership_transferred', 'export', 'trial_invited', 'trial_status'));
alter table public.org_candidates drop constraint org_candidates_source_check;
alter table public.org_candidates add constraint org_candidates_source_check check (source in ('discovery', 'application', 'shortlist', 'referral', 'trial'));

-- 3. Utilidades internas ---------------------------------------------------------------------------
create or replace function public.trial_log(p_reg uuid, p_actor text, p_from text, p_to text, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into public.trial_registration_events (registration_id, actor_id, actor_kind, from_status, to_status, detail)
  values (p_reg, auth.uid(), p_actor, p_from, p_to, left(p_detail, 300));
$$;

-- Avisa al atleta, a su familia con permiso de edición y a sus agentes con representación activa.
-- Nunca avisa a quien hizo la acción.
create or replace function public.trial_notify(p_reg uuid, p_kind text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_athlete uuid;
  v_opp uuid;
begin
  select athlete_id, opportunity_id into v_athlete, v_opp from public.trial_registrations where id = p_reg;
  for r in
    select v_athlete as uid
    union select l.parent_id from public.parent_athlete_links l where l.athlete_id = v_athlete and l.status = 'approved'
    union select rp.agent_id from public.agent_representations rp where rp.athlete_id = v_athlete and rp.status = 'active'
  loop
    if r.uid is not null and r.uid is distinct from auth.uid() then
      perform public.notify(r.uid, p_kind, p_title, p_body, '/app/opportunities/' || v_opp);
    end if;
  end loop;
end;
$$;

-- Quién actúa en nombre del atleta: el propio atleta, su familia (edición) o un agente con representación activa.
create or replace function public.trial_actor(p_athlete uuid, p_agency uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() = p_athlete then 'athlete'
    when public.has_family_link(p_athlete, 'edit_profile') then 'family'
    when p_agency is not null and public.agency_can_write(p_agency) and public.agency_has_active_representation(p_agency, p_athlete) then 'agent'
    else null
  end;
$$;

-- 4. Inscribirse (atleta, familia o agente) — idempotente y transaccional ---------------------------
create or replace function public.trial_register(p_opportunity uuid, p_athlete uuid, p_agency uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor text := public.trial_actor(p_athlete, p_agency);
  o record;
  d record;
  v_minor boolean := public.is_minor(p_athlete);
  v_status text;
  v_guardian text := 'not_required';
  v_needs_ok boolean := false;
  v_existing record;
  v_id uuid;
begin
  if v_actor is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select op.id, op.type, op.status, op.organization_id, op.deadline, op.expires_at, op.title, org.verification_status, org.name as org_name
    into o
    from public.opportunities op join public.organizations org on org.id = op.organization_id
   where op.id = p_opportunity;
  if o.id is null or o.status <> 'published' then raise exception 'opportunity_not_open' using errcode = 'P0001'; end if;
  if o.type not in ('tryout', 'camp_showcase', 'academy', 'club_recruitment') then raise exception 'not_a_trial_or_program' using errcode = 'P0001'; end if;
  if (o.deadline is not null and o.deadline < current_date) or (o.expires_at is not null and o.expires_at < current_date) then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  -- Protección frente a estafas: solo organizaciones verificadas reciben inscripciones.
  if o.verification_status <> 'verified' then raise exception 'organization_not_verified' using errcode = 'P0001'; end if;
  select fee_type, minor_policy into d from public.opportunity_event_details where opportunity_id = p_opportunity;
  if v_minor and coalesce(d.minor_policy, 'guardian_consent_required') = 'adults_only' then
    raise exception 'adults_only' using errcode = 'P0001';
  end if;

  if v_actor = 'agent' and coalesce(d.fee_type, 'unknown') <> 'free' then
    -- El agente no compromete dinero del atleta: queda en interesado hasta que el atleta acepte el coste.
    v_status := 'interested'; v_needs_ok := true;
  elsif v_minor and v_actor = 'athlete' then
    v_status := 'interested'; v_guardian := 'pending';
  else
    v_status := 'registered';
    if v_minor then v_guardian := 'approved'; end if;
  end if;

  select id, status into v_existing from public.trial_registrations where opportunity_id = p_opportunity and athlete_id = p_athlete for update;
  if v_existing.id is not null then
    -- Idempotente: si ya está en marcha, no se duplica ni se retrocede.
    if v_existing.status not in ('invited', 'withdrawn', 'interested') then return v_existing.id; end if;
    if v_existing.status = 'interested' and v_status = 'interested' then return v_existing.id; end if;
    update public.trial_registrations
       set status = v_status, origin = case when v_existing.status = 'invited' then origin else v_actor end,
           agency_id = coalesce(p_agency, agency_id), needs_athlete_ok = v_needs_ok, guardian_status = v_guardian, updated_at = now()
     where id = v_existing.id;
    perform public.trial_log(v_existing.id, v_actor, v_existing.status, v_status, null);
    v_id := v_existing.id;
  else
    insert into public.trial_registrations (opportunity_id, organization_id, athlete_id, status, origin, agency_id, created_by, needs_athlete_ok, guardian_status)
    values (p_opportunity, o.organization_id, p_athlete, v_status, v_actor, case when v_actor = 'agent' then p_agency end, auth.uid(), v_needs_ok, v_guardian)
    returning id into v_id;
    perform public.trial_log(v_id, v_actor, null, v_status, null);
  end if;

  -- Pipeline del atleta: el trial entra como proceso (sin duplicar).
  insert into public.saved_items (athlete_id, target_kind, target_id, status)
  values (p_athlete, 'opportunity', p_opportunity, case when v_status = 'registered' then 'applied' else 'saved' end)
  on conflict (athlete_id, target_kind, target_id) do nothing;

  if v_needs_ok then
    perform public.trial_notify(v_id, 'application.trial', 'Tu agente propone un trial: ' || left(o.title, 120),
      'Tiene coste: revisa el importe y acepta antes de que se envíe la inscripción.');
  elsif v_guardian = 'pending' then
    perform public.trial_notify(v_id, 'family.trial', 'Aprobación familiar pendiente: ' || left(o.title, 120), 'La inscripción se enviará cuando la familia la apruebe.');
  else
    perform public.trial_notify(v_id, 'application.trial', 'Inscripción enviada: ' || left(o.title, 120), o.org_name || ' revisará la inscripción.');
    perform public.org_log(o.organization_id, p_athlete, 'trial_status', jsonb_build_object('registration', v_id, 'to', v_status, 'origin', v_actor));
  end if;
  return v_id;
end;
$$;

-- 5. Respuestas del lado del atleta ---------------------------------------------------------------
-- interested (ante una invitación) · confirm_cost (acepta el coste propuesto por el agente) ·
-- guardian_approve / guardian_decline (familia) · withdraw (retirarse en cualquier momento antes de asistir)
create or replace function public.trial_respond(p_registration uuid, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_actor text;
  v_to text;
begin
  select * into r from public.trial_registrations where id = p_registration for update;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_actor := public.trial_actor(r.athlete_id, r.agency_id);
  if v_actor is null then raise exception 'not_allowed' using errcode = '42501'; end if;

  if p_action = 'interested' and r.status = 'invited' then
    v_to := 'interested';
    if public.is_minor(r.athlete_id) and v_actor = 'athlete' then
      update public.trial_registrations set guardian_status = 'pending' where id = r.id;
    end if;
  elsif p_action = 'confirm_cost' and r.needs_athlete_ok and v_actor in ('athlete', 'family') then
    v_to := 'registered';
    update public.trial_registrations set needs_athlete_ok = false where id = r.id;
  elsif p_action = 'guardian_approve' and r.guardian_status = 'pending' and v_actor = 'family' then
    v_to := case when r.needs_athlete_ok then r.status else 'registered' end;
    update public.trial_registrations set guardian_status = 'approved' where id = r.id;
  elsif p_action = 'guardian_decline' and r.guardian_status = 'pending' and v_actor = 'family' then
    v_to := 'withdrawn';
    update public.trial_registrations set guardian_status = 'declined' where id = r.id;
  elsif p_action = 'withdraw' and r.status in ('invited', 'interested', 'registered', 'confirmed', 'waitlisted') then
    v_to := 'withdrawn';
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- Un menor no pasa a inscrito sin aprobación familiar.
  if v_to = 'registered' and public.is_minor(r.athlete_id) and (select guardian_status from public.trial_registrations where id = r.id) not in ('approved') then
    v_to := 'interested';
    update public.trial_registrations set guardian_status = 'pending' where id = r.id;
  end if;

  update public.trial_registrations set status = v_to, updated_at = now() where id = r.id;
  perform public.trial_log(r.id, v_actor, r.status, v_to, p_action);
  if v_to = 'registered' then
    perform public.org_log(r.organization_id, r.athlete_id, 'trial_status', jsonb_build_object('registration', r.id, 'to', v_to));
    update public.saved_items set status = 'applied' where athlete_id = r.athlete_id and target_kind = 'opportunity' and target_id = r.opportunity_id and status in ('discovered', 'saved');
  end if;
  perform public.trial_notify(r.id, 'application.trial', 'Trial actualizado', 'Nuevo estado: ' || v_to);
  return v_to;
end;
$$;

-- 6. Lado del club --------------------------------------------------------------------------------
create or replace function public.trial_org_invite(p_opportunity uuid, p_athlete uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o record;
  v_id uuid;
begin
  select id, organization_id, status, type, title into o from public.opportunities where id = p_opportunity;
  if o.id is null or not public.org_can(o.organization_id, 'contact') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if o.status <> 'published' or o.type not in ('tryout', 'camp_showcase', 'academy', 'club_recruitment') then raise exception 'opportunity_not_open' using errcode = 'P0001'; end if;
  -- Solo se invita a quien el club puede ver (visibilidad, bloqueos y privacidad del atleta).
  if not public.can_view_athlete(p_athlete, 'profile') then raise exception 'athlete_not_visible' using errcode = '42501'; end if;
  insert into public.trial_registrations (opportunity_id, organization_id, athlete_id, status, origin, created_by)
  values (p_opportunity, o.organization_id, p_athlete, 'invited', 'club_invite', auth.uid())
  on conflict (opportunity_id, athlete_id) do nothing
  returning id into v_id;
  if v_id is null then
    -- Ya existe (invitado, inscrito…): no se duplica la invitación.
    select id into v_id from public.trial_registrations where opportunity_id = p_opportunity and athlete_id = p_athlete;
    return v_id;
  end if;
  perform public.trial_log(v_id, 'organization', null, 'invited', null);
  perform public.org_log(o.organization_id, p_athlete, 'trial_invited', jsonb_build_object('registration', v_id, 'opportunity', p_opportunity));
  perform public.trial_notify(v_id, 'application.trial', 'Invitación a trial: ' || left(o.title, 120), 'Revisa fecha, lugar, coste y requisitos antes de responder.');
  return v_id;
end;
$$;

-- confirm · waitlist · decline · attended · no_show · outcome (follow_up | continue_recruiting | not_selected)
create or replace function public.trial_org_action(p_registration uuid, p_action text, p_outcome text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_to text;
  v_event date;
begin
  select * into r from public.trial_registrations where id = p_registration for update;
  if r.id is null or not public.org_can(r.organization_id, 'candidates') then raise exception 'not_allowed' using errcode = '42501'; end if;
  select event_start_date into v_event from public.opportunity_event_details where opportunity_id = r.opportunity_id;

  if p_action = 'confirm' and r.status in ('registered', 'waitlisted') then v_to := 'confirmed';
  elsif p_action = 'waitlist' and r.status = 'registered' then v_to := 'waitlisted';
  elsif p_action = 'decline' and r.status in ('registered', 'waitlisted', 'interested', 'confirmed') then v_to := 'declined';
  elsif p_action in ('attended', 'no_show') and r.status = 'confirmed' then
    -- La asistencia se registra explícitamente y solo cuando el evento ya ha empezado.
    if v_event is null or v_event > current_date then raise exception 'event_not_started' using errcode = 'P0001'; end if;
    v_to := p_action;
  elsif p_action = 'outcome' and r.status = 'attended' and p_outcome in ('follow_up', 'continue_recruiting', 'not_selected') then
    update public.trial_registrations set outcome = p_outcome, updated_at = now() where id = r.id;
    perform public.trial_log(r.id, 'organization', r.status, r.status, 'outcome:' || p_outcome);
    if p_outcome = 'continue_recruiting' then
      -- Del trial al recruiting formal: crea o reactiva el candidato (nunca crea una oferta).
      insert into public.org_candidates (organization_id, athlete_id, opportunity_id, internal_stage, source)
      values (r.organization_id, r.athlete_id, r.opportunity_id, 'active', 'trial')
      on conflict (organization_id, athlete_id) do update set internal_stage = 'active', archived_at = null;
    end if;
    perform public.org_log(r.organization_id, r.athlete_id, 'trial_status', jsonb_build_object('registration', r.id, 'outcome', p_outcome));
    perform public.trial_notify(r.id, 'application.trial', 'Novedades tras el trial',
      case p_outcome when 'continue_recruiting' then 'El club quiere continuar el proceso contigo.' when 'not_selected' then 'El club no continuará esta vez.' else 'El club hará seguimiento.' end);
    return r.status;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.trial_registrations set status = v_to, updated_at = now() where id = r.id;
  perform public.trial_log(r.id, 'organization', r.status, v_to, null);
  perform public.org_log(r.organization_id, r.athlete_id, 'trial_status', jsonb_build_object('registration', r.id, 'from', r.status, 'to', v_to));
  perform public.trial_notify(r.id, 'application.trial', 'Trial actualizado',
    case v_to when 'confirmed' then 'Tu plaza está confirmada.' when 'waitlisted' then 'Estás en lista de espera (no es un rechazo).'
              when 'declined' then 'El club no continuará con esta inscripción.' when 'attended' then 'Asistencia registrada.' else 'Ausencia registrada.' end);
  return v_to;
end;
$$;

revoke all on function public.trial_log(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.trial_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.trial_actor(uuid, uuid) from public, anon;
revoke all on function public.trial_register(uuid, uuid, uuid) from public, anon;
revoke all on function public.trial_respond(uuid, text) from public, anon;
revoke all on function public.trial_org_invite(uuid, uuid) from public, anon;
revoke all on function public.trial_org_action(uuid, text, text) from public, anon;
grant execute on function public.trial_actor(uuid, uuid) to authenticated;
grant execute on function public.trial_register(uuid, uuid, uuid) to authenticated;
grant execute on function public.trial_respond(uuid, text) to authenticated;
grant execute on function public.trial_org_invite(uuid, uuid) to authenticated;
grant execute on function public.trial_org_action(uuid, text, text) to authenticated;

-- 7. Eventos de producto (sin datos sensibles) -----------------------------------------------------
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
  'trial_applied', 'trial_viewed', 'agent_trials_viewed'));
