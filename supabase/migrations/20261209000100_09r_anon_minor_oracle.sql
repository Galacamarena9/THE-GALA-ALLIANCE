-- Prompt 9 (revisión 22-11) · A3 de docs/ARCHITECTURE-AUDIT.md
-- is_listed_adult_profile(uuid) era ejecutable por `anon`: con un uuid, alguien sin sesión podía saber si
-- un perfil es de un adulto sin ficha de atleta (oráculo pequeño en la frontera de menores).
-- La única política que la usa ya exigía sesión, así que se separa la política por rol y se retira el permiso.
-- Riesgo: bajo. Sin cambios de datos.

drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles for select to anon using (
  public.is_admin() or public.can_view_athlete(id));

create policy profiles_select_authenticated on public.profiles for select to authenticated using (
  id = (select auth.uid()) or public.is_admin() or public.can_view_athlete(id)
  or public.is_listed_adult_profile(id));

revoke execute on function public.is_listed_adult_profile(uuid) from public, anon;
grant execute on function public.is_listed_adult_profile(uuid) to authenticated;

-- ROLLBACK
-- drop policy if exists profiles_select_authenticated on public.profiles;
-- drop policy if exists profiles_select on public.profiles;
-- create policy profiles_select on public.profiles for select to anon, authenticated using (
--   id = (select auth.uid()) or public.is_admin() or public.can_view_athlete(id)
--   or ((select auth.uid()) is not null and public.is_listed_adult_profile(id)));
-- grant execute on function public.is_listed_adult_profile(uuid) to anon;
