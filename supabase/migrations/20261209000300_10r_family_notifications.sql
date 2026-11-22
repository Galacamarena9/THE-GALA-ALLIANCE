-- Prompt 10 §34 (revisión 22-11) · avisos familiares por categoría, con preferencias y sin inundar.
-- Antes: todo aviso `family.*` caía en «esencial» (no silenciable) y la familia no se enteraba de ofertas
-- ni de cambios de estado de las candidaturas, aunque tuviera permiso para verlos.
-- Ahora:
--   · «Consentimiento, documentos y seguridad» siguen siendo esenciales (no se pueden silenciar).
--   · Nuevas categorías silenciables: family_offers, family_process (y family_deadlines / family_costs
--     reservadas para los siguientes avisos).
--   · Avisos nuevos a cada tutor ACTIVO con el permiso correspondiente (misma lógica que has_family_link,
--     incluida la caducidad por mayoría de edad): oferta registrada y cambio de estado de una candidatura.
--   · El texto no lleva datos sensibles (ni importes ni nombre de la universidad): se ven dentro, con sesión.
-- Riesgo: bajo (solo añade avisos; no cambia permisos de lectura). Sin cambios de datos.

-- 1. Categorías --------------------------------------------------------------------------------------
alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences add constraint notification_preferences_category_check
  check (category in ('messages', 'applications', 'deadlines', 'matches', 'platform',
                      'family_process', 'family_offers', 'family_deadlines', 'family_costs'));

create or replace function public.notification_category(p_kind text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_kind = 'family.offer' then 'family_offers'
    when p_kind = 'family.process' then 'family_process'
    when p_kind = 'family.deadline' then 'family_deadlines'
    when p_kind = 'family.cost' then 'family_costs'
    when p_kind like 'contact.%' or p_kind like 'family.%' or p_kind like 'security.%' or p_kind like 'account.%' then 'essential'
    when p_kind like 'message.%' then 'messages'
    when p_kind like 'application%' or p_kind like 'offer%' then 'applications'
    when p_kind like 'deadline%' then 'deadlines'
    when p_kind like 'saved_%' or p_kind like 'match%' or p_kind like 'opportunit%' then 'matches'
    else 'platform'
  end;
$$;

-- 2. Destinatarios: tutores activos con un permiso concreto (interna; no expuesta a la API) -----------
create or replace function public.active_guardians_with(p_athlete uuid, p_capability text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select l.parent_id from public.parent_athlete_links l
   where l.athlete_id = p_athlete and l.status = 'approved'
     and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at)
     and case p_capability
           when 'view_applications' then l.can_view_applications
           when 'view_costs' then l.can_view_costs
           when 'offers' then l.can_view_applications or l.can_view_costs
           else false
         end;
$$;
revoke all on function public.active_guardians_with(uuid, text) from public, anon, authenticated;

create or replace function public.athlete_first_name(p_athlete uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(trim(p.display_name), ' ', 1), ''), 'tu atleta') from public.profiles p where p.id = p_athlete;
$$;
revoke all on function public.athlete_first_name(uuid) from public, anon, authenticated;

-- 3. Oferta registrada → tutores con permiso de ofertas (no al tutor que la registra) -------------------
create or replace function public.family_notify_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  for g in select public.active_guardians_with(new.athlete_id, 'offers') loop
    continue when g = auth.uid();
    perform public.notify(g, 'family.offer', 'Nueva oferta para revisar',
      coalesce(public.athlete_first_name(new.athlete_id), 'Tu atleta') || ' tiene una oferta registrada. Podéis revisarla juntos.',
      '/app/family');
  end loop;
  return new;
end;
$$;
revoke execute on function public.family_notify_offer() from public, anon, authenticated;
drop trigger if exists family_notify_offer on public.athlete_offers;
create trigger family_notify_offer after insert on public.athlete_offers
  for each row execute function public.family_notify_offer();

-- 4. Cambio de estado de una candidatura → tutores con permiso de proceso ------------------------------
create or replace function public.family_notify_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  for g in select public.active_guardians_with(new.athlete_id, 'view_applications') loop
    continue when g = auth.uid();
    perform public.notify(g, 'family.process', 'Una candidatura ha cambiado de estado',
      'Hay novedades en el proceso de ' || coalesce(public.athlete_first_name(new.athlete_id), 'tu atleta') || '.',
      '/app/family');
  end loop;
  return new;
end;
$$;
revoke execute on function public.family_notify_application_status() from public, anon, authenticated;
drop trigger if exists family_notify_application_status on public.applications;
create trigger family_notify_application_status after update of status on public.applications
  for each row execute function public.family_notify_application_status();

-- ROLLBACK
-- drop trigger if exists family_notify_application_status on public.applications;
-- drop trigger if exists family_notify_offer on public.athlete_offers;
-- drop function if exists public.family_notify_application_status(), public.family_notify_offer(),
--   public.athlete_first_name(uuid), public.active_guardians_with(uuid, text);
-- (notification_category: versión de 20261117000600_athlete_dashboard.sql)
-- delete from public.notification_preferences where category like 'family_%';
-- alter table public.notification_preferences drop constraint notification_preferences_category_check;
-- alter table public.notification_preferences add constraint notification_preferences_category_check
--   check (category in ('messages', 'applications', 'deadlines', 'matches', 'platform'));
