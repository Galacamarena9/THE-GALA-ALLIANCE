-- =============================================================================
-- Prompt 9 · Supabase & PostgreSQL: endurecimiento tras inspección
-- INSPECT → BACKUP → DESIGN → MIGRATE → SECURE → VALIDATE → TEST → DOCUMENT
-- Solo aditiva o restrictiva (expand). Sin borrado de datos. Rollback al final.
-- Hallazgos que corrige (docs/SUPABASE_ARCHITECTURE.md §Inspección):
--   S9-01 (media) verification_evidence.storage_path podía apuntar a la carpeta de otra persona.
--                 (athlete_documents y athlete_profiles ya lo impedían: path_belongs_to_athlete,
--                 photo_belongs_to_athlete; verificado de nuevo en las pruebas P9.)
--   S9-02 (media) apertura de documentos por terceros (organización/admin) sin registro de acceso.
--   S9-03 (media) 124 claves foráneas sin índice (borrados RGPD en cascada y joins de RLS lentos).
--   S9-04 (baja)  funciones trigger SECURITY DEFINER ejecutables por anon/authenticated (ruido del linter).
--   S9-05 (baja)  2 funciones sin search_path fijo.
--   S9-06 (media) verification_evidence.storage_path sin bucket privado ni políticas.
--   S9-07 (baja)  sin hash de contenido en documentos.
-- =============================================================================

-- S9-01 · Las rutas de Storage pertenecen a la carpeta del dueño de la fila. ---------------------
-- Reconciliación previa (local y remoto): 0 filas incumplen. NOT VALID + VALIDATE para no bloquear.
alter table public.verification_evidence
  add constraint verification_evidence_path_owner
  check (storage_path is null or split_part(storage_path, '/', 1) = submitted_by::text) not valid;
alter table public.verification_evidence validate constraint verification_evidence_path_owner;

-- S9-07 · Huella del contenido (calculada en servidor al registrar la subida).
alter table public.athlete_documents
  add column if not exists content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');

-- S9-02 · Abrir un documento: comprueba permiso, registra el acceso de terceros y devuelve la ruta. ---
create or replace function public.document_open(p_document uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d public.athlete_documents%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into d from public.athlete_documents where id = p_document;
  if not found or d.storage_path is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- El atleta y su familia (con permiso de ver el perfil) no generan registro: son los dueños.
  if d.athlete_id = v_uid or public.has_family_link(d.athlete_id, 'view_profile') then
    return d.storage_path;
  end if;
  if public.org_has_document_grant(p_document) then
    select g.organization_id into v_org from public.document_access_grants g
     where g.document_id = p_document and g.revoked_at is null and g.expires_at > now()
       and public.org_can(g.organization_id, 'candidates')
     order by g.created_at desc limit 1;
    if v_org is null then
      select r.organization_id into v_org from public.info_requests r
       where r.document_id = p_document and r.status = 'shared' and r.shared_until >= current_date
         and public.org_can(r.organization_id, 'candidates') limit 1;
    end if;
  elsif not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, organization_id, classification, details)
  values (v_uid, 'document_opened', 'athlete_document', p_document, v_org,
          case when public.document_is_highly_restricted(d.kind) then 'security' else 'sensitive' end,
          jsonb_build_object('athlete_id', d.athlete_id, 'kind', d.kind, 'via', case when v_org is null then 'admin' else 'grant' end));
  return d.storage_path;
end $$;
revoke all on function public.document_open(uuid) from public, anon;
grant execute on function public.document_open(uuid) to authenticated;

-- S9-03 · Índices para todas las claves foráneas (generados desde el catálogo en la inspección). ---
create index if not exists fkx_ai_feedback_user_id on public.ai_feedback (user_id);
create index if not exists fkx_ai_messages_user_id on public.ai_messages (user_id);
create index if not exists fkx_applications_decided_by on public.applications (decided_by);
create index if not exists fkx_applications_invitation_id on public.applications (invitation_id);
create index if not exists fkx_athlete_offers_process_id on public.athlete_offers (process_id);
create index if not exists fkx_athlete_task_state_updated_by on public.athlete_task_state (updated_by);
create index if not exists fkx_consents_organization_id on public.consents (organization_id);
create index if not exists fkx_document_access_grants_athlete_id on public.document_access_grants (athlete_id);
create index if not exists fkx_document_access_grants_granted_by on public.document_access_grants (granted_by);
create index if not exists fkx_document_access_grants_grantee_user_id on public.document_access_grants (grantee_user_id);
create index if not exists fkx_email_verifications_organization_id on public.email_verifications (organization_id);
create index if not exists fkx_info_requests_document_id on public.info_requests (document_id);
create index if not exists fkx_info_requests_requested_by on public.info_requests (requested_by);
create index if not exists fkx_info_requests_responded_by on public.info_requests (responded_by);
create index if not exists fkx_institution_claims_organization_id on public.institution_claims (organization_id);
create index if not exists fkx_institution_claims_reviewed_by on public.institution_claims (reviewed_by);
create index if not exists fkx_institution_claims_user_id on public.institution_claims (user_id);
create index if not exists fkx_opportunities_age_category_code on public.opportunities (age_category_code);
create index if not exists fkx_opportunities_moderated_by on public.opportunities (moderated_by);
create index if not exists fkx_opportunities_need_id on public.opportunities (need_id);
create index if not exists fkx_opportunities_program_id on public.opportunities (program_id);
create index if not exists fkx_opportunities_season_id on public.opportunities (season_id);
create index if not exists fkx_opportunities_updated_by on public.opportunities (updated_by);
create index if not exists fkx_opportunity_attendance_athlete_id on public.opportunity_attendance (athlete_id);
create index if not exists fkx_opportunity_attendance_organization_id on public.opportunity_attendance (organization_id);
create index if not exists fkx_opportunity_attendance_recorded_by on public.opportunity_attendance (recorded_by);
create index if not exists fkx_opportunity_cost_components_updated_by on public.opportunity_cost_components (updated_by);
create index if not exists fkx_opportunity_invitations_invited_by on public.opportunity_invitations (invited_by);
create index if not exists fkx_opportunity_invitations_organization_id on public.opportunity_invitations (organization_id);
create index if not exists fkx_opportunity_invitations_source_shortlist_id on public.opportunity_invitations (source_shortlist_id);
create index if not exists fkx_opportunity_invitations_team_id on public.opportunity_invitations (team_id);
create index if not exists fkx_opportunity_outcomes_athlete_id on public.opportunity_outcomes (athlete_id);
create index if not exists fkx_opportunity_outcomes_candidate_id on public.opportunity_outcomes (candidate_id);
create index if not exists fkx_opportunity_outcomes_decided_by on public.opportunity_outcomes (decided_by);
create index if not exists fkx_opportunity_registration_events_actor_id on public.opportunity_registration_events (actor_id);
create index if not exists fkx_opportunity_registrations_application_id on public.opportunity_registrations (application_id);
create index if not exists fkx_opportunity_registrations_created_by on public.opportunity_registrations (created_by);
create index if not exists fkx_opportunity_registrations_invitation_id on public.opportunity_registrations (invitation_id);
create index if not exists fkx_org_activity_actor_id on public.org_activity (actor_id);
create index if not exists fkx_org_activity_athlete_id on public.org_activity (athlete_id);
create index if not exists fkx_org_assignment_log_assigned_by on public.org_assignment_log (assigned_by);
create index if not exists fkx_org_assignment_log_assigned_to on public.org_assignment_log (assigned_to);
create index if not exists fkx_org_candidates_application_id on public.org_candidates (application_id);
create index if not exists fkx_org_candidates_athlete_id on public.org_candidates (athlete_id);
create index if not exists fkx_org_candidates_created_by on public.org_candidates (created_by);
create index if not exists fkx_org_candidates_invitation_id on public.org_candidates (invitation_id);
create index if not exists fkx_org_candidates_need_id on public.org_candidates (need_id);
create index if not exists fkx_org_candidates_opportunity_id on public.org_candidates (opportunity_id);
create index if not exists fkx_org_candidates_program_id on public.org_candidates (program_id);
create index if not exists fkx_org_candidates_registration_id on public.org_candidates (registration_id);
create index if not exists fkx_org_candidates_team_id on public.org_candidates (team_id);
create index if not exists fkx_org_labels_created_by on public.org_labels (created_by);
create index if not exists fkx_org_labels_program_id on public.org_labels (program_id);
create index if not exists fkx_org_notes_athlete_id on public.org_notes (athlete_id);
create index if not exists fkx_org_notes_author_id on public.org_notes (author_id);
create index if not exists fkx_org_notes_shortlist_id on public.org_notes (shortlist_id);
create index if not exists fkx_org_programs_institution_program_id on public.org_programs (institution_program_id);
create index if not exists fkx_org_programs_sport_id on public.org_programs (sport_id);
create index if not exists fkx_org_saved_searches_created_by on public.org_saved_searches (created_by);
create index if not exists fkx_org_saved_searches_need_id on public.org_saved_searches (need_id);
create index if not exists fkx_org_saved_searches_program_id on public.org_saved_searches (program_id);
create index if not exists fkx_org_shortlist_member_labels_added_by on public.org_shortlist_member_labels (added_by);
create index if not exists fkx_org_shortlist_member_labels_label_id on public.org_shortlist_member_labels (label_id);
create index if not exists fkx_org_shortlist_members_added_by on public.org_shortlist_members (added_by);
create index if not exists fkx_org_shortlist_members_athlete_id on public.org_shortlist_members (athlete_id);
create index if not exists fkx_org_shortlist_members_promoted_candidate_id on public.org_shortlist_members (promoted_candidate_id);
create index if not exists fkx_org_shortlists_need_id on public.org_shortlists (need_id);
create index if not exists fkx_org_shortlists_opportunity_id on public.org_shortlists (opportunity_id);
create index if not exists fkx_org_shortlists_owner_id on public.org_shortlists (owner_id);
create index if not exists fkx_org_shortlists_program_id on public.org_shortlists (program_id);
create index if not exists fkx_org_shortlists_sport_id on public.org_shortlists (sport_id);
create index if not exists fkx_org_tasks_assignee_id on public.org_tasks (assignee_id);
create index if not exists fkx_org_tasks_athlete_id on public.org_tasks (athlete_id);
create index if not exists fkx_org_tasks_candidate_id on public.org_tasks (candidate_id);
create index if not exists fkx_org_tasks_created_by on public.org_tasks (created_by);
create index if not exists fkx_org_tasks_need_id on public.org_tasks (need_id);
create index if not exists fkx_org_tasks_opportunity_id on public.org_tasks (opportunity_id);
create index if not exists fkx_org_tasks_shortlist_id on public.org_tasks (shortlist_id);
create index if not exists fkx_org_teams_age_category_code on public.org_teams (age_category_code);
create index if not exists fkx_org_teams_created_by on public.org_teams (created_by);
create index if not exists fkx_org_teams_season_id on public.org_teams (season_id);
create index if not exists fkx_organization_domains_created_by on public.organization_domains (created_by);
create index if not exists fkx_organization_domains_reviewed_by on public.organization_domains (reviewed_by);
create index if not exists fkx_organization_members_invited_by on public.organization_members (invited_by);
create index if not exists fkx_organization_membership_records_actor_id on public.organization_membership_records (actor_id);
create index if not exists fkx_organization_membership_records_user_id on public.organization_membership_records (user_id);
create index if not exists fkx_passport_views_viewer_id on public.passport_views (viewer_id);
create index if not exists fkx_passport_views_viewer_org_id on public.passport_views (viewer_org_id);
create index if not exists fkx_payment_requirements_cost_component_id on public.payment_requirements (cost_component_id);
create index if not exists fkx_payment_requirements_enrollment_id on public.payment_requirements (enrollment_id);
create index if not exists fkx_payment_requirements_organization_id on public.payment_requirements (organization_id);
create index if not exists fkx_payment_requirements_registration_id on public.payment_requirements (registration_id);
create index if not exists fkx_pipeline_contacts_athlete_id on public.pipeline_contacts (athlete_id);
create index if not exists fkx_pipeline_events_athlete_id on public.pipeline_events (athlete_id);
create index if not exists fkx_pipeline_events_created_by on public.pipeline_events (created_by);
create index if not exists fkx_pipeline_tasks_created_by on public.pipeline_tasks (created_by);
create index if not exists fkx_pipeline_tasks_process_id on public.pipeline_tasks (process_id);
create index if not exists fkx_process_documents_athlete_id on public.process_documents (athlete_id);
create index if not exists fkx_process_documents_document_id on public.process_documents (document_id);
create index if not exists fkx_program_enrollments_application_id on public.program_enrollments (application_id);
create index if not exists fkx_program_enrollments_created_by on public.program_enrollments (created_by);
create index if not exists fkx_program_enrollments_offer_id on public.program_enrollments (offer_id);
create index if not exists fkx_program_memberships_granted_by on public.program_memberships (granted_by);
create index if not exists fkx_program_memberships_program_id on public.program_memberships (program_id);
create index if not exists fkx_program_memberships_revoked_by on public.program_memberships (revoked_by);
create index if not exists fkx_recruiting_needs_age_category_code on public.recruiting_needs (age_category_code);
create index if not exists fkx_recruiting_needs_created_by on public.recruiting_needs (created_by);
create index if not exists fkx_recruiting_needs_opportunity_id on public.recruiting_needs (opportunity_id);
create index if not exists fkx_recruiting_needs_program_id on public.recruiting_needs (program_id);
create index if not exists fkx_recruiting_needs_season_id on public.recruiting_needs (season_id);
create index if not exists fkx_recruiting_needs_sport_id on public.recruiting_needs (sport_id);
create index if not exists fkx_recruiting_needs_team_id on public.recruiting_needs (team_id);
create index if not exists fkx_shortlist_access_granted_by on public.shortlist_access (granted_by);
create index if not exists fkx_shortlist_access_organization_id on public.shortlist_access (organization_id);
create index if not exists fkx_shortlist_access_user_id on public.shortlist_access (user_id);
create index if not exists fkx_verification_checks_checked_by on public.verification_checks (checked_by);
create index if not exists fkx_verification_decisions_reviewer_id on public.verification_decisions (reviewer_id);
create index if not exists fkx_verification_evidence_request_id on public.verification_evidence (request_id);
create index if not exists fkx_verification_evidence_reviewed_by on public.verification_evidence (reviewed_by);
create index if not exists fkx_verification_evidence_submitted_by on public.verification_evidence (submitted_by);
create index if not exists fkx_verification_requests_assigned_reviewer on public.verification_requests (assigned_reviewer);
create index if not exists fkx_verification_requests_institution_id on public.verification_requests (institution_id);
create index if not exists fkx_verification_requests_organization_id on public.verification_requests (organization_id);
create index if not exists fkx_verification_requests_program_id on public.verification_requests (program_id);

-- S9-04 · Las funciones trigger no se llaman por la API (el disparo no comprueba EXECUTE). ---------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- S9-05 · search_path fijo en todas las funciones.
alter function public.domain_matches(text, text) set search_path = public;
alter function public.org_policy_version() set search_path = public;

-- passport_views: RLS sin políticas es intencionado (solo record_passport_view y las estadísticas
-- agregadas, ambas SECURITY DEFINER, la tocan). Se documenta para el linter.
comment on table public.passport_views is 'Acceso solo vía funciones SECURITY DEFINER (record_passport_view, estadísticas agregadas). RLS sin políticas = denegar por defecto.';

-- Storage (solo existe en Supabase; en pruebas locales se omite) -----------------------------------
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'buckets') then
    -- S9-01 defensa en profundidad: la concesión solo abre archivos de la carpeta del atleta del documento.
    execute 'drop policy if exists docs_storage_select_org_grant on storage.objects';
    execute $p$create policy docs_storage_select_org_grant on storage.objects for select to authenticated
      using (bucket_id = 'athlete-documents' and exists (
        select 1 from public.athlete_documents d
         where d.storage_path = name and d.athlete_id = public.document_owner(name)
           and public.org_has_document_grant(d.id)))$p$;

    -- S9-06 · Evidencias de verificación: bucket privado; el remitente sube a su carpeta, revisa el admin.
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('verification-evidence', 'verification-evidence', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists evidence_storage_insert on storage.objects';
    execute 'drop policy if exists evidence_storage_select on storage.objects';
    execute 'drop policy if exists evidence_storage_delete on storage.objects';
    execute $p$create policy evidence_storage_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'verification-evidence' and public.document_owner(name) = auth.uid())$p$;
    execute $p$create policy evidence_storage_select on storage.objects for select to authenticated
      using (bucket_id = 'verification-evidence' and (public.document_owner(name) = auth.uid() or public.is_admin()))$p$;
    execute $p$create policy evidence_storage_delete on storage.objects for delete to authenticated
      using (bucket_id = 'verification-evidence' and public.document_owner(name) = auth.uid())$p$;
  end if;
end $$;

-- =============================================================================
-- ROLLBACK (manual, en orden inverso; no pierde datos salvo content_sha256):
--   drop policy evidence_storage_* on storage.objects; delete bucket verification-evidence si está vacío;
--   recrear docs_storage_select_org_grant sin la condición de carpeta (20261117001000);
--   grant execute en funciones trigger a authenticated (no necesario para que funcionen);
--   drop index fkx_*; drop function document_open(uuid);
--   alter table athlete_documents drop column content_sha256;
--   alter table verification_evidence drop constraint verification_evidence_path_owner.
-- =============================================================================
