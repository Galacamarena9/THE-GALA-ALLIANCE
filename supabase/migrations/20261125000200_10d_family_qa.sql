-- Prompt 10D · QA E2E de Family Experience — correcciones de flujo.
-- QA-F07 (High): un tutor activo de un menor NO podía responder a una solicitud de documento
-- salvo que el atleta le hubiera dado «editar perfil». El panel le pedía revisar la solicitud y
-- el botón fallaba. La decisión sobre compartir documentos de un menor es del tutor activo
-- (scope athlete.documents.approve_share, definido en 10A); ahora la función lo usa.
-- Igual en la concesión directa de acceso (guard_document_grant).

CREATE OR REPLACE FUNCTION public.respond_info_request(p_id uuid, p_share boolean, p_document uuid DEFAULT NULL::uuid, p_until date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.info_requests;
begin
  select * into r from public.info_requests where id = p_id for update;
  if r.id is null or r.status not in ('pending', 'pending_guardian', 'shared') then raise exception 'not_open' using errcode = 'P0001'; end if;
  if public.is_minor(r.athlete_id) then
    if not (public.has_family_link(r.athlete_id, 'edit_profile') or public.guardian_has_scope(r.athlete_id, 'athlete.documents.approve_share')) then raise exception 'guardian_required' using errcode = '42501'; end if;
  elsif not (auth.uid() = r.athlete_id or public.has_family_link(r.athlete_id, 'edit_profile')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_share then
    if p_document is not null and not exists (select 1 from public.athlete_documents where id = p_document and athlete_id = r.athlete_id) then
      raise exception 'document_not_owned' using errcode = '42501';
    end if;
    update public.info_requests set status = 'shared', document_id = p_document,
      shared_until = least(coalesce(p_until, current_date + 30), current_date + 180), responded_by = auth.uid(), responded_at = now() where id = p_id;
    perform public.org_log(r.organization_id, r.athlete_id, 'info_shared', jsonb_build_object('kind', r.kind, 'until', least(coalesce(p_until, current_date + 30), current_date + 180)));
    if r.requested_by is not null then perform public.notify(r.requested_by, 'application.info_shared', 'Información compartida', 'Un atleta ha respondido a tu solicitud.', '/app/recruit/candidates/' || r.athlete_id); end if;
  else
    update public.info_requests set status = case when r.status = 'shared' then 'revoked' else 'declined' end, responded_by = auth.uid(), responded_at = now() where id = p_id;
    perform public.org_log(r.organization_id, r.athlete_id, 'info_declined', jsonb_build_object('kind', r.kind));
  end if;
end; $function$

;

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
    if auth.uid() is not null and not (auth.uid() = d.athlete_id or public.has_family_link(d.athlete_id, 'edit_profile')
                                      or public.guardian_has_scope(d.athlete_id, 'athlete.documents.approve_share')) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if auth.uid() is not null and auth.uid() = d.athlete_id and public.is_minor(d.athlete_id) and not exists (
         select 1 from public.consents c
          where c.user_id = d.athlete_id and c.purpose = 'document_sharing' and c.target_type = 'document' and c.target_id = d.id
            and c.organization_id = new.organization_id and c.guardian_id is not null and c.granted
            and (c.expires_at is null or c.expires_at > now())
            and c.created_at = (select max(c2.created_at) from public.consents c2
                                 where c2.user_id = d.athlete_id and c2.purpose = 'document_sharing' and c2.target_type = 'document'
                                   and c2.target_id = d.id and c2.organization_id is not distinct from new.organization_id)) then
      raise exception 'guardian_consent_required' using errcode = '42501';
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

drop policy if exists doc_grants_insert on public.document_access_grants;
create policy doc_grants_insert on public.document_access_grants for insert to authenticated
  with check (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'edit_profile')
              or public.guardian_has_scope(athlete_id, 'athlete.documents.approve_share'));
