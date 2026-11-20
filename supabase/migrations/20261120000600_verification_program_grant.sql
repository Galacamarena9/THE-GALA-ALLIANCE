-- Prompt 7C · la verificación desde el móvil pide universidad + programa + cargo en un solo paso.
-- Al aprobar la afiliación con programa, se concede también el acceso a ese programa.
-- Reversión: volver a crear verification_decide de 20261120000500.
create or replace function public.verification_decide(p_request uuid, p_decision text, p_reason text, p_role public.org_member_role default null, p_restrictions text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_new text;
begin
  if not public.is_admin() then raise exception 'reviewer_only' using errcode = '42501'; end if;
  select * into r from public.verification_requests where id = p_request for update;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_decision not in ('approved', 'partially_approved', 'rejected', 'revoked', 'suspended', 'pending_evidence', 'under_review') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  if p_decision in ('rejected', 'revoked', 'suspended') and char_length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  if p_decision in ('revoked', 'suspended') and r.status not in ('approved', 'partially_approved') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  v_new := p_decision;
  insert into public.verification_decisions (request_id, previous_status, new_status, decision, reason, reviewer_id, restrictions)
  values (r.id, r.status, v_new, p_decision, p_reason, auth.uid(), p_restrictions);
  update public.verification_requests
     set status = v_new, decision = case when p_decision in ('approved', 'partially_approved', 'rejected', 'revoked', 'suspended') then p_decision else decision end,
         decision_reason = coalesce(p_reason, decision_reason), reviewed_at = now(), assigned_reviewer = coalesce(assigned_reviewer, auth.uid()),
         revoked_at = case when p_decision = 'revoked' then now() else revoked_at end, updated_at = now()
   where id = r.id;

  -- Efectos: aprobar una afiliación crea (o confirma) la membresía con rol verificado; revocar/suspender retira el acceso.
  if p_decision in ('approved', 'partially_approved') and r.verification_type in ('organization_claim', 'organization_affiliation', 'role') and r.organization_id is not null then
    insert into public.organization_members (organization_id, user_id, member_role, declared_role, invitation_source)
    values (r.organization_id, r.subject_user, coalesce(p_role, case when r.verification_type = 'organization_claim' then 'admin' else 'coach' end::public.org_member_role), r.declared_role, 'claim')
    on conflict (organization_id, user_id) do update set member_role = coalesce(p_role, public.organization_members.member_role);
    update public.organization_members
       set affiliation_verification = 'verified', role_verification = case when p_decision = 'approved' then 'verified' else role_verification end
     where organization_id = r.organization_id and user_id = r.subject_user;
    if r.verification_type = 'organization_claim' then
      update public.organizations set claim_status = 'claimed', last_reviewed_at = now() where id = r.organization_id;
    end if;
    -- La afiliación pedida para un programa concreto concede también ese programa (y solo ese).
    if r.program_id is not null then
      insert into public.program_memberships (organization_id, user_id, program_id, program_role, granted_by)
      values (r.organization_id, r.subject_user, r.program_id, r.declared_role, auth.uid())
      on conflict do nothing;
    end if;
  elsif p_decision = 'approved' and r.verification_type = 'program_affiliation' and r.program_id is not null then
    insert into public.program_memberships (organization_id, user_id, program_id, granted_by)
    select r.organization_id, r.subject_user, r.program_id, auth.uid()
     where exists (select 1 from public.organization_members where organization_id = r.organization_id and user_id = r.subject_user)
    on conflict do nothing;
  elsif p_decision in ('revoked', 'suspended') and r.organization_id is not null then
    perform set_config('gala.exit_status', case when p_decision = 'revoked' then 'revoked' else 'suspended' end, true);
    perform set_config('gala.exit_reason', left(p_reason, 500), true);
    delete from public.organization_members where organization_id = r.organization_id and user_id = r.subject_user;
    perform set_config('gala.exit_status', '', true);
    perform set_config('gala.exit_reason', '', true);
  elsif p_decision = 'rejected' and r.verification_type = 'organization_claim' then
    update public.organizations set claim_status = 'unclaimed' where id = r.organization_id and claim_status = 'claim_pending'
      and not exists (select 1 from public.organization_members where organization_id = r.organization_id);
  end if;
  perform public.audit('verification_' || p_decision, 'verification_request', r.id, r.organization_id,
    jsonb_build_object('type', r.verification_type, 'from', r.status, 'to', v_new), p_reason, 'security', r.program_id);
end;
$$;

-- Eventos de producto de la experiencia móvil (sin datos sensibles).
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
  'athlete_quick_view', 'highlight_played', 'note_added'));
