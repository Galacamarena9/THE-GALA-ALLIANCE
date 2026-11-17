-- COACH & UNIVERSITY PORTAL (Fase 07). Solo aditiva. Reutiliza organizations, organization_members,
-- opportunities, applications, athlete_offers, contact_requests y athlete_documents (no duplica entidades).
-- Política de permisos versionada: org_policy_version() + org_can(). Todo se aplica en la base de datos (RLS).
-- Reversión (orden inverso): drop de las tablas org_* / recruiting_needs / info_requests, funciones org_*,
--   restaurar is_org_member(), athlete_directory y members_admin de 20261113000100, y quitar columnas añadidas
--   a organization_members y opportunities (antes, exportar sus datos si se quieren conservar).

-- 0. Permisos -------------------------------------------------------------------------------------
create or replace function public.org_policy_version() returns text language sql immutable as $$ select 'org-policy-2026-11-17' $$;

-- "admin" incluye ahora al propietario.
create or replace function public.is_org_member(p_org uuid, p_admin_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
     where organization_id = p_org and user_id = auth.uid()
       and (not p_admin_only or member_role in ('admin', 'owner'))
  );
$$;

alter table public.organization_members
  add column title text check (char_length(title) <= 80),
  -- Vacío = todos los programas de la organización.
  add column program_ids uuid[] not null default '{}';

-- Capacidades por rol. Las acciones que tocan datos de atletas exigen además organización verificada.
create or replace function public.org_role_caps(p_role text)
returns text[] language sql immutable set search_path = public as $$
  select case p_role
    when 'owner' then array['manage_org','manage_members','manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export','audit']
    when 'admin' then array['manage_org','manage_members','manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export','audit']
    when 'head_coach' then array['manage_programs','opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','offers','export']
    when 'coach' then array['opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact']
    when 'recruiter' then array['opportunities','needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact']
    when 'recruiting_coordinator' then array['needs','discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact','export']
    when 'assistant_coach' then array['discover','shortlist','notes','pipeline','tasks','candidates','academic','request_info','contact']
    when 'admissions' then array['candidates','academic','notes','tasks']
    when 'compliance' then array['candidates','audit']
    when 'staff' then array['candidates','tasks']
    else array[]::text[] end;
$$;

-- ¿Puede el usuario actual hacer p_cap en p_org (y, si se indica, en ese programa)?
create or replace function public.org_can(p_org uuid, p_cap text, p_program uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
     where m.organization_id = p_org and m.user_id = auth.uid()
       and p_cap = any (public.org_role_caps(m.member_role::text))
       and (p_program is null or cardinality(m.program_ids) = 0 or p_program = any (m.program_ids))
       -- Sin verificar: se puede configurar la organización, pero no tocar datos de atletas.
       and (o.verification_status = 'verified' or p_cap in ('manage_org', 'manage_members', 'manage_programs', 'needs', 'opportunities', 'tasks'))
  );
$$;

-- ALTER (no DROP): misma política, nueva condición.
alter policy members_admin on public.organization_members
  using (public.org_can(organization_id, 'manage_members') or public.is_admin())
  with check (public.org_can(organization_id, 'manage_members') or public.is_admin());

-- Solo el propietario nombra propietarios; siempre debe quedar un propietario o admin.
create or replace function public.guard_org_member()
returns trigger language plpgsql security definer set search_path = public as $$
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
$$;
create trigger guard_org_member before insert or update or delete on public.organization_members
  for each row execute function public.guard_org_member();

-- 1. Programas deportivos -------------------------------------------------------------------------
create table public.org_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sport_id text not null references public.sports (id),
  gender text not null default 'coed' check (gender in ('women', 'men', 'coed')),
  name text not null check (char_length(name) between 2 and 120),
  institution_program_id uuid references public.institution_programs (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, sport_id, gender)
);
alter table public.org_programs enable row level security;
create policy org_programs_select on public.org_programs for select to authenticated using (public.is_org_member(organization_id) or public.is_admin());
create policy org_programs_write on public.org_programs for all to authenticated
  using (public.org_can(organization_id, 'manage_programs')) with check (public.org_can(organization_id, 'manage_programs'));
grant select, insert, update, delete on public.org_programs to authenticated;

-- Garantiza que un program_id pertenece a la misma organización.
create or replace function public.program_in_org(p_program uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_program is null or exists (select 1 from public.org_programs where id = p_program and organization_id = p_org);
$$;

-- 2. Actividad y auditoría de la organización (solo inserción) -------------------------------------
create table public.org_activity (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid references public.athlete_profiles (user_id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('candidate_created', 'stage_changed', 'assigned', 'shortlisted', 'unshortlisted', 'reviewed',
    'note_added', 'task_created', 'task_done', 'info_requested', 'info_shared', 'info_declined', 'document_accessed',
    'offer_recorded', 'member_added', 'member_role_changed', 'member_removed', 'need_created', 'need_updated',
    'opportunity_status', 'ownership_transferred', 'export')),
  detail jsonb not null default '{}' check (pg_column_size(detail) < 4000),
  created_at timestamptz not null default now()
);
create index org_activity_org_idx on public.org_activity (organization_id, created_at desc);
create index org_activity_athlete_idx on public.org_activity (organization_id, athlete_id, created_at desc);
alter table public.org_activity enable row level security;
create policy org_activity_select on public.org_activity for select to authenticated
  using (public.org_can(organization_id, 'candidates') or public.org_can(organization_id, 'audit') or public.is_admin());
grant select on public.org_activity to authenticated;
-- Inmutable: solo se permite anonimizar (al borrar una cuenta) o borrar en cascada al eliminar la organización.
create or replace function public.guard_org_activity() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id, new.kind, new.detail, new.created_at) is distinct from (old.organization_id, old.kind, old.detail, old.created_at)
       or (new.athlete_id is not null and new.athlete_id is distinct from old.athlete_id)
       or (new.actor_id is not null and new.actor_id is distinct from old.actor_id) then
      raise exception 'audit_immutable' using errcode = '42501';
    end if;
    return new;
  end if;
  if exists (select 1 from public.organizations where id = old.organization_id) then
    raise exception 'audit_immutable' using errcode = '42501';
  end if;
  return old;
end; $$;
create trigger org_activity_immutable before update or delete on public.org_activity
  for each row execute function public.guard_org_activity();

create or replace function public.org_log(p_org uuid, p_athlete uuid, p_kind text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.org_activity (organization_id, athlete_id, actor_id, kind, detail) values (p_org, p_athlete, auth.uid(), p_kind, coalesce(p_detail, '{}'));
$$;
revoke all on function public.org_log(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- 3. Necesidades de recruiting (internas) ---------------------------------------------------------
create table public.recruiting_needs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  program_id uuid references public.org_programs (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  sport_id text not null references public.sports (id),
  position_ids int[] not null default '{}',
  class_years int[] not null default '{}',
  slots int check (slots between 1 and 50),
  min_height_cm int check (min_height_cm between 120 and 230),
  requires_video boolean not null default false,
  requires_documented_academics boolean not null default false,
  countries text[] not null default '{}' check (coalesce(array_length(countries, 1), 0) <= 30),
  start_term text check (char_length(start_term) <= 40),
  internal_notes text check (char_length(internal_notes) <= 2000),
  status text not null default 'active' check (status in ('active', 'paused', 'filled', 'closed')),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint need_program_org check (public.program_in_org(program_id, organization_id))
);
create index recruiting_needs_org_idx on public.recruiting_needs (organization_id, status);
alter table public.recruiting_needs enable row level security;
create policy needs_select on public.recruiting_needs for select to authenticated
  using (public.org_can(organization_id, 'candidates', program_id) or public.org_can(organization_id, 'needs', program_id));
create policy needs_write on public.recruiting_needs for all to authenticated
  using (public.org_can(organization_id, 'needs', program_id)) with check (public.org_can(organization_id, 'needs', program_id));
grant select, insert, update, delete on public.recruiting_needs to authenticated;
create trigger t_needs_updated before update on public.recruiting_needs for each row execute function public.set_updated_at();

-- 4. Candidatos de la organización (pipeline interno) ---------------------------------------------
create table public.org_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  program_id uuid references public.org_programs (id) on delete set null,
  need_id uuid references public.recruiting_needs (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  -- Etapa INTERNA: nunca se muestra al atleta (él ve el estado de su candidatura).
  internal_stage text not null default 'new' check (internal_stage in ('new', 'review', 'priority_review', 'shortlisted', 'contact', 'call', 'active', 'offer', 'committed', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  source text not null default 'discovery' check (source in ('discovery', 'application', 'shortlist', 'referral')),
  close_reason text check (char_length(close_reason) <= 120),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  unique (organization_id, athlete_id),
  constraint candidate_program_org check (public.program_in_org(program_id, organization_id))
);
create index org_candidates_stage_idx on public.org_candidates (organization_id, internal_stage) where archived_at is null;
create index org_candidates_assignee_idx on public.org_candidates (assigned_to) where archived_at is null;
alter table public.org_candidates enable row level security;
create policy candidates_select on public.org_candidates for select to authenticated using (public.org_can(organization_id, 'candidates', program_id));
create policy candidates_write on public.org_candidates for insert to authenticated
  with check (public.org_can(organization_id, 'pipeline', program_id) and public.can_view_athlete(athlete_id, 'profile'));
create policy candidates_update on public.org_candidates for update to authenticated
  using (public.org_can(organization_id, 'pipeline', program_id)) with check (public.org_can(organization_id, 'pipeline', program_id));
grant select, insert, update on public.org_candidates to authenticated;
create trigger t_candidates_updated before update on public.org_candidates for each row execute function public.set_updated_at();

-- El asignado debe ser miembro de la organización.
create or replace function public.guard_org_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = new.assigned_to) then
    raise exception 'assignee_not_member' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    perform public.org_log(new.organization_id, new.athlete_id, 'candidate_created', jsonb_build_object('source', new.source));
  else
    if new.internal_stage is distinct from old.internal_stage then
      new.stage_changed_at := now();
      perform public.org_log(new.organization_id, new.athlete_id, 'stage_changed', jsonb_build_object('from', old.internal_stage, 'to', new.internal_stage));
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      perform public.org_log(new.organization_id, new.athlete_id, 'assigned', jsonb_build_object('to', new.assigned_to));
      if new.assigned_to is not null and new.assigned_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
        perform public.notify(new.assigned_to, 'match.assigned', 'Te han asignado un candidato', 'Revísalo en el portal de recruiting.', '/app/recruit/candidates/' || new.athlete_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_org_candidate before insert or update on public.org_candidates
  for each row execute function public.guard_org_candidate();

-- Una candidatura crea (o vincula) el candidato en la organización y avisa al staff.
create or replace function public.candidate_from_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_title text; r record;
begin
  select organization_id, title into v_org, v_title from public.opportunities where id = new.opportunity_id;
  insert into public.org_candidates (organization_id, athlete_id, opportunity_id, application_id, source, internal_stage)
  values (v_org, new.athlete_id, new.opportunity_id, new.id, 'application', 'new')
  on conflict (organization_id, athlete_id) do update set application_id = coalesce(public.org_candidates.application_id, excluded.application_id),
    opportunity_id = coalesce(public.org_candidates.opportunity_id, excluded.opportunity_id), archived_at = null;
  for r in select user_id from public.organization_members where organization_id = v_org and 'candidates' = any (public.org_role_caps(member_role::text)) loop
    perform public.notify(r.user_id, 'application.received', 'Nueva candidatura', left(coalesce(v_title, 'Oportunidad'), 140), '/app/recruit/candidates');
  end loop;
  return new;
end;
$$;
create trigger candidate_from_application after insert on public.applications
  for each row execute function public.candidate_from_application();

-- Relleno: candidaturas existentes → candidatos (sin pérdida).
insert into public.org_candidates (organization_id, athlete_id, opportunity_id, application_id, source, internal_stage)
select distinct on (o.organization_id, a.athlete_id) o.organization_id, a.athlete_id, a.opportunity_id, a.id, 'application',
  case a.status::text when 'applied' then 'new' when 'reviewed' then 'review' when 'shortlist' then 'shortlisted'
    when 'contacted' then 'contact' when 'information_requested' then 'contact' when 'interview' then 'call' when 'tryout' then 'call'
    when 'offer' then 'offer' when 'accepted' then 'committed' else 'closed' end
  from public.applications a join public.opportunities o on o.id = a.opportunity_id
 order by o.organization_id, a.athlete_id, a.created_at desc
on conflict (organization_id, athlete_id) do nothing;

-- 5. Shortlists de la organización ----------------------------------------------------------------
create table public.org_shortlists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  program_id uuid references public.org_programs (id) on delete set null,
  need_id uuid references public.recruiting_needs (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  -- private: solo su dueño (y admins); team: todo el staff con permiso.
  visibility text not null default 'team' check (visibility in ('private', 'team')),
  owner_id uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortlist_program_org check (public.program_in_org(program_id, organization_id))
);
create index org_shortlists_org_idx on public.org_shortlists (organization_id) where archived_at is null;
alter table public.org_shortlists enable row level security;

create or replace function public.can_see_shortlist(p_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_shortlists s
    where s.id = p_list and public.org_can(s.organization_id, 'shortlist', s.program_id)
      and (s.visibility = 'team' or s.owner_id = auth.uid() or public.org_can(s.organization_id, 'manage_members')));
$$;
create policy shortlists_select on public.org_shortlists for select to authenticated
  using (public.org_can(organization_id, 'shortlist', program_id)
         and (visibility = 'team' or owner_id = auth.uid() or public.org_can(organization_id, 'manage_members')));
create policy shortlists_insert on public.org_shortlists for insert to authenticated
  with check (public.org_can(organization_id, 'shortlist', program_id) and owner_id = auth.uid());
create policy shortlists_update on public.org_shortlists for update to authenticated
  using (public.org_can(organization_id, 'shortlist', program_id)
         and (visibility = 'team' or owner_id = auth.uid() or public.org_can(organization_id, 'manage_members'))) with check (public.org_can(organization_id, 'shortlist', program_id));
grant select, insert, update on public.org_shortlists to authenticated;
create trigger t_shortlists_updated before update on public.org_shortlists for each row execute function public.set_updated_at();

create table public.org_shortlist_members (
  shortlist_id uuid not null references public.org_shortlists (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  position int not null default 0,
  review_status text not null default 'to_review' check (review_status in ('to_review', 'reviewed')),
  priority boolean not null default false,
  assigned_to uuid references public.profiles (id) on delete set null,
  -- Encaje con la necesidad en el momento de añadir (historial mínimo, no un snapshot completo).
  fit_at_add int check (fit_at_add between 0 and 100),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (shortlist_id, athlete_id)
);
create index org_shortlist_members_athlete_idx on public.org_shortlist_members (organization_id, athlete_id);
alter table public.org_shortlist_members enable row level security;
create policy slm_select on public.org_shortlist_members for select to authenticated using (public.can_see_shortlist(shortlist_id));
create policy slm_insert on public.org_shortlist_members for insert to authenticated
  with check (public.can_see_shortlist(shortlist_id) and public.can_view_athlete(athlete_id, 'profile')
              and organization_id = (select organization_id from public.org_shortlists where id = shortlist_id));
create policy slm_update on public.org_shortlist_members for update to authenticated using (public.can_see_shortlist(shortlist_id)) with check (public.can_see_shortlist(shortlist_id));
create policy slm_delete on public.org_shortlist_members for delete to authenticated using (public.can_see_shortlist(shortlist_id));
grant select, insert, update, delete on public.org_shortlist_members to authenticated;

create or replace function public.log_shortlist_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.org_shortlists where id = coalesce(new.shortlist_id, old.shortlist_id);
  if tg_op = 'INSERT' then
    new.added_by := coalesce(auth.uid(), new.added_by);
    if new.assigned_to is not null and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = new.assigned_to) then
      raise exception 'assignee_not_member' using errcode = '42501';
    end if;
    perform public.org_log(new.organization_id, new.athlete_id, 'shortlisted', jsonb_build_object('list', v_name));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null
       and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = new.assigned_to) then
      raise exception 'assignee_not_member' using errcode = '42501';
    end if;
    if new.review_status = 'reviewed' and old.review_status <> 'reviewed' then
      perform public.org_log(new.organization_id, new.athlete_id, 'reviewed', jsonb_build_object('list', v_name));
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      perform public.org_log(new.organization_id, new.athlete_id, 'assigned', jsonb_build_object('to', new.assigned_to, 'list', v_name));
    end if;
    return new;
  else
    perform public.org_log(old.organization_id, old.athlete_id, 'unshortlisted', jsonb_build_object('list', v_name));
    return old;
  end if;
end;
$$;
create trigger log_shortlist_member before insert or update or delete on public.org_shortlist_members
  for each row execute function public.log_shortlist_member();

-- Migración: listas personales de staff de universidades → shortlists privadas de su organización (se conserva saved_athletes).
insert into public.org_shortlists (organization_id, name, visibility, owner_id)
select distinct m.organization_id, sa.list_name, 'private', sa.owner_id
  from public.saved_athletes sa
  join lateral (select om.organization_id from public.organization_members om join public.organizations o on o.id = om.organization_id
                 where om.user_id = sa.owner_id and o.type in ('university', 'college') order by om.created_at limit 1) m on true
 where char_length(sa.list_name) >= 2;
insert into public.org_shortlist_members (shortlist_id, organization_id, athlete_id, added_by, added_at)
select s.id, s.organization_id, sa.athlete_id, sa.owner_id, sa.created_at
  from public.saved_athletes sa
  join public.org_shortlists s on s.owner_id = sa.owner_id and s.name = sa.list_name and s.visibility = 'private'
on conflict do nothing;

-- 6. Notas internas (nunca visibles para el atleta) -----------------------------------------------
create table public.org_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index org_notes_idx on public.org_notes (organization_id, athlete_id, created_at desc);
alter table public.org_notes enable row level security;
create policy org_notes_select on public.org_notes for select to authenticated using (public.org_can(organization_id, 'notes'));
create policy org_notes_insert on public.org_notes for insert to authenticated with check (public.org_can(organization_id, 'notes') and author_id = auth.uid());
create policy org_notes_delete on public.org_notes for delete to authenticated using (author_id = auth.uid() and public.org_can(organization_id, 'notes'));
grant select, insert, delete on public.org_notes to authenticated;

insert into public.org_notes (organization_id, athlete_id, author_id, body, created_at)
select s.organization_id, sa.athlete_id, sa.owner_id, sa.private_note, sa.created_at
  from public.saved_athletes sa join public.org_shortlists s on s.owner_id = sa.owner_id and s.name = sa.list_name and s.visibility = 'private'
 where sa.private_note is not null and char_length(sa.private_note) >= 1;

create or replace function public.log_org_note() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.org_log(new.organization_id, new.athlete_id, 'note_added', '{}'); return new; end; $$;
create trigger log_org_note after insert on public.org_notes for each row execute function public.log_org_note();

-- 7. Tareas del staff -----------------------------------------------------------------------------
create table public.org_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid references public.athlete_profiles (user_id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  due_date date,
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  assignee_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index org_tasks_open_idx on public.org_tasks (organization_id, due_date) where status = 'open';
alter table public.org_tasks enable row level security;
create policy org_tasks_select on public.org_tasks for select to authenticated using (public.org_can(organization_id, 'tasks'));
create policy org_tasks_write on public.org_tasks for all to authenticated using (public.org_can(organization_id, 'tasks')) with check (public.org_can(organization_id, 'tasks'));
grant select, insert, update, delete on public.org_tasks to authenticated;

create or replace function public.guard_org_task() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = new.assignee_id) then
    raise exception 'assignee_not_member' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    perform public.org_log(new.organization_id, new.athlete_id, 'task_created', jsonb_build_object('title', left(new.title, 80)));
    if new.assignee_id is not null and new.assignee_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.notify(new.assignee_id, 'platform.task', 'Nueva tarea: ' || left(new.title, 120), null, '/app/recruit/tasks');
    end if;
  elsif new.status = 'done' and old.status <> 'done' then
    new.done_at := now();
    perform public.org_log(new.organization_id, new.athlete_id, 'task_done', jsonb_build_object('title', left(new.title, 80)));
  end if;
  return new;
end; $$;
create trigger guard_org_task before insert or update on public.org_tasks for each row execute function public.guard_org_task();

-- 8. Salida de staff: pierde el acceso al instante (RLS por membresía); su trabajo queda en la organización ---
create or replace function public.on_org_member_removed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.organizations where id = old.organization_id) then return old; end if;
  update public.org_candidates set assigned_to = null where organization_id = old.organization_id and assigned_to = old.user_id;
  update public.org_shortlist_members set assigned_to = null where organization_id = old.organization_id and assigned_to = old.user_id;
  update public.org_tasks set assignee_id = null where organization_id = old.organization_id and assignee_id = old.user_id and status = 'open';
  update public.org_shortlists set visibility = 'team' where organization_id = old.organization_id and owner_id = old.user_id and visibility = 'private';
  perform public.org_log(old.organization_id, null, 'member_removed', jsonb_build_object('user', old.user_id, 'role', old.member_role));
  return old;
end; $$;
create trigger on_org_member_removed after delete on public.organization_members for each row execute function public.on_org_member_removed();

create or replace function public.on_org_member_changed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.org_log(new.organization_id, null, 'member_added', jsonb_build_object('user', new.user_id, 'role', new.member_role));
  elsif new.member_role is distinct from old.member_role or new.program_ids is distinct from old.program_ids then
    perform public.org_log(new.organization_id, null, 'member_role_changed', jsonb_build_object('user', new.user_id, 'from', old.member_role, 'to', new.member_role));
  end if;
  return new;
end; $$;
create trigger on_org_member_changed after insert or update on public.organization_members for each row execute function public.on_org_member_changed();

create or replace function public.org_transfer_ownership(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid() and member_role = 'owner')
     and not (public.is_org_member(p_org, true) and not exists (select 1 from public.organization_members where organization_id = p_org and member_role = 'owner')) then
    raise exception 'only_owner' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org and user_id = p_user) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  update public.organization_members set member_role = 'owner' where organization_id = p_org and user_id = p_user;
  update public.organization_members set member_role = 'admin' where organization_id = p_org and user_id = auth.uid() and user_id <> p_user;
  perform public.org_log(p_org, null, 'ownership_transferred', jsonb_build_object('to', p_user));
end; $$;
revoke all on function public.org_transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.org_transfer_ownership(uuid, uuid) to authenticated;

-- 9. Solicitudes de información y acceso a documentos ---------------------------------------------
create table public.info_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('full_game_video', 'transcript', 'english_certificate', 'statistic', 'document', 'other')),
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'pending_guardian', 'shared', 'declined', 'revoked', 'expired')),
  document_id uuid references public.athlete_documents (id) on delete set null,
  shared_until date,
  responded_by uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index info_requests_open_unique on public.info_requests (organization_id, athlete_id, kind) where status in ('pending', 'pending_guardian');
create index info_requests_athlete_idx on public.info_requests (athlete_id, status);
alter table public.info_requests enable row level security;
create policy info_select on public.info_requests for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile') or public.org_can(organization_id, 'candidates'));
create policy info_insert on public.info_requests for insert to authenticated
  with check (public.org_can(organization_id, 'request_info') and requested_by = auth.uid() and public.can_view_athlete(athlete_id, 'profile'));
grant select, insert on public.info_requests to authenticated;

create or replace function public.guard_info_request() returns trigger language plpgsql security definer set search_path = public as $$
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
end; $$;
create trigger guard_info_request before insert on public.info_requests for each row execute function public.guard_info_request();

-- Responder: compartir (con un documento propio y fecha límite) o rechazar. Con menores, solo la familia.
create or replace function public.respond_info_request(p_id uuid, p_share boolean, p_document uuid default null, p_until date default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.info_requests;
begin
  select * into r from public.info_requests where id = p_id for update;
  if r.id is null or r.status not in ('pending', 'pending_guardian', 'shared') then raise exception 'not_open' using errcode = 'P0001'; end if;
  if public.is_minor(r.athlete_id) then
    if not public.has_family_link(r.athlete_id, 'edit_profile') then raise exception 'guardian_required' using errcode = '42501'; end if;
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
end; $$;
revoke all on function public.respond_info_request(uuid, boolean, uuid, date) from public, anon;
grant execute on function public.respond_info_request(uuid, boolean, uuid, date) to authenticated;

-- "Disponible en el Passport" ≠ "Compartido con esta universidad": solo con concesión vigente.
create or replace function public.org_has_document_grant(p_document uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.info_requests r
    where r.document_id = p_document and r.status = 'shared' and r.shared_until >= current_date
      and public.org_can(r.organization_id, 'candidates'));
$$;
create policy docs_select_org_grant on public.athlete_documents for select to authenticated using (public.org_has_document_grant(id));

create or replace function public.log_document_access(p_request uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r public.info_requests; v_path text;
begin
  select * into r from public.info_requests where id = p_request;
  if r.id is null or r.status <> 'shared' or r.shared_until < current_date or not public.org_can(r.organization_id, 'candidates') then
    raise exception 'no_grant' using errcode = '42501';
  end if;
  select storage_path into v_path from public.athlete_documents where id = r.document_id;
  perform public.org_log(r.organization_id, r.athlete_id, 'document_accessed', jsonb_build_object('kind', r.kind));
  return v_path;
end; $$;
revoke all on function public.log_document_access(uuid) from public, anon;
grant execute on function public.log_document_access(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'objects') then
    execute $p$create policy docs_storage_select_org_grant on storage.objects for select to authenticated
      using (bucket_id = 'athlete-documents' and exists (select 1 from public.athlete_documents d where d.storage_path = name and public.org_has_document_grant(d.id)))$p$;
  end if;
end $$;

-- Caducidad diaria de concesiones.
create or replace function public.expire_info_grants() returns int language sql security definer set search_path = public as $$
  with u as (update public.info_requests set status = 'expired' where status = 'shared' and shared_until < current_date returning 1) select count(*)::int from u;
$$;
revoke all on function public.expire_info_grants() from public, anon, authenticated;

-- 10. Oportunidad: información de beca honesta, materiales y caducidad -----------------------------
alter table public.opportunities
  add column scholarship_status text not null default 'not_provided'
    check (scholarship_status in ('not_provided', 'potentially_available', 'amount_stated', 'confirmed_in_offer')),
  add column required_materials text[] not null default '{}',
  add column international_eligible text not null default 'unknown' check (international_eligible in ('yes', 'no', 'unknown')),
  add column need_id uuid references public.recruiting_needs (id) on delete set null,
  add column expires_at date,
  add column contact_method text not null default 'gala' check (contact_method in ('gala', 'application_only'));
update public.opportunities set scholarship_status = 'amount_stated' where aid_amount_usd is not null or aid_kind in ('full', 'partial');
-- Sin información de beca no se puede anunciar ayuda ni "beca completa".
alter table public.opportunities add constraint scholarship_claim_consistent
  check (scholarship_status <> 'not_provided' or (aid_amount_usd is null and coalesce(aid_kind, 'unknown') = 'unknown'));
alter table public.opportunities add constraint confirmed_scholarship_not_public
  check (scholarship_status <> 'confirmed_in_offer');

create or replace function public.log_opportunity_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.org_log(new.organization_id, null, 'opportunity_status', jsonb_build_object('opportunity', new.id, 'from', old.status, 'to', new.status));
  end if;
  return new;
end; $$;
create trigger log_opportunity_status after update on public.opportunities for each row execute function public.log_opportunity_status();

-- Aviso al staff 7 días antes de que una oportunidad caduque o cierre su plazo (nunca se renueva sola).
create or replace function public.notify_org_expiring() returns int language plpgsql security definer set search_path = public as $$
declare r record; m record; v_n int := 0;
begin
  for r in select id, organization_id, title from public.opportunities
            where status = 'published' and (coalesce(expires_at, deadline) = current_date + 7) loop
    for m in select user_id from public.organization_members where organization_id = r.organization_id and 'opportunities' = any (public.org_role_caps(member_role::text)) loop
      continue when exists (select 1 from public.notifications where user_id = m.user_id and kind = 'opportunity.expiring' and link = '/app/opportunities/' || r.id);
      perform public.notify(m.user_id, 'opportunity.expiring', left(r.title, 100) || ' caduca en 7 días', 'Revísala, amplíala o ciérrala.', '/app/opportunities/' || r.id);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end; $$;
revoke all on function public.notify_org_expiring() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gala-org-expiring', '47 7 * * *', 'select public.notify_org_expiring()');
    perform cron.schedule('gala-info-grants', '57 3 * * *', 'select public.expire_info_grants()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible';
end $$;

-- 11. Ofertas registradas por la organización (entidad compartida athlete_offers) -------------------
create or replace function public.org_record_offer(p_candidate uuid, p_annual_cost int, p_aid int, p_renewable text, p_in_writing boolean, p_deadline date, p_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.org_candidates; o public.organizations; v_id uuid; v_proc uuid;
begin
  select * into c from public.org_candidates where id = p_candidate;
  if c.id is null or not public.org_can(c.organization_id, 'offers', c.program_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_aid is not null and p_annual_cost is not null and p_aid > p_annual_cost then raise exception 'aid_above_cost' using errcode = '22023'; end if;
  select * into o from public.organizations where id = c.organization_id;
  if o.institution_id is not null then
    select id into v_proc from public.saved_items where athlete_id = c.athlete_id and target_kind = 'institution' and target_id = o.institution_id;
  end if;
  insert into public.athlete_offers (athlete_id, university_name, institution_id, process_id, annual_cost_usd, aid_amount_usd, renewable, in_writing, deadline, source, scholarship_type)
  values (c.athlete_id, o.name, o.institution_id, v_proc, p_annual_cost, p_aid, coalesce(p_renewable, 'unknown'), coalesce(p_in_writing, false), p_deadline, 'organization', coalesce(p_type, 'unknown'))
  returning id into v_id;
  update public.org_candidates set internal_stage = 'offer' where id = c.id and internal_stage not in ('offer', 'committed');
  perform public.org_log(c.organization_id, c.athlete_id, 'offer_recorded', jsonb_build_object('in_writing', p_in_writing));
  perform public.notify(c.athlete_id, 'offer.received', o.name || ' ha registrado una oferta', 'Revísala y compárala en tu pipeline.', '/app/offers');
  return v_id;
end; $$;
revoke all on function public.org_record_offer(uuid, int, int, text, boolean, date, text) from public, anon;
grant execute on function public.org_record_offer(uuid, int, int, text, boolean, date, text) to authenticated;
-- La organización puede ver las ofertas que ella registró.
create policy offers_select_org on public.athlete_offers for select to authenticated
  using (source = 'organization' and exists (select 1 from public.org_candidates c join public.organizations o on o.id = c.organization_id
         where c.athlete_id = athlete_offers.athlete_id and o.institution_id is not distinct from athlete_offers.institution_id and o.name = athlete_offers.university_name
           and public.org_can(c.organization_id, 'offers')));

-- 12. Búsqueda que respeta la privacidad por bloques -----------------------------------------------
-- Los campos de un bloque privado salen como NULL: no se pueden ver ni deducir filtrando por ellos.
create or replace view public.athlete_directory with (security_invoker = true) as
select
  ap.user_id,
  p.display_name,
  p.avatar_url,
  p.country,
  ap.headline,
  case when public.can_view_athlete(ap.user_id, 'sport') then ap.sport_id end as sport_id,
  case when public.can_view_athlete(ap.user_id, 'sport') then ap.primary_position_id end as primary_position_id,
  case when public.can_view_athlete(ap.user_id, 'sport') then ap.secondary_position_id end as secondary_position_id,
  ap.graduation_year,
  case when public.can_view_athlete(ap.user_id, 'sport') then ap.height_cm end as height_cm,
  case when public.can_view_athlete(ap.user_id, 'sport') then ap.current_team end as current_team,
  case when public.can_view_athlete(ap.user_id, 'sport') then ap.competitive_level end as competitive_level,
  case when public.can_view_athlete(ap.user_id, 'goals') then ap.target_divisions else '{}'::public.division[] end as target_divisions,
  ap.open_to_opportunities,
  (public.can_view_athlete(ap.user_id, 'videos') and (ap.highlight_video_url is not null
     or exists (select 1 from public.athlete_videos v where v.athlete_id = ap.user_id))) as has_video,
  ap.updated_at
from public.athlete_profiles ap
join public.profiles p on p.id = ap.user_id;

-- 13. Retención: actividad de organizaciones 3 años; solicitudes cerradas 2 años ------------------
-- (Política inicial documentada en docs; la limpieza programada se activará tras revisión legal.)

-- 14. Eventos de producto ------------------------------------------------------------------------
alter table public.product_events drop constraint product_events_event_check;
alter table public.product_events add constraint product_events_event_check check (event in (
  'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
  'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
  'document_uploaded', 'roster_joined', 'universities_compared',
  'passport_completed', 'passport_shared', 'video_uploaded', 'university_viewed', 'university_saved',
  'match_viewed', 'opportunity_saved', 'comparison_created', 'task_completed', 'dashboard_viewed',
  'pipeline_stage_changed', 'interaction_logged', 'offer_recorded', 'pipeline_decision',
  'recruiting_need_created', 'athlete_discovered', 'athlete_shortlisted', 'candidate_assigned', 'candidate_stage_changed',
  'document_requested', 'document_shared', 'offer_created', 'coach_dashboard_viewed', 'candidates_exported'));
