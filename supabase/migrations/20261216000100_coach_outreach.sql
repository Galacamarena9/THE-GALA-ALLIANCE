-- =============================================================================
-- Ciclo 2 · Escribir a coaches desde cada proceso y saber quién responde
-- La agencia prepara, desde un proceso aprobado para contactar, un correo en inglés al coach con un
-- enlace privado al Passport del atleta (recruiting_links). El correo sale del buzón de la propia
-- agencia (la plataforma no envía todavía): la agencia confirma «enviado» y después registra si el
-- coach contestó. Cada paso queda en el historial del proceso y la agencia ve cuántas veces se abrió
-- el enlace.
--   · Solo quien puede escribir en el proceso, con representación activa y permisos
--     «organization.contact» y «passport.view» concedidos por el atleta (o su familia si es menor).
--   · El enlace es el mismo que crea el atleta: él y su familia lo ven en su lista y pueden revocarlo.
--     La ficha de un menor oculta apellidos, equipo y ciudad, como siempre.
--   · Nadie escribe la tabla directamente: solo las funciones de abajo.
-- ROLLBACK:
--   drop function if exists public.case_outreach_list(uuid);
--   drop function if exists public.case_outreach_mark(uuid, text, text);
--   drop function if exists public.case_outreach_create(uuid, uuid, text, text, text);
--   drop table if exists public.case_outreach;
--   restaurar guard_recruiting_link desde 20261120000700_delete_behavior.sql
--   restaurar product_events_event_check desde 20261215000100_agency_portfolio_invites.sql
-- =============================================================================

create table public.case_outreach (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.recruiting_cases (id) on delete cascade,
  agency_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid references public.agency_contacts (id) on delete set null,
  to_email text not null check (to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(to_email) <= 254),
  subject text not null check (char_length(btrim(subject)) between 3 and 200),
  body text not null check (char_length(body) between 10 and 5000),
  link_id uuid references public.recruiting_links (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'replied', 'no_reply', 'bounced')),
  sent_at timestamptz,
  replied_at timestamptz,
  note text check (char_length(note) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_outreach_case_idx on public.case_outreach (case_id, created_at desc);
create index case_outreach_agency_idx on public.case_outreach (agency_id, created_at desc);
create index case_outreach_contact_idx on public.case_outreach (contact_id);
create index case_outreach_link_idx on public.case_outreach (link_id);
create index case_outreach_created_by_idx on public.case_outreach (created_by);
alter table public.case_outreach enable row level security;
revoke all on public.case_outreach from anon, authenticated;
grant select on public.case_outreach to authenticated;

-- Lectura: quien ve el proceso. Escritura: ninguna política (solo las funciones security definer).
create policy case_outreach_select on public.case_outreach for select to authenticated
  using (public.case_access_by_id(case_id, false));

-- El enlace del Passport lo puede crear también la función de outreach (para un menor, la familia ya
-- dio su consentimiento al aprobar la representación con permiso de contacto).
create or replace function public.guard_recruiting_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_minor(new.athlete_id) and auth.uid() is not null and not public.is_guardian_of(new.athlete_id)
       and current_setting('gala.outreach_rpc', true) is distinct from 'on' then
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

-- Comprobaciones comunes: proceso escribible, representación activa y permisos del atleta.
create or replace function public.case_outreach_allowed(p_case uuid)
returns public.recruiting_cases language plpgsql stable security definer set search_path = public as $$
declare v_case public.recruiting_cases;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select * into v_case from public.recruiting_cases where id = p_case;
  if not found or not public.case_access_by_id(p_case, true) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not public.agency_has_active_representation(v_case.agency_id, v_case.athlete_id) then
    raise exception 'representation_required' using errcode = 'P0001';
  end if;
  if not (public.agent_can(v_case.athlete_id, 'organization.contact', v_case.sport_id)
          and public.agent_can(v_case.athlete_id, 'passport.view', v_case.sport_id)) then
    raise exception 'contact_permission_required' using errcode = '42501';
  end if;
  return v_case;
end;
$$;
revoke all on function public.case_outreach_allowed(uuid) from public, anon, authenticated;

-- Preparar: crea el enlace privado al Passport y el borrador. Devuelve el token para montar el enlace.
create or replace function public.case_outreach_create(p_case uuid, p_contact uuid, p_email text, p_subject text, p_body text)
returns table (id uuid, token text) language plpgsql security definer set search_path = public as $$
declare
  v_case public.recruiting_cases;
  v_email text;
  v_link uuid; v_token text; v_id uuid;
begin
  v_case := public.case_outreach_allowed(p_case);
  if v_case.stage not in ('approved_to_contact', 'contacted', 'response_received', 'active_conversation',
                          'evaluation_visit', 'academic_review', 'offer_discussion', 'decision_pending') then
    raise exception 'not_approved_to_contact' using errcode = 'P0001';
  end if;
  if p_contact is not null then
    select c.email into v_email from public.agency_contacts c where c.id = p_contact and c.agency_id = v_case.agency_id;
    if not found then raise exception 'contact_not_in_agency' using errcode = 'P0001'; end if;
  end if;
  v_email := lower(btrim(coalesce(nullif(btrim(coalesce(p_email, '')), ''), v_email, '')));
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalid' using errcode = 'P0001'; end if;
  if (select count(*) from public.case_outreach o where o.agency_id = v_case.agency_id and o.created_at > now() - interval '1 day') >= 100 then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  perform set_config('gala.outreach_rpc', 'on', true);
  insert into public.recruiting_links (athlete_id, label, created_by, expires_at)
  values (v_case.athlete_id, left('Coach · ' || v_case.institution_name, 120), auth.uid(), now() + interval '60 days')
  returning recruiting_links.id, recruiting_links.token into v_link, v_token;
  perform set_config('gala.outreach_rpc', '', true);

  insert into public.case_outreach (case_id, agency_id, contact_id, to_email, subject, body, link_id, created_by)
  values (p_case, v_case.agency_id, p_contact, v_email, btrim(p_subject), p_body, v_link, auth.uid())
  returning case_outreach.id into v_id;
  perform public.audit('case_outreach_prepared', 'case_outreach', v_id, v_case.agency_id, '{}'::jsonb, null, 'security', null);
  return query select v_id, v_token;
end;
$$;

-- Registrar lo que pasa con el correo: enviado → respondido / sin respuesta / rebotado.
-- Enviar mueve el proceso de «aprobado para contactar» a «contactado»; una respuesta, a «respuesta recibida».
create or replace function public.case_outreach_mark(p_id uuid, p_status text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_o public.case_outreach;
  v_case public.recruiting_cases;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
begin
  select * into v_o from public.case_outreach where id = p_id;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_case := public.case_outreach_allowed(v_o.case_id);
  if not ((v_o.status = 'draft' and p_status = 'sent')
       or (v_o.status = 'sent' and p_status in ('replied', 'no_reply', 'bounced'))
       or (v_o.status = 'no_reply' and p_status = 'replied')) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.case_outreach set status = p_status, note = coalesce(v_note, note), updated_at = now(),
         sent_at = case when p_status = 'sent' then now() else sent_at end,
         replied_at = case when p_status = 'replied' then now() else replied_at end
   where id = p_id;

  insert into public.recruiting_case_activities (case_id, kind, body, actor_id)
  values (v_o.case_id, case when p_status in ('sent', 'replied') then 'email' else 'note' end,
          left(case p_status
            when 'sent' then 'Email al coach (' || v_o.to_email || '): «' || v_o.subject || '». Con enlace al Passport.'
            when 'replied' then 'El coach (' || v_o.to_email || ') ha respondido.'
            when 'no_reply' then 'Sin respuesta del coach (' || v_o.to_email || ').'
            else 'El email a ' || v_o.to_email || ' ha rebotado.' end
          || coalesce(' ' || v_note, ''), 5000),
          auth.uid());

  if p_status = 'sent' and v_case.stage = 'approved_to_contact' then
    update public.recruiting_cases set stage = 'contacted' where id = v_case.id;
  elsif p_status = 'replied' and v_case.stage in ('approved_to_contact', 'contacted') then
    update public.recruiting_cases set stage = 'response_received' where id = v_case.id;
  end if;
  perform public.audit('case_outreach_' || p_status, 'case_outreach', p_id, v_o.agency_id, '{}'::jsonb, null, 'security', null);
  return p_status;
end;
$$;

-- Lista para la ficha del proceso, con las aperturas del enlace (la agencia no lee recruiting_link_views).
create or replace function public.case_outreach_list(p_case uuid)
returns table (id uuid, to_email text, subject text, status text, sent_at timestamptz, replied_at timestamptz,
               note text, created_at timestamptz, views int, last_viewed_at timestamptz, link_active boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.to_email, o.subject, o.status, o.sent_at, o.replied_at, o.note, o.created_at,
         coalesce((select count(*)::int from public.recruiting_link_views v where v.link_id = o.link_id), 0),
         (select max(v.viewed_at) from public.recruiting_link_views v where v.link_id = o.link_id),
         coalesce((select l.revoked_at is null and l.expires_at > now() from public.recruiting_links l where l.id = o.link_id), false)
    from public.case_outreach o
   where o.case_id = p_case and public.case_access_by_id(p_case, false)
   order by o.created_at desc
   limit 100;
$$;

revoke all on function public.case_outreach_create(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.case_outreach_mark(uuid, text, text) from public, anon;
revoke all on function public.case_outreach_list(uuid) from public, anon;
grant execute on function public.case_outreach_create(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.case_outreach_mark(uuid, text, text) to authenticated;
grant execute on function public.case_outreach_list(uuid) to authenticated;

alter table public.product_events drop constraint if exists product_events_event_check;
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
  'trial_mobile_viewed', 'trial_invitation_opened', 'trial_consent_reviewed', 'trial_consent_approved', 'mobile_discovery_search', 'scout_note_added',
  -- 12-16
  'representation_requested', 'representation_accepted', 'representation_revoked', 'agency_invited',
  'brand_offer_sent', 'brand_offer_accepted', 'deliverable_submitted', 'collaborations_viewed',
  'trust_center_viewed', 'support_case_opened', 'subscription_started', 'billing_viewed',
  'agent_home_viewed', 'agent_attention_opened',
  -- Ciclo 1 · importar cartera e invitar a reclamarla
  'athlete_invited', 'invite_opened', 'athlete_claimed',
  -- Ciclo 2 · escribir a coaches y saber quién responde
  'coach_outreach_sent', 'coach_reply_logged'));
