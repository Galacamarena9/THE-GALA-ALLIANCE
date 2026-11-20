-- 11A · D: candidatura ≠ invitación ≠ inscripción ≠ asistencia ≠ resultado ≠ matrícula; pagos preparados;
-- consentimiento granular; acceso a documentos por concesión.
-- Procedencia siempre estructurada: applications.source, opportunity_invitations.source, opportunity_registrations.origin,
-- org_candidates.source (+ registration_id). Nombres de club/atleta: SIEMPRE por FK, nunca copiados en texto.
-- Borrado: los registros de participación se conservan (la oportunidad se archiva, no se borra: FK NO ACTION);
-- solo desaparecen con la cuenta del atleta (RGPD) o con la organización.
-- Reversión: ver docs/CLUBS_ACADEMIES_DATA_MODEL.md §Reversión.

-- 1. Candidatura (se reutiliza applications): tenant explícito, procedencia, consentimiento y decisión ------------
alter table public.applications
  add column organization_id uuid references public.organizations (id) on delete cascade,
  add column source text not null default 'athlete' check (source in ('athlete', 'family', 'agent', 'club_invitation')),
  add column submitted_at timestamptz,
  add column guardian_consent_status text not null default 'not_required' check (guardian_consent_status in ('not_required', 'pending', 'granted', 'declined')),
  add column materials_complete boolean,
  add column invitation_id uuid,
  add column decided_at timestamptz,
  add column decided_by uuid references public.profiles (id) on delete set null,
  add column decision_message text check (char_length(decision_message) <= 1000);
update public.applications a set organization_id = o.organization_id, submitted_at = a.created_at from public.opportunities o where o.id = a.opportunity_id;
alter table public.applications alter column organization_id set not null;
create index applications_org_status_idx on public.applications (organization_id, status);
create index applications_athlete_idx on public.applications (athlete_id, updated_at desc);

create or replace function public.application_set_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- El tenant lo decide la oportunidad, nunca el cliente.
  new.organization_id := (select organization_id from public.opportunities where id = new.opportunity_id);
  if tg_op = 'INSERT' then
    new.submitted_at := now();
    new.guardian_consent_status := case when public.is_minor(new.athlete_id) then 'pending' else 'not_required' end;
    new.decided_at := null; new.decided_by := null; new.decision_message := null;
  elsif (new.organization_id, new.source, new.submitted_at, new.invitation_id) is distinct from (old.organization_id, old.source, old.submitted_at, old.invitation_id)
        and coalesce(current_setting('gala.participation_write', true), '') <> 'on' then
    raise exception 'application_immutable_keys' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a_application_set_tenant before insert or update on public.applications for each row execute function public.application_set_tenant();

-- 2. Invitaciones del club (≠ candidatura del atleta) ----------------------------------------------------------------
create table public.opportunity_invitations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete no action,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid references public.org_teams (id) on delete set null,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  source text not null default 'discovery' check (source in ('discovery', 'shortlist', 'recruiting_need', 'gala_match', 'trial_follow_up', 'other')),
  source_shortlist_id uuid references public.org_shortlists (id) on delete set null,
  message text check (char_length(message) <= 600),
  status text not null default 'sent' check (status in ('sent', 'viewed', 'interested', 'declined', 'expired', 'withdrawn', 'converted_to_registration')),
  guardian_required boolean not null default false,
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '21 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Una invitación activa por atleta y oportunidad (las cerradas se conservan como historial).
create unique index invitations_active_unique on public.opportunity_invitations (opportunity_id, athlete_id) where status in ('sent', 'viewed', 'interested');
create index invitations_athlete_idx on public.opportunity_invitations (athlete_id, status);
create index invitations_opp_idx on public.opportunity_invitations (opportunity_id, status);
alter table public.applications add constraint applications_invitation_fk foreign key (invitation_id) references public.opportunity_invitations (id) on delete set null;

-- 3. Inscripción (se reutiliza la tabla de 11: trial_registrations → opportunity_registrations) -------------------
alter table public.trial_registrations rename to opportunity_registrations;
alter table public.trial_registration_events rename to opportunity_registration_events;
alter table public.opportunity_registrations
  add column application_id uuid references public.applications (id) on delete set null,
  add column invitation_id uuid references public.opportunity_invitations (id) on delete set null,
  add column registered_at timestamptz,
  add column confirmed_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancellation_reason text check (char_length(cancellation_reason) <= 300),
  add column cancelled_by_side text check (cancelled_by_side in ('athlete', 'family', 'organization', 'system')),
  add column payment_status text not null default 'not_required' check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'waived')),
  add column materials_status text not null default 'not_required' check (materials_status in ('not_required', 'pending', 'complete')),
  -- Lo ÚNICO del resultado que ve el atleta: un mensaje que el club decide compartir.
  add column athlete_update text check (char_length(athlete_update) <= 500),
  add column athlete_update_at timestamptz;

-- 3a. Las «invitaciones» guardadas como inscripción pasan a su entidad propia.
insert into public.opportunity_invitations (opportunity_id, organization_id, athlete_id, invited_by, status, sent_at, created_at, updated_at, source)
select opportunity_id, organization_id, athlete_id, created_by, 'sent', created_at, created_at, updated_at, 'other'
  from public.opportunity_registrations where status = 'invited';
delete from public.opportunity_registrations where status = 'invited';

-- 4. Asistencia (≠ inscripción). Una principal por inscripción. UNKNOWN hasta que el club la registra.
create table public.opportunity_attendance (
  registration_id uuid primary key references public.opportunity_registrations (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete no action,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  status text not null default 'unknown' check (status in ('unknown', 'attended', 'no_show', 'partial', 'cancelled_before_event')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz,
  source text not null default 'staff' check (source in ('staff', 'qr', 'athlete', 'guardian', 'system')),
  constraint attendance_checkout_after check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);
create index attendance_opp_idx on public.opportunity_attendance (opportunity_id, status);

-- 5. Resultado operativo INTERNO (nunca visible para atleta ni familia; no es una valoración del talento).
create table public.opportunity_outcomes (
  registration_id uuid primary key references public.opportunity_registrations (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete no action,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  outcome text not null check (outcome in ('no_further_action', 'follow_up', 'invite_again', 'start_recruiting_process', 'academy_offer', 'club_offer', 'closed')),
  internal_note text check (char_length(internal_note) <= 1000),
  candidate_id uuid references public.org_candidates (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz not null default now()
);
create index outcomes_org_idx on public.opportunity_outcomes (organization_id, outcome);

-- 3b. Estados antiguos → nuevos (asistencia y resultado a sus tablas; no se pierde nada).
insert into public.opportunity_attendance (registration_id, opportunity_id, organization_id, athlete_id, status, recorded_at, source)
select id, opportunity_id, organization_id, athlete_id, status, updated_at, 'staff' from public.opportunity_registrations where status in ('attended', 'no_show');
insert into public.opportunity_outcomes (registration_id, opportunity_id, organization_id, athlete_id, outcome, decided_at)
select id, opportunity_id, organization_id, athlete_id,
       case outcome when 'continue_recruiting' then 'start_recruiting_process' when 'not_selected' then 'no_further_action' else 'follow_up' end, updated_at
  from public.opportunity_registrations where outcome is not null;
alter table public.opportunity_registrations drop constraint if exists outcome_after_attendance;
alter table public.opportunity_registrations drop constraint if exists trial_registrations_status_check;
alter table public.opportunity_registrations drop constraint if exists trial_registrations_origin_check;
update public.opportunity_registrations set status = case status
  when 'interested' then 'pending' when 'declined' then 'cancelled' when 'attended' then 'completed' when 'no_show' then 'completed' else status end,
  cancelled_by_side = case when status = 'declined' then 'organization' when status = 'withdrawn' then 'athlete' end,
  registered_at = case when status in ('registered', 'confirmed', 'waitlisted', 'attended', 'no_show') then created_at end,
  confirmed_at = case when status in ('confirmed', 'attended', 'no_show') then updated_at end;
alter table public.opportunity_registrations drop column outcome;
alter table public.opportunity_registrations add constraint opportunity_registrations_status_check
  check (status in ('pending', 'registered', 'confirmed', 'waitlisted', 'cancelled', 'withdrawn', 'completed'));
alter table public.opportunity_registrations add constraint opportunity_registrations_origin_check
  check (origin in ('athlete', 'family', 'agent', 'club_invite', 'application'));
alter table public.opportunity_registrations drop constraint if exists trial_registrations_opportunity_id_fkey;
alter table public.opportunity_registrations add constraint opportunity_registrations_opportunity_fk foreign key (opportunity_id) references public.opportunities (id) on delete no action;
create index registrations_opp_status_idx on public.opportunity_registrations (opportunity_id, status);

-- 6. Matrícula en programa de academia (aceptado ≠ matriculado) ----------------------------------------------------
create table public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete no action,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  -- Si existe una oferta formal registrada (athlete_offers), se enlaza; no se duplica.
  offer_id uuid references public.athlete_offers (id) on delete set null,
  -- offered: la academia ofrece plaza · accepted: atleta/familia aceptan · enrolled: la academia formaliza · active · completed
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'enrolled', 'active', 'completed', 'withdrawn', 'cancelled')),
  guardian_status text not null default 'not_required' check (guardian_status in ('not_required', 'pending', 'approved', 'declined')),
  aid_amount numeric(10, 2) check (aid_amount >= 0),
  aid_currency char(3) check (aid_currency ~ '^[A-Z]{3}$'),
  starts_on date,
  ends_on date,
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  enrolled_at timestamptz,
  ended_at timestamptz,
  end_reason text check (char_length(end_reason) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollment_aid_currency check (aid_amount is null or aid_currency is not null),
  constraint enrollment_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index enrollments_active_unique on public.program_enrollments (opportunity_id, athlete_id) where status in ('offered', 'accepted', 'enrolled', 'active');
create index enrollments_athlete_idx on public.program_enrollments (athlete_id, status);
create index enrollments_org_idx on public.program_enrollments (organization_id, status);

-- 7. Pagos (preparados para Stripe; sin datos bancarios ni tarjetas) -----------------------------------------------
create table public.payment_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete no action,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  registration_id uuid references public.opportunity_registrations (id) on delete cascade,
  enrollment_id uuid references public.program_enrollments (id) on delete cascade,
  cost_component_id uuid references public.opportunity_cost_components (id) on delete set null,
  label text not null check (char_length(label) between 2 and 80),
  amount numeric(10, 2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  required boolean not null default true,
  due_date date,
  refundable text not null default 'unknown' check (refundable in ('yes', 'no', 'partial', 'unknown')),
  refund_deadline date,
  status text not null default 'pending' check (status in ('not_required', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'waived')),
  provider_reference text check (char_length(provider_reference) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_one_context check (num_nonnulls(registration_id, enrollment_id) = 1)
);
create unique index payment_component_unique on public.payment_requirements (coalesce(registration_id, enrollment_id), cost_component_id) where cost_component_id is not null;
-- Nadie marca «pagado» desde el cliente: solo el servidor de pagos (service_role) en el futuro. La organización puede eximir.
create or replace function public.guard_payment_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('paid', 'failed', 'refunded', 'partially_refunded')
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'payment_status_server_only' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_payment_status before update on public.payment_requirements for each row execute function public.guard_payment_status();

-- 8. Consentimiento granular (se reutiliza consents: tipo + destino + alcance + versión + estado + fecha) -------------
alter table public.consents
  add column target_type text check (target_type in ('opportunity', 'registration', 'application', 'enrollment', 'document', 'organization')),
  add column target_id uuid,
  add column organization_id uuid references public.organizations (id) on delete set null,
  add column scope text check (char_length(scope) <= 120);
-- El tutor ve los consentimientos que él mismo otorgó o denegó (prueba de su decisión); nunca los de otros.
create policy consents_select_guardian on public.consents for select to authenticated using (guardian_id = auth.uid());
alter table public.consents drop constraint if exists consents_purpose_check;
alter table public.consents add constraint consents_purpose_check check (purpose in ('terms', 'privacy_notice', 'profile_discoverable', 'guardian_consent',
  'marketing_email', 'media_rights', 'trial_participation', 'academy_enrollment', 'document_sharing', 'travel', 'contact'));
create index consents_target_idx on public.consents (user_id, purpose, target_type, target_id, created_at desc);

-- ¿Hay consentimiento vigente (el último registro manda: se puede retirar)?
create or replace function public.consent_granted(p_athlete uuid, p_purpose text, p_target_type text, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select granted from public.consents
                    where user_id = p_athlete and purpose = p_purpose and target_type is not distinct from p_target_type and target_id is not distinct from p_target
                    order by created_at desc limit 1), false);
$$;
-- Un adulto no necesita tutor; un menor necesita un consentimiento de tutor vigente para ese destino.
create or replace function public.guardian_requirement_satisfied(p_athlete uuid, p_purpose text, p_target_type text, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_minor(p_athlete) or exists (
    select 1 from public.consents c
     where c.user_id = p_athlete and c.purpose = p_purpose and c.target_type = p_target_type and c.target_id = p_target
       and c.guardian_id is not null and c.granted
       and c.created_at = (select max(c2.created_at) from public.consents c2 where c2.user_id = p_athlete and c2.purpose = p_purpose
                            and c2.target_type = p_target_type and c2.target_id = p_target));
$$;
revoke all on function public.consent_granted(uuid, text, text, uuid) from public, anon;
revoke all on function public.guardian_requirement_satisfied(uuid, text, text, uuid) from public, anon;
grant execute on function public.consent_granted(uuid, text, text, uuid) to authenticated;
grant execute on function public.guardian_requirement_satisfied(uuid, text, text, uuid) to authenticated;

-- 9. Concesiones de acceso a documentos (nunca acceso general al Document Vault) -------------------------------------
create table public.document_access_grants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.athlete_documents (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  purpose text not null check (purpose in ('application_review', 'trial_registration', 'recruiting_process', 'enrollment', 'verification', 'other')),
  context_type text check (context_type in ('opportunity', 'application', 'registration', 'recruiting_process', 'enrollment')),
  context_id uuid,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint grant_expiry_bounded check (expires_at <= created_at + interval '365 days')
);
create index doc_grants_org_idx on public.document_access_grants (organization_id, document_id) where revoked_at is null;
create index doc_grants_doc_idx on public.document_access_grants (document_id);

-- 10. Proceso de recruiting central (org_candidates): equipo e inscripción de origen ---------------------------------
alter table public.org_candidates
  add column team_id uuid references public.org_teams (id) on delete set null,
  add column registration_id uuid references public.opportunity_registrations (id) on delete set null,
  add column invitation_id uuid references public.opportunity_invitations (id) on delete set null;
alter table public.org_candidates drop constraint org_candidates_source_check;
alter table public.org_candidates add constraint org_candidates_source_check check (source in ('discovery', 'application', 'shortlist', 'referral', 'trial', 'invitation'));

-- 11. RLS ------------------------------------------------------------------------------------------------------------
-- Quién ve la participación de un atleta: él, su familia (con permiso de candidaturas), su agente activo,
-- la organización dueña con permiso de candidatos (y de su programa), y Gala. Nadie escribe directamente: funciones.
alter table public.opportunity_invitations enable row level security;
create policy invitations_select on public.opportunity_invitations for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.is_active_agent_for(athlete_id)
  or public.org_can(organization_id, 'candidates') or public.is_admin());
grant select on public.opportunity_invitations to authenticated;

drop policy if exists trial_reg_select on public.opportunity_registrations;
create policy registrations_select on public.opportunity_registrations for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.is_active_agent_for(athlete_id)
  or public.org_can(organization_id, 'candidates') or public.is_admin());
drop policy if exists trial_reg_events_select on public.opportunity_registration_events;
create policy registration_events_select on public.opportunity_registration_events for select to authenticated
  using (exists (select 1 from public.opportunity_registrations r where r.id = registration_id));

alter table public.opportunity_attendance enable row level security;
create policy attendance_select on public.opportunity_attendance for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.org_can(organization_id, 'candidates') or public.is_admin());
grant select on public.opportunity_attendance to authenticated;

alter table public.opportunity_outcomes enable row level security;
create policy outcomes_select on public.opportunity_outcomes for select to authenticated using (public.org_can(organization_id, 'candidates') or public.is_admin());
grant select on public.opportunity_outcomes to authenticated;

alter table public.program_enrollments enable row level security;
create policy enrollments_select on public.program_enrollments for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.is_active_agent_for(athlete_id)
  or public.org_can(organization_id, 'candidates') or public.is_admin());
grant select on public.program_enrollments to authenticated;

alter table public.payment_requirements enable row level security;
create policy payments_select on public.payment_requirements for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_applications') or public.org_can(organization_id, 'candidates') or public.is_admin());
grant select on public.payment_requirements to authenticated;

alter table public.document_access_grants enable row level security;
create policy doc_grants_select on public.document_access_grants for select to authenticated using (
  athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile') or public.org_can(organization_id, 'candidates') or public.is_admin());
grant select on public.document_access_grants to authenticated;
