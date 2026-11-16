-- Networking: Showcase Day virtual. Jornadas reales programadas por administración; los atletas se
-- inscriben y, solo mientras la jornada está en directo, los reclutadores verificados ven la selección
-- y piden contacto por el flujo seguro de siempre (con circuito familiar para menores).

create table public.showcase_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 4 and 120),
  description text check (char_length(description) <= 1000),
  sport_id text references public.sports (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '7 days')
);
create index showcase_events_time_idx on public.showcase_events (starts_at);
create index showcase_events_sport_idx on public.showcase_events (sport_id);
alter table public.showcase_events enable row level security;

create table public.showcase_entries (
  event_id uuid not null references public.showcase_events (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, athlete_id)
);
create index showcase_entries_athlete_idx on public.showcase_entries (athlete_id);
alter table public.showcase_entries enable row level security;

create policy sev_select on public.showcase_events for select to anon, authenticated using (true);
create policy sev_admin on public.showcase_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Inscritos: el propio atleta y su familia siempre; reclutadores verificados solo en directo
-- (y solo si pueden ver ese perfil); administración siempre.
create policy sen_select on public.showcase_entries for select to authenticated using (
  athlete_id = (select auth.uid())
  or public.is_guardian_of(athlete_id)
  or public.is_admin()
  or (
    public.is_verified_recruiter()
    and public.can_view_athlete(athlete_id, 'profile')
    and exists (select 1 from public.showcase_events e where e.id = event_id and now() between e.starts_at and e.ends_at)
  )
);
create policy sen_insert on public.showcase_entries for insert to authenticated with check (
  (athlete_id = (select auth.uid()) or public.is_guardian_of(athlete_id))
  and exists (select 1 from public.showcase_events e where e.id = event_id and e.ends_at > now())
);
create policy sen_delete on public.showcase_entries for delete to authenticated using (
  athlete_id = (select auth.uid()) or public.is_guardian_of(athlete_id) or public.is_admin()
);

grant select on public.showcase_events to anon, authenticated;
grant insert, update, delete on public.showcase_events to authenticated;
grant select, insert, delete on public.showcase_entries to authenticated;
