-- Prompt 12 (revisión 22-11). Dos cambios:
--   A) §24–25, §62 · notas internas de agencia: la base de datos aplica la misma regla
-- que la ficha 360. Antes, cualquier miembro de la agencia (incluidos `viewer` y `scout`) podía leer el texto
-- de todas las notas pidiéndolo directamente a la API; la interfaz solo lo ocultaba.
-- Ahora leen las notas:
--   · los roles de agencia con trabajo sobre atletas: owner, admin, manager, recruiter, athlete_manager,
--     operations, compliance (y miembros sin agency_role, como hasta ahora en la interfaz);
--   · o quien está asignado al atleta como primary, secondary u operations en una representación vigente.
-- `viewer` y `scout` sin asignación dejan de verlas (ni el texto ni la fila).
--   B) §60 · motivos propios para denunciar a un agente o a una agencia (ver más abajo).
-- Riesgo: medio-bajo (A solo restringe lectura; B solo amplía valores permitidos). Sin cambios de datos.

create or replace function public.agency_can_read_notes(p_agency uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.organization_members m
            where m.organization_id = p_agency and m.user_id = auth.uid()
              and (m.agency_role is null
                   or m.agency_role in ('owner', 'admin', 'manager', 'recruiter', 'athlete_manager', 'operations', 'compliance')))
      or exists (
           select 1 from public.representation_assignments a
             join public.agent_representations r on r.id = a.representation_id
            where a.user_id = auth.uid() and a.agency_id = p_agency and a.ended_at is null
              and a.role in ('primary', 'secondary', 'operations')
              and r.agency_id = p_agency and r.athlete_id = p_athlete
              and public.is_org_member(p_agency));
$$;
revoke all on function public.agency_can_read_notes(uuid, uuid) from public, anon;
grant execute on function public.agency_can_read_notes(uuid, uuid) to authenticated;

drop policy if exists agency_notes_select on public.agency_athlete_notes;
create policy agency_notes_select on public.agency_athlete_notes for select to authenticated
  using (public.is_org_member(agency_id) and public.agency_can_read_notes(agency_id, athlete_id));

-- ROLLBACK
-- drop policy if exists agency_notes_select on public.agency_athlete_notes;
-- create policy agency_notes_select on public.agency_athlete_notes for select to authenticated
--   using (public.is_org_member(agency_id));
-- drop function if exists public.agency_can_read_notes(uuid, uuid);

-- ─── §60 · Denunciar agente o agencia: motivos propios ──────────────────────────────────────────────
-- Expand: se añaden motivos; los existentes no cambian. Un cobro sospechoso o una representación no autorizada
-- entran con prioridad 1 (detrás solo de seguridad infantil).
alter table public.content_reports drop constraint if exists content_reports_reason_check;
alter table public.content_reports add constraint content_reports_reason_check
  check (reason in ('child_safety', 'harassment', 'fake_or_misleading', 'spam', 'illegal_content', 'privacy', 'other',
                    'impersonation', 'unauthorized_representation', 'misleading_fees', 'payment_request', 'unauthorized_document_use'));

create or replace function public.content_report_agent_priority()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.reason in ('unauthorized_representation', 'payment_request', 'impersonation') and new.priority > 1 then
    new.priority := 1;
  end if;
  return new;
end;
$$;
revoke execute on function public.content_report_agent_priority() from public, anon, authenticated;
drop trigger if exists zz_content_report_agent_priority on public.content_reports;
create trigger zz_content_report_agent_priority before insert on public.content_reports
  for each row execute function public.content_report_agent_priority();

-- ROLLBACK (§60)
-- drop trigger if exists zz_content_report_agent_priority on public.content_reports;
-- drop function if exists public.content_report_agent_priority();
-- (antes, reclasificar a 'other' las denuncias con motivos nuevos)
-- alter table public.content_reports drop constraint content_reports_reason_check;
-- alter table public.content_reports add constraint content_reports_reason_check
--   check (reason in ('child_safety', 'harassment', 'fake_or_misleading', 'spam', 'illegal_content', 'privacy', 'other'));
