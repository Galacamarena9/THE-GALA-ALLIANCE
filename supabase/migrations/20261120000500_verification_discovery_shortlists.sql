-- =============================================================================
-- PROMPT 7B · MODELO DE DATOS: verificación, Athlete Discovery y shortlists. Solo aditiva.
-- Evoluciona lo que ya existía (organizations, organization_members, institution_claims, org_shortlists…)
-- en lugar de crear sistemas paralelos. Documentación y diagrama: docs/DATA_MODEL_7B.md.
--
-- Decisiones clave:
--   · Membresía ACTIVA = fila en organization_members (todas las políticas ya dependen de ello).
--     Cualquier otro estado (suspendida, revocada, abandonada) vive en organization_membership_records:
--     al suspender o revocar, el acceso desaparece al instante y la historia se conserva.
--   · Acceso por programa: program_memberships (registro con quién concede y revoca) + caché en
--     organization_members.program_ids con un alcance explícito (program_scope), para no confundir
--     «sin programas» con «todos los programas».
--   · Verificación: solicitudes + comprobaciones + evidencias + decisiones (append-only). El estado efectivo
--     se calcula (verification_summary), no es un booleano.
--   · Discovery: el Passport sigue siendo la fuente de verdad. Ver ≠ filtrar ≠ usar en Match ≠ exportar,
--     por bloque. Las búsquedas de organizaciones pasan por discover_athlete_ids (paginada, con cuota).
--   · Shortlist ≠ Pipeline: promover crea o vincula el candidato del pipeline mediante una función explícita.
--
-- Reversión (orden inverso, exportando antes los datos que se quieran conservar):
--   drop function public.shortlist_promote, public.discover_athlete_ids, public.athlete_field_allows, public.can_discover_athlete,
--     public.verification_decide, public.verification_submit, public.verification_summary, public.email_verification_confirm,
--     public.email_verification_issue, public.email_verification_start, public.domain_matches, public.org_suspend_member,
--     public.org_reinstate_member, public.audit;
--   drop table public.org_saved_searches, public.org_assignment_log, public.org_shortlist_member_labels, public.org_labels,
--     public.shortlist_access, public.passport_field_policies, public.athlete_discovery_settings, public.discovery_usage,
--     public.email_verifications, public.verification_decisions, public.verification_evidence, public.verification_checks,
--     public.verification_requests, public.program_memberships, public.organization_membership_records, public.organization_domains;
--   restaurar org_can / can_see_shortlist / políticas de shortlists de 20261117001000 y quitar columnas añadidas.
-- =============================================================================

-- 0. Auditoría central (evoluciona audit_logs: organización, programa, rol, motivo y clasificación) -------
alter table public.audit_logs
  add column organization_id uuid references public.organizations (id) on delete set null,
  add column program_id uuid,
  add column actor_role text check (char_length(actor_role) <= 40),
  add column reason text check (char_length(reason) <= 500),
  add column classification text not null default 'normal' check (classification in ('normal', 'sensitive', 'security'));
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc) where organization_id is not null;
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- Nunca recibe secretos ni documentos: solo identificadores y estados.
create or replace function public.audit(p_action text, p_entity text, p_entity_id uuid, p_org uuid, p_details jsonb default '{}',
  p_reason text default null, p_class text default 'normal', p_program uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, organization_id, program_id, details, reason, classification)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_org, p_program, coalesce(p_details, '{}'), left(p_reason, 500), p_class);
$$;
revoke all on function public.audit(text, text, uuid, uuid, jsonb, text, text, uuid) from public, anon, authenticated;

-- El compliance y los admins de la organización leen su auditoría.
drop policy if exists audit_org_select on public.audit_logs;
create policy audit_org_select on public.audit_logs for select to authenticated
  using (organization_id is not null and public.org_can(organization_id, 'audit'));

-- 1. Organización: importada ≠ reclamada ≠ verificada ------------------------------------------------
alter table public.organizations
  add column normalized_name text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  add column org_status text not null default 'active' check (org_status in ('active', 'suspended', 'compromised', 'closed')),
  add column claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed', 'claim_pending', 'claimed')),
  add column source text not null default 'user_created' check (source in ('user_created', 'imported', 'admin')),
  add column external_id text check (char_length(external_id) <= 80),
  add column last_reviewed_at timestamptz;
-- Las que ya tienen equipo están reclamadas por quien las creó; las vinculadas a una universidad importada lo indican.
update public.organizations o set claim_status = 'claimed' where exists (select 1 from public.organization_members m where m.organization_id = o.id);
create index organizations_name_idx on public.organizations (normalized_name);
create unique index organizations_external_idx on public.organizations (source, external_id) where external_id is not null;

-- 2. Dominios institucionales ------------------------------------------------------------------------
create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Nombre de host en minúsculas, sin protocolo ni ruta (p. ej. university.edu, athletics.university.edu).
  domain text not null check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' and char_length(domain) <= 253),
  domain_type text not null default 'primary' check (domain_type in ('primary', 'athletics', 'other')),
  is_primary boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'verified', 'revoked')),
  verification_method text check (verification_method in ('admin_review', 'dns_txt', 'official_source', 'institution_import')),
  verified_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, domain)
);
-- Un dominio verificado pertenece a una sola organización; un solo dominio principal por organización.
create unique index org_domains_verified_unique on public.organization_domains (domain) where status = 'verified';
create unique index org_domains_primary_unique on public.organization_domains (organization_id) where is_primary and status <> 'revoked';
alter table public.organization_domains enable row level security;
create policy org_domains_select on public.organization_domains for select to authenticated
  using (public.is_org_member(organization_id) or public.is_admin() or status = 'verified');
create policy org_domains_insert on public.organization_domains for insert to authenticated
  with check (public.org_can(organization_id, 'manage_org') and status = 'pending' and created_by = auth.uid());
create policy org_domains_admin_update on public.organization_domains for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.organization_domains to authenticated;

-- Solo un admin de Gala verifica o revoca dominios.
create or replace function public.guard_org_domain()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.domain := lower(btrim(new.domain));
  if tg_op = 'UPDATE' and not public.is_admin() and auth.uid() is not null then
    raise exception 'domain_admin_only' using errcode = '42501';
  end if;
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status <> 'verified') then
    if not public.is_admin() and auth.uid() is not null then raise exception 'domain_admin_only' using errcode = '42501'; end if;
    new.verified_at := now(); new.reviewed_by := auth.uid();
  end if;
  if new.status = 'revoked' and (tg_op = 'INSERT' or old.status <> 'revoked') then new.revoked_at := now(); end if;
  return new;
end;
$$;
create trigger guard_org_domain before insert or update on public.organization_domains for each row execute function public.guard_org_domain();

-- Coincidencia de dominio correcta: igual o subdominio con límite de punto.
-- «fake-university.edu» NO coincide con «university.edu»; «athletics.university.edu» SÍ.
create or replace function public.domain_matches(p_email_domain text, p_domain text)
returns boolean language sql immutable as $$
  select p_email_domain is not null and p_domain is not null
     and (lower(p_email_domain) = lower(p_domain) or right(lower(p_email_domain), char_length(p_domain) + 1) = '.' || lower(p_domain));
$$;

-- 3. Membresía: rol declarado ≠ rol verificado ≠ permisos; historial de estados -------------------------
alter table public.organization_members
  add column declared_role text check (char_length(declared_role) <= 80),
  add column role_verification text not null default 'unverified' check (role_verification in ('unverified', 'verified')),
  add column affiliation_verification text not null default 'unverified' check (affiliation_verification in ('unverified', 'email_verified', 'verified')),
  add column invited_by uuid references public.profiles (id) on delete set null,
  add column invitation_source text check (invitation_source in ('creator', 'invitation', 'claim', 'admin', 'reinstated')),
  add column program_scope text not null default 'all' check (program_scope in ('all', 'selected')),
  add column updated_at timestamptz not null default now();
update public.organization_members set program_scope = 'selected' where cardinality(program_ids) > 0;
create index organization_members_user_idx on public.organization_members (user_id);

-- Compatibilidad: quien escriba program_ids directamente fija el alcance (vacío = todos, como antes).
create or replace function public.member_program_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('gala.program_sync', true), '') <> 'on' and new.program_ids is distinct from old.program_ids then
    new.program_scope := case when cardinality(new.program_ids) > 0 then 'selected' else 'all' end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger member_program_scope before update on public.organization_members for each row execute function public.member_program_scope();

-- Los niveles de verificación solo los cambia Gala (o sus funciones de verificación), nunca el admin de la organización.
create or replace function public.guard_member_verification()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or coalesce(current_setting('gala.verification_write', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' and (new.role_verification <> 'unverified' or new.affiliation_verification <> 'unverified') then
    raise exception 'verification_admin_only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.role_verification is distinct from old.role_verification or new.affiliation_verification is distinct from old.affiliation_verification) then
    raise exception 'verification_admin_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_member_verification before insert or update on public.organization_members for each row execute function public.guard_member_verification();

create table public.organization_membership_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('invited', 'pending', 'suspended', 'revoked', 'left', 'rejected', 'reinstated')),
  member_role public.org_member_role,
  declared_role text,
  program_ids uuid[] not null default '{}',
  program_scope text,
  title text,
  reason text check (char_length(reason) <= 500),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index membership_records_idx on public.organization_membership_records (organization_id, user_id, created_at desc);
alter table public.organization_membership_records enable row level security;
create policy membership_records_select on public.organization_membership_records for select to authenticated
  using (user_id = auth.uid() or public.org_can(organization_id, 'manage_members') or public.org_can(organization_id, 'audit') or public.is_admin());
grant select on public.organization_membership_records to authenticated;

-- Toda salida deja registro (revocada por un admin, abandonada por el propio usuario o suspendida).
create or replace function public.record_membership_exit()
returns trigger language plpgsql security definer set search_path = public as $$
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
$$;
create trigger record_membership_exit after delete on public.organization_members for each row execute function public.record_membership_exit();

-- Suspensión temporal: retira el acceso al instante (borra la fila activa) y conserva rol y programas para reactivar.
create or replace function public.org_suspend_member(p_org uuid, p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.org_can(p_org, 'manage_members') or public.is_admin()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot_suspend_self' using errcode = 'P0001'; end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  perform set_config('gala.exit_status', 'suspended', true);
  perform set_config('gala.exit_reason', left(p_reason, 500), true);
  delete from public.organization_members where organization_id = p_org and user_id = p_user;
  if not found then raise exception 'not_a_member' using errcode = 'P0002'; end if;
  perform set_config('gala.exit_status', '', true);
  perform set_config('gala.exit_reason', '', true);
end;
$$;

create or replace function public.org_reinstate_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not (public.org_can(p_org, 'manage_members') or public.is_admin()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into r from public.organization_membership_records where organization_id = p_org and user_id = p_user order by created_at desc limit 1;
  if r.id is null or r.status <> 'suspended' then raise exception 'not_suspended' using errcode = 'P0001'; end if;
  insert into public.organization_members (organization_id, user_id, member_role, declared_role, title, program_ids, invitation_source, invited_by)
  values (p_org, p_user, case when r.member_role in ('owner') then 'admin' else r.member_role end, r.declared_role, r.title, r.program_ids, 'reinstated', auth.uid());
  update public.organization_members set program_scope = coalesce(r.program_scope, 'all') where organization_id = p_org and user_id = p_user;
  insert into public.organization_membership_records (organization_id, user_id, status, member_role, actor_id) values (p_org, p_user, 'reinstated', r.member_role, auth.uid());
  perform public.audit('membership_reinstated', 'organization_member', p_user, p_org, '{}'::jsonb, null, 'security');
end;
$$;
revoke all on function public.org_suspend_member(uuid, uuid, text) from public, anon;
revoke all on function public.org_reinstate_member(uuid, uuid) from public, anon;
grant execute on function public.org_suspend_member(uuid, uuid, text) to authenticated;
grant execute on function public.org_reinstate_member(uuid, uuid) to authenticated;

-- 4. Acceso por programa ----------------------------------------------------------------------------
create table public.program_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.org_programs (id) on delete cascade,
  program_role text check (char_length(program_role) <= 60),
  access_level text not null default 'full' check (access_level in ('full', 'read')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  constraint program_membership_org check (public.program_in_org(program_id, organization_id))
);
create unique index program_memberships_active_unique on public.program_memberships (organization_id, user_id, program_id) where status = 'active';
create index program_memberships_user_idx on public.program_memberships (user_id) where status = 'active';
alter table public.program_memberships enable row level security;
create policy program_memberships_select on public.program_memberships for select to authenticated
  using (user_id = auth.uid() or public.org_can(organization_id, 'manage_members') or public.is_admin());
create policy program_memberships_insert on public.program_memberships for insert to authenticated
  with check ((public.org_can(organization_id, 'manage_members') or public.org_can(organization_id, 'manage_programs')) and granted_by = auth.uid() and status = 'active');
create policy program_memberships_update on public.program_memberships for update to authenticated
  using (public.org_can(organization_id, 'manage_members') or public.org_can(organization_id, 'manage_programs'))
  with check (public.org_can(organization_id, 'manage_members') or public.org_can(organization_id, 'manage_programs'));
grant select, insert, update on public.program_memberships to authenticated;

-- Solo se concede a miembros activos; revocar registra quién y cuándo; la caché de acceso se recalcula.
create or replace function public.sync_program_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = new.user_id) then
    raise exception 'not_an_active_member' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.status = 'revoked' and old.status = 'active' then
    new.revoked_at := now(); new.revoked_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger sync_program_access before insert or update on public.program_memberships for each row execute function public.sync_program_access();

create or replace function public.refresh_program_cache()
returns trigger language plpgsql security definer set search_path = public as $$
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
$$;
create trigger refresh_program_cache after insert or update on public.program_memberships for each row execute function public.refresh_program_cache();

-- Migración de datos: las listas de programas existentes pasan a ser concesiones registradas.
insert into public.program_memberships (organization_id, user_id, program_id, granted_at)
select m.organization_id, m.user_id, p, m.created_at from public.organization_members m cross join unnest(m.program_ids) p
where exists (select 1 from public.org_programs op where op.id = p and op.organization_id = m.organization_id)
on conflict do nothing;

-- 5. Roles y permisos (catálogo SQL versionado; la interfaz solo lo refleja) ---------------------------
create or replace function public.org_policy_version() returns text language sql immutable as $$ select 'org-policy-2026-11-20' $$;
create or replace function public.org_role_caps(p_role text)
returns text[] language sql immutable set search_path = public as $$
  select case p_role
    when 'owner' then array['manage_org','manage_members','manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export','audit']
    when 'admin' then array['manage_org','manage_members','manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export','audit']
    when 'athletic_director' then array['manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export','audit']
    when 'head_coach' then array['manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export']
    when 'coach' then array['opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact']
    when 'recruiter' then array['opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact']
    when 'recruiting_coordinator' then array['needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','export']
    when 'assistant_coach' then array['discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact']
    when 'analyst' then array['discover','shortlist','candidates']
    when 'admissions' then array['candidates','academic','notes','tasks']
    when 'compliance' then array['candidates','audit']
    when 'staff' then array['candidates','tasks']
    when 'viewer' then array[]::text[]
    else array[]::text[] end;
$$;

-- Permiso efectivo: miembro activo + rol + organización activa (no suspendida ni comprometida) + verificación + programa.
create or replace function public.org_can(p_org uuid, p_cap text, p_program uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
     where m.organization_id = p_org and m.user_id = auth.uid()
       and o.org_status = 'active'
       and p_cap = any (public.org_role_caps(m.member_role::text))
       and (p_program is null or m.program_scope = 'all' or p_program = any (m.program_ids))
       and (o.verification_status = 'verified' or p_cap in ('manage_org', 'manage_members', 'manage_programs', 'needs', 'opportunities', 'tasks'))
  );
$$;

-- 6. Verificación: solicitudes, comprobaciones, evidencias y decisiones (append-only) -------------------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  subject_user uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  program_id uuid references public.org_programs (id) on delete set null,
  verification_type text not null check (verification_type in ('identity', 'institutional_email', 'organization_claim', 'organization_affiliation', 'program_affiliation', 'role', 'domain')),
  declared_role text check (char_length(declared_role) <= 80),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'pending_evidence', 'under_review', 'approved', 'partially_approved', 'rejected', 'expired', 'revoked', 'suspended')),
  risk_level text not null default 'normal' check (risk_level in ('low', 'normal', 'high')),
  submitted_at timestamptz,
  assigned_reviewer uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  decision text check (decision in ('approved', 'partially_approved', 'rejected', 'revoked', 'suspended')),
  decision_reason text check (char_length(decision_reason) <= 1000),
  expires_at timestamptz,
  revoked_at timestamptz,
  legacy_claim_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_requests_subject_idx on public.verification_requests (subject_user, created_at desc);
create index verification_requests_queue_idx on public.verification_requests (status, created_at) where status in ('submitted', 'pending_evidence', 'under_review');
-- Una solicitud abierta por persona, organización y tipo.
create unique index verification_requests_open_unique on public.verification_requests (subject_user, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), verification_type)
  where status in ('draft', 'submitted', 'pending_evidence', 'under_review');
alter table public.verification_requests enable row level security;
create policy vr_select on public.verification_requests for select to authenticated
  using (subject_user = auth.uid() or assigned_reviewer = auth.uid() or public.is_admin()
         or (organization_id is not null and public.org_can(organization_id, 'manage_members')));
grant select on public.verification_requests to authenticated;

create table public.verification_checks (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  method text not null check (method in ('institutional_email', 'domain_match', 'admin_invitation', 'manual_review', 'official_staff_directory', 'organization_confirmation', 'supporting_document')),
  result text not null check (result in ('passed', 'failed', 'inconclusive')),
  detail text check (char_length(detail) <= 500),
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz not null default now()
);
create index verification_checks_idx on public.verification_checks (request_id);
alter table public.verification_checks enable row level security;
create policy vc_select on public.verification_checks for select to authenticated
  using (exists (select 1 from public.verification_requests r where r.id = request_id));
grant select on public.verification_checks to authenticated;

create table public.verification_evidence (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  evidence_type text not null check (evidence_type in ('staff_directory_url', 'official_letter', 'business_card', 'id_document', 'other')),
  -- Referencia (URL oficial https) o ruta en almacenamiento privado: nunca el documento en texto.
  reference_url text check (reference_url is null or reference_url ~ '^https://'),
  storage_path text check (storage_path is null or storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  validation_result text not null default 'pending' check (validation_result in ('pending', 'valid', 'invalid')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  classification text not null default 'confidential' check (classification in ('internal', 'confidential', 'restricted')),
  constraint evidence_has_reference check (reference_url is not null or storage_path is not null)
);
alter table public.verification_evidence enable row level security;
create policy ve_select on public.verification_evidence for select to authenticated
  using (submitted_by = auth.uid() or public.is_admin());
create policy ve_insert on public.verification_evidence for insert to authenticated
  with check (submitted_by = auth.uid() and validation_result = 'pending'
              and exists (select 1 from public.verification_requests r where r.id = request_id and r.subject_user = auth.uid()
                          and r.status in ('draft', 'submitted', 'pending_evidence', 'under_review')));
grant select, insert on public.verification_evidence to authenticated;

create table public.verification_decisions (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  previous_status text not null,
  new_status text not null,
  decision text not null,
  reason text check (char_length(reason) <= 1000),
  reviewer_id uuid not null references public.profiles (id),
  restrictions text check (char_length(restrictions) <= 500),
  review_by date,
  created_at timestamptz not null default now()
);
create index verification_decisions_idx on public.verification_decisions (request_id, id);
alter table public.verification_decisions enable row level security;
create policy vd_select on public.verification_decisions for select to authenticated
  using (exists (select 1 from public.verification_requests r where r.id = request_id));
grant select on public.verification_decisions to authenticated;
-- Historial inmutable (solo se borra en cascada con la solicitud).
create trigger verification_decisions_immutable before update on public.verification_decisions for each row execute function public.forbid_mutation();

-- Solicitud nueva. La comprobación de dominio se registra automáticamente (sin aprobar nada).
create or replace function public.verification_submit(p_type text, p_org uuid, p_program uuid default null, p_declared_role text default null)
returns uuid language plpgsql security definer set search_path = public as $$
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
$$;

-- Decisión del revisor (admin de Gala). Nunca sobrescribe: añade una decisión y aplica sus efectos.
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
revoke all on function public.verification_submit(text, uuid, uuid, text) from public, anon;
revoke all on function public.verification_decide(uuid, text, text, public.org_member_role, text) from public, anon;
grant execute on function public.verification_submit(text, uuid, uuid, text) to authenticated;
grant execute on function public.verification_decide(uuid, text, text, public.org_member_role, text) to authenticated;

-- Migración de reclamaciones existentes: se conservan como solicitudes con su decisión (sin inventar revisores).
insert into public.verification_requests (subject_user, organization_id, institution_id, verification_type, declared_role, status, submitted_at, reviewed_at, decision, decision_reason, legacy_claim_id, assigned_reviewer, created_at)
select c.user_id, c.organization_id, c.institution_id, 'organization_claim', left(c.role_title, 80),
       case c.status when 'approved' then 'approved' when 'rejected' then 'rejected' else 'submitted' end,
       c.created_at, c.reviewed_at, case c.status when 'approved' then 'approved' when 'rejected' then 'rejected' end, c.review_note, c.id, c.reviewed_by, c.created_at
  from public.institution_claims c
on conflict do nothing;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- 7. Correo institucional: token con hash, caducidad, un solo uso e intentos limitados -------------------
create table public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and char_length(email) <= 254),
  email_domain text generated always as (lower(split_part(email, '@', 2))) stored,
  -- Solo el hash SHA-256 del token; el token en claro solo existe en el correo.
  token_hash text check (token_hash ~ '^[0-9a-f]{64}$'),
  sent_at timestamptz,
  token_expires_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 10),
  verified_at timestamptz,
  result text not null default 'pending' check (result in ('pending', 'verified', 'failed', 'expired', 'revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_verifications_user_idx on public.email_verifications (user_id, created_at desc);
alter table public.email_verifications enable row level security;
-- El usuario ve sus verificaciones, pero nunca el hash (privilegio de columna).
create policy ev_select on public.email_verifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select (id, user_id, organization_id, email, email_domain, sent_at, token_expires_at, attempts, verified_at, result, revoked_at, created_at) on public.email_verifications to authenticated;

-- Paso 1 (usuario): pide verificar un correo. Máx. 5 al día. No genera token aquí: el usuario nunca lo recibe en la respuesta.
create or replace function public.email_verification_start(p_org uuid, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if (select count(*) from public.email_verifications where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  insert into public.email_verifications (user_id, organization_id, email) values (auth.uid(), p_org, lower(btrim(p_email))) returning id into v_id;
  return v_id;
end;
$$;

-- Paso 2 (solo servidor con clave secreta): emite el token para enviarlo por correo. Devuelve el token en claro una única vez.
create or replace function public.email_verification_issue(p_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  update public.email_verifications
     set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'), sent_at = now(), token_expires_at = now() + interval '30 minutes', attempts = 0
   where id = p_id and result = 'pending';
  if not found then raise exception 'not_pending' using errcode = 'P0001'; end if;
  return v_token;
end;
$$;

-- Paso 3 (usuario, desde el enlace del correo): confirma. Un solo uso, caduca y bloquea tras 5 intentos.
create or replace function public.email_verification_confirm(p_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
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
$$;
revoke all on function public.email_verification_start(uuid, text) from public, anon;
revoke all on function public.email_verification_issue(uuid) from public, anon, authenticated;
revoke all on function public.email_verification_confirm(uuid, text) from public, anon;
grant execute on function public.email_verification_start(uuid, text) to authenticated;
grant execute on function public.email_verification_confirm(uuid, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.email_verification_issue(uuid) to service_role';
  end if;
end $$;

-- Estado efectivo (no un booleano): lo que la interfaz muestra se calcula aquí.
create or replace function public.verification_summary(p_org uuid, p_user uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  m as (select * from public.organization_members where organization_id = p_org and user_id = (select id from u))
  select case when (select id from u) <> auth.uid() and not (public.org_can(p_org, 'manage_members') or public.is_admin()) then null else jsonb_build_object(
    'email_verified', exists (select 1 from public.email_verifications e where e.user_id = (select id from u) and e.result = 'verified' and e.revoked_at is null
                               and exists (select 1 from public.organization_domains d where d.organization_id = p_org and d.status = 'verified' and public.domain_matches(e.email_domain, d.domain))),
    'organization_verified', (select verification_status = 'verified' from public.organizations where id = p_org),
    'affiliation_verified', coalesce((select affiliation_verification = 'verified' from m), false),
    'program_verified', exists (select 1 from public.program_memberships pm where pm.organization_id = p_org and pm.user_id = (select id from u) and pm.status = 'active'),
    'role_verified', coalesce((select role_verification = 'verified' from m), false),
    'access_active', exists (select 1 from m) and (select org_status = 'active' from public.organizations where id = p_org)
  ) end;
$$;
revoke all on function public.verification_summary(uuid, uuid) from public, anon;
grant execute on function public.verification_summary(uuid, uuid) to authenticated;

-- 8. Discovery: visibilidad del atleta y política por bloque (ver ≠ filtrar ≠ Match ≠ exportar) ------------
create table public.athlete_discovery_settings (
  athlete_id uuid primary key references public.athlete_profiles (user_id) on delete cascade,
  mode text not null default 'verified_organizations' check (mode in ('off', 'verified_organizations', 'selected_organization_types')),
  organization_types public.org_type[] not null default '{}',
  opportunity_types public.opportunity_type[] not null default '{}',
  regions text[] not null default '{}' check (cardinality(regions) <= 30),
  visible_from date,
  visible_until date,
  updated_at timestamptz not null default now(),
  constraint discovery_period check (visible_until is null or visible_from is null or visible_until >= visible_from),
  constraint discovery_types_when_selected check (mode <> 'selected_organization_types' or cardinality(organization_types) > 0)
);
alter table public.athlete_discovery_settings enable row level security;
create policy ads_own on public.athlete_discovery_settings for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
grant select, insert, update, delete on public.athlete_discovery_settings to authenticated;

create table public.passport_field_policies (
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  field_group text not null check (field_group in ('sport', 'physical', 'academics', 'stats', 'videos', 'goals')),
  allow_filter boolean not null,
  allow_match boolean not null,
  allow_compare boolean not null,
  allow_export boolean not null,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, field_group)
);
alter table public.passport_field_policies enable row level security;
create policy pfp_own on public.passport_field_policies for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
grant select, insert, update, delete on public.passport_field_policies to authenticated;

-- Valores por defecto (sin fila): filtrar/Match/comparar sí; exportar no. Menores: académico y estadísticas no filtrables por defecto.
create or replace function public.athlete_field_allows(p_athlete uuid, p_group text, p_purpose text)
returns boolean language plpgsql stable security definer set search_path = public as $$
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
$$;
revoke all on function public.athlete_field_allows(uuid, text, text) from public, anon;
grant execute on function public.athlete_field_allows(uuid, text, text) to authenticated;

-- ¿Puede esta organización encontrar a este atleta en Discovery?
create or replace function public.can_discover_athlete(p_org uuid, p_athlete uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare s record; o record;
begin
  if not public.org_can(p_org, 'discover') then return false; end if;
  if not exists (select 1 from public.athlete_profiles where user_id = p_athlete and open_to_opportunities) then return false; end if;
  if not public.can_view_athlete(p_athlete, 'profile') then return false; end if;
  select * into s from public.athlete_discovery_settings where athlete_id = p_athlete;
  if s.athlete_id is null then return true; end if;
  if s.mode = 'off' then return false; end if;
  if s.visible_from is not null and current_date < s.visible_from then return false; end if;
  if s.visible_until is not null and current_date > s.visible_until then return false; end if;
  select type, country into o from public.organizations where id = p_org;
  if s.mode = 'selected_organization_types' and not (o.type = any (s.organization_types)) then return false; end if;
  if cardinality(s.regions) > 0 and (o.country is null or not (o.country = any (s.regions))) then return false; end if;
  return true;
end;
$$;
revoke all on function public.can_discover_athlete(uuid, uuid) from public, anon;
grant execute on function public.can_discover_athlete(uuid, uuid) to authenticated;

-- Cuota anti-enumeración: búsquedas por usuario y día.
create table public.discovery_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  searches int not null default 0,
  primary key (user_id, day)
);
alter table public.discovery_usage enable row level security;
create policy du_own on public.discovery_usage for select to authenticated using (user_id = auth.uid());
grant select on public.discovery_usage to authenticated;

-- Búsqueda de atletas para organizaciones. Devuelve solo identificadores (la ficha se lee con la vista enmascarada).
-- Reglas: organización verificada con permiso «discover», deporte obligatorio (no se puede listar toda la base),
-- páginas de 24 como máximo hasta la página 20, 300 búsquedas al día por persona, y cada filtro solo se aplica
-- sobre atletas que permiten filtrar ese bloque: un dato no filtrable nunca excluye ni incluye a nadie por él.
-- Devuelve además qué bloques NO pueden usarse para el encaje inverso de cada atleta.
create or replace function public.discover_athlete_ids(p_org uuid, p_filters jsonb, p_page int default 1, p_page_size int default 24)
returns table (user_id uuid, total bigint, match_blocked text[])
language plpgsql stable security definer set search_path = public as $$
declare
  v_sport text := p_filters->>'sport';
  v_pos int := nullif(p_filters->>'position', '')::int;
  v_grad int := nullif(p_filters->>'grad', '')::int;
  v_country text := nullif(p_filters->>'country', '');
  v_min_h int := nullif(p_filters->>'min_height', '')::int;
  v_video boolean := coalesce((p_filters->>'video')::boolean, false);
  v_acad boolean := coalesce((p_filters->>'academics')::boolean, false);
  v_stats boolean := coalesce((p_filters->>'verified_stats')::boolean, false);
  v_q text := nullif(left(regexp_replace(coalesce(p_filters->>'q', ''), '[%_\\]', '', 'g'), 60), '');
  v_size int := least(greatest(coalesce(p_page_size, 24), 1), 24);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  if not public.org_can(p_org, 'discover') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_sport is null or not exists (select 1 from public.sports where id = v_sport) then raise exception 'sport_required' using errcode = 'P0001'; end if;
  if v_page > 20 then raise exception 'page_limit' using errcode = 'P0001'; end if;
  if (select count(*) from jsonb_object_keys(p_filters) k where k not in ('sport', 'position', 'grad', 'country', 'min_height', 'video', 'academics', 'verified_stats', 'q')) > 0 then
    raise exception 'invalid_filter' using errcode = 'P0001';
  end if;
  -- La cuota se cuenta en una función volátil aparte (esta es estable y no escribe).
  return query
  with base as (
    select ap.user_id as uid, ap.updated_at
      from public.athlete_profiles ap
      join public.profiles p on p.id = ap.user_id
     where ap.sport_id = v_sport
       and public.can_discover_athlete(p_org, ap.user_id)
       and public.athlete_field_allows(ap.user_id, 'sport', 'filter')
       and (v_pos is null or ap.primary_position_id = v_pos or ap.secondary_position_id = v_pos)
       and (v_grad is null or ap.graduation_year = v_grad)
       and (v_country is null or p.country = v_country)
       and (v_q is null or p.display_name ilike '%' || v_q || '%')
       and (v_min_h is null or (ap.height_cm >= v_min_h and public.athlete_field_allows(ap.user_id, 'physical', 'filter')))
       and (not v_video or (public.athlete_field_allows(ap.user_id, 'videos', 'filter')
            and (ap.highlight_video_url is not null or exists (select 1 from public.athlete_videos v where v.athlete_id = ap.user_id))))
       and (not v_acad or (public.athlete_field_allows(ap.user_id, 'academics', 'filter')
            and exists (select 1 from public.athlete_academics a where a.athlete_id = ap.user_id and a.gpa_source <> 'self_reported')))
       and (not v_stats or (public.athlete_field_allows(ap.user_id, 'stats', 'filter')
            and exists (select 1 from public.athlete_statistics s where s.athlete_id = ap.user_id and s.source <> 'self_reported')))
  )
  select b.uid, count(*) over (), array(select g from unnest(array['physical', 'academics', 'stats', 'videos', 'goals']) g where not public.athlete_field_allows(b.uid, g, 'match'))
    from base b
   order by b.updated_at desc
   limit v_size offset (v_page - 1) * v_size;
end;
$$;
create or replace function public.discovery_consume()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into public.discovery_usage (user_id) values (auth.uid())
  on conflict (user_id, day) do update set searches = public.discovery_usage.searches + 1
  returning searches into v_n;
  return v_n <= 300;
end;
$$;
revoke all on function public.discover_athlete_ids(uuid, jsonb, int, int) from public, anon;
revoke all on function public.discovery_consume() from public, anon;
grant execute on function public.discover_athlete_ids(uuid, jsonb, int, int) to authenticated;
grant execute on function public.discovery_consume() to authenticated;

-- 9. Búsquedas guardadas de la organización (filtros normalizados y validados, no una URL) -------------
create table public.org_saved_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  program_id uuid references public.org_programs (id) on delete set null,
  need_id uuid references public.recruiting_needs (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  filters jsonb not null check (jsonb_typeof(filters) = 'object' and filters ? 'sport'
    and (filters - array['sport', 'position', 'grad', 'country', 'min_height', 'video', 'academics', 'verified_stats', 'q']) = '{}'::jsonb),
  filters_version smallint not null default 1,
  notify boolean not null default false,
  visibility text not null default 'private' check (visibility in ('private', 'team')),
  status text not null default 'active' check (status in ('active', 'archived')),
  last_executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_search_program_org check (public.program_in_org(program_id, organization_id))
);
create index org_saved_searches_idx on public.org_saved_searches (organization_id, status);
alter table public.org_saved_searches enable row level security;
create policy oss_select on public.org_saved_searches for select to authenticated
  using (public.org_can(organization_id, 'discover', program_id) and (visibility = 'team' or created_by = auth.uid()));
create policy oss_insert on public.org_saved_searches for insert to authenticated
  with check (public.org_can(organization_id, 'discover', program_id) and created_by = auth.uid());
create policy oss_update on public.org_saved_searches for update to authenticated
  using (created_by = auth.uid() and public.org_can(organization_id, 'discover', program_id))
  with check (created_by = auth.uid() and public.org_can(organization_id, 'discover', program_id));
create policy oss_delete on public.org_saved_searches for delete to authenticated using (created_by = auth.uid());
grant select, insert, update, delete on public.org_saved_searches to authenticated;
create trigger t_oss_updated before update on public.org_saved_searches for each row execute function public.set_updated_at();

-- 10. Shortlists: estado, visibilidad ampliada, acceso por persona ---------------------------------------
alter table public.org_shortlists
  add column description text check (char_length(description) <= 500),
  add column recruiting_class int check (recruiting_class between 2020 and 2045),
  add column sport_id text references public.sports (id),
  add column opportunity_id uuid references public.opportunities (id) on delete set null,
  add column status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  add column deleted_at timestamptz;
update public.org_shortlists set status = 'archived' where archived_at is not null;
alter table public.org_shortlists drop constraint org_shortlists_visibility_check;
-- private: dueño y accesos concedidos · shared: dueño y personas concretas · program: miembros con acceso al programa · team: toda la organización
alter table public.org_shortlists add constraint org_shortlists_visibility_check check (visibility in ('private', 'shared', 'program', 'team'));
alter table public.org_shortlists add constraint shortlist_program_visibility check (visibility <> 'program' or program_id is not null);

create table public.shortlist_access (
  shortlist_id uuid not null references public.org_shortlists (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  access_role text not null check (access_role in ('editor', 'contributor', 'viewer')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (shortlist_id, user_id)
);
alter table public.shortlist_access enable row level security;

-- Nivel de acceso a una lista: owner > editor > contributor > viewer (null = sin acceso). Las borradas no se ven.
create or replace function public.shortlist_role(p_list uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.id is null or s.status = 'deleted' or not public.org_can(s.organization_id, 'shortlist', s.program_id) then null
    when s.owner_id = auth.uid() then 'owner'
    when public.org_can(s.organization_id, 'manage_members') then 'editor'
    when a.user_id is not null then a.access_role
    when s.visibility = 'team' then 'editor'
    when s.visibility = 'program' then 'editor'
    else null end
  from public.org_shortlists s
  left join public.shortlist_access a on a.shortlist_id = s.id and a.user_id = auth.uid() and a.revoked_at is null
  where s.id = p_list;
$$;
create or replace function public.can_see_shortlist(p_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.shortlist_role(p_list) is not null;
$$;
create or replace function public.can_edit_shortlist(p_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.shortlist_role(p_list) in ('owner', 'editor', 'contributor');
$$;
revoke all on function public.shortlist_role(uuid) from public, anon;
grant execute on function public.shortlist_role(uuid) to authenticated;
grant execute on function public.can_edit_shortlist(uuid) to authenticated;

drop policy shortlists_select on public.org_shortlists;
drop policy shortlists_update on public.org_shortlists;
-- Sobre las columnas de la fila (no por id): así también vale para la fila recién insertada (INSERT … RETURNING).
create policy shortlists_select on public.org_shortlists for select to authenticated using (
  status <> 'deleted' and public.org_can(organization_id, 'shortlist', program_id)
  and (owner_id = auth.uid() or visibility in ('team', 'program') or public.org_can(organization_id, 'manage_members')
       or exists (select 1 from public.shortlist_access a where a.shortlist_id = id and a.user_id = auth.uid() and a.revoked_at is null)));
create policy shortlists_update on public.org_shortlists for update to authenticated
  using (public.org_can(organization_id, 'shortlist', program_id)
         and (owner_id = auth.uid() or visibility in ('team', 'program') or public.org_can(organization_id, 'manage_members')
              or exists (select 1 from public.shortlist_access a where a.shortlist_id = id and a.user_id = auth.uid() and a.revoked_at is null and a.access_role = 'editor')))
  with check (public.org_can(organization_id, 'shortlist', program_id));
-- Miembros de la lista: los «viewer» leen pero no escriben.
drop policy slm_insert on public.org_shortlist_members;
drop policy slm_update on public.org_shortlist_members;
drop policy slm_delete on public.org_shortlist_members;
create policy slm_insert on public.org_shortlist_members for insert to authenticated
  with check (public.can_edit_shortlist(shortlist_id) and public.can_view_athlete(athlete_id, 'profile')
              and organization_id = (select organization_id from public.org_shortlists where id = shortlist_id));
create policy slm_update on public.org_shortlist_members for update to authenticated
  using (public.can_edit_shortlist(shortlist_id)) with check (public.can_edit_shortlist(shortlist_id));
create policy slm_delete on public.org_shortlist_members for delete to authenticated using (public.can_edit_shortlist(shortlist_id));

create policy sa_select on public.shortlist_access for select to authenticated using (user_id = auth.uid() or public.shortlist_role(shortlist_id) in ('owner', 'editor'));
create policy sa_write on public.shortlist_access for all to authenticated
  using (public.shortlist_role(shortlist_id) = 'owner' or public.org_can(organization_id, 'manage_members'))
  with check ((public.shortlist_role(shortlist_id) = 'owner' or public.org_can(organization_id, 'manage_members')) and granted_by = auth.uid());
grant select, insert, update, delete on public.shortlist_access to authenticated;

-- Solo se comparte con miembros de la misma organización con permiso de shortlists.
create or replace function public.guard_shortlist_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.organization_id := (select organization_id from public.org_shortlists where id = new.shortlist_id);
  if not exists (select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = new.user_id
                 and 'shortlist' = any (public.org_role_caps(m.member_role::text))) then
    raise exception 'not_an_authorized_member' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_shortlist_access before insert or update on public.shortlist_access for each row execute function public.guard_shortlist_access();

-- 11. Miembros de shortlist: procedencia, revisión, promoción ----------------------------------------
alter table public.org_shortlist_members
  add column source text not null default 'manual_discovery' check (source in ('manual_discovery', 'gala_match', 'application', 'recruiting_need', 'imported_list', 'staff_referral', 'gala_ai', 'trial')),
  add column last_reviewed_at timestamptz,
  add column internal_label text check (char_length(internal_label) <= 40),
  add column promoted_candidate_id uuid references public.org_candidates (id) on delete set null,
  add column promoted_at timestamptz;
alter table public.org_shortlist_members drop constraint org_shortlist_members_review_status_check;
-- Revisión ≠ pipeline: aquí nunca hay «oferta» ni «comprometido».
alter table public.org_shortlist_members add constraint org_shortlist_members_review_status_check
  check (review_status in ('to_review', 'reviewing', 'reviewed', 'needs_info'));
create index slm_assigned_idx on public.org_shortlist_members (assigned_to) where assigned_to is not null;

-- 12. Etiquetas (de la organización o del programa; nunca atributos públicos del atleta) ------------------
create table public.org_labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  program_id uuid references public.org_programs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint label_program_org check (public.program_in_org(program_id, organization_id))
);
create unique index org_labels_name_unique on public.org_labels (organization_id, coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
alter table public.org_labels enable row level security;
create policy org_labels_select on public.org_labels for select to authenticated using (public.org_can(organization_id, 'shortlist', program_id));
create policy org_labels_write on public.org_labels for all to authenticated
  using (public.org_can(organization_id, 'shortlist', program_id)) with check (public.org_can(organization_id, 'shortlist', program_id));
grant select, insert, update, delete on public.org_labels to authenticated;

create table public.org_shortlist_member_labels (
  shortlist_id uuid not null,
  athlete_id uuid not null,
  label_id uuid not null references public.org_labels (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (shortlist_id, athlete_id, label_id),
  foreign key (shortlist_id, athlete_id) references public.org_shortlist_members (shortlist_id, athlete_id) on delete cascade
);
alter table public.org_shortlist_member_labels enable row level security;
create policy osml_select on public.org_shortlist_member_labels for select to authenticated using (public.can_see_shortlist(shortlist_id));
create policy osml_write on public.org_shortlist_member_labels for all to authenticated
  using (public.can_edit_shortlist(shortlist_id))
  with check (public.can_edit_shortlist(shortlist_id)
              and exists (select 1 from public.org_labels l join public.org_shortlists s on s.id = shortlist_id where l.id = label_id and l.organization_id = s.organization_id));
grant select, insert, delete on public.org_shortlist_member_labels to authenticated;

-- 13. Notas: vinculadas a la lista, editables con marca y borrado lógico -----------------------------------
alter table public.org_notes
  add column shortlist_id uuid references public.org_shortlists (id) on delete set null,
  add column updated_at timestamptz,
  add column deleted_at timestamptz;
create policy org_notes_update on public.org_notes for update to authenticated
  using (author_id = auth.uid() and public.org_can(organization_id, 'notes'))
  with check (author_id = auth.uid() and public.org_can(organization_id, 'notes'));
grant update (body, deleted_at, shortlist_id) on public.org_notes to authenticated;
create or replace function public.mark_note_edited() returns trigger language plpgsql set search_path = public as $$
begin
  if new.body is distinct from old.body then new.updated_at := now(); end if;
  -- Sin HTML ejecutable: se rechaza cualquier etiqueta de script o manejador inline.
  if new.body ~* '<\s*script|javascript:|on[a-z]+\s*=' then raise exception 'unsafe_content' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger mark_note_edited before update on public.org_notes for each row execute function public.mark_note_edited();
create or replace function public.guard_note_content() returns trigger language plpgsql set search_path = public as $$
begin
  if new.body ~* '<\s*script|javascript:|on[a-z]+\s*=' then raise exception 'unsafe_content' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger guard_note_content before insert on public.org_notes for each row execute function public.guard_note_content();

-- 14. Asignaciones: solo a miembros autorizados; historial de cada cambio ---------------------------------
create table public.org_assignment_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  target_kind text not null check (target_kind in ('shortlist_member', 'candidate')),
  shortlist_id uuid,
  athlete_id uuid,
  candidate_id uuid,
  assigned_to uuid references public.profiles (id) on delete set null,
  assigned_by uuid references public.profiles (id) on delete set null,
  status text not null check (status in ('assigned', 'unassigned')),
  created_at timestamptz not null default now()
);
create index org_assignment_log_idx on public.org_assignment_log (organization_id, created_at desc);
alter table public.org_assignment_log enable row level security;
create policy oal_select on public.org_assignment_log for select to authenticated using (public.org_can(organization_id, 'candidates'));
grant select on public.org_assignment_log to authenticated;

create or replace function public.guard_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Quien no es miembro lo rechaza la guarda existente (assignee_not_member); aquí: miembro sin permiso de candidatos.
  if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to
     and exists (select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = new.assigned_to
                 and not ('candidates' = any (public.org_role_caps(m.member_role::text)))) then
    raise exception 'assignee_not_authorized' using errcode = 'P0001';
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.org_assignment_log (organization_id, target_kind, shortlist_id, athlete_id, candidate_id, assigned_to, assigned_by, status)
    values (new.organization_id, case when tg_table_name = 'org_candidates' then 'candidate' else 'shortlist_member' end,
            case when tg_table_name = 'org_shortlist_members' then (to_jsonb(new)->>'shortlist_id')::uuid end, new.athlete_id,
            case when tg_table_name = 'org_candidates' then (to_jsonb(new)->>'id')::uuid end,
            coalesce(new.assigned_to, old.assigned_to), auth.uid(), case when new.assigned_to is null then 'unassigned' else 'assigned' end);
  end if;
  return new;
end; $$;
create trigger guard_assignment_slm before update on public.org_shortlist_members for each row execute function public.guard_assignment();
create trigger guard_assignment_cand before update on public.org_candidates for each row execute function public.guard_assignment();

-- 15. Tareas: se pueden vincular a lista, candidato o necesidad (se reutiliza org_tasks) --------------------
alter table public.org_tasks
  add column shortlist_id uuid references public.org_shortlists (id) on delete set null,
  add column candidate_id uuid references public.org_candidates (id) on delete set null,
  add column need_id uuid references public.recruiting_needs (id) on delete set null;

-- 16. Promoción explícita Shortlist → Pipeline (crea o vincula el candidato; nunca transforma la fila) -----
create or replace function public.shortlist_promote(p_list uuid, p_athlete uuid, p_need uuid default null, p_opportunity uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
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
$$;
revoke all on function public.shortlist_promote(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.shortlist_promote(uuid, uuid, uuid, uuid) to authenticated;

-- 17. Eventos de producto (analítica, separada de la auditoría) -----------------------------------------
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
  'athlete_search_performed', 'athlete_search_saved', 'athlete_promoted_to_pipeline', 'verification_requested'));
