-- =============================================================================
-- Oleada 1 · Enlace privado de reclutamiento
-- El atleta (o su familia, si es menor) crea un enlace secreto, revocable y con caducidad
-- que un coach abre sin cuenta. Nunca es público ni indexable: solo quien recibe el enlace
-- ve la ficha, y la familia ve cuántas veces se abrió.
--   · Menores: solo madre, padre o tutor legal con vínculo aprobado crea el enlace; la ficha
--     oculta apellidos, equipo y ciudad.
--   · El presupuesto familiar nunca forma parte de la ficha.
-- =============================================================================

-- Madre, padre o tutor legal con vínculo aprobado (no otros familiares).
create or replace function public.is_guardian_of(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_athlete_links l
     where l.parent_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'approved'
       and l.relationship in ('parent', 'legal_guardian')
  );
$$;

-- Quién gestiona los enlaces de un atleta: él mismo si es adulto, o su madre/padre/tutor.
create or replace function public.can_manage_recruiting_links(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() = p_athlete and not public.is_minor(p_athlete)) or public.is_guardian_of(p_athlete);
$$;

create table public.recruiting_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  -- 256 bits aleatorios generados por la base de datos (el cliente no puede elegirlo).
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text not null default 'Enlace' check (char_length(btrim(label)) between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index recruiting_links_athlete_idx on public.recruiting_links (athlete_id, created_at desc);
alter table public.recruiting_links enable row level security;

create table public.recruiting_link_views (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.recruiting_links (id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index recruiting_link_views_link_idx on public.recruiting_link_views (link_id, viewed_at desc);
alter table public.recruiting_link_views enable row level security;

create or replace function public.guard_recruiting_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.is_minor(new.athlete_id) and auth.uid() is not null and not public.is_guardian_of(new.athlete_id) then
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
  -- Solo se puede cambiar la etiqueta y revocar (una vez, sin vuelta atrás).
  if (new.athlete_id, new.token, new.created_by, new.created_at, new.expires_at)
     is distinct from (old.athlete_id, old.token, old.created_by, old.created_at, old.expires_at)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'link_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_recruiting_link before insert or update on public.recruiting_links
  for each row execute function public.guard_recruiting_link();

-- El propio atleta (también menor) ve y revoca sus enlaces; crear exige ser adulto o tutor.
create policy rlinks_select on public.recruiting_links for select to authenticated
  using (athlete_id = auth.uid() or public.is_guardian_of(athlete_id));
create policy rlinks_insert on public.recruiting_links for insert to authenticated
  with check (public.can_manage_recruiting_links(athlete_id));
create policy rlinks_update on public.recruiting_links for update to authenticated
  using (athlete_id = auth.uid() or public.is_guardian_of(athlete_id))
  with check (athlete_id = auth.uid() or public.is_guardian_of(athlete_id));

create policy rlink_views_select on public.recruiting_link_views for select to authenticated
  using (exists (select 1 from public.recruiting_links l
                  where l.id = link_id and (l.athlete_id = auth.uid() or public.is_guardian_of(l.athlete_id))));

-- Ficha de reclutamiento para quien tiene el enlace (sin sesión). Registra cada visita.
create or replace function public.get_recruiting_card(p_token text)
returns table (
  display_name text, avatar_url text, is_minor boolean, sport_name text, position_name text,
  graduation_year int, height_cm int, dominant_side text, current_team text, city text, country text,
  target_divisions public.division[], headline text, video_url text, intended_major text,
  gpa_4 numeric, english_test text, english_score text, sat_score int, expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_link public.recruiting_links;
  v_minor boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return; end if;
  select rl.* into v_link from public.recruiting_links rl
   where rl.token = p_token and rl.revoked_at is null and rl.expires_at > now();
  if not found then return; end if;

  insert into public.recruiting_link_views (link_id) values (v_link.id);
  v_minor := public.is_minor(v_link.athlete_id);

  return query
  select
    case when v_minor then
      split_part(btrim(p.display_name), ' ', 1)
      || case when position(' ' in btrim(p.display_name)) > 0
              then ' ' || left(split_part(btrim(p.display_name), ' ', 2), 1) || '.' else '' end
    else p.display_name end,
    p.avatar_url,
    v_minor,
    s.name_es,
    sp.name_es,
    ap.graduation_year,
    ap.height_cm,
    ap.dominant_side,
    case when v_minor then null else ap.current_team end,
    case when v_minor then null else ap.city end,
    case when v_minor then null else p.country end,
    ap.target_divisions,
    ap.headline,
    ap.highlight_video_url,
    ap.intended_major,
    case when ap.academics_visibility <> 'private' then ac.gpa_4 end,
    case when ap.academics_visibility <> 'private' then ac.english_test end,
    case when ap.academics_visibility <> 'private' then ac.english_score end,
    case when ap.academics_visibility <> 'private' then ac.sat_score end,
    v_link.expires_at
  from public.athlete_profiles ap
  join public.profiles p on p.id = ap.user_id
  left join public.sports s on s.id = ap.sport_id
  left join public.sport_positions sp on sp.id = ap.primary_position_id
  left join public.athlete_academics ac on ac.athlete_id = ap.user_id
  where ap.user_id = v_link.athlete_id;
end;
$$;

grant select, insert, update on public.recruiting_links to authenticated;
grant select on public.recruiting_link_views to authenticated;
revoke all on public.recruiting_links, public.recruiting_link_views from anon;

revoke execute on function public.guard_recruiting_link() from public, anon, authenticated;
revoke execute on function public.is_guardian_of(uuid), public.can_manage_recruiting_links(uuid) from public, anon;
grant execute on function public.is_guardian_of(uuid), public.can_manage_recruiting_links(uuid) to authenticated;
revoke execute on function public.get_recruiting_card(text) from public;
grant execute on function public.get_recruiting_card(text) to anon, authenticated;
