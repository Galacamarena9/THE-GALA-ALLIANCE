-- =============================================================================
-- Agency Core (Fase 1 del Agent & Agency OS)
--   1. Roles de agencia (owner, admin, manager, recruiter, scout, compliance, viewer).
--   2. Contactos de universidades y coaches, privados de cada agencia.
--   3. Procesos de recruiting: atleta + universidad + temporada, con 13 fases.
--   4. Historial automático de fases e interacciones registradas a mano.
--   5. Tareas con responsable y fecha.
-- Reglas:
--   · Solo se abren procesos con atletas que han ACEPTADO la representación (activa).
--   · Si el atleta termina la relación, los procesos se conservan pero no se abren nuevos.
--   · Ninguna otra agencia ve nada. El rol "viewer" lee pero no escribe.
--   · El atleta ve solo los procesos que la agencia comparte, y solo los cambios de fase
--     (nunca notas internas ni tareas).
-- =============================================================================

-- 1. Rol dentro de la agencia (null = recruiter por defecto) ----------------------
alter table public.organization_members
  add column if not exists agency_role text
  check (agency_role in ('owner', 'admin', 'manager', 'recruiter', 'scout', 'compliance', 'viewer'));

create or replace function public.agency_can_write(p_agency uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = p_agency and m.user_id = (select auth.uid())
       and coalesce(m.agency_role, 'recruiter') <> 'viewer'
  );
$$;

create or replace function public.agency_has_active_representation(p_agency uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_representations r
     where r.agency_id = p_agency and r.athlete_id = p_athlete and r.status = 'active'
  );
$$;

-- 2. Contactos de universidades y coaches ------------------------------------------
create table if not exists public.agency_contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  institution_name text not null check (char_length(btrim(institution_name)) between 2 and 200),
  sport_id text references public.sports (id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  role_title text check (char_length(role_title) <= 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 40),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agency_contacts_agency_idx on public.agency_contacts (agency_id, institution_name);
create index if not exists agency_contacts_institution_idx on public.agency_contacts (institution_id);
create index if not exists agency_contacts_sport_idx on public.agency_contacts (sport_id);
create index if not exists agency_contacts_created_by_idx on public.agency_contacts (created_by);
alter table public.agency_contacts enable row level security;

-- 3. Procesos de recruiting -----------------------------------------------------------
create table if not exists public.recruiting_cases (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  institution_name text not null check (char_length(btrim(institution_name)) between 2 and 200),
  sport_id text references public.sports (id),
  cycle text not null check (cycle ~ '^[0-9]{4}(-[0-9]{2})?$'),
  stage text not null default 'research' check (stage in (
    'research', 'fit_review', 'shortlisted', 'approved_to_contact', 'contacted',
    'response_received', 'active_conversation', 'evaluation_visit', 'academic_review',
    'offer_discussion', 'decision_pending', 'committed', 'closed')),
  owner_id uuid references public.profiles (id) on delete set null,
  contact_id uuid references public.agency_contacts (id) on delete set null,
  next_action text check (char_length(next_action) <= 300),
  next_action_due date,
  outcome_reason text check (char_length(outcome_reason) <= 500),
  shared_with_athlete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, athlete_id, institution_name, cycle)
);
create index if not exists recruiting_cases_agency_idx on public.recruiting_cases (agency_id, stage);
create index if not exists recruiting_cases_athlete_idx on public.recruiting_cases (athlete_id);
create index if not exists recruiting_cases_owner_idx on public.recruiting_cases (owner_id);
create index if not exists recruiting_cases_contact_idx on public.recruiting_cases (contact_id);
create index if not exists recruiting_cases_institution_idx on public.recruiting_cases (institution_id);
create index if not exists recruiting_cases_sport_idx on public.recruiting_cases (sport_id);
alter table public.recruiting_cases enable row level security;

create or replace function public.guard_recruiting_case()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.agency_has_active_representation(new.agency_id, new.athlete_id) then
      raise exception 'representation_required' using errcode = 'P0001';
    end if;
    new.owner_id := coalesce(new.owner_id, (select auth.uid()));
    new.created_at := now();
  else
    if (new.agency_id, new.athlete_id, new.created_at) is distinct from (old.agency_id, old.athlete_id, old.created_at) then
      raise exception 'case_immutable' using errcode = '42501';
    end if;
  end if;
  if new.owner_id is not null and not exists (
    select 1 from public.organization_members m where m.organization_id = new.agency_id and m.user_id = new.owner_id
  ) then
    raise exception 'owner_not_member' using errcode = 'P0001';
  end if;
  if new.contact_id is not null and not exists (
    select 1 from public.agency_contacts c where c.id = new.contact_id and c.agency_id = new.agency_id
  ) then
    raise exception 'contact_not_in_agency' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create or replace trigger guard_recruiting_case before insert or update on public.recruiting_cases
  for each row execute function public.guard_recruiting_case();

-- 4. Historial e interacciones -------------------------------------------------------
create table if not exists public.recruiting_case_activities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.recruiting_cases (id) on delete cascade,
  kind text not null check (kind in ('stage_change', 'email', 'call', 'meeting', 'message', 'note')),
  from_stage text,
  to_stage text,
  body text check (char_length(body) <= 5000),
  occurred_on date not null default current_date,
  actor_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists case_activities_case_idx on public.recruiting_case_activities (case_id, created_at desc);
create index if not exists case_activities_actor_idx on public.recruiting_case_activities (actor_id);
alter table public.recruiting_case_activities enable row level security;

create or replace function public.log_recruiting_case_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.recruiting_case_activities (case_id, kind, to_stage, actor_id)
    values (new.id, 'stage_change', new.stage, (select auth.uid()));
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values ((select auth.uid()), 'recruiting_case.opened', 'recruiting_cases', new.id,
            jsonb_build_object('agency_id', new.agency_id, 'athlete_id', new.athlete_id));
  elsif new.stage is distinct from old.stage then
    insert into public.recruiting_case_activities (case_id, kind, from_stage, to_stage, body, actor_id)
    values (new.id, 'stage_change', old.stage, new.stage, new.outcome_reason, (select auth.uid()));
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values ((select auth.uid()), 'recruiting_case.stage', 'recruiting_cases', new.id,
            jsonb_build_object('from', old.stage, 'to', new.stage));
  elsif new.shared_with_athlete is distinct from old.shared_with_athlete then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values ((select auth.uid()), 'recruiting_case.sharing', 'recruiting_cases', new.id,
            jsonb_build_object('shared', new.shared_with_athlete));
  end if;
  return new;
end;
$$;
create or replace trigger log_recruiting_case_stage after insert or update on public.recruiting_cases
  for each row execute function public.log_recruiting_case_stage();

-- 5. Tareas -----------------------------------------------------------------------------
create table if not exists public.recruiting_case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.recruiting_cases (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists case_tasks_case_idx on public.recruiting_case_tasks (case_id, done, due_date);
create index if not exists case_tasks_assignee_idx on public.recruiting_case_tasks (assignee_id);
create index if not exists case_tasks_created_by_idx on public.recruiting_case_tasks (created_by);
alter table public.recruiting_case_tasks enable row level security;

create or replace function public.guard_recruiting_task()
returns trigger language plpgsql set search_path = public as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.recruiting_cases where id = new.case_id;
  if new.assignee_id is not null and not exists (
    select 1 from public.organization_members m where m.organization_id = v_agency and m.user_id = new.assignee_id
  ) then
    raise exception 'assignee_not_member' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.case_id is distinct from old.case_id then
    raise exception 'task_immutable' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.done := false;
    new.done_at := null;
  elsif new.done is distinct from old.done then
    new.done_at := case when new.done then now() else null end;
  end if;
  return new;
end;
$$;
create or replace trigger guard_recruiting_task before insert or update on public.recruiting_case_tasks
  for each row execute function public.guard_recruiting_task();

-- 6. Políticas ----------------------------------------------------------------------------
create policy agency_contacts_select on public.agency_contacts for select to authenticated
  using (public.is_org_member(agency_id));
create policy agency_contacts_insert on public.agency_contacts for insert to authenticated
  with check (public.agency_can_write(agency_id));
create policy agency_contacts_update on public.agency_contacts for update to authenticated
  using (public.agency_can_write(agency_id)) with check (public.agency_can_write(agency_id));
create policy agency_contacts_delete on public.agency_contacts for delete to authenticated
  using (public.agency_can_write(agency_id));

create policy recruiting_cases_select on public.recruiting_cases for select to authenticated
  using (public.is_org_member(agency_id) or (athlete_id = (select auth.uid()) and shared_with_athlete));
create policy recruiting_cases_insert on public.recruiting_cases for insert to authenticated
  with check (public.agency_can_write(agency_id));
create policy recruiting_cases_update on public.recruiting_cases for update to authenticated
  using (public.agency_can_write(agency_id)) with check (public.agency_can_write(agency_id));

create policy case_activities_select on public.recruiting_case_activities for select to authenticated
  using (exists (
    select 1 from public.recruiting_cases c where c.id = case_id and (
      public.is_org_member(c.agency_id)
      or (kind = 'stage_change' and c.athlete_id = (select auth.uid()) and c.shared_with_athlete))));
create policy case_activities_insert on public.recruiting_case_activities for insert to authenticated
  with check (kind <> 'stage_change' and actor_id = (select auth.uid()) and exists (
    select 1 from public.recruiting_cases c where c.id = case_id and public.agency_can_write(c.agency_id)));
create policy case_activities_delete on public.recruiting_case_activities for delete to authenticated
  using (kind <> 'stage_change' and actor_id = (select auth.uid()));

create policy case_tasks_select on public.recruiting_case_tasks for select to authenticated
  using (exists (select 1 from public.recruiting_cases c where c.id = case_id and public.is_org_member(c.agency_id)));
create policy case_tasks_insert on public.recruiting_case_tasks for insert to authenticated
  with check (exists (select 1 from public.recruiting_cases c where c.id = case_id and public.agency_can_write(c.agency_id)));
create policy case_tasks_update on public.recruiting_case_tasks for update to authenticated
  using (exists (select 1 from public.recruiting_cases c where c.id = case_id and public.agency_can_write(c.agency_id)))
  with check (exists (select 1 from public.recruiting_cases c where c.id = case_id and public.agency_can_write(c.agency_id)));
create policy case_tasks_delete on public.recruiting_case_tasks for delete to authenticated
  using (exists (select 1 from public.recruiting_cases c where c.id = case_id and public.agency_can_write(c.agency_id)));

-- 7. Privilegios -----------------------------------------------------------------------------
grant select, insert, update, delete on public.agency_contacts to authenticated;
grant select, insert, update on public.recruiting_cases to authenticated;
grant select, insert, delete on public.recruiting_case_activities to authenticated;
grant select, insert, update, delete on public.recruiting_case_tasks to authenticated;
revoke execute on function public.guard_recruiting_case(), public.log_recruiting_case_stage(),
  public.guard_recruiting_task() from public, anon, authenticated;
revoke execute on function public.agency_can_write(uuid), public.agency_has_active_representation(uuid, uuid) from public, anon;
grant execute on function public.agency_can_write(uuid), public.agency_has_active_representation(uuid, uuid) to authenticated;
