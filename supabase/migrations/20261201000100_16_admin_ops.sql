-- =============================================================================================================
-- Prompt 16 · Operaciones de administración. Gala Admin no es un actor del marketplace: opera, no curiosea.
-- REUSE: roles internos (14), colas de verificación, T&S, break glass, audit_logs, conflictos de representación (12A).
-- NEW: feature flags e interruptores de emergencia, búsqueda global minimizada, soporte con casos y notas,
-- concesiones manuales de plan con doble aprobación, cola de conflictos de representación y estado de los jobs.
-- =============================================================================================================

-- 1. Feature flags / kill switches. No sustituyen permisos: solo apagan o encienden una funcionalidad entera.
create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,60}$'),
  enabled boolean not null default true,
  description text not null check (char_length(description) between 5 and 300),
  kill_switch boolean not null default false,   -- true = apagar es una medida de seguridad
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists feature_flags_updated_by on public.feature_flags (updated_by);
alter table public.feature_flags enable row level security;
create policy feature_flags_read on public.feature_flags for select to anon, authenticated using (true);
grant select on public.feature_flags to anon, authenticated;

insert into public.feature_flags (key, enabled, description, kill_switch) values
  ('contact_requests', true, 'Organizaciones pueden pedir contacto a atletas', true),
  ('brand_offers', true, 'Marcas pueden enviar ofertas comerciales', true),
  ('representation_requests', true, 'Agencias pueden proponer representaciones', true),
  ('gala_ai', true, 'Asistente Gala IA', true),
  ('messaging', true, 'Mensajes entre organizaciones y atletas', true)
on conflict (key) do nothing;

create or replace function public.flag_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.feature_flags where key = p_key), true);
$$;
grant execute on function public.flag_enabled(text) to anon, authenticated;

create or replace function public.flag_set(p_key text, p_enabled boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('super_admin') then raise exception 'admin_only' using errcode = '42501'; end if;
  if char_length(coalesce(btrim(p_reason), '')) < 10 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  update public.feature_flags set enabled = p_enabled, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.audit(case when p_enabled then 'flag_enabled' else 'flag_disabled' end, 'feature_flag', null, null,
                       jsonb_build_object('key', p_key), p_reason, 'security', null);
end;
$$;
revoke execute on function public.flag_set(text, boolean, text) from public, anon;
grant execute on function public.flag_set(text, boolean, text) to authenticated;

-- Los interruptores se aplican en la base de datos, donde ocurre la acción.
create or replace function public.enforce_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.flag_enabled(tg_argv[0]) and current_user in ('authenticated', 'anon') then
    raise exception 'feature_disabled' using errcode = 'P0001', hint = tg_argv[0];
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_flag() from public, anon, authenticated;
drop trigger if exists enforce_flag on public.contact_requests;
create trigger enforce_flag before insert on public.contact_requests for each row execute function public.enforce_flag('contact_requests');
drop trigger if exists enforce_flag on public.contact_messages;
create trigger enforce_flag before insert on public.contact_messages for each row execute function public.enforce_flag('messaging');
-- Ofertas y representaciones se crean dentro de funciones (definer): se comprueba con auth.uid().
create or replace function public.enforce_flag_rpc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.flag_enabled(tg_argv[0]) and auth.uid() is not null then
    raise exception 'feature_disabled' using errcode = 'P0001', hint = tg_argv[0];
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_flag_rpc() from public, anon, authenticated;
drop trigger if exists enforce_flag on public.campaign_offers;
create trigger enforce_flag before insert on public.campaign_offers for each row execute function public.enforce_flag_rpc('brand_offers');
drop trigger if exists enforce_flag on public.agent_representations;
create trigger enforce_flag before insert on public.agent_representations for each row execute function public.enforce_flag_rpc('representation_requests');

-- 2. Búsqueda global minimizada: lo justo para encontrar, nunca datos sensibles. Cada búsqueda queda auditada.
create or replace function public.admin_search(p_query text)
returns table (kind text, id uuid, label text, detail text)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not (public.has_admin_role('support') or public.has_admin_role('trust_safety') or public.has_admin_role('verification_reviewer')) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if char_length(coalesce(btrim(p_query), '')) < 3 then raise exception 'query_too_short' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, entity, details, classification)
  values (auth.uid(), 'admin_search', 'search', jsonb_build_object('query', left(p_query, 60)), 'security');
  return query
    select 'user'::text, p.id, coalesce(p.display_name, 'Usuario'),
           (select string_agg(r.role::text, ', ') from public.user_roles r where r.user_id = p.id)
      from public.profiles p where p.display_name ilike '%' || p_query || '%' limit 20;
  return query
    select 'organization'::text, o.id, o.name, o.type::text || ' · ' || o.verification_status::text || ' · ' || o.org_status
      from public.organizations o where o.name ilike '%' || p_query || '%' limit 20;
end;
$$;
revoke execute on function public.admin_search(text) from public, anon;
grant execute on function public.admin_search(text) to authenticated;

-- 3. Soporte: casos con estado y notas internas; nunca acceso por contraseña ni suplantación.
create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 200),
  body text not null check (char_length(body) between 10 and 4000),
  category text not null default 'other' check (category in ('account', 'verification', 'billing', 'safety', 'bug', 'data', 'other')),
  status text not null default 'open' check (status in ('open', 'waiting_user', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_cases_requester on public.support_cases (requester_id);
create index if not exists support_cases_org on public.support_cases (organization_id);
create index if not exists support_cases_assigned on public.support_cases (assigned_to);
create index if not exists support_cases_status on public.support_cases (status, created_at);

create table if not exists public.support_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  internal boolean not null default true,   -- interna: solo Gala; pública: la ve quien abrió el caso
  created_at timestamptz not null default now()
);
create index if not exists support_case_notes_case on public.support_case_notes (case_id);
create index if not exists support_case_notes_author on public.support_case_notes (author_id);

alter table public.support_cases enable row level security;
alter table public.support_case_notes enable row level security;
create policy support_cases_select on public.support_cases for select to authenticated
  using (requester_id = (select auth.uid()) or public.has_admin_role('support'));
create policy support_cases_insert on public.support_cases for insert to authenticated
  with check (requester_id = (select auth.uid()) and (organization_id is null or public.is_org_member(organization_id)));
create policy support_notes_select on public.support_case_notes for select to authenticated
  using (public.has_admin_role('support')
         or (not internal and exists (select 1 from public.support_cases c where c.id = case_id and c.requester_id = (select auth.uid()))));
grant select, insert on public.support_cases to authenticated;
grant select on public.support_case_notes to authenticated;

create or replace function public.guard_support_case()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and tg_op = 'INSERT' then
    new.status := 'open'; new.assigned_to := null; new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_support_case on public.support_cases;
create trigger guard_support_case before insert or update on public.support_cases for each row execute function public.guard_support_case();
revoke execute on function public.guard_support_case() from public, anon, authenticated;

create or replace function public.support_case_update(p_case uuid, p_status text, p_note text default null, p_public boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare c public.support_cases;
begin
  if not public.has_admin_role('support') then raise exception 'admin_only' using errcode = '42501'; end if;
  select * into c from public.support_cases where id = p_case for update;
  if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.support_cases set status = coalesce(p_status, status), assigned_to = coalesce(assigned_to, auth.uid()) where id = p_case;
  if p_note is not null and btrim(p_note) <> '' then
    insert into public.support_case_notes (case_id, author_id, body, internal) values (p_case, auth.uid(), p_note, not coalesce(p_public, false));
  end if;
  if coalesce(p_public, false) and c.requester_id is not null then
    perform public.notify(c.requester_id, 'support.reply', 'Respuesta del equipo de Gala', left(coalesce(p_note, 'Hemos actualizado tu caso.'), 200), '/app/support');
  end if;
  perform public.audit('support_case_updated', 'support_case', p_case, c.organization_id, jsonb_build_object('status', p_status), null, 'normal', null);
end;
$$;
revoke execute on function public.support_case_update(uuid, text, text, boolean) from public, anon;
grant execute on function public.support_case_update(uuid, text, text, boolean) to authenticated;

-- 4. Doble aprobación (four eyes) solo para lo muy sensible: concesiones manuales de plan y borrado de organizaciones.
create table if not exists public.admin_approvals (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('entitlement_grant', 'organization_delete')),
  payload jsonb not null,
  reason text not null check (char_length(reason) between 10 and 2000),
  requested_by uuid not null references auth.users (id) on delete cascade,
  approved_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default now() + interval '72 hours'
);
create index if not exists admin_approvals_requested_by on public.admin_approvals (requested_by);
create index if not exists admin_approvals_approved_by on public.admin_approvals (approved_by);
alter table public.admin_approvals enable row level security;
create policy admin_approvals_select on public.admin_approvals for select to authenticated
  using (public.has_admin_role('finance') or public.has_admin_role('super_admin'));
grant select on public.admin_approvals to authenticated;

create or replace function public.admin_request(p_action text, p_payload jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not ((p_action = 'entitlement_grant' and public.has_admin_role('finance')) or public.has_admin_role('super_admin')) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_action = 'entitlement_grant' and (p_payload->>'user_id' is null or not exists (select 1 from public.plan_catalog where code = p_payload->>'plan_code')) then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;
  if p_action = 'organization_delete' and not exists (select 1 from public.organizations where id = (p_payload->>'organization_id')::uuid) then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;
  insert into public.admin_approvals (action, payload, reason, requested_by) values (p_action, p_payload, p_reason, auth.uid()) returning id into v_id;
  perform public.audit('admin_approval_requested', 'admin_approval', v_id, null, jsonb_build_object('action', p_action), p_reason, 'security', null);
  return v_id;
end;
$$;

create or replace function public.admin_approve(p_approval uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare a public.admin_approvals;
begin
  select * into a from public.admin_approvals where id = p_approval for update;
  if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.status <> 'pending' then return a.status; end if;
  if a.requested_by = auth.uid() then raise exception 'second_approver_required' using errcode = '42501'; end if;
  if not ((a.action = 'entitlement_grant' and public.has_admin_role('finance')) or public.has_admin_role('super_admin')) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if a.expires_at <= now() then
    update public.admin_approvals set status = 'expired', decided_at = now() where id = p_approval;
    return 'expired';
  end if;
  update public.admin_approvals set status = case when p_approve then 'approved' else 'rejected' end, approved_by = auth.uid(), decided_at = now() where id = p_approval;
  if p_approve and a.action = 'entitlement_grant' then
    insert into public.entitlements (user_id, plan_code, source, reference)
    values ((a.payload->>'user_id')::uuid, a.payload->>'plan_code', 'admin', 'approval:' || a.id) on conflict do nothing;
  elsif p_approve and a.action = 'organization_delete' then
    delete from public.organizations where id = (a.payload->>'organization_id')::uuid;
  end if;
  perform public.audit(case when p_approve then 'admin_approval_executed' else 'admin_approval_rejected' end, 'admin_approval', p_approval, null,
                       jsonb_build_object('action', a.action), a.reason, 'security', null);
  return case when p_approve then 'approved' else 'rejected' end;
end;
$$;
do $$
declare f text;
begin
  foreach f in array array['admin_request(text, jsonb, text)', 'admin_approve(uuid, boolean)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 5. Cola de conflictos de representación (12A): todo lo necesario para decidir, sin decidir la validez contractual.
create or replace view public.admin_representation_conflicts with (security_invoker = true) as
select c.id, c.status, c.detected_at, c.resolution,
       a.id as representation_a, a.agency_id as agency_a, a.status as status_a, a.representation_type as type_a, a.start_date as start_a, a.end_date as end_a,
       b.id as representation_b, b.agency_id as agency_b, b.status as status_b, b.representation_type as type_b, b.start_date as start_b, b.end_date as end_b,
       a.athlete_id
  from public.representation_conflicts c
  join public.agent_representations a on a.id = c.representation_id
  join public.agent_representations b on b.id = c.conflicting_id;
grant select on public.admin_representation_conflicts to authenticated;

-- 6. Estado de los jobs programados (pg_cron si existe): sin él, se dice.
create or replace function public.admin_jobs()
returns table (jobname text, schedule text, last_status text, last_run timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return; end if;
  return query execute $q$
    select j.jobname::text, j.schedule::text,
           (select d.status::text from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
           (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1)
      from cron.job j order by j.jobname $q$;
end;
$$;
revoke execute on function public.admin_jobs() from public, anon;
grant execute on function public.admin_jobs() to authenticated;

/* ROLLBACK: drop triggers enforce_flag (contact_requests, contact_messages, campaign_offers, agent_representations),
   tablas feature_flags, support_case_notes, support_cases, admin_approvals, la vista admin_representation_conflicts
   y las funciones nuevas. */

-- 7. Un admin ya no concede planes escribiendo en la tabla: solo por doble aprobación (o el webhook de Stripe).
drop policy if exists entitlements_admin on public.entitlements;
create policy entitlements_admin_read on public.entitlements for select to authenticated using (public.has_admin_role('finance'));
-- Revocar un plan (reembolso manual) sí es directo para Finanzas, y queda en la auditoría del webhook/admin.
create policy entitlements_finance_revoke on public.entitlements for update to authenticated
  using (public.has_admin_role('finance')) with check (public.has_admin_role('finance'));
