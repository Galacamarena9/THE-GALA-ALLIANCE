-- Prompt 9 §6 (revisión 22-11) · creación mínima del perfil: idempotente, resistente a metadatos incompletos
-- y con mecanismo de recuperación.
-- Problema encontrado: una fecha con formato válido pero inexistente (p. ej. 2003-02-30) pasaba la expresión
-- regular y el cast fallaba dentro del trigger → el alta entera fallaba sin explicación.
-- Se mantiene a propósito que el alta de un menor de 13 años falle entera (coppa_minimum_age).
-- Riesgo: bajo. Sin cambios de datos.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dob_text text := new.raw_user_meta_data ->> 'date_of_birth';
  v_dob date;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 120), ''))
  on conflict (id) do nothing;

  if v_dob_text is not null and v_dob_text ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      v_dob := v_dob_text::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      v_dob := null; -- fecha imposible: se pedirá de nuevo en el onboarding
    end;
    if v_dob is not null then
      insert into public.private_profile_data (user_id, date_of_birth) values (new.id, v_dob)
      on conflict (user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Recuperación: si por cualquier motivo falta el perfil de la sesión actual, se crea (idempotente).
-- Solo actúa sobre auth.uid(); no acepta ids del cliente.
create or replace function public.ensure_my_profile()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_created boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid) then
    raise exception 'unknown_user' using errcode = '42501';
  end if;
  insert into public.profiles (id, display_name) values (v_uid, '') on conflict (id) do nothing;
  get diagnostics v_created = row_count;
  return v_created;
end;
$$;
revoke execute on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- ROLLBACK
-- drop function if exists public.ensure_my_profile();
-- (handle_new_user: restaurar la versión de 20261113000100_foundation.sql)
