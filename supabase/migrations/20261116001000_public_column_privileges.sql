-- P1-01 · Columnas internas fuera del alcance anónimo (docs/audit/threat-model.md, T-01).
--
-- La RLS decide QUÉ FILAS ve cada rol, pero no QUÉ COLUMNAS. Un visitante sin sesión (anon) con la clave publicable
-- podía leer de las oportunidades publicadas la nota interna de revisión y los identificadores de quien la creó o
-- revisó, y de las organizaciones verificadas quién la creó o verificó. Aquí se sustituye el permiso de tabla por
-- permisos por columna, solo para `anon`. Los usuarios con sesión no cambian (los miembros necesitan la nota).
--
-- `is_reviewed` sustituye a `reviewed_by` en el sello público: dice SI se revisó, no QUIÉN.
-- Las columnas que se añadan en el futuro NO quedan visibles para anon hasta concederlas aquí (seguro por defecto).
--
-- Rollback (no borra datos):
--   grant select on public.opportunities, public.organizations to anon;
--   alter table public.opportunities drop column is_reviewed;

alter table public.opportunities
  add column if not exists is_reviewed boolean generated always as (reviewed_by is not null) stored;

revoke select on public.opportunities from anon;
revoke select on public.organizations from anon;

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'opportunities'
     and column_name not in ('review_note', 'created_by', 'reviewed_by');
  execute format('grant select (%s) on public.opportunities to anon', v_cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'organizations'
     and column_name not in ('created_by', 'verified_by');
  execute format('grant select (%s) on public.organizations to anon', v_cols);
end $$;
