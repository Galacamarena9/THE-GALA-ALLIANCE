-- Prompt 8 · Comportamiento de borrado (RGPD) — corrige un bloqueo real detectado al documentar el ERD.
--
-- Problema: borrar una cuenta (derecho de supresión) o una organización FALLABA en cuanto la persona
-- había dejado rastro en tablas de evidencia: los registros inmutables (audit_logs, consents,
-- cookie_consent_logs, application_status_history, verification_decisions) rechazaban cualquier UPDATE/DELETE,
-- incluido el `on delete set null/cascade` de sus propias claves; y 15 claves hacia profiles eran NO ACTION.
--
-- Regla nueva (la misma que ya seguía org_activity):
--   · Los registros de evidencia siguen siendo inmutables para todo el mundo, admin incluido.
--   · Solo se permite ANONIMIZAR (poner a null las columnas que apuntan a personas u organizaciones)
--     y BORRAR EN CASCADA cuando el padre ya no existe.
--   · Las referencias a «quién creó / revisó / aprobó» pasan a ON DELETE SET NULL: el contenido se conserva
--     sin la persona.
--
-- Reversión: volver a crear los triggers con public.forbid_mutation() y las FKs sin `on delete set null`
-- (no recomendado: vuelve a bloquear la supresión de cuentas).

-- 1. Guardia genérica para tablas de evidencia ----------------------------------------------------
-- ¿El único cambio es poner a null alguna de estas columnas? (anonimizar, nunca reescribir)
create or replace function public.only_nulled(p_old jsonb, p_new jsonb, p_cols text[])
returns boolean language plpgsql immutable set search_path = public as $$
declare c text;
begin
  if (p_new - p_cols) is distinct from (p_old - p_cols) then return false; end if;
  foreach c in array p_cols loop
    if (p_new -> c) is distinct from (p_old -> c) and coalesce(p_new -> c, 'null'::jsonb) <> 'null'::jsonb then return false; end if;
  end loop;
  return true;
end;
$$;

--    tg_argv[0]: columnas anonimizables; tg_argv[1]: tablas padre; tg_argv[2]: columnas hacia cada padre.
create or replace function public.guard_evidence_record()
returns trigger language plpgsql set search_path = public as $$
declare
  v_parents text[] := coalesce(nullif(tg_argv[1], '')::text[], '{}');
  v_pcols text[] := coalesce(nullif(tg_argv[2], '')::text[], '{}');
  v_exists boolean;
begin
  -- Supresión RGPD autoservicio (delete_my_account) sigue funcionando igual.
  if current_setting('gala.erasure', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' then
    if public.only_nulled(to_jsonb(old), to_jsonb(new), tg_argv[0]::text[]) then return new; end if;
    raise exception 'immutable_record' using errcode = '42501';
  end if;
  -- DELETE: solo en cascada, cuando alguno de sus padres ya no existe.
  for i in 1 .. coalesce(array_length(v_parents, 1), 0) loop
    execute format('select exists (select 1 from public.%I where id = $1)', v_parents[i])
      into v_exists using (to_jsonb(old) ->> v_pcols[i])::uuid;
    if not v_exists then return old; end if;
  end loop;
  raise exception 'immutable_record' using errcode = '42501';
end;
$$;
revoke execute on function public.guard_evidence_record() from public, anon, authenticated;

drop trigger if exists audit_immutable on public.audit_logs;
create trigger audit_immutable before update or delete on public.audit_logs
  for each row execute function public.guard_evidence_record('{actor_id,organization_id}', '', '');

drop trigger if exists cookie_logs_immutable on public.cookie_consent_logs;
create trigger cookie_logs_immutable before update or delete on public.cookie_consent_logs
  for each row execute function public.guard_evidence_record('{user_id}', '', '');

-- El consentimiento se borra con la persona (deja de haber tratamiento que justificar);
-- el del tutor se conserva anonimizado si el tutor borra su cuenta.
drop trigger if exists consents_immutable on public.consents;
create trigger consents_immutable before update or delete on public.consents
  for each row execute function public.guard_evidence_record('{guardian_id}', '{profiles}', '{user_id}');

drop trigger if exists status_history_immutable on public.application_status_history;
create trigger status_history_immutable before update or delete on public.application_status_history
  for each row execute function public.guard_evidence_record('{changed_by}', '{applications}', '{application_id}');

drop trigger if exists contact_messages_immutable on public.contact_messages;
create trigger contact_messages_immutable before update or delete on public.contact_messages
  for each row execute function public.guard_evidence_record('{}', '{profiles,contact_requests}', '{sender_id,request_id}');

drop trigger if exists verification_decisions_immutable on public.verification_decisions;
create trigger verification_decisions_immutable before update on public.verification_decisions
  for each row execute function public.guard_evidence_record('{reviewer_id}', '', '');

-- 2. «Quién creó / revisó» → ON DELETE SET NULL -------------------------------------------------------
alter table public.application_notes alter column author_id drop not null;
alter table public.brand_campaigns alter column created_by drop not null;
alter table public.opportunities alter column created_by drop not null;
alter table public.organizations alter column created_by drop not null;
alter table public.verification_decisions alter column reviewer_id drop not null;

do $$
declare r record;
begin
  for r in
    select * from (values
      ('application_notes', 'author_id'), ('application_status_history', 'changed_by'), ('athlete_links', 'verified_by'),
      ('brand_campaigns', 'created_by'), ('consents', 'guardian_id'), ('contact_requests', 'guardian_approved_by'),
      ('content_reports', 'decided_by'), ('institution_claims', 'reviewed_by'), ('institutions', 'links_verified_by'),
      ('opportunities', 'created_by'), ('opportunities', 'reviewed_by'), ('organization_invitations', 'accepted_by'),
      ('organizations', 'created_by'), ('organizations', 'verified_by'), ('verification_decisions', 'reviewer_id')
    ) v(t, c)
  loop
    -- Busca el nombre real de la FK (no se asume la convención).
    execute (
      select format('alter table public.%I drop constraint %I', r.t, con.conname)
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.contype = 'f' and con.conrelid = format('public.%I', r.t)::regclass and a.attname = r.c
    );
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.profiles (id) on delete set null',
                   r.t, r.t || '_' || r.c || '_fkey', r.c);
  end loop;
end;
$$;

-- 3. Solicitudes de servicio: anonimizar la organización al borrarla no es «editar la solicitud».
create or replace function public.guard_service_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'new';
    new.admin_note := null;
    if new.organization_id is not null and not public.is_org_member(new.organization_id) then
      raise exception 'not_org_member' using errcode = '42501';
    end if;
    if (select count(*) from public.service_requests where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- ON DELETE SET NULL de la organización: única modificación permitida sin ser admin.
  if public.only_nulled(to_jsonb(old), to_jsonb(new), '{organization_id}') then return new; end if;
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if (new.user_id, new.plan_code, new.organization_id, new.message, new.created_at)
     is distinct from (old.user_id, old.plan_code, old.organization_id, old.message, old.created_at) then
    raise exception 'service_request_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4. Otras guardas: aceptar la anonimización (ON DELETE SET NULL) sin abrir otras ediciones ----------
create or replace function public.guard_recruiting_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_minor(new.athlete_id) and auth.uid() is not null and not public.is_guardian_of(new.athlete_id) then
      raise exception 'guardian_required' using errcode = '42501';
    end if;
    if (select count(*) from public.recruiting_links
         where athlete_id = new.athlete_id and revoked_at is null and expires_at > now()) >= 50 then
      raise exception 'too_many_active_links' using errcode = 'P0001';
    end if;
    new.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    new.revoked_at := null;
    new.expires_at := least(coalesce(new.expires_at, now() + interval '30 days'), now() + interval '90 days');
    return new;
  end if;
  if public.only_nulled(to_jsonb(old), to_jsonb(new), '{created_by}') then return new; end if;
  -- Solo se puede cambiar la etiqueta y revocar (una vez, sin vuelta atrás).
  if (new.athlete_id, new.token, new.created_by, new.created_at, new.expires_at)
     is distinct from (old.athlete_id, old.token, old.created_by, old.created_at, old.expires_at)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'link_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_club_recommendation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if not public.is_club_admin(new.organization_id) then
      raise exception 'club_admin_required' using errcode = '42501';
    end if;
    if not exists (select 1 from public.club_roster where organization_id = new.organization_id
                   and athlete_id = new.athlete_id and status = 'active') then
      raise exception 'not_in_roster' using errcode = 'P0001';
    end if;
    new.author_id := v_uid;
    new.status := 'pending';
    new.decided_at := null;
    perform public.notify(new.athlete_id, 'recommendation.new', 'Tu club te ha recomendado',
      'Revísala y decide si se muestra en tu perfil.', '/app/athlete/passport');
    return new;
  end if;
  if public.only_nulled(to_jsonb(old), to_jsonb(new), '{author_id}') then return new; end if;
  if (new.athlete_id, new.organization_id, new.author_id, new.created_at)
     is distinct from (old.athlete_id, old.organization_id, old.author_id, old.created_at) then
    raise exception 'recommendation_immutable' using errcode = '42501';
  end if;
  -- El texto solo lo cambia el club mientras está pendiente; publicar u ocultar es cosa del atleta o su familia.
  if new.body is distinct from old.body then
    if not (public.is_club_admin(old.organization_id) and old.status = 'pending' and new.status = old.status) then
      raise exception 'recommendation_transition_not_allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if not (v_uid = old.athlete_id or public.is_guardian_of(old.athlete_id)) then
      raise exception 'recommendation_transition_not_allowed' using errcode = '42501';
    end if;
    new.decided_at := now();
  end if;
  return new;
end $$;

-- El historial de asignaciones no registra «desasignaciones» provocadas por borrar la cuenta del asignado.
create or replace function public.guard_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to
     and exists (select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = new.assigned_to
                 and not ('candidates' = any (public.org_role_caps(m.member_role::text)))) then
    raise exception 'assignee_not_authorized' using errcode = 'P0001';
  end if;
  if new.assigned_to is distinct from old.assigned_to
     and exists (select 1 from public.profiles where id = coalesce(new.assigned_to, old.assigned_to))
     and exists (select 1 from public.organizations where id = new.organization_id) then
    insert into public.org_assignment_log (organization_id, target_kind, shortlist_id, athlete_id, candidate_id, assigned_to, assigned_by, status)
    values (new.organization_id, case when tg_table_name = 'org_candidates' then 'candidate' else 'shortlist_member' end,
            case when tg_table_name = 'org_shortlist_members' then (to_jsonb(new)->>'shortlist_id')::uuid end, new.athlete_id,
            case when tg_table_name = 'org_candidates' then (to_jsonb(new)->>'id')::uuid end,
            coalesce(new.assigned_to, old.assigned_to), auth.uid(), case when new.assigned_to is null then 'unassigned' else 'assigned' end);
  end if;
  return new;
end; $$;

-- Al borrar una organización o un atleta no se registra actividad sobre lo que ya no existe.
create or replace function public.org_log(p_org uuid, p_athlete uuid, p_kind text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.org_activity (organization_id, athlete_id, actor_id, kind, detail)
  select p_org, p_athlete, auth.uid(), p_kind, coalesce(p_detail, '{}')
   where exists (select 1 from public.organizations where id = p_org)
     and (p_athlete is null or exists (select 1 from public.athlete_profiles where user_id = p_athlete));
$$;
revoke all on function public.org_log(uuid, uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.guard_opportunity_question()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_title text;
begin
  select organization_id, title into v_org, v_title from public.opportunities where id = coalesce(new.opportunity_id, old.opportunity_id);
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.opportunities where id = new.opportunity_id and status = 'published') then
      raise exception 'opportunity_not_published' using errcode = 'P0001';
    end if;
    -- Espacio público: nada de emails, teléfonos ni redes.
    if new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or new.body ~ '\+?\d[\d\s().-]{7,}\d'
       or new.body ~* '(whatsapp|telegram|instagram|snapchat|tiktok|wa\.me)' then
      raise exception 'contact_data_not_allowed' using errcode = 'P0001';
    end if;
    if (select count(*) from public.opportunity_questions where asker_id = v_uid and created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    new.asker_id := v_uid;
    new.answer := null; new.answered_by := null; new.answered_at := null;
    return new;
  end if;
  if public.only_nulled(to_jsonb(old), to_jsonb(new), '{asker_id,answered_by}') then return new; end if;
  if (new.opportunity_id, new.asker_id, new.body, new.created_at) is distinct from (old.opportunity_id, old.asker_id, old.body, old.created_at) then
    raise exception 'question_immutable' using errcode = '42501';
  end if;
  if new.answer is distinct from old.answer then
    if not public.is_org_member(v_org) then
      raise exception 'answer_not_allowed' using errcode = '42501';
    end if;
    if new.answer ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or new.answer ~ '\+?\d[\d\s().-]{7,}\d' then
      raise exception 'contact_data_not_allowed' using errcode = 'P0001';
    end if;
    new.answered_by := v_uid;
    new.answered_at := now();
    if old.answer is null and old.asker_id is not null then
      perform public.notify(old.asker_id, 'question.answered', 'Han respondido tu pregunta', left(v_title, 160), '/app/opportunities/' || old.opportunity_id);
    end if;
  end if;
  return new;
end $$;
