-- =============================================================================================================
-- Protección de menores (QA atleta/familia, hallazgos 1, 4 y 7)
-- 1. CRÍTICA · Un atleta MENOR ya no puede pausar ni desvincular por sí solo a un tutor adulto con vínculo activo
--    (aprobado o en pausa). Era el vector de grooming: «quita a tus padres» dejaba el canal abierto sin supervisión.
--    - Lo exige un trigger que corre SIEMPRE (también dentro de family_link_restrict, que se salta guard_family_link).
--    - Error: guardian_change_requires_guardian. El tutor sí puede renunciar; un atleta mayor de edad sí puede;
--      administración sí puede (canal de protección: /app/support). Reanudar un acceso pausado sigue permitido.
--    - Invitaciones pendientes y vínculos con un «tutor» menor (sin efecto desde la fase 1) se pueden retirar.
-- 3. ALTA · can_view_athlete: un menor sin tutor activo vinculado (minor_has_active_family) deja de ser visible
--    para reclutadores verificados (deny by default). El atleta, su familia, admin y quien ya tenía relación
--    legítima (conexión aceptada, agente con passport.view) no cambian.
-- 4. Presupuesto familiar: el tutor activo de un menor con permiso «presupuesto» lo fija sin necesitar
--    «editar perfil». Sigue siendo invisible para clubes, universidades y agentes (lectura sin cambios).
-- Fuera de alcance (decisión L5 de Gala): la edad mínima de alta sigue en 13 años.
-- ROLLBACK:
--   drop trigger if exists guard_minor_guardian_change on public.parent_athlete_links;
--   drop function if exists public.guard_minor_guardian_change();
--   drop function if exists public.guardian_sets_family_budget(uuid);  (después de restaurar las policies)
--   restaurar can_view_athlete (20261127000100_12b_agent_rls.sql) y las policies finances_insert/update/delete
--   (20261125000100_10c_family_pentest_fixes.sql).
-- =============================================================================================================

-- 1. Un menor no se «desvincula» de su tutor ------------------------------------------------------------------
create or replace function public.guard_minor_guardian_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.athlete_id
     and new.status is distinct from old.status
     and old.status::text in ('approved', 'restricted')
     and new.status::text in ('revoked', 'restricted')
     and old.parent_id is not null
     and not public.is_admin()
     and public.is_minor(old.athlete_id)
     and not public.is_minor(old.parent_id) then
    raise exception 'guardian_change_requires_guardian' using errcode = '42501',
      hint = 'Un menor no puede pausar ni desvincular a su tutor. El tutor puede renunciar; si hay un problema, soporte lo revisa.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_minor_guardian_change() from public, anon, authenticated;
drop trigger if exists guard_minor_guardian_change on public.parent_athlete_links;
create trigger guard_minor_guardian_change before update on public.parent_athlete_links
  for each row execute function public.guard_minor_guardian_change();

-- 3. Passport de un menor: sin tutor activo, invisible para reclutadores ---------------------------------------
create or replace function public.can_view_athlete(p_athlete uuid, p_block text default 'profile'::text)
returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_vis public.visibility_level;
  v_minor boolean;
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and v_uid = p_athlete then return true; end if;
  if public.is_admin() then return true; end if;
  if public.has_family_link(p_athlete, case p_block when 'academics' then 'view_academics' else 'view_profile' end) then
    return true;
  end if;
  if v_uid is not null and public.is_blocked_by_athlete(p_athlete) then return false; end if;
  if v_uid is not null and public.is_blocked_by_user(p_athlete) then return false; end if;
  -- 12B: el agente asignado con passport.view ve el Passport aunque sea privado (lo eligió el atleta).
  -- Académico no: no hay permiso de agente para ello.
  if p_block <> 'academics' and public.agent_can(p_athlete, 'passport.view') then return true; end if;

  select case p_block
           when 'academics' then academics_visibility
           when 'stats' then stats_visibility
           when 'sport' then sport_visibility
           when 'videos' then videos_visibility
           when 'goals' then goals_visibility
           else profile_visibility
         end
    into v_vis
    from public.athlete_profiles where user_id = p_athlete;

  if v_vis is null or v_vis = 'private' then return false; end if;
  if p_block <> 'profile' and not public.can_view_athlete(p_athlete, 'profile') then
    return false;
  end if;
  if public.has_connection_with_athlete(p_athlete) then return true; end if;

  v_minor := public.is_minor(p_athlete);
  if v_minor then
    -- Menor: solo organizaciones verificadas y solo si tiene un tutor adulto activo vinculado.
    return v_uid is not null and v_vis in ('public', 'members', 'verified_orgs') and public.is_verified_recruiter()
       and public.minor_has_active_family(p_athlete);
  end if;

  return case v_vis
           when 'public' then true
           when 'members' then v_uid is not null
           when 'verified_orgs' then v_uid is not null and public.is_verified_recruiter()
           else false
         end;
end;
$function$;
grant execute on function public.can_view_athlete(uuid, text) to anon;
grant execute on function public.can_view_athlete(uuid, text) to authenticated;

-- 4. Presupuesto familiar: lo fija quien paga ------------------------------------------------------------------
-- Escribir exige SIEMPRE el permiso de presupuesto (lectura). Además: «editar perfil», o ser tutor activo de un menor.
-- is_minor() no es ejecutable por authenticated: el criterio va en una función SECURITY DEFINER pequeña.
create or replace function public.guardian_sets_family_budget(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.guardian_has_scope(p_athlete, 'athlete.family_budget.view')
     and (public.has_family_link(p_athlete, 'edit_profile') or public.is_minor(p_athlete));
$$;
revoke all on function public.guardian_sets_family_budget(uuid) from public, anon;
grant execute on function public.guardian_sets_family_budget(uuid) to authenticated;

drop policy if exists finances_insert on public.athlete_finances;
drop policy if exists finances_update on public.athlete_finances;
drop policy if exists finances_delete on public.athlete_finances;
create policy finances_insert on public.athlete_finances for insert to authenticated
  with check (athlete_id = (select auth.uid())
              or public.guardian_sets_family_budget(athlete_id));
create policy finances_update on public.athlete_finances for update to authenticated
  using (athlete_id = (select auth.uid())
         or public.guardian_sets_family_budget(athlete_id))
  with check (athlete_id = (select auth.uid())
              or public.guardian_sets_family_budget(athlete_id));
create policy finances_delete on public.athlete_finances for delete to authenticated
  using (athlete_id = (select auth.uid())
         or public.guardian_sets_family_budget(athlete_id));
