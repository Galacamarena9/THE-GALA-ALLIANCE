-- =============================================================================================================
-- Confianza de la familia y protección de menores (QA atleta/familia: hallazgo 1, parte pendiente; hallazgo 8; idea 5)
-- 1. Avisos in-app cuando cambia un vínculo familiar (reutiliza public.notify, categoría «esencial», no silenciable):
--    el tutor renuncia, soporte pausa o retira, el atleta adulto pausa o retira, se reanuda, el atleta confirma tras
--    cumplir 18 y, con la tarea diaria, cuando la revisión de los 18 vence sin respuesta. Nunca se avisa a quien actúa.
-- 2. Conversaciones congeladas: un menor sin tutor adulto activo (minor_has_active_family) no puede recibir ni enviar
--    mensajes nuevos en sus conversaciones con organizaciones hasta que vuelva a haber tutor activo. Deny by default:
--    trigger con error explícito (conversation_frozen_no_guardian) + condición en la policy cmsg_insert.
--    Se avisa a la organización (sin datos de la familia) y al atleta, también cuando se reanudan.
-- 3. «Esto me incomoda»: el atleta marca una conversación; se crea una denuncia de seguridad (content_reports, prioridad
--    máxima si es menor, la cola de moderación existente) y se avisa a sus tutores activos. No desvincula a nadie.
-- 4. Tipo de cambio de la familia (family_cost_settings): 1 US$ = X €, con fecha y fuente. Sin valor por defecto:
--    sin tipo, todo se muestra solo en la moneda de la fuente. Mismo acceso que los escenarios de coste
--    (atleta o tutor con permiso de costes). Nunca visible para clubes, universidades ni agentes.
-- ROLLBACK:
--   drop trigger if exists family_link_notify_change on public.parent_athlete_links;
--   drop function if exists public.family_link_notify_change(), public.family_notify_lapsed_access(),
--     public.contact_flag_discomfort(uuid, text), public.guard_contact_frozen(), public.person_first_name(uuid, text),
--     public.notify_minor_threads(uuid, boolean);
--   drop trigger if exists guard_contact_frozen on public.contact_messages;
--   restaurar cmsg_insert (20261213000100_agency_message_authority.sql) y después
--   drop function if exists public.contact_thread_frozen(uuid);
--   drop table if exists public.family_cost_settings;
--   (pg_cron) select cron.unschedule('gala-family-lapsed-access');
-- =============================================================================================================

-- 0. Nombre de pila para los avisos (interna) ---------------------------------------------------------------
create or replace function public.person_first_name(p_user uuid, p_fallback text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(split_part(trim(p.display_name), ' ', 1), '') from public.profiles p where p.id = p_user), p_fallback);
$$;
revoke all on function public.person_first_name(uuid, text) from public, anon, authenticated;

-- 1. ¿Está congelada esta conversación? -------------------------------------------------------------------
-- Solo responde a quien participa (o a admin); para cualquier otra persona, false (no revela nada).
create or replace function public.contact_thread_frozen(p_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select r.is_minor_at_request and not public.minor_has_active_family(r.athlete_id)
      from public.contact_requests r
     where r.id = p_request
       and (public.is_contact_participant(r.id) or public.is_admin())), false);
$$;
revoke all on function public.contact_thread_frozen(uuid) from public, anon;
grant execute on function public.contact_thread_frozen(uuid) to authenticated;

-- Defensa con error claro (la policy de abajo es la que deniega por defecto).
create or replace function public.guard_contact_frozen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.contact_requests r
              where r.id = new.request_id and r.is_minor_at_request
                and not public.minor_has_active_family(r.athlete_id)) then
    raise exception 'conversation_frozen_no_guardian' using errcode = '42501',
      hint = 'El atleta es menor y ahora mismo no tiene un tutor activo: la conversación está en pausa.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_contact_frozen() from public, anon, authenticated;
drop trigger if exists guard_contact_frozen on public.contact_messages;
create trigger guard_contact_frozen before insert on public.contact_messages
  for each row execute function public.guard_contact_frozen();

-- Misma policy que 20261213000100 + «no congelada».
drop policy if exists cmsg_insert on public.contact_messages;
create policy cmsg_insert on public.contact_messages for insert to authenticated with check (
  public.is_contact_participant(request_id)
  and not public.contact_thread_frozen(request_id)
  and not exists (
    select 1 from public.contact_requests r
     where r.id = request_id
       and ((r.athlete_id <> (select auth.uid()) and public.has_block_with(r.athlete_id))
            or (r.requested_by <> (select auth.uid()) and public.has_block_with(r.requested_by)))
  )
  and exists (
    select 1 from public.contact_requests r
     where r.id = request_id
       and (r.athlete_id = (select auth.uid()) or public.is_active_guardian(r.athlete_id) or public.agency_may_message(r.organization_id, r.athlete_id))
  )
);

-- Aviso a quien abrió cada conversación abierta de un menor: en pausa / reanudada. Sin datos de la familia.
create or replace function public.notify_minor_threads(p_athlete uuid, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, requested_by from public.contact_requests
            where athlete_id = p_athlete and is_minor_at_request and status = 'accepted' and requested_by is not null loop
    if p_paused then
      perform public.notify(r.requested_by, 'contact.paused', 'Conversación en pausa',
        'Por protección de menores, no se pueden enviar mensajes en esta conversación hasta que la familia del atleta vuelva a estar activa.',
        '/app/inbox/' || r.id);
    else
      perform public.notify(r.requested_by, 'contact.resumed', 'Conversación reanudada',
        'La familia del atleta vuelve a estar activa: ya se pueden enviar mensajes en esta conversación.',
        '/app/inbox/' || r.id);
    end if;
  end loop;
end;
$$;
revoke all on function public.notify_minor_threads(uuid, boolean) from public, anon, authenticated;

-- 2. Avisos por cambio en el vínculo familiar -------------------------------------------------------------
create or replace function public.family_link_notify_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_kid text;
  v_adult text;
  v_minor boolean;
  v_support boolean;
  v_others boolean;
  v_paused_note text := '';
  g uuid;
begin
  if new.athlete_id is null or new.parent_id is null then return null; end if;
  v_kid := public.person_first_name(new.athlete_id, 'tu hijo/a');
  v_adult := public.person_first_name(new.parent_id, 'Un familiar');
  v_minor := public.is_minor(new.athlete_id);
  -- Soporte/administración o el sistema (no es ni el atleta ni el tutor del vínculo).
  v_support := v_actor is null or (v_actor <> new.athlete_id and v_actor <> new.parent_id);
  -- ¿Queda (o había) otro tutor adulto activo además de este vínculo?
  v_others := exists (select 1 from public.parent_athlete_links l
                       where l.athlete_id = new.athlete_id and l.id <> new.id and l.status = 'approved'
                         and l.parent_id is not null and not public.is_minor(l.parent_id)
                         and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at));

  -- 2a. El atleta adulto confirma el acceso tras cumplir 18 (sin cambio de estado).
  if new.status is not distinct from old.status then
    if new.status = 'approved' and new.last_reviewed_at is distinct from old.last_reviewed_at
       and v_actor = new.athlete_id and new.last_reviewed_at is not null then
      perform public.notify(new.parent_id, 'family.link_changed', 'Tu acceso familiar sigue activo',
        v_kid || ' ha confirmado que sigues acompañando su cuenta.', '/app/family');
    end if;
    return null;
  end if;

  -- 2b. Retirada del vínculo (estaba activo o en pausa).
  if new.status = 'revoked' and old.status::text in ('approved', 'restricted') then
    if v_minor and old.status = 'approved' and not v_others then
      v_paused_note := ' Mientras no haya un tutor activo, tus conversaciones con organizaciones quedan en pausa. Puedes invitar a otro familiar desde Ajustes.';
      perform public.notify_minor_threads(new.athlete_id, true);
    end if;
    if v_actor = new.parent_id then
      perform public.notify(new.athlete_id, 'family.link_changed', 'Un familiar ha dejado de acompañar tu cuenta',
        v_adult || ' ya no tiene acceso a tu cuenta.' || v_paused_note, '/app/settings');
    elsif v_actor = new.athlete_id then
      perform public.notify(new.parent_id, 'family.link_changed', 'Ya no tienes acceso a la cuenta de ' || v_kid,
        v_kid || ' ha retirado el acceso familiar. Si crees que es un error, habladlo en casa.', '/app/family');
    else
      perform public.notify(new.parent_id, 'family.link_changed', 'Soporte ha retirado tu acceso familiar',
        'El equipo de Gala ha retirado tu acceso a la cuenta de ' || v_kid || '. Si crees que es un error, escríbenos desde Soporte.', '/app/support');
      perform public.notify(new.athlete_id, 'family.link_changed', 'Cambio en el acceso de tu familia',
        'El equipo de Gala ha retirado el acceso de ' || v_adult || ' a tu cuenta.' || v_paused_note, '/app/settings');
    end if;
    -- Los demás tutores activos se enteran de que la otra persona ya no está.
    for g in select l.parent_id from public.parent_athlete_links l
              where l.athlete_id = new.athlete_id and l.id <> new.id and l.status = 'approved' and l.parent_id is not null
                and l.parent_id <> coalesce(v_actor, '00000000-0000-0000-0000-000000000000'::uuid) loop
      perform public.notify(g, 'family.link_changed', 'Cambio en el acceso familiar',
        v_adult || ' ya no acompaña la cuenta de ' || v_kid || '. Tu acceso no cambia.', '/app/family');
    end loop;
    return null;
  end if;

  -- 2c. Pausa (soporte o el atleta adulto; un menor no puede pausar, lo impide guard_minor_guardian_change).
  if new.status = 'restricted' and old.status = 'approved' then
    if v_minor and not v_others then
      v_paused_note := ' Mientras tanto, tus conversaciones con organizaciones quedan en pausa.';
      perform public.notify_minor_threads(new.athlete_id, true);
    end if;
    if v_actor = new.athlete_id then
      perform public.notify(new.parent_id, 'family.link_changed', v_kid || ' ha pausado tu acceso familiar',
        'Sigues vinculado/a, pero ahora mismo no ves su cuenta. Puede reanudarlo cuando quiera.', '/app/family');
    else
      perform public.notify(new.parent_id, 'family.link_changed', 'Tu acceso familiar está en pausa',
        'El equipo de Gala ha pausado tu acceso a la cuenta de ' || v_kid || ' mientras revisa el caso. Si crees que es un error, escríbenos desde Soporte.', '/app/support');
      perform public.notify(new.athlete_id, 'family.link_changed', 'El acceso de un familiar está en pausa',
        'El equipo de Gala ha pausado el acceso de ' || v_adult || ' a tu cuenta mientras revisa el caso.' || v_paused_note, '/app/settings');
    end if;
    return null;
  end if;

  -- 2d. Reanudación o un tutor que pasa a estar activo.
  if new.status = 'approved' and old.status::text in ('restricted', 'pending') then
    if v_minor and not v_others then
      perform public.notify_minor_threads(new.athlete_id, false);
    end if;
    if old.status = 'restricted' then
      if v_actor is distinct from new.parent_id then
        perform public.notify(new.parent_id, 'family.link_changed', 'Tu acceso familiar vuelve a estar activo',
          'Vuelves a ver la cuenta de ' || v_kid || ' con los mismos permisos.', '/app/family');
      end if;
      if v_actor is distinct from new.athlete_id then
        perform public.notify(new.athlete_id, 'family.link_changed', 'El acceso de tu familia vuelve a estar activo',
          v_adult || ' vuelve a acompañar tu cuenta.'
            || case when v_minor and not v_others then ' Tus conversaciones con organizaciones se reanudan.' else '' end, '/app/settings');
      end if;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.family_link_notify_change() from public, anon, authenticated;
drop trigger if exists family_link_notify_change on public.parent_athlete_links;
create trigger family_link_notify_change after update on public.parent_athlete_links
  for each row execute function public.family_link_notify_change();

-- 2e. La revisión de los 18 vence sin respuesta: el acceso se pausa solo (family_link_lapsed) y ahora se avisa.
-- Idempotente: marca family_link.majority_review_lapsed en audit_logs (una vez por vínculo).
create or replace function public.family_notify_lapsed_access()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select l.id, l.athlete_id, l.parent_id from public.parent_athlete_links l
     where l.status = 'approved' and l.parent_id is not null and l.athlete_id is not null
       and public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at)
       and not exists (select 1 from public.audit_logs a where a.action = 'family_link.majority_review_lapsed' and a.entity_id = l.id)
  loop
    perform public.notify(r.parent_id, 'family.link_changed', 'Tu acceso familiar está en pausa',
      public.person_first_name(r.athlete_id, 'Tu familiar') || ' no ha confirmado tu acceso tras cumplir 18 años. Si lo confirma desde sus ajustes, volverás a tenerlo.',
      '/app/family');
    perform public.notify(r.athlete_id, 'family.link_changed', 'El acceso de tu familia está en pausa',
      'No lo confirmaste a tiempo tras cumplir 18 años. Puedes confirmarlo o retirarlo cuando quieras en Ajustes.', '/app/settings');
    insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
    values (null, 'family_link.majority_review_lapsed', 'parent_athlete_links', r.id, 'sensitive', '{}'::jsonb);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.family_notify_lapsed_access() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gala-family-lapsed-access', '47 5 * * *', 'select public.family_notify_lapsed_access()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: el aviso de revisión vencida no se programará';
end $$;

-- 3. «Esto me incomoda» ------------------------------------------------------------------------------------
-- Solo el atleta de la conversación. Crea (una vez mientras siga abierta) una denuncia de seguridad y avisa a sus
-- tutores activos. Devuelve cuántos familiares han recibido el aviso (0 = sin tutor activo: solo seguridad).
create or replace function public.contact_flag_discomfort(p_request uuid, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  r public.contact_requests;
  v_minor boolean;
  v_org text;
  v_kid text;
  v_n int := 0;
  g uuid;
begin
  select * into r from public.contact_requests where id = p_request;
  if not found or auth.uid() is null or r.athlete_id is distinct from auth.uid() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_minor := public.is_minor(r.athlete_id) or r.is_minor_at_request;
  -- Una sola denuncia abierta por conversación y atleta: pulsar dos veces no inunda a la familia ni la cola.
  if exists (select 1 from public.content_reports c
              where c.entity_type = 'contact_request' and c.entity_id = p_request and c.reporter_id = auth.uid()
                and c.status in ('open', 'reviewing') and c.details like '«Esto me incomoda»%') then
    return -1;
  end if;
  insert into public.content_reports (entity_type, entity_id, reason, details)
  values ('contact_request', p_request, case when v_minor then 'child_safety' else 'harassment' end,
          left('«Esto me incomoda» (botón del atleta)' || coalesce(': ' || nullif(trim(p_note), ''), ''), 2000));

  select o.name into v_org from public.organizations o where o.id = r.organization_id;
  v_kid := public.person_first_name(r.athlete_id, 'Tu hijo/a');
  for g in select l.parent_id from public.parent_athlete_links l
            where l.athlete_id = r.athlete_id and l.status = 'approved' and l.parent_id is not null
              and not public.is_minor(l.parent_id)
              and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at) loop
    perform public.notify(g, 'family.safety', v_kid || ' ha marcado una conversación como incómoda',
      left(v_kid || ' ha pulsado «Esto me incomoda» en la conversación con ' || coalesce(v_org, 'una organización')
        || '. El equipo de seguridad de Gala ya lo está revisando. Hablad con calma: no hace falta desvincular a nadie.', 500),
      '/app/inbox/' || r.id);
    v_n := v_n + 1;
  end loop;
  insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
  values (auth.uid(), 'contact.discomfort_flagged', 'contact_requests', p_request, 'security',
          jsonb_build_object('minor', v_minor, 'family_notified', v_n));
  return v_n;
end;
$$;
revoke all on function public.contact_flag_discomfort(uuid, text) from public, anon;
grant execute on function public.contact_flag_discomfort(uuid, text) to authenticated;

-- 4. Tipo de cambio de la familia ----------------------------------------------------------------------------
create table if not exists public.family_cost_settings (
  athlete_id uuid primary key references public.athlete_profiles (user_id) on delete cascade,
  eur_per_usd numeric(8, 4) check (eur_per_usd > 0 and eur_per_usd < 10),
  rate_date date,
  rate_source text check (char_length(rate_source) between 3 and 200),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  -- Todo o nada: un tipo sin fecha o sin fuente no se usa.
  constraint family_fx_complete check ((eur_per_usd is null) = (rate_date is null) and (eur_per_usd is null) = (rate_source is null))
);
create index if not exists fkx_family_cost_settings_updated_by on public.family_cost_settings (updated_by);
comment on table public.family_cost_settings is 'Tipo de cambio que indica la familia (fecha y fuente). PRIVADO: atleta y familia con permiso de costes. Sin valor por defecto.';
alter table public.family_cost_settings enable row level security;
revoke all on public.family_cost_settings from anon, authenticated;
grant select, insert, update, delete on public.family_cost_settings to authenticated;
create policy fcset_select on public.family_cost_settings for select to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'));
create policy fcset_insert on public.family_cost_settings for insert to authenticated
  with check (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'));
create policy fcset_update on public.family_cost_settings for update to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'))
  with check (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'));
create policy fcset_delete on public.family_cost_settings for delete to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'));

create or replace function public.stamp_family_cost_settings()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.athlete_id is distinct from old.athlete_id then
    raise exception 'fx_owner_immutable' using errcode = '42501';
  end if;
  if new.rate_date is not null and new.rate_date > current_date then
    raise exception 'fx_date_in_future' using errcode = '22023';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.stamp_family_cost_settings() from public, anon, authenticated;
drop trigger if exists stamp_family_cost_settings on public.family_cost_settings;
create trigger stamp_family_cost_settings before insert or update on public.family_cost_settings
  for each row execute function public.stamp_family_cost_settings();
