-- =============================================================================================================
-- Prompt 14 · Trust & Safety. Lo que ya existía se reutiliza:
--   - denuncias (content_reports + auto_protect_on_report)
--   - bloqueos (user_blocks y bloqueos de organización)
--   - auditoría inmutable (audit_immutable)
--   - consentimientos centrales y verificación central
--   - transición a la mayoría de edad (family_link_lapsed)
--   - exportación y borrado RGPD.
-- NUEVO:
--   - casos de seguridad con su línea de tiempo
--   - acciones de moderación proporcionales (restricciones por ámbito, con duración)
--   - apelaciones
--   - roles internos de Gala con mínimo privilegio
--   - acceso de emergencia («break glass») caducable y auditado
--   - límites de frecuencia anti-spam en la base de datos
-- =============================================================================================================

-- 1. Roles internos de Gala (mínimo privilegio). Un admin sin filas aquí conserva el comportamiento anterior
--    (super admin), para no romper nada; en cuanto se le asigna un rol, solo tiene ese.
create table if not exists public.admin_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('support', 'verification_reviewer', 'trust_safety', 'finance', 'super_admin')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index if not exists admin_roles_granted_by on public.admin_roles (granted_by);
alter table public.admin_roles enable row level security;
create policy admin_roles_select on public.admin_roles for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

create or replace function public.has_admin_role(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and (
    not exists (select 1 from public.admin_roles where user_id = auth.uid())
    or exists (select 1 from public.admin_roles where user_id = auth.uid() and role in (p_role, 'super_admin')));
$$;

-- 2. Casos de seguridad: un caso agrupa denuncias, personas, organizaciones, pruebas, acciones y su historia.
create table if not exists public.safety_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  category text not null check (category in ('minor', 'fraud', 'payment', 'organization', 'messaging', 'impersonation', 'privacy', 'other')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'investigating', 'actioned', 'closed')),
  subject_user uuid references auth.users (id) on delete set null,
  subject_org uuid references public.organizations (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists safety_cases_status on public.safety_cases (status, priority);
create index if not exists safety_cases_subject_user on public.safety_cases (subject_user);
create index if not exists safety_cases_subject_org on public.safety_cases (subject_org);
create index if not exists safety_cases_assigned on public.safety_cases (assigned_to);
create index if not exists safety_cases_created_by on public.safety_cases (created_by);

alter table public.content_reports add column if not exists case_id uuid references public.safety_cases (id) on delete set null;
create index if not exists content_reports_case on public.content_reports (case_id);

create table if not exists public.safety_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.safety_cases (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('note', 'evidence', 'report_linked', 'action', 'status', 'appeal')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists safety_case_events_case on public.safety_case_events (case_id);
create index if not exists safety_case_events_actor on public.safety_case_events (actor_id);

-- 3. Acciones de moderación: proporcionales, con ámbito, motivo, duración y reversión registrada.
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.safety_cases (id) on delete set null,
  report_id uuid references public.content_reports (id) on delete set null,
  subject_user uuid references auth.users (id) on delete cascade,
  subject_org uuid references public.organizations (id) on delete cascade,
  action text not null check (action in ('no_action', 'warning', 'content_removed', 'opportunity_paused', 'user_restricted',
                                         'organization_restricted', 'suspended', 'verification_revoked', 'escalate')),
  scopes text[] not null default '{}',
  reason text not null check (char_length(reason) between 10 and 2000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users (id) on delete set null,
  revert_reason text check (char_length(revert_reason) <= 2000),
  constraint moderation_subject check (subject_user is not null or subject_org is not null),
  constraint moderation_scopes check (scopes <@ array['contact', 'messaging', 'discovery', 'publishing', 'offers', 'representation', 'applications']::text[]),
  constraint moderation_restriction_scoped check (action not in ('user_restricted', 'organization_restricted') or cardinality(scopes) > 0),
  constraint moderation_dates check (ends_at is null or ends_at > starts_at)
);
create index if not exists moderation_actions_user on public.moderation_actions (subject_user);
create index if not exists moderation_actions_org on public.moderation_actions (subject_org);
create index if not exists moderation_actions_case on public.moderation_actions (case_id);
create index if not exists moderation_actions_report on public.moderation_actions (report_id);
create index if not exists moderation_actions_created_by on public.moderation_actions (created_by);
create index if not exists moderation_actions_reverted_by on public.moderation_actions (reverted_by);

-- ¿Está restringido este usuario (o su organización) para este ámbito ahora mismo?
create or replace function public.is_restricted(p_user uuid, p_org uuid, p_scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.moderation_actions a
     where a.reverted_at is null and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
       and ((p_user is not null and a.subject_user = p_user) or (p_org is not null and a.subject_org = p_org))
       and (a.action = 'suspended' or (a.action in ('user_restricted', 'organization_restricted') and p_scope = any (a.scopes))));
$$;
revoke execute on function public.is_restricted(uuid, uuid, text) from public, anon;
grant execute on function public.is_restricted(uuid, uuid, text) to authenticated;

-- 4. Apelaciones: entran en la cola de revisión; no es un sistema jurídico.
create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.moderation_actions (id) on delete cascade,
  appellant_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 20 and 4000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_reason text check (char_length(decision_reason) <= 2000),
  created_at timestamptz not null default now()
);
create unique index if not exists moderation_appeals_open on public.moderation_appeals (action_id) where status = 'open';
create index if not exists moderation_appeals_appellant on public.moderation_appeals (appellant_id);
create index if not exists moderation_appeals_decided_by on public.moderation_appeals (decided_by);

-- 5. Acceso de emergencia: motivo, caducidad corta (máx. 4 h), auditado y revisado después. Nunca para el día a día.
create table if not exists public.break_glass_grants (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  subject_user uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 20 and 2000),
  case_id uuid references public.safety_cases (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  constraint break_glass_short check (expires_at <= created_at + interval '4 hours')
);
create index if not exists break_glass_admin on public.break_glass_grants (admin_id);
create index if not exists break_glass_subject on public.break_glass_grants (subject_user);
create index if not exists break_glass_case on public.break_glass_grants (case_id);
create index if not exists break_glass_reviewed_by on public.break_glass_grants (reviewed_by);

create or replace function public.has_break_glass(p_subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (select 1 from public.break_glass_grants g
                                         where g.admin_id = auth.uid() and g.subject_user = p_subject and g.expires_at > now());
$$;
revoke execute on function public.has_break_glass(uuid) from public, anon;
grant execute on function public.has_break_glass(uuid) to authenticated;

-- 6. Límites de frecuencia (anti-spam / anti-scraping) aplicados en la base de datos, no solo en la interfaz.
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup on public.rate_limit_events (user_id, bucket, created_at desc);
alter table public.rate_limit_events enable row level security;  -- sin policies: nadie la lee desde la API

create or replace function public.rate_limit_hit(p_bucket text, p_max integer, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); n integer;
begin
  if v_uid is null or public.is_admin() then return; end if;
  perform pg_advisory_xact_lock(hashtext('rl:' || v_uid::text || ':' || p_bucket));
  select count(*) into n from public.rate_limit_events where user_id = v_uid and bucket = p_bucket and created_at > now() - p_window;
  if n >= p_max then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Has alcanzado el límite. Inténtalo más tarde.';
  end if;
  insert into public.rate_limit_events (user_id, bucket) values (v_uid, p_bucket);
end;
$$;
revoke execute on function public.rate_limit_hit(text, integer, interval) from public, anon, authenticated;

-- Limpieza: solo hace falta la última semana.
create or replace function public.rate_limit_prune()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.rate_limit_events where created_at < now() - interval '7 days' returning 1) select count(*)::int from d;
$$;
revoke execute on function public.rate_limit_prune() from public, anon, authenticated;

-- 7. Aplicación de restricciones y límites donde ocurre el riesgo (triggers: valen también dentro de las funciones).
create or replace function public.enforce_safety()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_org uuid; v_scope text := tg_argv[0]; v_max integer := tg_argv[1]::integer; v_window interval := tg_argv[2]::interval;
begin
  case tg_table_name
    when 'contact_requests' then v_user := new.requested_by; v_org := new.organization_id;
    when 'contact_messages' then v_user := new.sender_id; v_org := null;
    when 'agent_representations' then v_user := new.agent_id; v_org := new.agency_id;
    when 'campaign_offers' then v_user := new.sent_by; v_org := new.brand_org_id;
    when 'campaign_applications' then v_user := new.athlete_id; v_org := null;
    when 'opportunities' then v_user := null; v_org := new.organization_id;
    else return new;
  end case;
  if public.is_restricted(v_user, v_org, v_scope) then
    raise exception 'account_restricted' using errcode = '42501', hint = v_scope;
  end if;
  if v_max > 0 then perform public.rate_limit_hit(tg_table_name, v_max, v_window); end if;
  return new;
end;
$$;
revoke execute on function public.enforce_safety() from public, anon, authenticated;

drop trigger if exists enforce_safety on public.contact_requests;
create trigger enforce_safety before insert on public.contact_requests for each row execute function public.enforce_safety('contact', '20', '1 day');
drop trigger if exists enforce_safety on public.contact_messages;
create trigger enforce_safety before insert on public.contact_messages for each row execute function public.enforce_safety('messaging', '120', '1 hour');
drop trigger if exists enforce_safety on public.agent_representations;
create trigger enforce_safety before insert on public.agent_representations for each row execute function public.enforce_safety('representation', '60', '1 day');
drop trigger if exists enforce_safety on public.campaign_offers;
create trigger enforce_safety before insert on public.campaign_offers for each row execute function public.enforce_safety('offers', '50', '1 day');
drop trigger if exists enforce_safety on public.campaign_applications;
create trigger enforce_safety before insert on public.campaign_applications for each row execute function public.enforce_safety('applications', '30', '1 day');
-- Publicar oportunidades: solo restricción (sin límite de frecuencia).
create or replace function public.enforce_publishing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('published', 'pending_review') and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and public.is_restricted(null, new.organization_id, 'publishing') then
    raise exception 'account_restricted' using errcode = '42501', hint = 'publishing';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_publishing() from public, anon, authenticated;
drop trigger if exists enforce_publishing on public.opportunities;
create trigger enforce_publishing before insert or update of status on public.opportunities for each row execute function public.enforce_publishing();

-- Denuncias: límite para evitar abuso del sistema de denuncias.
create or replace function public.limit_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.rate_limit_hit('content_reports', 20, interval '1 day');
  return new;
end;
$$;
revoke execute on function public.limit_reports() from public, anon, authenticated;
drop trigger if exists limit_reports on public.content_reports;
create trigger limit_reports before insert on public.content_reports for each row execute function public.limit_reports();

-- 8. RLS: todo lo de moderación es interno de Gala; la persona afectada ve sus propias acciones y apelaciones.
alter table public.safety_cases enable row level security;
alter table public.safety_case_events enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.moderation_appeals enable row level security;
alter table public.break_glass_grants enable row level security;

create policy safety_cases_select on public.safety_cases for select to authenticated using (public.has_admin_role('trust_safety'));
create policy safety_case_events_select on public.safety_case_events for select to authenticated using (public.has_admin_role('trust_safety'));
create policy moderation_actions_select on public.moderation_actions for select to authenticated
  using (public.has_admin_role('trust_safety') or subject_user = (select auth.uid())
         or (subject_org is not null and public.is_org_member(subject_org, true)));
create policy moderation_appeals_select on public.moderation_appeals for select to authenticated
  using (appellant_id = (select auth.uid()) or public.has_admin_role('trust_safety'));
create policy break_glass_select on public.break_glass_grants for select to authenticated
  using (admin_id = (select auth.uid()) or public.has_admin_role('super_admin'));
grant select on public.safety_cases, public.safety_case_events, public.moderation_actions, public.moderation_appeals, public.break_glass_grants, public.admin_roles to authenticated;

-- 9. Funciones de moderación (todo cambio pasa por aquí y queda auditado).
create or replace function public.safety_case_open(p_title text, p_category text, p_priority text, p_subject_user uuid default null,
                                                   p_subject_org uuid default null, p_reports uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_admin_role('trust_safety') then raise exception 'admin_only' using errcode = '42501'; end if;
  insert into public.safety_cases (title, category, priority, subject_user, subject_org, created_by, assigned_to)
  values (p_title, p_category, p_priority, p_subject_user, p_subject_org, auth.uid(), auth.uid()) returning id into v_id;
  update public.content_reports set case_id = v_id, status = case when status = 'open' then 'reviewing' else status end where id = any (coalesce(p_reports, '{}'));
  insert into public.safety_case_events (case_id, actor_id, kind, body) values (v_id, auth.uid(), 'status', 'Caso abierto');
  if coalesce(cardinality(p_reports), 0) > 0 then
    insert into public.safety_case_events (case_id, actor_id, kind, body) values (v_id, auth.uid(), 'report_linked', cardinality(p_reports) || ' denuncia(s) vinculadas');
  end if;
  perform public.audit('safety_case_opened', 'safety_case', v_id, p_subject_org, jsonb_build_object('category', p_category, 'priority', p_priority), null, 'security', null);
  return v_id;
end;
$$;

create or replace function public.safety_case_note(p_case uuid, p_kind text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('trust_safety') then raise exception 'admin_only' using errcode = '42501'; end if;
  if p_kind not in ('note', 'evidence') then raise exception 'invalid_kind' using errcode = 'P0001'; end if;
  insert into public.safety_case_events (case_id, actor_id, kind, body) values (p_case, auth.uid(), p_kind, p_body);
end;
$$;

create or replace function public.safety_case_set_status(p_case uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('trust_safety') then raise exception 'admin_only' using errcode = '42501'; end if;
  update public.safety_cases set status = p_status, closed_at = case when p_status = 'closed' then now() end where id = p_case;
  insert into public.safety_case_events (case_id, actor_id, kind, body) values (p_case, auth.uid(), 'status', 'Estado: ' || p_status);
  perform public.audit('safety_case_' || p_status, 'safety_case', p_case, null, '{}'::jsonb, null, 'security', null);
end;
$$;

create or replace function public.moderation_act(p_action text, p_reason text, p_subject_user uuid default null, p_subject_org uuid default null,
                                                 p_scopes text[] default '{}', p_days integer default null, p_case uuid default null, p_report uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_admin_role('trust_safety') then raise exception 'admin_only' using errcode = '42501'; end if;
  if p_subject_user = auth.uid() then raise exception 'cannot_moderate_self' using errcode = '42501'; end if;
  if p_days is not null and p_days not between 1 and 3650 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  insert into public.moderation_actions (case_id, report_id, subject_user, subject_org, action, scopes, reason, ends_at, created_by)
  values (p_case, p_report, p_subject_user, p_subject_org, p_action, coalesce(p_scopes, '{}'), p_reason,
          case when p_days is null then null else now() + make_interval(days => p_days) end, auth.uid())
  returning id into v_id;
  -- Efectos directos de algunas acciones
  if p_action = 'suspended' and p_subject_org is not null then update public.organizations set org_status = 'suspended' where id = p_subject_org; end if;
  if p_action = 'verification_revoked' and p_subject_org is not null then update public.organizations set verification_status = 'unverified' where id = p_subject_org; end if;
  if p_report is not null then
    update public.content_reports set status = case when p_action = 'no_action' then 'dismissed' else 'actioned' end, decided_by = auth.uid(), decided_at = now(),
           decision_reason = left(p_reason, 2000) where id = p_report;
  end if;
  if p_case is not null then
    insert into public.safety_case_events (case_id, actor_id, kind, body) values (p_case, auth.uid(), 'action', p_action || ': ' || left(p_reason, 500));
    update public.safety_cases set status = 'actioned' where id = p_case and status in ('open', 'investigating');
  end if;
  if p_subject_user is not null and p_action not in ('no_action', 'escalate') then
    perform public.notify(p_subject_user, 'moderation.action', 'Aviso del equipo de seguridad de Gala',
            'Hemos tomado una medida sobre tu cuenta. Entra para ver el motivo y, si no estás de acuerdo, apelar.', '/app/trust');
  end if;
  if p_subject_org is not null and p_action not in ('no_action', 'escalate') then
    perform public.notify(m.user_id, 'moderation.action', 'Aviso del equipo de seguridad de Gala',
            'Hemos tomado una medida sobre vuestra organización. Entra para ver el motivo y apelar.', '/app/trust')
       from public.organization_members m where m.organization_id = p_subject_org and m.member_role::text in ('owner', 'admin');
  end if;
  perform public.audit('moderation_' || p_action, 'moderation_action', v_id, p_subject_org,
                       jsonb_build_object('user', p_subject_user, 'scopes', p_scopes, 'days', p_days), p_reason, 'security', null);
  return v_id;
end;
$$;

create or replace function public.moderation_revert(p_action uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.moderation_actions;
begin
  if not public.has_admin_role('trust_safety') then raise exception 'admin_only' using errcode = '42501'; end if;
  select * into a from public.moderation_actions where id = p_action for update;
  if a.id is null or a.reverted_at is not null then return; end if;
  update public.moderation_actions set reverted_at = now(), reverted_by = auth.uid(), revert_reason = left(p_reason, 2000) where id = p_action;
  if a.action = 'suspended' and a.subject_org is not null then update public.organizations set org_status = 'active' where id = a.subject_org and org_status = 'suspended'; end if;
  perform public.audit('moderation_reverted', 'moderation_action', p_action, a.subject_org, '{}'::jsonb, p_reason, 'security', null);
end;
$$;

-- Apelar: la persona afectada (o quien dirige la organización afectada). Una apelación abierta por acción.
create or replace function public.moderation_appeal(p_action uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.moderation_actions; v_id uuid;
begin
  select * into a from public.moderation_actions where id = p_action;
  if a.id is null or not (a.subject_user = auth.uid() or (a.subject_org is not null and public.is_org_member(a.subject_org, true))) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.action in ('no_action', 'escalate') or a.reverted_at is not null then raise exception 'nothing_to_appeal' using errcode = 'P0001'; end if;
  select id into v_id from public.moderation_appeals where action_id = p_action and status = 'open';
  if v_id is not null then return v_id; end if;
  insert into public.moderation_appeals (action_id, appellant_id, body) values (p_action, auth.uid(), p_body) returning id into v_id;
  if a.case_id is not null then
    insert into public.safety_case_events (case_id, actor_id, kind, body) values (a.case_id, auth.uid(), 'appeal', 'Apelación recibida');
    update public.safety_cases set status = 'investigating' where id = a.case_id;
  end if;
  perform public.audit('moderation_appealed', 'moderation_action', p_action, a.subject_org, '{}'::jsonb, null, 'security', null);
  return v_id;
end;
$$;

create or replace function public.moderation_appeal_decide(p_appeal uuid, p_overturn boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare ap public.moderation_appeals;
begin
  if not public.has_admin_role('trust_safety') then raise exception 'admin_only' using errcode = '42501'; end if;
  select * into ap from public.moderation_appeals where id = p_appeal for update;
  if ap.id is null or ap.status <> 'open' then return; end if;
  if exists (select 1 from public.moderation_actions where id = ap.action_id and created_by = auth.uid())
     and exists (select 1 from public.user_roles where role = 'admin' and user_id <> auth.uid()) then
    raise exception 'second_reviewer_required' using errcode = '42501';  -- quien sancionó no revisa su propia sanción
  end if;
  update public.moderation_appeals set status = case when p_overturn then 'overturned' else 'upheld' end, decided_by = auth.uid(), decided_at = now(),
         decision_reason = left(p_reason, 2000) where id = p_appeal;
  if p_overturn then perform public.moderation_revert(ap.action_id, 'Apelación estimada: ' || coalesce(p_reason, '')); end if;
  perform public.notify(ap.appellant_id, 'moderation.appeal', 'Respuesta a tu apelación',
          case when p_overturn then 'Hemos revisado tu apelación y retirado la medida.' else 'Hemos revisado tu apelación y la medida se mantiene.' end, '/app/trust');
  perform public.audit('moderation_appeal_' || case when p_overturn then 'overturned' else 'upheld' end, 'moderation_appeal', p_appeal, null, '{}'::jsonb, p_reason, 'security', null);
end;
$$;

create or replace function public.break_glass_open(p_subject uuid, p_reason text, p_hours integer default 1, p_case uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (public.has_admin_role('trust_safety') or public.has_admin_role('super_admin')) then raise exception 'admin_only' using errcode = '42501'; end if;
  if coalesce(p_hours, 0) not between 1 and 4 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  insert into public.break_glass_grants (admin_id, subject_user, reason, case_id, expires_at)
  values (auth.uid(), p_subject, p_reason, p_case, now() + make_interval(hours => p_hours)) returning id into v_id;
  perform public.audit('break_glass_opened', 'break_glass', v_id, null, jsonb_build_object('subject', p_subject, 'hours', p_hours), p_reason, 'security', null);
  return v_id;
end;
$$;

create or replace function public.break_glass_review(p_grant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('super_admin') then raise exception 'admin_only' using errcode = '42501'; end if;
  if exists (select 1 from public.break_glass_grants where id = p_grant and admin_id = auth.uid()) then
    raise exception 'second_reviewer_required' using errcode = '42501';
  end if;
  update public.break_glass_grants set reviewed_by = auth.uid(), reviewed_at = now() where id = p_grant and reviewed_at is null;
  perform public.audit('break_glass_reviewed', 'break_glass', p_grant, null, '{}'::jsonb, null, 'security', null);
end;
$$;

-- Con acceso de emergencia vigente, el admin ve los documentos de ESA persona (y queda auditado al abrirlos).
drop policy if exists docs_select_break_glass on public.athlete_documents;
create policy docs_select_break_glass on public.athlete_documents for select to authenticated using (public.has_break_glass(athlete_id));

do $$
declare f text;
begin
  foreach f in array array['has_admin_role(text)',
    'safety_case_open(text, text, text, uuid, uuid, uuid[])', 'safety_case_note(uuid, text, text)', 'safety_case_set_status(uuid, text)',
    'moderation_act(text, text, uuid, uuid, text[], integer, uuid, uuid)', 'moderation_revert(uuid, text)',
    'moderation_appeal(uuid, text)', 'moderation_appeal_decide(uuid, boolean, text)',
    'break_glass_open(uuid, text, integer, uuid)', 'break_glass_review(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prune-rate-limits', '50 3 * * *', 'select public.rate_limit_prune()');
  end if;
exception when others then null;
end $$;

/* ROLLBACK: drop de los triggers enforce_safety/enforce_publishing/limit_reports, de las tablas nuevas
   (break_glass_grants, moderation_appeals, moderation_actions, safety_case_events, safety_cases, rate_limit_events, admin_roles),
   de la columna content_reports.case_id, de la policy docs_select_break_glass y de las funciones nuevas. */
