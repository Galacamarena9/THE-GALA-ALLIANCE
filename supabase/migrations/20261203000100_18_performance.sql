-- =============================================================================================================
-- Prompt 18 · Rendimiento. Medir antes de tocar; ninguna optimización relaja la seguridad.
--   1) RLS: auth.uid() envuelto en (select …) para que Postgres lo evalúe una vez por consulta (initplan) y no
--      una vez por fila. Se reescriben automáticamente las 59 policies que aún lo llamaban «a pelo».
--   2) Índices: fuera los duplicados o redundantes (prefijo de otro); dentro los compuestos de rutas calientes.
--   3) Búsqueda por nombre: trigramas (pg_trgm) para que «ilike '%texto%'» use índice.
--   4) Autovacuum más agresivo en tablas de mucho movimiento.
-- =============================================================================================================

-- 1. RLS: evaluación única de auth.uid() por consulta.
do $$
declare p record; v_qual text; v_check text; v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
  loop
    v_qual := p.qual; v_check := p.with_check;
    if v_qual is not null then
      v_qual := replace(replace(replace(v_qual, '( SELECT auth.uid() AS uid)', '§UID§'), 'auth.uid()', '( SELECT auth.uid() AS uid)'), '§UID§', '( SELECT auth.uid() AS uid)');
    end if;
    if v_check is not null then
      v_check := replace(replace(replace(v_check, '( SELECT auth.uid() AS uid)', '§UID§'), 'auth.uid()', '( SELECT auth.uid() AS uid)'), '§UID§', '( SELECT auth.uid() AS uid)');
    end if;
    if v_qual is distinct from p.qual or v_check is distinct from p.with_check then
      v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
      if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
      execute v_sql;
    end if;
  end loop;
end $$;

-- 2. Índices redundantes: su columna inicial ya la cubre otro índice (que también sirve a la FK).
drop index if exists public.organization_members_user_idx;          -- idéntico a fk_organization_members_user_id
drop index if exists public.fk_agent_representations_athlete_id;     -- cubierto por rep_athlete_status_idx (athlete_id, status)
drop index if exists public.fk_applications_athlete_id;              -- cubierto por applications_athlete_idx (athlete_id, updated_at)
drop index if exists public.fk_consents_user_id;                     -- cubierto por consents_target_idx (user_id, …)
drop index if exists public.fk_opportunities_organization_id;        -- cubierto por opportunities_org_status_idx (organization_id, status)

-- Rutas calientes
create index if not exists product_events_user_time_idx on public.product_events (user_id, created_at desc);  -- límite por hora y actividad
drop index if exists public.fk_product_events_user_id;
create index if not exists contact_requests_athlete_status_idx on public.contact_requests (athlete_id, status);  -- bandeja del atleta
drop index if exists public.fk_contact_requests_athlete_id;
create index if not exists campaign_offers_athlete_status_idx on public.campaign_offers (athlete_id, status, created_at desc);
drop index if exists public.campaign_offers_athlete;  -- cubierto por el compuesto
create index if not exists moderation_actions_active_idx on public.moderation_actions (subject_user, subject_org) where reverted_at is null;
create index if not exists representation_assignments_user_active_idx on public.representation_assignments (user_id, representation_id) where ended_at is null;
create index if not exists representation_permissions_active_idx on public.representation_permissions (representation_id, permission) where status = 'active';

-- 3. Búsqueda por nombre con trigramas.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);
create index if not exists organizations_name_trgm on public.organizations using gin (name extensions.gin_trgm_ops);
create index if not exists institutions_name_trgm on public.institutions using gin (name extensions.gin_trgm_ops);

-- 4. Autovacuum en tablas de alta rotación (inserciones continuas y borrados por retención).
alter table public.product_events set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
alter table public.notifications set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02);
alter table public.rate_limit_events set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.usage_counters set (autovacuum_vacuum_scale_factor = 0.05);
alter table public.audit_logs set (autovacuum_analyze_scale_factor = 0.02);

/* ROLLBACK: los índices borrados se recrean con su nombre original sobre la misma columna; los nuevos se pueden
   borrar sin efecto funcional. La reescritura de policies es equivalente (mismo resultado, una evaluación por
   consulta) y no necesita deshacerse. */
