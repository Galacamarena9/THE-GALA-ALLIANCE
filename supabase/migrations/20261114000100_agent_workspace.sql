-- =============================================================================
-- Agent Workspace (Hito 1)
--   1. Notas privadas de agencia sobre atletas de su cartera (y seguimientos con fecha).
--   2. Auditoría de cada cambio de estado de una representación.
-- Reglas que NO cambian: guard_agent_representation() (solo el atleta acepta o rechaza,
-- solo mayores de edad, solo organizaciones de tipo agencia).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Notas privadas de agencia
--    · Solo las leen los miembros de esa agencia (nunca el atleta ni otras organizaciones).
--    · Solo se crean sobre atletas con los que la agencia tiene o tuvo relación
--      (solicitud pendiente, activa o terminada; nunca tras un rechazo).
--    · Solo el autor edita o borra. Agencia, atleta y autor son inmutables.
-- -----------------------------------------------------------------------------
create table public.agency_athlete_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'follow_up')),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_due_only_follow_up check (kind = 'follow_up' or (due_date is null and not done))
);
create index agency_notes_athlete_idx on public.agency_athlete_notes (agency_id, athlete_id, created_at desc);
create index agency_notes_open_followups_idx on public.agency_athlete_notes (agency_id, due_date)
  where kind = 'follow_up' and not done;
alter table public.agency_athlete_notes enable row level security;

-- ¿La agencia tiene (o tuvo) una relación válida con el atleta? Solo responde a miembros de esa
-- agencia, para que nadie pueda sondear la cartera de otra.
create or replace function public.agency_has_relationship(p_agency uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_agency) and exists (
    select 1 from public.agent_representations r
     where r.agency_id = p_agency and r.athlete_id = p_athlete and r.status in ('requested', 'active', 'ended')
  );
$$;

create or replace function public.guard_agency_note()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.organizations where id = new.agency_id and type = 'agency') then
      raise exception 'agency_required' using errcode = 'P0001';
    end if;
    new.done := false;
    new.done_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if (new.agency_id, new.athlete_id, new.author_id, new.kind, new.created_at)
     is distinct from (old.agency_id, old.athlete_id, old.author_id, old.kind, old.created_at) then
    raise exception 'note_immutable' using errcode = '42501';
  end if;
  if new.done is distinct from old.done then
    new.done_at := case when new.done then now() else null end;
  else
    new.done_at := old.done_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_agency_note before insert or update on public.agency_athlete_notes
  for each row execute function public.guard_agency_note();

create policy agency_notes_select on public.agency_athlete_notes for select to authenticated
  using (public.is_org_member(agency_id));
create policy agency_notes_insert on public.agency_athlete_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.has_role('agent')
    and public.is_org_member(agency_id)
    and public.agency_has_relationship(agency_id, athlete_id)
  );
create policy agency_notes_update on public.agency_athlete_notes for update to authenticated
  using (author_id = auth.uid() and public.is_org_member(agency_id))
  with check (author_id = auth.uid() and public.is_org_member(agency_id));
create policy agency_notes_delete on public.agency_athlete_notes for delete to authenticated
  using (author_id = auth.uid() and public.is_org_member(agency_id));

grant select, insert, update, delete on public.agency_athlete_notes to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Auditoría de representaciones (solicitud, aceptación, rechazo, fin).
--    audit_logs es inmutable y solo la lee administración.
-- -----------------------------------------------------------------------------
create or replace function public.audit_agent_representation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'representation.requested', 'agent_representations', new.id,
            jsonb_build_object('agency_id', new.agency_id, 'athlete_id', new.athlete_id));
  elsif new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'representation.status', 'agent_representations', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger audit_agent_representation after insert or update on public.agent_representations
  for each row execute function public.audit_agent_representation();

-- -----------------------------------------------------------------------------
-- 3. Privilegios (mismo criterio que 20261113000600)
-- -----------------------------------------------------------------------------
revoke execute on function public.guard_agency_note(), public.audit_agent_representation() from public, anon, authenticated;
revoke execute on function public.agency_has_relationship(uuid, uuid) from public, anon;
grant execute on function public.agency_has_relationship(uuid, uuid) to authenticated;
