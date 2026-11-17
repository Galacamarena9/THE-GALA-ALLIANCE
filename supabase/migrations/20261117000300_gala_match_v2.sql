-- =============================================================================
-- Gala Match v2 (fase 02). Aditivo y reversible (ver ROLLBACK al final).
-- 1) Capa institucional: más campos OFICIALES de College Scorecard con su procedencia.
-- 2) Guardados (base del futuro Opportunity Pipeline) y señales de feedback (sin ML todavía).
-- =============================================================================

-- 1. Institución: datos oficiales adicionales ------------------------------------------------
alter table public.institutions
  add column enrollment int check (enrollment between 0 and 500000),
  add column ownership text check (ownership in ('public', 'private_nonprofit', 'private_forprofit')),
  add column locale text check (locale in ('city', 'suburb', 'town', 'rural')),
  add column graduation_rate numeric(5, 4) check (graduation_rate between 0 and 1),
  add column tuition_in_state_usd int check (tuition_in_state_usd between 0 and 200000),
  -- Precio neto medio publicado: se calcula sobre estudiantes con ayuda federal de EE. UU.
  -- No es el precio para un atleta internacional; se muestra con esa advertencia.
  add column net_price_usd int check (net_price_usd between 0 and 200000),
  add column intl_share numeric(5, 4) check (intl_share between 0 and 1),
  -- Programas de grado (bachelor) por código CIP de 4 dígitos (p. ej. 5202 = Business Administration).
  add column program_cips text[] not null default '{}',
  -- Procedencia de los datos DEPORTIVOS (asociación, división, conferencia, deportes): no vienen de Scorecard.
  add column athletic_source text check (athletic_source in ('manual_admin', 'organization', 'official_external')),
  add column athletic_updated_at timestamptz;

create index institutions_programs_idx on public.institutions using gin (program_cips);
create index institutions_sports_idx on public.institutions using gin (sports_offered);

-- Los nuevos datos oficiales también son solo de importación (admin), como los anteriores.
create or replace function public.guard_institution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    if (new.athletics_url, new.admissions_url, new.international_url, new.virtual_tour_url)
       is distinct from (old.athletics_url, old.admissions_url, old.international_url, old.virtual_tour_url) then
      new.links_verified_at := now();
      new.links_verified_by := auth.uid();
    end if;
    return new;
  end if;
  if (new.ipeds_unitid, new.name, new.city, new.state, new.website_url, new.price_calculator_url,
      new.cost_attendance_usd, new.tuition_out_of_state_usd, new.data_source, new.source_fetched_at,
      new.sat_avg, new.admission_rate, new.enrollment, new.ownership, new.locale, new.graduation_rate,
      new.tuition_in_state_usd, new.net_price_usd, new.intl_share, new.program_cips)
     is distinct from
     (old.ipeds_unitid, old.name, old.city, old.state, old.website_url, old.price_calculator_url,
      old.cost_attendance_usd, old.tuition_out_of_state_usd, old.data_source, old.source_fetched_at,
      old.sat_avg, old.admission_rate, old.enrollment, old.ownership, old.locale, old.graduation_rate,
      old.tuition_in_state_usd, old.net_price_usd, old.intl_share, old.program_cips) then
    raise exception 'official_data_admin_only' using errcode = '42501';
  end if;
  if (new.athletics_url, new.admissions_url, new.international_url, new.virtual_tour_url)
     is distinct from (old.athletics_url, old.admissions_url, old.international_url, old.virtual_tour_url) then
    new.links_verified_at := null;
    new.links_verified_by := null;
  else
    new.links_verified_at := old.links_verified_at;
    new.links_verified_by := old.links_verified_by;
  end if;
  return new;
end;
$$;

-- Procedencia de los datos deportivos: la pone la base de datos, nunca el cliente.
create or replace function public.stamp_institution_athletics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.association, new.division, new.conference, new.sports_offered)
     is distinct from (old.association, old.division, old.conference, old.sports_offered) then
    new.athletic_updated_at := now();
    if not public.is_admin() then
      new.athletic_source := 'organization';
    elsif new.athletic_source is not distinct from old.athletic_source or new.athletic_source is null then
      new.athletic_source := 'manual_admin';
    end if;
  elsif not public.is_admin() then
    new.athletic_source := old.athletic_source;
    new.athletic_updated_at := old.athletic_updated_at;
  end if;
  return new;
end;
$$;
create trigger t_stamp_institution_athletics before update on public.institutions
  for each row execute function public.stamp_institution_athletics();

-- 2. Guardados: universidades y oportunidades (estados preparados para el Pipeline) ---------
create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  target_kind text not null check (target_kind in ('institution', 'opportunity')),
  target_id uuid not null,
  status text not null default 'saved'
    check (status in ('discovered', 'saved', 'applied', 'contacted', 'call', 'offer', 'decision')),
  -- Shortlist que organiza el atleta (Gala nunca clasifica automáticamente como "segura").
  shortlist_tier text check (shortlist_tier in ('dream', 'target', 'strong_fit', 'backup')),
  note text check (char_length(note) <= 1000),
  -- Encaje en el momento de guardar (para poder avisar si cambia).
  match_score_at_save int check (match_score_at_save between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, target_kind, target_id)
);
create index saved_items_athlete_idx on public.saved_items (athlete_id, created_at desc);
alter table public.saved_items enable row level security;
create policy saved_items_select on public.saved_items for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy saved_items_write on public.saved_items for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
create trigger t_saved_items_updated before update on public.saved_items for each row execute function public.set_updated_at();

-- El destino debe existir (no hay FK polimórfica).
create or replace function public.guard_saved_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_kind = 'institution' and not exists (select 1 from public.institutions where id = new.target_id) then
    raise exception 'target_not_found' using errcode = '23503';
  end if;
  if new.target_kind = 'opportunity' and not exists (select 1 from public.opportunities where id = new.target_id and status = 'published') then
    raise exception 'target_not_found' using errcode = '23503';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.saved_items where athlete_id = new.athlete_id) >= 300 then
    raise exception 'too_many_saved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger t_guard_saved_item before insert or update of target_kind, target_id on public.saved_items
  for each row execute function public.guard_saved_item();

-- 3. Señales de Gala Match (para aprender más adelante; hoy el motor es determinista) ---------
create table public.match_signals (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  target_kind text not null check (target_kind in ('institution', 'opportunity')),
  target_id uuid not null,
  signal text not null check (signal in ('viewed', 'saved', 'unsaved', 'hidden', 'unhidden', 'applied', 'contacted', 'offer', 'not_interested', 'compared')),
  match_score int check (match_score between 0 and 100),
  engine_version text check (char_length(engine_version) <= 40),
  created_at timestamptz not null default now()
);
create index match_signals_athlete_idx on public.match_signals (athlete_id, target_kind, target_id, created_at desc);
alter table public.match_signals enable row level security;
create policy match_signals_select on public.match_signals for select to authenticated using (athlete_id = auth.uid());
create policy match_signals_insert on public.match_signals for insert to authenticated with check (athlete_id = auth.uid());

-- 4. Analítica de producto: nomenclatura objeto_acción, sin datos sensibles (props ≤ 512 bytes).
alter table public.product_events drop constraint product_events_event_check;
alter table public.product_events add constraint product_events_event_check check (event in (
  'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
  'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
  'document_uploaded', 'roster_joined', 'universities_compared',
  'passport_completed', 'passport_shared', 'video_uploaded', 'university_viewed', 'university_saved',
  'match_viewed', 'opportunity_saved', 'comparison_created', 'task_completed', 'dashboard_viewed'));

grant select, insert, update, delete on public.saved_items to authenticated;
grant select, insert on public.match_signals to authenticated;
revoke all on public.saved_items, public.match_signals from anon;
revoke execute on function public.stamp_institution_athletics(), public.guard_saved_item() from public, anon, authenticated;

-- =============================================================================
-- ROLLBACK:
--   restaurar product_events_event_check con la lista de 20261113000700 (antes, borrar eventos nuevos);
--   drop table public.match_signals, public.saved_items;
--   drop function public.guard_saved_item();
--   drop trigger t_stamp_institution_athletics on public.institutions; drop function public.stamp_institution_athletics();
--   drop index institutions_programs_idx, institutions_sports_idx;
--   alter table public.institutions drop column enrollment, drop column ownership, drop column locale, drop column graduation_rate,
--     drop column tuition_in_state_usd, drop column net_price_usd, drop column intl_share, drop column program_cips,
--     drop column athletic_source, drop column athletic_updated_at;
-- =============================================================================
