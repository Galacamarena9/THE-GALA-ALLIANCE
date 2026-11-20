-- =====================================================================================================
-- 11E · QA y pulido de Clubs & Academies: correcciones de datos (registro de bugs en docs/CLUBS-ACADEMIES-QA.md)
--
--   QA-01 (alta) «Valencia Basket», «VALENCIA BASKET», «Valencia Basket Club» y «ValenciaBasket» creaban 4
--         organizaciones distintas → clave canónica del nombre + bloqueo de duplicados al crear + búsqueda por clave.
-- Reversión: drop trigger guard_org_duplicate; drop column name_key; drop function org_name_key.
-- =====================================================================================================

-- Clave canónica: minúsculas, sin acentos, sin signos ni espacios, sin artículos y sin formas jurídicas (club, S.A.,
-- S.L., SAD). NO se quitan CF, CB, FC ni «Academy»: distinguen entidades reales («Valencia CF» ≠ «CB Valencia Academy»).
create or replace function public.org_name_key(p_name text)
returns text language sql immutable parallel safe set search_path = public as $$
  select nullif(regexp_replace(
           regexp_replace(
             replace(translate(lower(btrim(p_name)), 'áàäâãåéèëêíìïîóòöôõúùüûñçß', 'aaaaaaeeeeiiiiooooouuuuncs'), '.', ''),
             '\m(club|sad|sa|sl|the|el|la|de|del)\M', '', 'g'),
           '[^a-z0-9]', '', 'g'), '');
$$;

alter table public.organizations
  add column if not exists name_key text generated always as (public.org_name_key(name)) stored;
create index if not exists organizations_name_key_idx on public.organizations (name_key);

-- Grupos que representan la misma clase de entidad (un club y su academia con el mismo nombre suelen ser la misma).
create or replace function public.org_type_group(p_type text)
returns text language sql immutable set search_path = public as $$
  select case when p_type in ('university', 'college') then 'education'
              when p_type in ('club', 'academy') then 'sport_club'
              else p_type end;
$$;

-- Al crear desde el cliente, si ya existe una organización equivalente (misma clave, mismo grupo y mismo país o
-- sin país) se rechaza con un error accionable: «búscala y solicita unirte». Gala (admin/importaciones) sí puede.
create or replace function public.guard_org_duplicate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_key text := public.org_name_key(new.name);
begin
  if v_key is null or public.is_admin() or auth.uid() is null then return new; end if;
  if exists (select 1 from public.organizations o
              where o.name_key = v_key and public.org_type_group(o.type::text) = public.org_type_group(new.type::text)
                and (o.country is null or new.country is null or o.country = new.country)
                and o.org_status <> 'closed') then
    raise exception 'organization_exists' using errcode = 'P0001',
      hint = 'Busca la organización existente y solicita unirte en lugar de crear otra.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_org_duplicate on public.organizations;
create trigger guard_org_duplicate before insert on public.organizations for each row execute function public.guard_org_duplicate();

-- QA-07 (rendimiento) · Índices que faltaban en columnas usadas por las políticas de 11B y por las listas del club/atleta.
create index if not exists payment_requirements_opportunity_idx on public.payment_requirements (opportunity_id);
create index if not exists payment_requirements_athlete_idx on public.payment_requirements (athlete_id);
create index if not exists opportunity_outcomes_opportunity_idx on public.opportunity_outcomes (opportunity_id);
