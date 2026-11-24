-- =============================================================================
-- Fase 1 de la auditoría (Agente Maestro PRO) · Confianza para el piloto
-- S1: un menor no puede actuar como tutor de nadie, tampoco de sí mismo con una segunda cuenta.
-- S2: los roles de adulto (familia, agente, marca, coach, universidad) exigen mayoría de edad también
--     en la base de datos, no solo en la pantalla.
-- is_minor() trata como menor a quien no tiene fecha de nacimiento: protección por defecto.
-- Límite que queda (documentado): una cuenta que miente sobre su edad sigue pareciendo adulta. Cerrarlo
-- exige verificar al tutor (fase 5 del roadmap).
-- ROLLBACK:
--   drop trigger if exists guard_adult_roles on public.user_roles; drop function if exists public.guard_adult_roles();
--   drop trigger if exists guard_guardian_adult on public.parent_athlete_links; drop function if exists public.guard_guardian_adult();
--   restaurar has_family_link (20261124000200_10a_family_rls.sql), is_guardian_of (20261114000300_recruiting_links.sql)
--   y minor_has_active_family (20261126000300_12a1_representation_integrity.sql)
-- =============================================================================

-- Antes de nada, informar de vínculos que quedarían sin efecto (en staging no debería haber ninguno real).
do $$
declare n int;
begin
  select count(*) into n from public.parent_athlete_links l
   where l.status = 'approved' and l.parent_id is not null and public.is_minor(l.parent_id);
  raise notice 'phase1_guardian_trust: % vínculos aprobados con tutor menor dejarán de dar acceso', n;
end $$;

-- 1. Roles de adulto: solo mayores de edad (llamadas con sesión; los procesos del servidor no tienen auth.uid()).
create or replace function public.guard_adult_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Solo con una fecha de nacimiento conocida de menor: el alta guarda la fecha antes de elegir rol.
  if auth.uid() is not null and new.role::text <> 'athlete' and exists (
       select 1 from public.private_profile_data p
        where p.user_id = new.user_id and p.date_of_birth > (current_date - interval '18 years')) then
    raise exception 'adult_role_required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_adult_roles() from public, anon, authenticated;
drop trigger if exists guard_adult_roles on public.user_roles;
create trigger guard_adult_roles before insert or update on public.user_roles
  for each row execute function public.guard_adult_roles();

-- 2. Un vínculo familiar aprobado exige un tutor adulto y distinto del atleta (por cualquier vía).
create or replace function public.guard_guardian_adult()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'approved' and new.parent_id is not null then
    if new.parent_id = new.athlete_id then
      raise exception 'guardian_cannot_be_self' using errcode = '42501';
    end if;
    if public.is_minor(new.parent_id) then
      raise exception 'guardian_must_be_adult' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_guardian_adult() from public, anon, authenticated;
drop trigger if exists guard_guardian_adult on public.parent_athlete_links;
create trigger guard_guardian_adult before insert or update on public.parent_athlete_links
  for each row execute function public.guard_guardian_adult();

-- 3. Defensa en profundidad: un vínculo con tutor menor no da ningún permiso aunque exista.
create or replace function public.has_family_link(p_athlete uuid, p_capability text default 'view_profile')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_athlete_links l
     where l.parent_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'approved'
       and not public.is_minor(l.parent_id)
       and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at)
       and case p_capability
             when 'view_profile' then l.can_view_profile
             when 'edit_profile' then l.can_edit_profile
             when 'view_applications' then l.can_view_applications
             when 'view_academics' then l.can_view_academics
             when 'view_costs' then l.can_view_costs
             when 'view_budget' then l.can_view_budget
             when 'view_documents' then l.can_view_documents
             when 'view_contacts' then l.can_view_contacts
             when 'view_messages' then l.can_view_messages
             when 'active' then true
             else false
           end);
$$;

create or replace function public.is_guardian_of(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_athlete_links l
     where l.parent_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'approved'
       and l.relationship in ('parent', 'legal_guardian')
       and not public.is_minor(l.parent_id)
  );
$$;

create or replace function public.minor_has_active_family(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_minor(p_athlete) or exists (
    select 1 from public.parent_athlete_links l
     where l.athlete_id = p_athlete and l.status = 'approved'
       and l.parent_id is not null and not public.is_minor(l.parent_id)
       and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at));
$$;
revoke execute on function public.minor_has_active_family(uuid) from public, anon, authenticated;
