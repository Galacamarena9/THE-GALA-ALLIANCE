-- =============================================================================
-- Prompt 10B · Policies RLS de Family Experience (implementación de la matriz de 10A)
-- Solo Family. Lecturas con el permiso que corresponde a cada recurso; escrituras de protección
-- del menor (consentimientos, revocar concesiones) por RPC transaccional. Deny by default.
-- =============================================================================

-- 1. Lecturas del proceso: permiso «proceso» (antes «ver Passport») -------------------------------
drop policy if exists pipeline_events_select on public.pipeline_events;
create policy athlete_or_guardian_view_pipeline_events on public.pipeline_events for select to authenticated
  using (athlete_id = (select auth.uid()) or public.guardian_has_scope(athlete_id, 'athlete.pipeline.view'));

drop policy if exists pipeline_contacts_select on public.pipeline_contacts;
create policy athlete_or_guardian_view_pipeline_contacts on public.pipeline_contacts for select to authenticated
  using (athlete_id = (select auth.uid()) or public.guardian_has_scope(athlete_id, 'athlete.pipeline.view'));

drop policy if exists process_documents_select on public.process_documents;
create policy athlete_or_guardian_view_process_documents on public.process_documents for select to authenticated
  using (athlete_id = (select auth.uid()) or public.guardian_has_scope(athlete_id, 'athlete.pipeline.view'));

-- 2. Concesiones de documentos: verlas exige permiso de documentos; un tutor de un menor puede revocarlas.
drop policy if exists doc_grants_select on public.document_access_grants;
create policy parties_view_document_grants on public.document_access_grants for select to authenticated
  using (athlete_id = (select auth.uid())
         or public.guardian_has_scope(athlete_id, 'athlete.documents.view')
         or public.is_admin()
         or (public.org_can(organization_id, 'candidates') and (grantee_user_id is null or grantee_user_id = (select auth.uid()))));

drop policy if exists doc_grants_revoke on public.document_access_grants;
create policy athlete_or_guardian_revoke_document_grants on public.document_access_grants for update to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'edit_profile')
         or public.guardian_has_scope(athlete_id, 'athlete.documents.approve_share'))
  with check (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'edit_profile')
         or public.guardian_has_scope(athlete_id, 'athlete.documents.approve_share'));

-- 3. Consentimientos: registro transaccional (atleta para sí mismo; tutor activo de un menor). -------
-- Inmutable (nunca se sobrescribe): revocar = nueva fila granted=false → cascada y auditoría (on_consent_recorded).
-- Idempotente: si la última decisión para el mismo objetivo es idéntica y vigente, devuelve esa fila.
create or replace function public.consent_record(
  p_athlete uuid, p_purpose text, p_target_type text, p_target uuid, p_organization uuid,
  p_granted boolean, p_policy_version text, p_expires_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_guardian uuid;
  v_last public.consents%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_athlete = v_uid then
    v_guardian := null;
  elsif public.guardian_has_scope(p_athlete, 'athlete.consents.manage') then
    v_guardian := v_uid;
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_policy_version is null or char_length(p_policy_version) not between 1 and 40 then
    raise exception 'policy_version_required' using errcode = 'P0001';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'consent_already_expired' using errcode = 'P0001';
  end if;
  -- Un consentimiento sobre un documento solo puede referirse a un documento de ese atleta.
  if p_target_type = 'document' and not exists (select 1 from public.athlete_documents where id = p_target and athlete_id = p_athlete) then
    raise exception 'document_mismatch' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_athlete::text || p_purpose || coalesce(p_target::text, ''), 0));
  select * into v_last from public.consents
   where user_id = p_athlete and purpose = p_purpose and target_type is not distinct from p_target_type
     and target_id is not distinct from p_target and organization_id is not distinct from p_organization
   order by created_at desc limit 1;
  if found and v_last.granted = p_granted and v_last.document_version = p_policy_version
     and v_last.expires_at is not distinct from p_expires_at and (v_last.expires_at is null or v_last.expires_at > now()) then
    return v_last.id;
  end if;
  insert into public.consents (user_id, purpose, document_version, granted, guardian_id, target_type, target_id, organization_id, expires_at)
  values (p_athlete, p_purpose, p_policy_version, p_granted, v_guardian, p_target_type, p_target, p_organization, p_expires_at)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.consent_record(uuid, text, text, uuid, uuid, boolean, text, timestamptz) from public, anon;
grant execute on function public.consent_record(uuid, text, text, uuid, uuid, boolean, text, timestamptz) to authenticated;

-- 4. Storage: el archivo real sigue la misma regla que la fila (permiso de documentos). -------------
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'buckets') then
    execute 'drop policy if exists docs_storage_select on storage.objects';
    execute $p$create policy docs_storage_select on storage.objects for select to authenticated
      using (bucket_id = 'athlete-documents' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'view_documents')))$p$;
  end if;
end $$;

-- =============================================================================
-- ROLLBACK: restaurar pipeline_events_select / pipeline_contacts_select / process_documents_select
--   (has_family_link(..., 'view_profile')), doc_grants_select y doc_grants_revoke (20261122000100),
--   docs_storage_select (20261113000700); drop function consent_record.
-- =============================================================================
