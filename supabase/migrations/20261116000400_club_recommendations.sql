-- Networking: recomendaciones verificadas del club.
-- Solo un club o academia verificada recomienda a un atleta activo en su roster. El atleta (o su
-- familia si es menor) decide si se publica. Publicada, la ve quien ya puede ver su perfil.

create table public.club_recommendations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 40 and 1200),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (athlete_id, organization_id)
);
create index club_recommendations_athlete_idx on public.club_recommendations (athlete_id, status);
create index club_recommendations_org_idx on public.club_recommendations (organization_id);
create index club_recommendations_author_idx on public.club_recommendations (author_id);
alter table public.club_recommendations enable row level security;

create or replace function public.guard_club_recommendation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if not public.is_club_admin(new.organization_id) then
      raise exception 'club_admin_required' using errcode = '42501';
    end if;
    if not exists (select 1 from public.club_roster where organization_id = new.organization_id
                   and athlete_id = new.athlete_id and status = 'active') then
      raise exception 'not_in_roster' using errcode = 'P0001';
    end if;
    new.author_id := v_uid;
    new.status := 'pending';
    new.decided_at := null;
    perform public.notify(new.athlete_id, 'recommendation.new', 'Tu club te ha recomendado',
      'Revísala y decide si se muestra en tu perfil.', '/app/athlete/passport');
    return new;
  end if;

  if (new.athlete_id, new.organization_id, new.author_id, new.created_at)
     is distinct from (old.athlete_id, old.organization_id, old.author_id, old.created_at) then
    raise exception 'recommendation_immutable' using errcode = '42501';
  end if;
  -- El texto solo lo cambia el club mientras está pendiente; publicar u ocultar es cosa del atleta o su familia.
  if new.body is distinct from old.body then
    if not (public.is_club_admin(old.organization_id) and old.status = 'pending' and new.status = old.status) then
      raise exception 'recommendation_transition_not_allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if not (v_uid = old.athlete_id or public.is_guardian_of(old.athlete_id)) then
      raise exception 'recommendation_transition_not_allowed' using errcode = '42501';
    end if;
    new.decided_at := now();
  end if;
  return new;
end $$;
create trigger club_recommendations_guard before insert or update on public.club_recommendations
  for each row execute function public.guard_club_recommendation();
revoke execute on function public.guard_club_recommendation() from public, anon, authenticated;

create policy recs_select_public on public.club_recommendations for select to anon
  using (status = 'published' and public.can_view_athlete(athlete_id, 'profile'));
create policy recs_select on public.club_recommendations for select to authenticated using (
  (status = 'published' and public.can_view_athlete(athlete_id, 'profile'))
  or athlete_id = (select auth.uid())
  or public.is_guardian_of(athlete_id)
  or public.is_org_member(organization_id)
  or public.is_admin()
);
create policy recs_insert on public.club_recommendations for insert to authenticated
  with check (public.is_club_admin(organization_id));
create policy recs_update on public.club_recommendations for update to authenticated
  using (athlete_id = (select auth.uid()) or public.is_guardian_of(athlete_id) or public.is_club_admin(organization_id))
  with check (athlete_id = (select auth.uid()) or public.is_guardian_of(athlete_id) or public.is_club_admin(organization_id));
create policy recs_delete on public.club_recommendations for delete to authenticated
  using (athlete_id = (select auth.uid()) or public.is_club_admin(organization_id) or public.is_admin());

grant select on public.club_recommendations to anon;
grant select, insert, update, delete on public.club_recommendations to authenticated;
