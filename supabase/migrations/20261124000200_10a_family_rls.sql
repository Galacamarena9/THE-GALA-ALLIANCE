-- =============================================================================
-- Prompt 10A · Matriz RLS de Family Experience (docs/FAMILY-RLS.md)
-- Inventario → huecos → corrección. Solo «expand» + políticas más estrictas.
--   F-01 (alta)  contactos: el tutor veía/aprobaba solicitudes con cualquier vínculo «approved»,
--                aunque estuviera pausado por el atleta o vencida la revisión de mayoría de edad.
--   F-02 (media) ofertas: la familia las veía con el permiso «ver Passport», no con proceso/costes.
--   F-03 (media) presupuesto familiar sin permiso propio (colgaba de «costes»).
--   F-04 (media) mensajes de atletas adultos: sin regla explícita para la familia.
--   F-05 (baja)  sin función de scopes legibles (athlete.*.view) para la matriz y la IA.
-- =============================================================================

-- F-03 · Permiso propio para el presupuesto (por defecto igual que antes: visible).
alter table public.parent_athlete_links add column if not exists can_view_budget boolean not null default true;

create or replace function public.has_family_link(p_athlete uuid, p_capability text default 'view_profile')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_athlete_links l
     where l.parent_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'approved'
       and not public.family_link_lapsed(l.athlete_id, l.guardian_consent_given, l.last_reviewed_at)
       and case p_capability
             when 'view_profile' then l.can_view_profile
             when 'edit_profile' then l.can_edit_profile
             when 'view_applications' then l.can_view_applications
             when 'view_academics' then l.can_view_academics
             when 'view_costs' then l.can_view_costs
             when 'view_budget' then l.can_view_budget
             when 'view_documents' then l.can_view_documents
             when 'view_contacts' then l.can_view_contacts
             when 'view_messages' then l.can_view_messages
             when 'active' then true
             else false
           end);
$$;

-- F-05 · Scopes legibles de la matriz → permisos reales. Desconocido = denegado.
create or replace function public.guardian_has_scope(p_athlete uuid, p_scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_scope
    when 'athlete.profile.view' then public.has_family_link(p_athlete, 'view_profile')
    when 'athlete.passport.view' then public.has_family_link(p_athlete, 'view_profile')
    when 'athlete.shortlist.view' then public.has_family_link(p_athlete, 'view_profile')
    when 'athlete.tasks.view' then public.has_family_link(p_athlete, 'view_profile')
    when 'athlete.pipeline.view' then public.has_family_link(p_athlete, 'view_applications')
    when 'athlete.deadlines.view' then public.has_family_link(p_athlete, 'view_applications')
    when 'athlete.offers.view' then public.has_family_link(p_athlete, 'view_applications') or public.has_family_link(p_athlete, 'view_costs')
    when 'athlete.costs.view' then public.has_family_link(p_athlete, 'view_costs')
    when 'athlete.family_budget.view' then public.has_family_link(p_athlete, 'view_budget')
    when 'athlete.documents.view' then public.has_family_link(p_athlete, 'view_documents')
    when 'athlete.messages.view' then public.has_family_link(p_athlete, 'view_messages')
    when 'athlete.safety.view' then public.has_family_link(p_athlete, 'view_contacts')
    when 'athlete.contacts.view' then public.has_family_link(p_athlete, 'view_contacts')
    -- Aprobar (contactos, compartir documentos, participación) es una función de protección del menor:
    -- la tiene todo tutor activo de un menor; con un atleta adulto, nadie aprueba por él.
    when 'athlete.contacts.approve' then public.is_minor(p_athlete) and public.is_active_guardian(p_athlete)
    when 'athlete.documents.approve_share' then public.is_minor(p_athlete) and public.is_active_guardian(p_athlete)
    when 'athlete.consents.manage' then public.is_minor(p_athlete) and public.is_active_guardian(p_athlete)
    else false
  end;
$$;
revoke all on function public.guardian_has_scope(uuid, text) from public, anon;
grant execute on function public.guardian_has_scope(uuid, text) to authenticated;

-- El permiso nuevo también lo decide solo el atleta y queda auditado.
create or replace function public.guard_family_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() or current_setting('gala.family_rpc', true) = 'on' then
    return new;
  end if;
  if (new.parent_id, new.athlete_id, new.invited_by, new.invitation_token, new.expires_at,
      new.approved_at, new.created_at, new.guardian_consent_given, new.relationship,
      new.verification_status, new.verified_at, new.verified_by, new.restricted_at, new.restriction_reason, new.last_reviewed_at)
     is distinct from
     (old.parent_id, old.athlete_id, old.invited_by, old.invitation_token, old.expires_at,
      old.approved_at, old.created_at, old.guardian_consent_given, old.relationship,
      old.verification_status, old.verified_at, old.verified_by, old.restricted_at, old.restriction_reason, old.last_reviewed_at) then
    raise exception 'family_link_fields_immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if new.status <> 'revoked' or old.status = 'revoked' then
      raise exception 'family_link_can_only_be_revoked' using errcode = '42501';
    end if;
    new.revoked_at := now();
  else
    new.revoked_at := old.revoked_at;
  end if;
  if (new.can_view_profile, new.can_edit_profile, new.can_view_applications, new.can_view_academics,
      new.can_view_costs, new.can_view_budget, new.can_view_documents, new.can_view_contacts, new.can_view_messages)
     is distinct from
     (old.can_view_profile, old.can_edit_profile, old.can_view_applications, old.can_view_academics,
      old.can_view_costs, old.can_view_budget, old.can_view_documents, old.can_view_contacts, old.can_view_messages)
     and (auth.uid() is distinct from new.athlete_id or new.status::text not in ('approved', 'restricted')) then
    raise exception 'only_athlete_sets_family_permissions' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.audit_family_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status = 'revoked' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
    values (auth.uid(), 'family_link.revoked', 'parent_athlete_links', new.id, 'sensitive', jsonb_build_object('athlete_id', new.athlete_id));
  end if;
  if (new.can_view_profile, new.can_edit_profile, new.can_view_applications, new.can_view_academics,
      new.can_view_costs, new.can_view_budget, new.can_view_documents, new.can_view_contacts, new.can_view_messages)
     is distinct from
     (old.can_view_profile, old.can_edit_profile, old.can_view_applications, old.can_view_academics,
      old.can_view_costs, old.can_view_budget, old.can_view_documents, old.can_view_contacts, old.can_view_messages) then
    insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
    values (auth.uid(), 'family_link.scope_changed', 'parent_athlete_links', new.id, 'sensitive',
            jsonb_build_object('profile', new.can_view_profile, 'edit', new.can_edit_profile, 'applications', new.can_view_applications,
                               'academics', new.can_view_academics, 'costs', new.can_view_costs, 'budget', new.can_view_budget,
                               'documents', new.can_view_documents, 'contacts', new.can_view_contacts, 'messages', new.can_view_messages));
  end if;
  return null;
end $$;
revoke execute on function public.audit_family_link() from public, anon, authenticated;

drop policy if exists finances_select on public.athlete_finances;
create policy athlete_or_guardian_view_family_budget on public.athlete_finances for select to authenticated
  using (athlete_id = (select auth.uid()) or public.guardian_has_scope(athlete_id, 'athlete.family_budget.view') or public.is_admin());

-- F-02 · Ofertas: proceso o costes, no «ver Passport».
drop policy if exists offers_select on public.athlete_offers;
create policy athlete_or_guardian_view_offers on public.athlete_offers for select to authenticated
  using (athlete_id = (select auth.uid()) or public.guardian_has_scope(athlete_id, 'athlete.offers.view'));

-- F-01 · Contactos: el tutor debe estar ACTIVO (no pausado ni con la revisión de los 18 vencida).
-- Menor: el tutor activo ve y aprueba (protección, no depende de que el menor lo active).
-- Adulto: la familia solo ve quién contacta si el atleta concede «quién me contacta».
create or replace function public.is_contact_participant(p_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contact_requests r
     where r.id = p_request
       and (r.athlete_id = auth.uid()
            or public.is_org_member(r.organization_id)
            or (r.is_minor_at_request and public.is_active_guardian(r.athlete_id))));
$$;

drop policy if exists contact_select on public.contact_requests;
create policy parties_and_guardians_view_contact_requests on public.contact_requests for select to authenticated
  using (athlete_id = (select auth.uid())
         or public.is_org_member(organization_id)
         or (is_minor_at_request and public.is_active_guardian(athlete_id))
         or public.guardian_has_scope(athlete_id, 'athlete.contacts.view'));

-- F-04 · Mensajes de un atleta adulto: la familia solo los lee con «ver mis mensajes» (nunca escribe).
create policy guardians_with_scope_view_adult_messages on public.contact_messages for select to authenticated
  using (exists (select 1 from public.contact_requests r
                  where r.id = contact_messages.request_id and not r.is_minor_at_request
                    and public.guardian_has_scope(r.athlete_id, 'athlete.messages.view')));

-- La aprobación del tutor en el flujo de contacto exige tutor activo (resto idéntico a 20261116000100: ventana NCAA).
create or replace function public.guard_contact_request()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_is_guardian boolean;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'verified_organization_required' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.contact_requests where organization_id = new.organization_id
               and athlete_id = new.athlete_id and status = 'blocked') then
      raise exception 'blocked_by_athlete' using errcode = '42501';
    end if;
    -- Cumplimiento NCAA: una universidad D-I/D-II no inicia contacto antes de la ventana de su deporte.
    if exists (
      select 1
      from public.organizations o
      join public.athlete_profiles ap on ap.user_id = new.athlete_id
      where o.id = new.organization_id
        and o.type in ('university', 'college')
        and public.ncaa_contact_opens_on(ap.graduation_year, o.division, ap.sport_id) > current_date
    ) then
      raise exception 'ncaa_contact_window_closed' using errcode = 'P0001';
    end if;
    new.requested_by := v_uid;
    new.is_minor_at_request := public.is_minor(new.athlete_id);
    new.guardian_approved_by := null;
    new.responded_at := null;
    if new.is_minor_at_request then
      if not exists (select 1 from public.parent_athlete_links where athlete_id = new.athlete_id and status = 'approved') then
        raise exception 'guardian_required' using errcode = 'P0001';
      end if;
      new.status := 'pending_guardian';
    else
      new.status := 'pending';
    end if;
    if (select count(*) from public.contact_requests where requested_by = v_uid and created_at > now() - interval '1 day') >= 20 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if (new.organization_id, new.requested_by, new.athlete_id, new.message, new.is_minor_at_request, new.created_at)
     is distinct from (old.organization_id, old.requested_by, old.athlete_id, old.message, old.is_minor_at_request, old.created_at) then
    raise exception 'contact_request_immutable' using errcode = '42501';
  end if;
  if new.status is not distinct from old.status then return new; end if;

  v_is_guardian := public.is_active_guardian(new.athlete_id);
  if old.status = 'pending_guardian' and v_is_guardian and new.status in ('pending', 'declined', 'blocked') then
    new.guardian_approved_by := case when new.status = 'pending' then v_uid else null end;
    new.responded_at := case when new.status = 'pending' then null else now() end;
  elsif old.status = 'pending' and v_uid = new.athlete_id and new.status in ('accepted', 'declined', 'blocked') then
    new.responded_at := now();
  elsif old.status in ('accepted', 'declined') and (v_uid = new.athlete_id or (new.is_minor_at_request and v_is_guardian)) and new.status = 'blocked' then
    new.responded_at := now();
  else
    raise exception 'contact_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

-- =============================================================================
-- ROLLBACK: restaurar finances_select / offers_select / contact_select (20261113000100, 20261113000400),
--   is_contact_participant (20261113000500) y guard_contact_request (20261116000100), guard_family_link / audit_family_link
--   y has_family_link (20261124000100); drop policy guardians_with_scope_view_adult_messages;
--   drop function guardian_has_scope; alter table parent_athlete_links drop column can_view_budget.
-- =============================================================================
