-- Endurecimiento según los avisos de Supabase (seguridad y rendimiento).

-- 1) Funciones SECURITY DEFINER internas: sin acceso anónimo.
--    Se mantienen para anon las que usan políticas públicas (can_view_athlete, is_admin, is_minor, is_org_member)
--    y las de páginas con token (get_recruiting_card, preview_*_invitation). Las de administración ya
--    comprueban is_admin() por dentro.
do $$
declare f text;
begin
  foreach f in array array[
    'application_org(uuid)', 'campaign_org(uuid)', 'has_connection_with_athlete(uuid)', 'has_family_link(uuid, text)',
    'has_role(public.app_role)', 'is_blocked_by_athlete(uuid)', 'is_contact_participant(uuid)', 'is_verified_recruiter()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- 2) Políticas RLS: auth.uid()/auth.jwt() envueltos en (select ...) para que Postgres los evalúe
--    una vez por consulta y no por fila. Misma lógica, mejor rendimiento a escala.
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(?<!SELECT )auth\.(uid|jwt)\(\)' or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|jwt)\(\)')
  loop
    v_using := regexp_replace(r.qual, '(?<!SELECT )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'g');
    v_check := regexp_replace(r.with_check, '(?<!SELECT )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'g');
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_using is not null then v_sql := v_sql || format(' using (%s)', v_using); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end $$;

-- 3) Índices para las claves foráneas sin índice (uniones y borrados en cascada más rápidos).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, cl.relname as tname
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and n.nspname = 'public' and array_length(c.conkey, 1) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  loop
    execute format('create index if not exists %I on %s (%I)', left('fk_' || r.tname || '_' || r.col, 63), r.tbl, r.col);
  end loop;
end $$;
