-- Prompt 11B §16, §56 (revisión 22-11) · G-08 · identidad inmutable en miembros de shortlist y candidatos.
-- Hallazgo: la política UPDATE de org_shortlist_members solo comprobaba can_edit_shortlist(). Quien podía editar
-- una lista podía cambiar por UPDATE el atleta de un miembro (sustituir un candidato por otro) saltándose la
-- comprobación de INSERT (can_view_athlete): así entraba en la lista un atleta que no puede ver, por ejemplo
-- un menor oculto en Discovery. También podía mover el miembro a otra lista o poner otra organization_id.
-- org_candidates y saved_athletes (heredada) tenían el mismo patrón.
-- Fix: un trigger rechaza cambios en los campos de identidad cuando quien escribe es un usuario de la API.
-- Las funciones del servidor (SECURITY DEFINER, otro current_user) siguen pudiendo, como en guard_family_link.
-- Cambiar de atleta = quitar el miembro y añadir otro (y entonces se aplican las comprobaciones de INSERT).
-- Riesgo: bajo (la app no actualiza esos campos; solo assigned_to, posición y revisión). Sin cambios de datos.

create or replace function public.guard_identity_immutable()
returns trigger language plpgsql set search_path = public as $$
declare
  col text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  -- Las columnas de identidad llegan como argumentos del trigger (una lista explícita por tabla).
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'identity_fields_immutable' using errcode = '42501', detail = tg_table_name || '.' || col;
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.guard_identity_immutable() from public, anon, authenticated;

drop trigger if exists aa_identity_immutable on public.org_shortlist_members;
create trigger aa_identity_immutable before update on public.org_shortlist_members
  for each row execute function public.guard_identity_immutable('shortlist_id', 'organization_id', 'athlete_id', 'added_by', 'added_at');
drop trigger if exists aa_identity_immutable on public.org_candidates;
create trigger aa_identity_immutable before update on public.org_candidates
  for each row execute function public.guard_identity_immutable('organization_id', 'athlete_id', 'created_by', 'created_at');
-- Mismo patrón detectado al revisar el resto del catálogo (INSERT comprueba el atleta, UPDATE no):
drop trigger if exists aa_identity_immutable on public.saved_athletes;
create trigger aa_identity_immutable before update on public.saved_athletes
  for each row execute function public.guard_identity_immutable('owner_id', 'athlete_id', 'created_at');
-- (agency_athlete_notes ya estaba protegida por su propio trigger: note_immutable.)

-- ROLLBACK
-- drop trigger if exists aa_identity_immutable on public.org_shortlist_members;
-- drop trigger if exists aa_identity_immutable on public.org_candidates;
-- drop trigger if exists aa_identity_immutable on public.saved_athletes;
-- drop function if exists public.guard_identity_immutable();
