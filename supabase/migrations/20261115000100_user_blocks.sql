-- =============================================================================
-- Fase 1 · Bloquear a una persona
-- Cualquier usuario puede bloquear a otro. Si quien bloquea es el atleta, o su madre, padre
-- o tutor con vínculo aprobado, el bloqueado deja de ver su perfil. Con un bloqueo entre
-- dos personas, ninguna de las dos puede escribir en sus conversaciones.
-- El bloqueado nunca ve quién le ha bloqueado. Los bloqueos solo se crean y se borran.
-- =============================================================================

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;

create policy user_blocks_select on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

grant select, insert, delete on public.user_blocks to authenticated;
revoke all on public.user_blocks from anon;

-- ¿Me ha bloqueado esta persona (o, si es atleta, su familia con vínculo aprobado)?
create or replace function public.is_blocked_by_user(p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks b
     where b.blocked_id = auth.uid()
       and (b.blocker_id = p_target
            or exists (select 1 from public.parent_athlete_links l
                        where l.athlete_id = p_target and l.parent_id = b.blocker_id and l.status = 'approved'))
  );
$$;

-- ¿Hay un bloqueo, en cualquier dirección, entre yo y esta persona?
create or replace function public.has_block_with(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_blocked_by_user(p_other)
      or exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_other);
$$;

revoke execute on function public.is_blocked_by_user(uuid), public.has_block_with(uuid) from public, anon;
grant execute on function public.is_blocked_by_user(uuid), public.has_block_with(uuid) to authenticated;

-- El perfil deja de ser visible para quien ha sido bloqueado (misma función de siempre + una comprobación).
create or replace function public.can_view_athlete(p_athlete uuid, p_block text default 'profile')
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_vis public.visibility_level;
  v_minor boolean;
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and v_uid = p_athlete then return true; end if;
  if public.is_admin() then return true; end if;
  if public.has_family_link(p_athlete, case p_block when 'academics' then 'view_academics' else 'view_profile' end) then
    return true;
  end if;
  if v_uid is not null and public.is_blocked_by_athlete(p_athlete) then return false; end if;
  if v_uid is not null and public.is_blocked_by_user(p_athlete) then return false; end if;

  select case p_block
           when 'academics' then academics_visibility
           when 'stats' then stats_visibility
           else profile_visibility
         end
    into v_vis
    from public.athlete_profiles where user_id = p_athlete;

  if v_vis is null or v_vis = 'private' then return false; end if;
  if p_block <> 'profile' and not public.can_view_athlete(p_athlete, 'profile') then
    return false;
  end if;
  if public.has_connection_with_athlete(p_athlete) then return true; end if;

  v_minor := public.is_minor(p_athlete);
  if v_minor then
    return v_uid is not null and v_vis in ('public', 'members') and public.is_verified_recruiter();
  end if;

  return case v_vis
           when 'public' then true
           when 'members' then v_uid is not null
           else false
         end;
end;
$$;

-- Mensajes: con un bloqueo entre el remitente y el atleta o quien abrió la conversación, no se puede escribir.
drop policy if exists cmsg_insert on public.contact_messages;
create policy cmsg_insert on public.contact_messages for insert to authenticated with check (
  public.is_contact_participant(request_id)
  and not exists (
    select 1 from public.contact_requests r
     where r.id = request_id
       and ((r.athlete_id <> auth.uid() and public.has_block_with(r.athlete_id))
            or (r.requested_by <> auth.uid() and public.has_block_with(r.requested_by)))
  )
);
