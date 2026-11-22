-- Reconciliación del proyecto remoto con el repositorio (22-11-2026).
-- El proyecto remoto (hoy STAGING) se construyó en parte con SQL aplicado a mano o con versiones anteriores de
-- las migraciones. Tras ponerlo al día, la huella (docs/supabase/schema-fingerprint.json) mostraba:
--   · tabla application_tracking (+ guard_application_tracking y 4 políticas) que ninguna migración crea;
--   · columna athlete_documents.expires_on que ninguna migración crea ni la app usa;
--   · 23 funciones con un cuerpo distinto del que define el repositorio.
-- Esta migración deja cualquier base igual que el repositorio. En una base creada desde cero no cambia nada:
-- los DROP son condicionales y las funciones se vuelven a declarar con la misma definición.
-- Seguridad: solo se borra la tabla / la columna si están vacías; si no, la migración falla y no toca nada.
-- Rollback: no aplica (los objetos eliminados no existen en el repositorio y estaban vacíos).

do $$
begin
  if to_regclass('public.application_tracking') is not null then
    if exists (select 1 from public.application_tracking) then
      raise exception 'application_tracking tiene filas: revisar antes de eliminarla';
    end if;
    drop table public.application_tracking;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athlete_documents' and column_name = 'expires_on') then
    if exists (select 1 from public.athlete_documents where expires_on is not null) then
      raise exception 'athlete_documents.expires_on tiene datos: revisar antes de eliminarla';
    end if;
    alter table public.athlete_documents drop column expires_on;
  end if;
end $$;
drop function if exists public.guard_application_tracking();

-- Definiciones del repositorio (generadas con pg_get_functiondef sobre las 79 migraciones).
CREATE OR REPLACE FUNCTION public.accept_family_invitation(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link public.parent_athlete_links;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_link from public.parent_athlete_links
   where invitation_token = p_token for update;

  if not found or v_link.status <> 'pending' or v_link.expires_at < now() then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if v_link.invited_by = v_uid then
    raise exception 'cannot_accept_own_invitation' using errcode = 'P0001';
  end if;

  if v_link.athlete_id is null then
    -- La familia invitó; acepta el atleta.
    if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'athlete') then
      raise exception 'athlete_role_required' using errcode = 'P0001';
    end if;
    update public.parent_athlete_links
       set athlete_id = v_uid, status = 'approved', approved_at = now(),
           guardian_consent_given = public.is_minor(v_uid)
     where id = v_link.id;
  else
    -- El atleta invitó; acepta la familia.
    if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'parent') then
      raise exception 'parent_role_required' using errcode = 'P0001';
    end if;
    update public.parent_athlete_links
       set parent_id = v_uid, status = 'approved', approved_at = now(),
           guardian_consent_given = public.is_minor(v_link.athlete_id)
     where id = v_link.id;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (v_uid, 'family_link.approved', 'parent_athlete_links', v_link.id);

  return v_link.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.alert_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_target uuid;
  v_link text := '/app/inbox/' || new.request_id;
begin
  select athlete_id, requested_by into r from public.contact_requests where id = new.request_id;
  foreach v_target in array array[r.athlete_id, r.requested_by] loop
    continue when v_target is null or v_target = new.sender_id;
    -- Un solo aviso sin leer por conversación: no llenamos la bandeja con cada mensaje.
    continue when exists (select 1 from public.notifications where user_id = v_target and kind = 'message.new' and link = v_link and read_at is null);
    perform public.notify(v_target, 'message.new', 'Tienes un mensaje nuevo', left(new.body, 140), v_link);
  end loop;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.athlete_field_allows(p_athlete uuid, p_group text, p_purpose text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; v_view_block text := case p_group when 'physical' then 'sport' else p_group end;
begin
  if p_purpose not in ('view', 'filter', 'match', 'compare', 'export') then return false; end if;
  -- Ver (y por tanto filtrar, comparar o exportar) exige poder ver el bloque según el Passport.
  if p_purpose <> 'match' and not public.can_view_athlete(p_athlete, v_view_block) then return false; end if;
  if p_purpose = 'view' then return true; end if;
  select * into p from public.passport_field_policies where athlete_id = p_athlete and field_group = p_group;
  if p.athlete_id is not null then
    return case p_purpose when 'filter' then p.allow_filter when 'match' then p.allow_match when 'compare' then p.allow_compare else p.allow_export end;
  end if;
  if p_purpose = 'export' then return false; end if;
  if p_purpose = 'filter' and p_group in ('academics', 'stats') and public.is_minor(p_athlete) then return false; end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if p_confirm is distinct from 'ELIMINAR' then raise exception 'confirmation_required' using errcode = 'P0001'; end if;
  if public.is_admin() then raise exception 'admin_cannot_self_delete' using errcode = 'P0001'; end if;
  if exists (select 1 from public.organizations where created_by = v_uid) then
    raise exception 'transfer_organizations_first' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.opportunities where created_by = v_uid)
     or exists (select 1 from public.application_notes where author_id = v_uid)
     or exists (select 1 from public.brand_campaigns where created_by = v_uid) then
    raise exception 'organization_staff_contact_support' using errcode = 'P0001';
  end if;
  perform set_config('gala.erasure', 'on', true);
  update public.application_status_history set changed_by = null where changed_by = v_uid;
  update public.contact_requests set guardian_approved_by = null where guardian_approved_by = v_uid;
  update public.consents set guardian_id = null where guardian_id = v_uid;
  update public.organization_invitations set accepted_by = null where accepted_by = v_uid;
  -- Registro mínimo de la baja (sin datos personales) para acreditar el cumplimiento.
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (null, 'account.self_deleted', 'profiles', null);
  delete from auth.users where id = v_uid;
  perform set_config('gala.erasure', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.email_verification_confirm(p_id uuid, p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r record;
begin
  select * into r from public.email_verifications where id = p_id and user_id = auth.uid() for update;
  if r.id is null or r.result <> 'pending' or r.token_hash is null then return false; end if;
  if r.token_expires_at < now() then
    update public.email_verifications set result = 'expired' where id = r.id; return false;
  end if;
  if r.attempts >= 5 then
    update public.email_verifications set result = 'failed' where id = r.id; return false;
  end if;
  if encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') <> r.token_hash then
    update public.email_verifications set attempts = attempts + 1 where id = r.id; return false;
  end if;
  update public.email_verifications set result = 'verified', verified_at = now(), token_hash = null where id = r.id;
  perform set_config('gala.verification_write', 'on', true);
  -- Si ya es miembro y el dominio está verificado para esa organización, sube su nivel de afiliación.
  if r.organization_id is not null and exists (select 1 from public.organization_domains d where d.organization_id = r.organization_id and d.status = 'verified' and public.domain_matches(r.email_domain, d.domain)) then
    update public.organization_members set affiliation_verification = 'email_verified'
     where organization_id = r.organization_id and user_id = auth.uid() and affiliation_verification = 'unverified';
  end if;
  perform public.audit('email_verified', 'email_verification', r.id, r.organization_id, jsonb_build_object('domain', r.email_domain), null, 'security');
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_athlete boolean := auth.uid() = new.athlete_id;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.opportunities where id = new.opportunity_id and status = 'published'
                   and (deadline is null or deadline >= current_date)) then
      raise exception 'opportunity_not_open' using errcode = 'P0001';
    end if;
    new.status := 'applied';
    return new;
  end if;

  if new.athlete_id <> old.athlete_id or new.opportunity_id <> old.opportunity_id then
    raise exception 'application_immutable_keys' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'withdrawn' then
      raise exception 'application_closed' using errcode = 'P0001';
    end if;
    -- El atleta solo puede retirarse; la organización gestiona el resto del pipeline.
    if v_is_athlete and new.status <> 'withdrawn' then
      raise exception 'athlete_can_only_withdraw' using errcode = '42501';
    end if;
    if not v_is_athlete and new.status = 'withdrawn' then
      raise exception 'only_athlete_can_withdraw' using errcode = '42501';
    end if;
  end if;
  -- El atleta no puede reescribir su mensaje cuando la organización ya la gestiona.
  if not v_is_athlete and new.athlete_message is distinct from old.athlete_message then
    raise exception 'application_message_owner_only' using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_contact_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_req public.contact_requests;
begin
  select * into v_req from public.contact_requests where id = new.request_id;
  if v_req.status is distinct from 'accepted' then
    raise exception 'conversation_not_open' using errcode = 'P0001';
  end if;
  new.sender_id := auth.uid();
  -- Con menores no se comparten emails, teléfonos ni redes: todo dentro de la plataforma.
  if v_req.is_minor_at_request and (
       new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
       or new.body ~ '\+?\d[\d\s().-]{7,}\d'
       or new.body ~* '(whatsapp|telegram|instagram|snapchat|tiktok|wa\.me)'
     ) then
    raise exception 'contact_data_not_allowed_with_minors' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_messages where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_content_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    new.reporter_id := auth.uid();
    new.status := 'open';
    new.decided_by := null;
    new.decided_at := null;
    new.decision_reason := null;
    -- Seguridad infantil siempre primero en la cola.
    new.priority := case when new.reason = 'child_safety' then 0 when new.reason in ('harassment', 'illegal_content') then 1 else 2 end;
    return new;
  end if;
  if new.status in ('actioned', 'dismissed') and old.status not in ('actioned', 'dismissed') then
    if new.decision_reason is null or char_length(new.decision_reason) < 10 then
      raise exception 'decision_reason_required' using errcode = 'P0001';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'report.decided', 'content_reports', new.id, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_info_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_org text;
begin
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
end; $function$;

CREATE OR REPLACE FUNCTION public.guard_institution_claim()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_site text; v_domain text := lower(split_part(new.work_email, '@', 2));
begin
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    if new.organization_id is not null and not public.is_org_member(new.organization_id, true) then
      raise exception 'not_org_admin' using errcode = '42501';
    end if;
    select lower(regexp_replace(regexp_replace(website_url, '^https://(www\.)?', ''), '/.*$', '')) into v_site
      from public.institutions where id = new.institution_id;
    new.domain_matches := coalesce(v_site is not null and (v_domain = v_site or v_domain like '%.' || v_site), false);
    return new;
  end if;
  if new.status <> old.status then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    -- Aprobar vincula la organización a la universidad (solo si la organización ya está verificada).
    if new.status = 'approved' then
      if new.organization_id is null or not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
        raise exception 'claim_needs_verified_org' using errcode = 'P0001';
      end if;
      update public.organizations set institution_id = new.institution_id where id = new.organization_id;
    end if;
  end if;
  new.domain_matches := old.domain_matches;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_news_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.author_id := v_uid;
    new.hidden_reason := null;
    new.athlete_consented_at := null;
    -- Editorial sin organización: solo admin. Con organización: solo verificada.
    if new.organization_id is null and not public.is_admin() then
      raise exception 'editorial_admin_only' using errcode = '42501';
    end if;
    if new.organization_id is not null and not exists (
         select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'verified_organization_required' using errcode = 'P0001';
    end if;
    if new.athlete_id is not null then
      -- v1: los menores no aparecen en publicaciones.
      if public.is_minor(new.athlete_id) then raise exception 'minors_not_taggable' using errcode = 'P0001'; end if;
      new.status := 'pending_consent';
    else
      new.status := 'published';
    end if;
    return new;
  end if;
  if public.is_admin() then return new; end if;
  if (new.organization_id, new.author_id, new.kind, new.title, new.body, new.source_url, new.athlete_id, new.created_at)
     is distinct from (old.organization_id, old.author_id, old.kind, old.title, old.body, old.source_url, old.athlete_id, old.created_at) then
    raise exception 'news_post_immutable' using errcode = '42501';
  end if;
  -- El atleta etiquetado da (o retira) su consentimiento; el autor puede ocultar su publicación.
  if v_uid = new.athlete_id and old.status = 'pending_consent' and new.status = 'published' then
    new.athlete_consented_at := now();
  elsif v_uid = new.athlete_id and new.status = 'hidden' then
    new.hidden_reason := 'Retirado por el atleta';
  elsif public.is_org_member(new.organization_id) and new.status = 'hidden' then
    new.hidden_reason := 'Retirado por la organización';
  else
    raise exception 'news_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_org_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_admin() or auth.uid() is null then return coalesce(new, old); end if;
  -- Borrado en cascada de la cuenta o de la organización: no aplica.
  if tg_op = 'DELETE' and (not exists (select 1 from public.profiles where id = old.user_id)
                           or not exists (select 1 from public.organizations where id = old.organization_id)) then
    return old;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.member_role = 'owner' and (tg_op = 'INSERT' or old.member_role <> 'owner')
     and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = auth.uid() and member_role = 'owner')
     and exists (select 1 from public.organization_members where organization_id = new.organization_id and member_role = 'owner') then
    raise exception 'only_owner_can_grant_owner' using errcode = '42501';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.member_role in ('owner', 'admin')
     and (tg_op = 'DELETE' or new.member_role not in ('owner', 'admin'))
     and not exists (select 1 from public.organization_members where organization_id = old.organization_id and user_id <> old.user_id and member_role in ('owner', 'admin')) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_minor(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Sin fecha de nacimiento se trata como menor: protección por defecto.
  select coalesce(
    (select date_of_birth > (current_date - interval '18 years')
       from public.private_profile_data where user_id = p_user),
    true
  );
$function$;

CREATE OR REPLACE FUNCTION public.mark_note_edited()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.body is distinct from old.body then new.updated_at := now(); end if;
  -- Sin HTML ejecutable: se rechaza cualquier etiqueta de script o manejador inline.
  if new.body ~* '<\s*script|javascript:|on[a-z]+\s*=' then raise exception 'unsafe_content' using errcode = 'P0001'; end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_contact_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org text;
  r record;
begin
  select name into v_org from public.organizations where id = new.organization_id;
  if tg_op = 'INSERT' then
    if new.status = 'pending_guardian' then
      for r in select parent_id from public.parent_athlete_links where athlete_id = new.athlete_id and status = 'approved' loop
        perform public.notify(r.parent_id, 'contact.guardian_review', v_org || ' quiere contactar con tu hijo/a',
          'Revisa la solicitud y decide si la apruebas.', '/app/inbox');
      end loop;
    else
      perform public.notify(new.athlete_id, 'contact.new', v_org || ' quiere contactar contigo',
        'Organización verificada. Puedes aceptar, rechazar o bloquear.', '/app/inbox');
    end if;
  elsif new.status is distinct from old.status then
    if old.status = 'pending_guardian' and new.status = 'pending' then
      perform public.notify(new.athlete_id, 'contact.new', v_org || ' quiere contactar contigo',
        'Tu familia ha aprobado la solicitud. Ahora decides tú.', '/app/inbox');
    elsif new.status = 'accepted' then
      perform public.notify(new.requested_by, 'contact.accepted', 'Solicitud aceptada',
        'La conversación ya está abierta en Mensajes.', '/app/inbox/' || new.id);
    elsif new.status in ('declined', 'blocked') then
      -- No se revela si fue un rechazo o un bloqueo.
      perform public.notify(new.requested_by, 'contact.closed', 'Solicitud no aceptada', null, '/app/inbox');
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.only_nulled(p_old jsonb, p_new jsonb, p_cols text[])
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if (p_new - p_cols) is distinct from (p_old - p_cols) then return false; end if;
  foreach c in array p_cols loop
    if (p_new -> c) is distinct from (p_old -> c) and coalesce(p_new -> c, 'null'::jsonb) <> 'null'::jsonb then return false; end if;
  end loop;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.only_nulled(p_old jsonb, p_new jsonb, p_cols text[], p_rel regclass)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.only_nulled(
    p_old - coalesce((select array_agg(attname::text) from pg_attribute where attrelid = p_rel and attgenerated <> ''), '{}'::text[]),
    p_new - coalesce((select array_agg(attname::text) from pg_attribute where attrelid = p_rel and attgenerated <> ''), '{}'::text[]),
    p_cols);
$function$;

CREATE OR REPLACE FUNCTION public.pipeline_from_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_stage text := public.application_stage_for_athlete(new.status);
  v_title text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  perform set_config('gala.pipeline_source', case when new.status = 'withdrawn' then 'user' else 'organization' end, true);
  insert into public.saved_items (athlete_id, target_kind, target_id, status)
  values (new.athlete_id, 'opportunity', new.opportunity_id, v_stage)
  on conflict (athlete_id, target_kind, target_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.saved_items where athlete_id = new.athlete_id and target_kind = 'opportunity' and target_id = new.opportunity_id;
    -- Avanza, nunca retrocede lo que decidió el atleta; una candidatura descartada cierra el proceso.
    update public.saved_items
       set status = v_stage,
           close_reason = case when v_stage = 'closed' then case when new.status = 'withdrawn' then 'not_interested' else 'rejected' end else close_reason end
     where id = v_id and status not in ('committed', 'closed')
       and (public.pipeline_stage_rank(v_stage) > public.pipeline_stage_rank(status) or v_stage = 'closed');
  end if;
  v_title := case new.status::text
    when 'applied' then 'Candidatura enviada' when 'reviewed' then 'La organización revisó tu candidatura'
    when 'contacted' then 'La organización te ha contactado' when 'information_requested' then 'Te piden información adicional'
    when 'interview' then 'Entrevista o llamada programada' when 'tryout' then 'Te proponen una prueba'
    when 'shortlist' then 'Estás en su lista de seguimiento' when 'offer' then 'La organización registró una oferta'
    when 'accepted' then 'Candidatura aceptada' when 'declined' then 'La organización no continúa el proceso'
    when 'withdrawn' then 'Retiraste tu candidatura' else 'Actualización de la candidatura' end;
  insert into public.pipeline_events (athlete_id, process_id, kind, source, title)
  values (new.athlete_id, v_id, 'application_update', case when new.status = 'withdrawn' then 'user' else 'organization' end, v_title);
  perform set_config('gala.pipeline_source', '', true);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pipeline_log_process()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Las funciones del sistema marcan la fuente (organización / plataforma); por defecto actúa el usuario.
  v_src text := coalesce(nullif(current_setting('gala.pipeline_source', true), ''), 'user');
begin
  if tg_op = 'INSERT' then
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, created_by)
    values (new.athlete_id, new.id, 'created', v_src, 'Añadido al pipeline', auth.uid());
    return new;
  end if;
  if new.status is distinct from old.status then
    new.stage_changed_at := now();
    if new.status in ('committed', 'closed') then new.decided_at := now(); end if;
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, body, created_by)
    values (new.athlete_id, new.id, 'stage_changed', v_src, 'Etapa: ' || old.status || ' → ' || new.status, new.close_reason, auth.uid());
  end if;
  if new.archived_at is distinct from old.archived_at then
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, created_by)
    values (new.athlete_id, new.id, case when new.archived_at is null then 'restored' else 'archived' end, v_src,
            case when new.archived_at is null then 'Recuperado del archivo' else 'Archivado' end, auth.uid());
  end if;
  if (new.next_action, new.next_action_due) is distinct from (old.next_action, old.next_action_due) and new.next_action is not null then
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, created_by)
    values (new.athlete_id, new.id, 'next_action', v_src, 'Siguiente paso: ' || left(new.next_action, 160), auth.uid());
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_membership_exit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_status text := coalesce(nullif(current_setting('gala.exit_status', true), ''), case when old.user_id = auth.uid() then 'left' else 'revoked' end);
begin
  if not exists (select 1 from public.organizations where id = old.organization_id) or not exists (select 1 from public.profiles where id = old.user_id) then
    return old;
  end if;
  insert into public.organization_membership_records (organization_id, user_id, status, member_role, declared_role, program_ids, program_scope, title, reason, actor_id)
  values (old.organization_id, old.user_id, v_status, old.member_role, old.declared_role, old.program_ids, old.program_scope, old.title,
          nullif(current_setting('gala.exit_reason', true), ''), auth.uid());
  -- Los permisos por programa se revocan con la membresía.
  update public.program_memberships set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
   where organization_id = old.organization_id and user_id = old.user_id and status = 'active';
  perform public.audit('membership_' || v_status, 'organization_member', old.user_id, old.organization_id,
    jsonb_build_object('role', old.member_role), nullif(current_setting('gala.exit_reason', true), ''), 'security');
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_program_cache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ids uuid[];
begin
  select coalesce(array_agg(program_id), '{}') into v_ids from public.program_memberships
   where organization_id = new.organization_id and user_id = new.user_id and status = 'active';
  perform set_config('gala.program_sync', 'on', true);
  -- Con concesiones explícitas el alcance es «seleccionados», aunque se revoquen todas: revocar nunca abre acceso a todo.
  update public.organization_members set program_ids = v_ids, program_scope = 'selected'
   where organization_id = new.organization_id and user_id = new.user_id;
  perform set_config('gala.program_sync', '', true);
  perform public.audit(case when new.status = 'active' then 'program_access_granted' else 'program_access_revoked' end,
    'program_membership', new.id, new.organization_id, jsonb_build_object('user', new.user_id, 'level', new.access_level), null, 'security', new.program_id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_retention()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb := '{}'::jsonb;
  n int;
begin
  -- La ejecuta pg_cron (sin usuario) o un admin desde el panel; nadie más.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  delete from public.product_events where created_at < now() - interval '13 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('product_events', n);
  delete from public.notifications where read_at is not null and read_at < now() - interval '6 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('notifications_read', n);
  delete from public.notifications where created_at < now() - interval '12 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('notifications_old', n);
  delete from public.athlete_updates where expires_at < now() - interval '30 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('athlete_updates', n);
  delete from public.ai_usage where day < current_date - 90;
  get diagnostics n = row_count; v := v || jsonb_build_object('ai_usage', n);
  delete from public.club_roster_invites where expires_at < now() - interval '90 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('roster_invites', n);
  delete from public.organization_invitations where status <> 'accepted' and expires_at < now() - interval '90 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('org_invitations', n);
  delete from public.parent_athlete_links where status = 'pending' and expires_at < now() - interval '90 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('family_invitations', n);
  delete from public.user_feedback where created_at < now() - interval '24 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('feedback', n);
  insert into public.audit_logs (actor_id, action, entity, details) values (auth.uid(), 'retention.run', 'system', v);
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.shortlist_promote(p_list uuid, p_athlete uuid, p_need uuid DEFAULT NULL::uuid, p_opportunity uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; m record; v_cand uuid;
begin
  select * into s from public.org_shortlists where id = p_list;
  if s.id is null or not public.can_see_shortlist(p_list) or not public.org_can(s.organization_id, 'pipeline', s.program_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into m from public.org_shortlist_members where shortlist_id = p_list and athlete_id = p_athlete for update;
  if m.athlete_id is null then raise exception 'not_in_shortlist' using errcode = 'P0002'; end if;
  -- El atleta debe seguir siendo accesible para la organización (privacidad actual, no la de cuando se añadió).
  if not public.can_view_athlete(p_athlete, 'profile') then raise exception 'athlete_not_accessible' using errcode = '42501'; end if;
  if p_need is not null and not exists (select 1 from public.recruiting_needs where id = p_need and organization_id = s.organization_id and status = 'active') then
    raise exception 'need_not_active' using errcode = 'P0001';
  end if;
  if p_opportunity is not null and not exists (select 1 from public.opportunities where id = p_opportunity and organization_id = s.organization_id) then
    raise exception 'opportunity_not_in_org' using errcode = 'P0001';
  end if;
  -- Sin duplicados: un candidato por organización y atleta (se reactiva si estaba archivado).
  insert into public.org_candidates (organization_id, athlete_id, program_id, need_id, opportunity_id, internal_stage, source, created_by)
  values (s.organization_id, p_athlete, s.program_id, coalesce(p_need, s.need_id), coalesce(p_opportunity, s.opportunity_id), 'active', 'shortlist', auth.uid())
  on conflict (organization_id, athlete_id) do update
     set archived_at = null,
         internal_stage = case when public.org_candidates.internal_stage in ('new', 'review', 'priority_review', 'shortlisted', 'closed') then 'active' else public.org_candidates.internal_stage end,
         need_id = coalesce(public.org_candidates.need_id, excluded.need_id),
         opportunity_id = coalesce(public.org_candidates.opportunity_id, excluded.opportunity_id)
  returning id into v_cand;
  update public.org_shortlist_members set promoted_candidate_id = v_cand, promoted_at = now() where shortlist_id = p_list and athlete_id = p_athlete;
  perform public.org_log(s.organization_id, p_athlete, 'stage_changed', jsonb_build_object('candidate', v_cand, 'via', 'shortlist', 'shortlist', p_list));
  perform public.audit('athlete_promoted_to_pipeline', 'org_candidate', v_cand, s.organization_id, jsonb_build_object('shortlist', p_list), null, 'normal', s.program_id);
  return v_cand;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verification_submit(p_type text, p_org uuid, p_program uuid DEFAULT NULL::uuid, p_declared_role text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_email text; v_domain text; v_match boolean;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if p_type not in ('organization_claim', 'organization_affiliation', 'program_affiliation', 'role') then raise exception 'invalid_type' using errcode = 'P0001'; end if;
  if p_program is not null and not public.program_in_org(p_program, p_org) then raise exception 'program_not_in_org' using errcode = 'P0001'; end if;
  insert into public.verification_requests (subject_user, organization_id, program_id, verification_type, declared_role, status, submitted_at)
  values (auth.uid(), p_org, p_program, p_type, left(p_declared_role, 80), 'submitted', now())
  returning id into v_id;
  if p_type = 'organization_claim' then
    update public.organizations set claim_status = 'claim_pending' where id = p_org and claim_status = 'unclaimed';
  end if;
  -- Señal de dominio: email verificado más reciente del usuario frente a los dominios verificados de la organización.
  select email, email_domain into v_email, v_domain from public.email_verifications
   where user_id = auth.uid() and organization_id = p_org and result = 'verified' and revoked_at is null order by verified_at desc limit 1;
  if v_domain is not null then
    select exists (select 1 from public.organization_domains d where d.organization_id = p_org and d.status = 'verified' and public.domain_matches(v_domain, d.domain)) into v_match;
    insert into public.verification_checks (request_id, method, result, detail)
    values (v_id, 'domain_match', case when v_match then 'passed' else 'failed' end, 'Dominio del correo verificado: ' || v_domain);
  end if;
  perform public.audit('verification_requested', 'verification_request', v_id, p_org, jsonb_build_object('type', p_type), null, 'security', p_program);
  return v_id;
end;
$function$;

