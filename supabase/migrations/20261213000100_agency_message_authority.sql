-- Fase 9 · Autoridad para comunicarse: una agencia cuya representación ya no está activa (revocada, caducada,
-- suspendida) o que no tiene el permiso «messages.participate» NO puede escribir al atleta ni abrir conversaciones nuevas.
-- Solo afecta a agencias que tuvieron (o tienen) representación con ese atleta; el contacto previo a representar
-- sigue las reglas de siempre (organización verificada, menores vía familia, bloqueos).
--
-- ROLLBACK:
--   drop trigger if exists guard_agency_contact_authority on public.contact_requests;
--   drop function if exists public.guard_agency_contact_authority();
--   drop policy if exists cmsg_insert on public.contact_messages;
--   create policy cmsg_insert ... (la de 20261115000100_user_blocks.sql)
--   drop function if exists public.agency_may_message(uuid, uuid);

create or replace function public.agency_may_message(p_org uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.organizations o where o.id = p_org and o.type = 'agency') then true
    when not exists (select 1 from public.agent_representations r where r.agency_id = p_org and r.athlete_id = p_athlete) then true
    else public.agent_can(p_athlete, 'messages.participate')
  end;
$$;
revoke all on function public.agency_may_message(uuid, uuid) from public, anon;
grant execute on function public.agency_may_message(uuid, uuid) to authenticated;

-- Mensajes: además de ser participante y no haber bloqueo, quien escribe desde una agencia necesita autoridad vigente.
drop policy if exists cmsg_insert on public.contact_messages;
create policy cmsg_insert on public.contact_messages for insert to authenticated with check (
  public.is_contact_participant(request_id)
  and not exists (
    select 1 from public.contact_requests r
     where r.id = request_id
       and ((r.athlete_id <> (select auth.uid()) and public.has_block_with(r.athlete_id))
            or (r.requested_by <> (select auth.uid()) and public.has_block_with(r.requested_by)))
  )
  and exists (
    select 1 from public.contact_requests r
     where r.id = request_id
       -- El atleta y su familia siempre pueden contestar; la agencia, solo con autoridad.
       and (r.athlete_id = (select auth.uid()) or public.is_active_guardian(r.athlete_id) or public.agency_may_message(r.organization_id, r.athlete_id))
  )
);

-- Conversaciones nuevas: misma regla.
create or replace function public.guard_agency_contact_authority()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.agency_may_message(new.organization_id, new.athlete_id) then
    raise exception 'representation_inactive' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_agency_contact_authority() from public, anon, authenticated;
drop trigger if exists guard_agency_contact_authority on public.contact_requests;
create trigger guard_agency_contact_authority before insert on public.contact_requests
  for each row execute function public.guard_agency_contact_authority();
