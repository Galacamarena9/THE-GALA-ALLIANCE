-- =============================================================================
-- Fase 03 · Universities & College Recruiting. Aditivo y reversible (ROLLBACK al final).
--   Universidad (institutions) → programas deportivos (institution_programs) → oportunidades (opportunities)
--   → miembros de organización → candidaturas. Cada capa con su procedencia y su fecha.
-- =============================================================================

-- 1. Programas deportivos por universidad ---------------------------------------------------
create table public.institution_programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  sport_id text not null references public.sports (id),
  gender text not null check (gender in ('men', 'women', 'coed')),
  association text check (association in ('ncaa', 'naia', 'njcaa', 'other')),
  division public.division,
  conference text check (char_length(conference) <= 120),
  program_url text check (program_url is null or program_url ~ '^https://'),
  -- Procedencia: equipo de Gala, la propia universidad verificada o una fuente oficial externa (con URL).
  source text not null check (source in ('manual_admin', 'organization', 'official_external')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, sport_id, gender),
  constraint external_needs_url check (source <> 'official_external' or source_url is not null)
);
create index institution_programs_sport_idx on public.institution_programs (sport_id, gender, division);
alter table public.institution_programs enable row level security;
create policy programs_read on public.institution_programs for select to anon, authenticated using (true);
create policy programs_write on public.institution_programs for all to authenticated
  using (public.is_admin() or exists (select 1 from public.organizations o where o.institution_id = institution_programs.institution_id
         and o.verification_status = 'verified' and public.is_org_member(o.id, true)))
  with check (public.is_admin() or exists (select 1 from public.organizations o where o.institution_id = institution_programs.institution_id
         and o.verification_status = 'verified' and public.is_org_member(o.id, true)));
create trigger t_programs_updated before update on public.institution_programs for each row execute function public.set_updated_at();

-- La procedencia la fija la base de datos: una organización nunca puede marcar su dato como "admin" u "oficial externo".
create or replace function public.guard_institution_program()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.source := 'organization';
    new.source_url := null;
    new.verified_at := null;
  elsif new.verified_at is null then
    new.verified_at := now();
  end if;
  return new;
end;
$$;
create trigger t_guard_institution_program before insert or update on public.institution_programs
  for each row execute function public.guard_institution_program();

-- institutions.sports_offered (lo usa Gala Match) se deriva de los programas: una sola fuente de verdad.
create or replace function public.sync_institution_sports()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inst uuid := coalesce(new.institution_id, old.institution_id);
begin
  update public.institutions set
    sports_offered = coalesce((select array_agg(distinct sport_id order by sport_id) from public.institution_programs where institution_id = v_inst), '{}'),
    athletic_updated_at = now()
  where id = v_inst;
  return null;
end;
$$;
create trigger t_sync_institution_sports after insert or update or delete on public.institution_programs
  for each row execute function public.sync_institution_sports();

-- Los deportes ya marcados en una institución pasan a programas (género desconocido → coed) sin perder nada.
insert into public.institution_programs (institution_id, sport_id, gender, association, division, conference, source, verified_at)
select i.id, s.sport, 'coed', i.association, i.division, i.conference, coalesce(i.athletic_source, 'manual_admin'), i.athletic_updated_at
  from public.institutions i, unnest(i.sports_offered) as s(sport)
 where exists (select 1 from public.sports where id = s.sport)
on conflict do nothing;

-- 2. Reclamar una universidad ("Claim this university") ----------------------------------------
create table public.institution_claims (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  work_email text not null check (work_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and char_length(work_email) <= 254),
  email_domain text generated always as (lower(split_part(work_email, '@', 2))) stored,
  role_title text not null check (char_length(btrim(role_title)) between 2 and 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Calculado al crear: ¿el dominio del email coincide con la web oficial de la universidad?
  domain_matches boolean not null default false,
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index institution_claims_one_open on public.institution_claims (institution_id, user_id) where status = 'pending';
alter table public.institution_claims enable row level security;
create policy claims_select on public.institution_claims for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy claims_insert on public.institution_claims for insert to authenticated with check (user_id = auth.uid());
create policy claims_admin_update on public.institution_claims for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_institution_claim()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_site text; v_domain text := lower(split_part(new.work_email, '@', 2));
begin
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    if new.organization_id is not null and not public.is_org_member(new.organization_id, true) then
      raise exception 'not_org_admin' using errcode = '42501';
    end if;
    select lower(regexp_replace(regexp_replace(website_url, '^https://(www\.)?', ''), '/.*$', '')) into v_site
      from public.institutions where id = new.institution_id;
    new.domain_matches := coalesce(v_site is not null and (v_domain = v_site or v_domain like '%.' || v_site), false);
    return new;
  end if;
  if new.status <> old.status then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    -- Aprobar vincula la organización a la universidad (solo si la organización ya está verificada).
    if new.status = 'approved' then
      if new.organization_id is null or not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
        raise exception 'claim_needs_verified_org' using errcode = 'P0001';
      end if;
      update public.organizations set institution_id = new.institution_id where id = new.organization_id;
    end if;
  end if;
  new.domain_matches := old.domain_matches;
  return new;
end;
$$;
create trigger t_guard_institution_claim before insert or update on public.institution_claims
  for each row execute function public.guard_institution_claim();

-- 3. Ciclo de vida de las oportunidades -----------------------------------------------------
alter table public.opportunities add column last_confirmed_at timestamptz;
update public.opportunities set last_confirmed_at = coalesce(published_at, updated_at) where status = 'published';

-- Los miembros también pueden cerrar o marcar como cubierta una oportunidad publicada.
create or replace function public.guard_opportunity_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') and not public.is_admin() then
      raise exception 'opportunity_status_admin_only' using errcode = '42501';
    end if;
    if not public.is_admin() then
      new.review_note := null;
      new.reviewed_by := null;
      new.published_at := null;
    end if;
    return new;
  end if;

  if not public.is_admin() then
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.published_at := old.published_at;
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
  end if;

  if new.status is distinct from old.status and not public.is_admin() then
    if not ((new.status in ('draft', 'pending_review') and old.status in ('draft', 'pending_review', 'rejected', 'published'))
            or (new.status in ('closed', 'filled') and old.status = 'published')) then
      raise exception 'opportunity_status_admin_only' using errcode = '42501';
    end if;
  end if;

  if old.status = 'published' and new.status = 'published' and not public.is_admin()
     and (new.title, new.description, new.annual_cost_usd, new.aid_amount_usd, new.aid_kind, new.deadline)
         is distinct from (old.title, old.description, old.annual_cost_usd, old.aid_amount_usd, old.aid_kind, old.deadline) then
    new.status := 'pending_review';
    new.published_at := null;
  end if;

  if new.status = 'published' and old.status <> 'published' then
    if not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'organization_not_verified' using errcode = 'P0001';
    end if;
    new.published_at := now();
    new.reviewed_by := auth.uid();
  end if;
  if new.status = 'published' then
    new.last_confirmed_at := coalesce(new.last_confirmed_at, now());
  end if;
  return new;
end;
$$;

-- Caducidad: nada se queda "activo" para siempre.
--   · con plazo: caduca al día siguiente del plazo;
--   · sin plazo: caduca si la organización no la confirma en 120 días.
create or replace function public.expire_stale_opportunities()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.opportunities set status = 'expired'
   where status = 'published'
     and ((deadline is not null and deadline < current_date)
          or (deadline is null and coalesce(last_confirmed_at, published_at, updated_at) < now() - interval '120 days'));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- La organización confirma que sigue abierta (renueva los 120 días).
create or replace function public.confirm_opportunity_open(p_opportunity uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.opportunities o set last_confirmed_at = now()
   where o.id = p_opportunity and o.status = 'published'
     and (public.is_admin() or public.is_org_member(o.organization_id, false));
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gala-expire-opportunities', '7 4 * * *', 'select public.expire_stale_opportunities()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: ejecuta expire_stale_opportunities() desde el panel de admin';
end $$;

-- 4. Aviso a quien guardó la universidad cuando publica una oportunidad (sin spam: una por oportunidad) ---
create or replace function public.notify_saved_institution_followers()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inst uuid; v_name text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select o.institution_id into v_inst from public.organizations o where o.id = new.organization_id;
    if v_inst is null then return new; end if;
    select name into v_name from public.institutions where id = v_inst;
    insert into public.notifications (user_id, kind, title, body, link)
    select s.athlete_id, 'saved_university_opportunity', left('Nueva oportunidad en ' || v_name, 160), left(new.title, 500), '/app/match/opportunity/' || new.id
      from public.saved_items s
     where s.target_kind = 'institution' and s.target_id = v_inst;
  end if;
  return new;
end;
$$;
create trigger t_notify_saved_institution_followers after insert or update of status on public.opportunities
  for each row execute function public.notify_saved_institution_followers();

-- 5. Calidad de datos para el panel de admin --------------------------------------------------
create or replace function public.admin_institution_quality()
returns table (kind text, institution_id uuid, name text, state text, detail text)
language sql stable security definer set search_path = public as $$
  select 'duplicate', i.id, i.name, i.state, 'Mismo nombre y estado que otra universidad'
    from public.institutions i
   where public.is_admin()
     and exists (select 1 from public.institutions j where j.id <> i.id and lower(j.name) = lower(i.name) and j.state is not distinct from i.state)
  union all
  select 'stale_official', i.id, i.name, i.state, 'Datos oficiales de hace más de 13 meses'
    from public.institutions i
   where public.is_admin() and i.data_source = 'college_scorecard' and i.source_fetched_at < now() - interval '13 months'
  union all
  select 'program_unverified', i.id, i.name, i.state, 'Programa deportivo aportado por la organización, sin revisar'
    from public.institutions i
   where public.is_admin() and exists (select 1 from public.institution_programs p where p.institution_id = i.id and p.source = 'organization' and p.verified_at is null)
  order by 1, 3
  limit 300;
$$;

grant select on public.institution_programs to anon;
grant select, insert, update, delete on public.institution_programs to authenticated;
grant select, insert on public.institution_claims to authenticated;
grant update (status, review_note) on public.institution_claims to authenticated;
revoke all on public.institution_claims from anon;
revoke execute on function public.guard_institution_program(), public.sync_institution_sports(), public.guard_institution_claim(),
  public.notify_saved_institution_followers() from public, anon, authenticated;
revoke all on function public.expire_stale_opportunities(), public.admin_institution_quality(), public.confirm_opportunity_open(uuid) from public, anon;
grant execute on function public.expire_stale_opportunities(), public.admin_institution_quality(), public.confirm_opportunity_open(uuid) to authenticated;

-- =============================================================================
-- ROLLBACK:
--   select cron.unschedule('gala-expire-opportunities');
--   drop function public.admin_institution_quality(), public.confirm_opportunity_open(uuid), public.expire_stale_opportunities();
--   drop trigger t_notify_saved_institution_followers on public.opportunities; drop function public.notify_saved_institution_followers();
--   restaurar guard_opportunity_status desde 20261113000100_foundation.sql; alter table public.opportunities drop column last_confirmed_at;
--   drop table public.institution_claims; drop function public.guard_institution_claim();
--   drop table public.institution_programs (los deportes siguen en institutions.sports_offered);
--   drop function public.guard_institution_program(), public.sync_institution_sports();
-- =============================================================================
