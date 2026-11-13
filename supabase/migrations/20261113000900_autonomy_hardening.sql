-- Endurecimiento tras los avisos del linter de Supabase (migraciones 0700 y 0800).
-- 1. has_plan solo responde sobre uno mismo, un atleta vinculado o si eres admin (antes cualquiera podía consultar el plan de otro).
-- 2. Las comprobaciones de club no necesitan ser ejecutables sin sesión: solo las usan políticas de usuarios autenticados.
-- preview_roster_invitation sigue siendo pública a propósito: la página de invitación se ve antes de iniciar sesión y solo
-- devuelve nombre del club, temporada y si el enlace es válido.
create or replace function public.has_plan(p_user uuid, p_plan text)
returns boolean language sql stable security definer set search_path = public as $$
  select (p_user = auth.uid() or public.has_family_link(p_user, 'view_profile') or public.is_admin())
     and exists (select 1 from public.entitlements where user_id = p_user and revoked_at is null
                 and (plan_code = p_plan
                      or (p_plan = 'family_core' and plan_code in ('family_elite', 'family_signature'))
                      or (p_plan = 'family_elite' and plan_code = 'family_signature')));
$$;

revoke execute on function public.has_plan(uuid, text), public.is_club_admin(uuid), public.is_club_admin_org_verified(uuid) from anon;
