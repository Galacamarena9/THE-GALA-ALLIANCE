-- =============================================================================================================
-- Prompt 12A.1 · Integridad de la representación. Dos huecos encontrados al probar el modelo de 12A:
--   1) Reactivar una suspensión solo miraba las fechas: ahora revalida agencia, conflictos, familia y asignación.
--   2) Un menor cuya familia deja de estar vinculada no debe seguir dando acceso a la agencia.
-- =============================================================================================================

-- Familia vigente de un menor (cualquier tutor aprobado y no caducado). Para adultos, siempre verdadero.
create or replace function public.minor_has_active_family(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_minor(p_athlete) or exists (
    select 1 from public.parent_athlete_links l
     where l.athlete_id = p_athlete and l.status = 'approved'
       and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at));
$$;
revoke execute on function public.minor_has_active_family(uuid) from public, anon, authenticated;

create or replace function public.agent_can(p_athlete uuid, p_permission text, p_sport text default null, p_country text default null,
                                            p_category text default null, p_opportunity uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.agent_representations r
      join public.representation_assignments a on a.representation_id = r.id and a.user_id = auth.uid() and a.ended_at is null
      join public.organization_members m on m.organization_id = r.agency_id and m.user_id = auth.uid()
      join public.organizations o on o.id = r.agency_id and o.verification_status = 'verified' and o.org_status = 'active'
      join public.representation_permissions p on p.representation_id = r.id and p.permission = p_permission and p.status = 'active'
                                              and (p.expires_at is null or p.expires_at > now())
     where r.athlete_id = p_athlete and r.status = 'active' and current_date between r.start_date and r.end_date
       and (a.role <> 'viewer' or p_permission in ('passport.view', 'pipeline.view', 'offers.view', 'documents.view'))
       and (not public.is_minor(r.athlete_id) or (r.guardian_approved_at is not null and public.minor_has_active_family(r.athlete_id)))
       and public.representation_covers(r.id, p_sport, p_country, p_category, p_opportunity)
  );
$$;

-- Reactivar no es «poner active»: se vuelven a comprobar todas las condiciones de la activación.
create or replace function public.representation_suspend(p_id uuid, p_suspend boolean, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_new text;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into r from public.agent_representations where id = p_id;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext('rep:' || r.athlete_id::text));
  select * into r from public.agent_representations where id = p_id for update;

  if p_suspend then
    if r.status <> 'active' then return r.status; end if;
    v_new := 'suspended';
  else
    if r.status <> 'suspended' then return r.status; end if;
    if current_date > r.end_date then
      v_new := 'expired';
    else
      if not exists (select 1 from public.organizations where id = r.agency_id and verification_status = 'verified' and org_status = 'active') then
        raise exception 'agency_not_verified' using errcode = '42501';
      end if;
      if public.is_minor(r.athlete_id) and (r.guardian_approved_at is null or not public.minor_has_active_family(r.athlete_id)) then
        raise exception 'guardian_approval_required' using errcode = '42501';
      end if;
      if not exists (select 1 from public.representation_assignments a join public.organization_members m
                       on m.organization_id = a.agency_id and m.user_id = a.user_id
                      where a.representation_id = r.id and a.role = 'primary' and a.ended_at is null) then
        raise exception 'primary_agent_required' using errcode = 'P0001';
      end if;
      v_new := case when exists (select 1 from public.representation_conflicts c where c.status = 'open' and r.id in (c.representation_id, c.conflicting_id))
                    then 'pending_review' else 'active' end;
    end if;
  end if;

  perform public.rep_set(true);
  update public.agent_representations
     set status = v_new, suspended_at = case when p_suspend then now() end, status_reason = left(p_reason, 500),
         ended_at = case when v_new = 'expired' then now() else ended_at end
   where id = p_id;
  if v_new = 'expired' then
    update public.representation_assignments set ended_at = now() where representation_id = p_id and ended_at is null;
  end if;
  perform public.rep_set(false);
  perform public.notify(r.athlete_id, 'representation.' || v_new, case when p_suspend then 'Representación suspendida' else 'Representación revisada' end,
          'Gala ha revisado tu representación. Entra para ver su estado.', '/app/agents');
  perform public.audit(case when p_suspend then 'representation_suspended' else 'representation_reinstated' end, 'agent_representation', p_id, r.agency_id,
                       jsonb_build_object('to', v_new), p_reason, 'security', null);
  return v_new;
end;
$$;
revoke execute on function public.representation_suspend(uuid, boolean, text) from public, anon;
grant execute on function public.representation_suspend(uuid, boolean, text) to authenticated;

/* ROLLBACK: recrear agent_can y representation_suspend desde 20261126000200 y borrar minor_has_active_family. */

-- 3) La función de acuerdos corre como definer, así que el trigger no fijaba la evidencia: «documentado» si hay documento.
create or replace function public.representation_add_agreement(p_id uuid, p_document uuid, p_from date, p_until date)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.agent_representations; v_id uuid;
begin
  select * into r from public.agent_representations where id = p_id for update;
  if r.id is null or not (auth.uid() = r.athlete_id or public.agency_manages(r.agency_id)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_until is not null and p_until < p_from then raise exception 'invalid_dates' using errcode = 'P0001'; end if;
  insert into public.representation_agreements (representation_id, version, document_id, effective_from, effective_until, created_by, evidence_status)
  values (p_id, coalesce((select max(version) from public.representation_agreements where representation_id = p_id), 0) + 1, p_document, p_from, p_until, auth.uid(),
          case when p_document is not null then 'documented' else 'declared' end)
  returning id into v_id;
  perform public.audit('representation_agreement_added', 'agent_representation', p_id, r.agency_id, jsonb_build_object('agreement', v_id), null, 'security', null);
  return v_id;
end;
$$;
