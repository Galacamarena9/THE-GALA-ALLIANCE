-- =============================================================================
-- 1. CRM de coaches: responsable, próxima acción y fecha por candidato.
--    Tabla aparte (no columnas en applications) porque el atleta lee su candidatura
--    y este seguimiento es interno de la organización.
-- 2. Documentos: fecha de caducidad (pasaporte, resultados de exámenes, visados).
-- Reversión: drop table public.application_tracking; alter table public.athlete_documents drop column expires_on;
-- =============================================================================
create table if not exists public.application_tracking (
  application_id uuid primary key references public.applications (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,
  next_action text check (char_length(next_action) <= 300),
  next_action_due date,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists application_tracking_org_idx on public.application_tracking (organization_id, next_action_due);
create index if not exists application_tracking_owner_idx on public.application_tracking (owner_id);
create index if not exists application_tracking_updated_by_idx on public.application_tracking (updated_by);
alter table public.application_tracking enable row level security;

create or replace function public.guard_application_tracking()
returns trigger language plpgsql set search_path = public as $$
begin
  -- La organización sale siempre de la candidatura: no se puede falsear.
  new.organization_id := public.application_org(new.application_id);
  if tg_op = 'UPDATE' and new.application_id is distinct from old.application_id then
    raise exception 'tracking_immutable' using errcode = '42501';
  end if;
  if new.owner_id is not null and not exists (
    select 1 from public.organization_members m where m.organization_id = new.organization_id and m.user_id = new.owner_id
  ) then
    raise exception 'owner_not_member' using errcode = 'P0001';
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
create or replace trigger guard_application_tracking before insert or update on public.application_tracking
  for each row execute function public.guard_application_tracking();

create policy tracking_select on public.application_tracking for select to authenticated
  using (public.is_org_member(organization_id));
create policy tracking_insert on public.application_tracking for insert to authenticated
  with check (public.is_org_member(public.application_org(application_id)));
create policy tracking_update on public.application_tracking for update to authenticated
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy tracking_delete on public.application_tracking for delete to authenticated
  using (public.is_org_member(organization_id));

grant select, insert, update, delete on public.application_tracking to authenticated;
revoke execute on function public.guard_application_tracking() from public, anon, authenticated;

alter table public.athlete_documents add column if not exists expires_on date;
