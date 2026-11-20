-- =============================================================================
-- Prompt 10 · Family Experience sobre Supabase
-- AS-IS → TO-BE (docs/FAMILY.md). Solo «expand»: no se borra ni se renombra nada.
--   AS-IS: parent_athlete_links (pending/approved/revoked, 4 permisos), consents inmutables,
--          athlete_finances.annual_budget_usd, pipeline_tasks del atleta.
--   TO-BE: la misma tabla es la Guardian Relationship (ciclo de vida, verificación, permisos
--          por recurso, revisión al cumplir 18), consentimientos con caducidad y revocación en
--          cascada, presupuesto privado con modo, escenarios de coste privados, notas familiares
--          y tareas compartidas. Household: no hace falta (las relaciones resuelven varios
--          tutores y varios atletas con permisos independientes).
-- =============================================================================

-- 1. Ciclo de vida de la relación ----------------------------------------------------------------
-- ACTIVE = 'approved' (se conserva el valor para no romper datos ni políticas existentes).
alter type public.link_status add value if not exists 'restricted';
alter type public.link_status add value if not exists 'expired';

alter table public.parent_athlete_links drop constraint if exists parent_athlete_links_relationship_check;
alter table public.parent_athlete_links add constraint parent_athlete_links_relationship_check
  check (relationship in ('parent', 'mother', 'father', 'legal_guardian', 'other_guardian', 'other_family'));

alter table public.parent_athlete_links
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'athlete_confirmed', 'admin_verified')),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists restricted_at timestamptz,
  add column if not exists restriction_reason text check (char_length(restriction_reason) <= 300),
  add column if not exists last_reviewed_at timestamptz,
  -- Permisos por recurso (además de los 4 existentes). Por defecto: lo útil sí, los mensajes no.
  add column if not exists can_view_costs boolean not null default true,
  add column if not exists can_view_documents boolean not null default true,
  add column if not exists can_view_contacts boolean not null default true,
  add column if not exists can_view_messages boolean not null default false;
create index if not exists fkx_parent_athlete_links_verified_by on public.parent_athlete_links (verified_by);

-- Reconciliación: todo vínculo aprobado lo confirmó el atleta (aceptó o invitó él).
update public.parent_athlete_links
   set verification_status = 'athlete_confirmed', verified_at = coalesce(approved_at, created_at)
 where status = 'approved' and verification_status = 'unverified';

-- 2. Política configurable (por jurisdicción; hoy solo «default») ------------------------------------
create table if not exists public.family_policies (
  jurisdiction text primary key check (jurisdiction ~ '^(default|[A-Z]{2})$'),
  review_window_days int not null default 30 check (review_window_days between 0 and 365),
  updated_at timestamptz not null default now()
);
alter table public.family_policies enable row level security;
create policy family_policies_read on public.family_policies for select to authenticated using (true);
grant select on public.family_policies to authenticated;
insert into public.family_policies (jurisdiction, review_window_days) values ('default', 30) on conflict do nothing;

-- 3. Mayoría de edad: GUARDIAN ACCESS REVIEW ----------------------------------------------------------
-- Si el vínculo nació siendo menor el atleta, al cumplir 18 se abre una ventana de revisión.
-- Pasada la ventana sin confirmación del atleta, el acceso se suspende solo (sin cron).
create or replace function public.family_review_due_at(p_athlete uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select (d.date_of_birth + interval '18 years')::timestamptz
         + make_interval(days => coalesce((select review_window_days from public.family_policies where jurisdiction = 'default'), 30))
    from public.private_profile_data d where d.user_id = p_athlete;
$$;
revoke all on function public.family_review_due_at(uuid) from public, anon, authenticated;

create or replace function public.family_link_lapsed(p_athlete uuid, p_minor_link boolean, p_last_reviewed timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_minor_link
    and now() > public.family_review_due_at(p_athlete)
    and (p_last_reviewed is null
         or p_last_reviewed < (select (d.date_of_birth + interval '18 years')::timestamptz
                                 from public.private_profile_data d where d.user_id = p_athlete)), false);
$$;
revoke all on function public.family_link_lapsed(uuid, boolean, timestamptz) from public, anon, authenticated;

-- 4. Funciones de autorización (pequeñas y auditables) -------------------------------------------------
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
             when 'view_documents' then l.can_view_documents
             when 'view_contacts' then l.can_view_contacts
             when 'view_messages' then l.can_view_messages
             when 'active' then true
             else false
           end);
$$;

-- Tutor activo (cualquier permiso): base de las demás comprobaciones.
create or replace function public.is_active_guardian(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_family_link(p_athlete, 'active');
$$;

-- Recurso → permiso. Las notas privadas del atleta no son visibles nunca para la familia.
create or replace function public.guardian_can_view_resource(p_athlete uuid, p_resource text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_resource
    when 'passport' then public.has_family_link(p_athlete, 'view_profile')
    when 'shortlist' then public.has_family_link(p_athlete, 'view_profile')
    when 'pipeline' then public.has_family_link(p_athlete, 'view_applications')
    when 'applications' then public.has_family_link(p_athlete, 'view_applications')
    when 'academics' then public.has_family_link(p_athlete, 'view_academics')
    when 'costs' then public.has_family_link(p_athlete, 'view_costs')
    when 'documents' then public.has_family_link(p_athlete, 'view_documents')
    when 'contacts' then public.has_family_link(p_athlete, 'view_contacts')
    when 'messages' then public.has_family_link(p_athlete, 'view_messages')
    else false
  end;
$$;

-- ¿Esta acción del atleta necesita el visto bueno del tutor? (hoy: menor + acción sensible)
create or replace function public.requires_guardian_consent(p_athlete uuid, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_minor(p_athlete)
     and p_action in ('organization_contact', 'document_sharing', 'trial_participation', 'academy_enrollment', 'travel', 'media_public');
$$;

grant execute on function public.is_active_guardian(uuid), public.guardian_can_view_resource(uuid, text),
  public.requires_guardian_consent(uuid, text) to authenticated;
revoke execute on function public.is_active_guardian(uuid), public.guardian_can_view_resource(uuid, text),
  public.requires_guardian_consent(uuid, text) from public, anon;

-- 5. Guard de la relación: lo nuevo también es inmutable desde el cliente --------------------------
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
      new.can_view_costs, new.can_view_documents, new.can_view_contacts, new.can_view_messages)
     is distinct from
     (old.can_view_profile, old.can_edit_profile, old.can_view_applications, old.can_view_academics,
      old.can_view_costs, old.can_view_documents, old.can_view_contacts, old.can_view_messages)
     and (auth.uid() is distinct from new.athlete_id or new.status::text not in ('approved', 'restricted')) then
    raise exception 'only_athlete_sets_family_permissions' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 6. Acciones sobre la relación (RPC) ----------------------------------------------------------------
-- El atleta confirma (o no) que su familia sigue teniendo acceso al cumplir 18.
create or replace function public.family_link_review(p_link uuid, p_keep boolean)
returns text language plpgsql security definer set search_path = public as $$
declare l public.parent_athlete_links;
begin
  select * into l from public.parent_athlete_links where id = p_link for update;
  if not found or l.athlete_id is distinct from auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if public.is_minor(l.athlete_id) then raise exception 'review_after_majority' using errcode = 'P0001'; end if;
  if l.status::text not in ('approved', 'restricted') then raise exception 'link_not_active' using errcode = 'P0001'; end if;
  perform set_config('gala.family_rpc', 'on', true);
  if p_keep then
    update public.parent_athlete_links set last_reviewed_at = now() where id = p_link;
  else
    update public.parent_athlete_links set status = 'revoked', revoked_at = now(), last_reviewed_at = now() where id = p_link;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
  values (auth.uid(), 'family_link.reviewed', 'parent_athlete_links', p_link, 'sensitive', jsonb_build_object('keep', p_keep));
  return case when p_keep then 'kept' else 'revoked' end;
end $$;

-- Pausar / reanudar: el atleta suspende temporalmente el acceso sin romper la relación.
create or replace function public.family_link_restrict(p_link uuid, p_restrict boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare l public.parent_athlete_links;
begin
  select * into l from public.parent_athlete_links where id = p_link for update;
  if not found or (l.athlete_id is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform set_config('gala.family_rpc', 'on', true);
  if p_restrict then
    if l.status::text <> 'approved' then raise exception 'link_not_active' using errcode = 'P0001'; end if;
    update public.parent_athlete_links set status = 'restricted', restricted_at = now(), restriction_reason = left(p_reason, 300) where id = p_link;
  else
    if l.status::text <> 'restricted' then raise exception 'link_not_restricted' using errcode = 'P0001'; end if;
    update public.parent_athlete_links set status = 'approved', restricted_at = null, restriction_reason = null,
           last_reviewed_at = case when public.is_minor(l.athlete_id) then l.last_reviewed_at else now() end
     where id = p_link;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
  values (auth.uid(), case when p_restrict then 'family_link.restricted' else 'family_link.resumed' end,
          'parent_athlete_links', p_link, 'sensitive', '{}'::jsonb);
  return case when p_restrict then 'restricted' else 'approved' end;
end $$;

-- Verificación administrativa del vínculo (Opción D: casos excepcionales).
create or replace function public.family_link_admin_verify(p_link uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform set_config('gala.family_rpc', 'on', true);
  update public.parent_athlete_links set verification_status = 'admin_verified', verified_at = now(), verified_by = auth.uid()
   where id = p_link and status::text in ('approved', 'restricted');
  insert into public.audit_logs (actor_id, action, entity, entity_id, classification)
  values (auth.uid(), 'family_link.admin_verified', 'parent_athlete_links', p_link, 'security');
end $$;

-- Invitaciones caducadas pasan a «expired» (diario si hay pg_cron; la aceptación ya las rechaza).
create or replace function public.expire_family_invitations()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('gala.family_rpc', 'on', true);
  update public.parent_athlete_links set status = 'expired' where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.family_link_review(uuid, boolean), public.family_link_restrict(uuid, boolean, text),
  public.family_link_admin_verify(uuid), public.expire_family_invitations() from public, anon;
grant execute on function public.family_link_review(uuid, boolean), public.family_link_restrict(uuid, boolean, text),
  public.family_link_admin_verify(uuid) to authenticated;
revoke execute on function public.expire_family_invitations() from authenticated;

-- La aceptación de una invitación confirma la relación (el atleta participa en ambos sentidos).
create or replace function public.stamp_family_link_verification()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' and new.verification_status = 'unverified' then
    new.verification_status := 'athlete_confirmed';
    new.verified_at := now();
  end if;
  return new;
end $$;
drop trigger if exists stamp_family_link_verification on public.parent_athlete_links;
create trigger stamp_family_link_verification before update on public.parent_athlete_links
  for each row execute function public.stamp_family_link_verification();
revoke execute on function public.stamp_family_link_verification() from public, anon, authenticated;

-- Auditoría de cambios de estado y de permisos.
create or replace function public.audit_family_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status = 'revoked' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
    values (auth.uid(), 'family_link.revoked', 'parent_athlete_links', new.id, 'sensitive', jsonb_build_object('athlete_id', new.athlete_id));
  end if;
  if (new.can_view_profile, new.can_edit_profile, new.can_view_applications, new.can_view_academics,
      new.can_view_costs, new.can_view_documents, new.can_view_contacts, new.can_view_messages)
     is distinct from
     (old.can_view_profile, old.can_edit_profile, old.can_view_applications, old.can_view_academics,
      old.can_view_costs, old.can_view_documents, old.can_view_contacts, old.can_view_messages) then
    insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
    values (auth.uid(), 'family_link.scope_changed', 'parent_athlete_links', new.id, 'sensitive',
            jsonb_build_object('profile', new.can_view_profile, 'edit', new.can_edit_profile, 'applications', new.can_view_applications,
                               'academics', new.can_view_academics, 'costs', new.can_view_costs, 'documents', new.can_view_documents,
                               'contacts', new.can_view_contacts, 'messages', new.can_view_messages));
  end if;
  return null;
end $$;
drop trigger if exists audit_family_link on public.parent_athlete_links;
create trigger audit_family_link after update on public.parent_athlete_links
  for each row execute function public.audit_family_link();
revoke execute on function public.audit_family_link() from public, anon, authenticated;

-- 7. Permisos por recurso aplicados (por defecto todos «true»: sin cambio de comportamiento) -----------
drop policy if exists finances_select on public.athlete_finances;
create policy finances_select on public.athlete_finances for select to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs') or public.is_admin());
drop policy if exists docs_select on public.athlete_documents;
create policy docs_select on public.athlete_documents for select to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_documents'));
drop policy if exists info_select on public.info_requests;
create policy info_select on public.info_requests for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_documents') or public.org_can(organization_id, 'candidates'));

-- document_open: la familia necesita permiso de documentos (antes: ver perfil).
create or replace function public.document_open(p_document uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d public.athlete_documents%rowtype;
  v_org uuid;
begin
  if v_uid is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into d from public.athlete_documents where id = p_document;
  if not found or d.storage_path is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if d.athlete_id = v_uid or public.has_family_link(d.athlete_id, 'view_documents') then
    return d.storage_path;
  end if;
  if public.org_has_document_grant(p_document) then
    select g.organization_id into v_org from public.document_access_grants g
     where g.document_id = p_document and g.revoked_at is null and g.expires_at > now()
       and public.org_can(g.organization_id, 'candidates')
     order by g.created_at desc limit 1;
    if v_org is null then
      select r.organization_id into v_org from public.info_requests r
       where r.document_id = p_document and r.status = 'shared' and r.shared_until >= current_date
         and public.org_can(r.organization_id, 'candidates') limit 1;
    end if;
  elsif not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, organization_id, classification, details)
  values (v_uid, 'document_opened', 'athlete_document', p_document, v_org,
          case when public.document_is_highly_restricted(d.kind) then 'security' else 'sensitive' end,
          jsonb_build_object('athlete_id', d.athlete_id, 'kind', d.kind, 'via', case when v_org is null then 'admin' else 'grant' end));
  return d.storage_path;
end $$;

-- 8. Consentimientos: caducidad y revocación en cascada -----------------------------------------------
alter table public.consents add column if not exists expires_at timestamptz;
create or replace function public.consent_granted(p_athlete uuid, p_purpose text, p_target_type text, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select granted and (expires_at is null or expires_at > now()) from public.consents
                    where user_id = p_athlete and purpose = p_purpose and target_type is not distinct from p_target_type and target_id is not distinct from p_target
                    order by created_at desc limit 1), false);
$$;

-- Revocar el consentimiento de compartir un documento revoca las concesiones vivas y queda auditado.
create or replace function public.on_consent_recorded()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.granted and new.purpose = 'document_sharing' and new.target_type = 'document' and new.target_id is not null then
    update public.document_access_grants set revoked_at = now()
     where document_id = new.target_id and revoked_at is null
       and (new.organization_id is null or organization_id = new.organization_id);
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, organization_id, classification, details)
  values (coalesce(new.guardian_id, new.user_id), case when new.granted then 'consent.granted' else 'consent.revoked' end,
          'consents', new.id, new.organization_id, 'sensitive',
          jsonb_build_object('purpose', new.purpose, 'athlete_id', new.user_id, 'by_guardian', new.guardian_id is not null));
  return null;
end $$;
drop trigger if exists on_consent_recorded on public.consents;
create trigger on_consent_recorded after insert on public.consents for each row execute function public.on_consent_recorded();
revoke execute on function public.on_consent_recorded() from public, anon, authenticated;

-- 9. Presupuesto familiar: privado y con modo ------------------------------------------------------------
alter table public.athlete_finances
  add column if not exists budget_mode text not null default 'preference' check (budget_mode in ('preference', 'hard_limit'));
comment on table public.athlete_finances is 'Presupuesto familiar. PRIVADO: solo atleta, familia con permiso de costes y admin. Nunca organizaciones ni agentes.';

-- 10. Escenarios de coste de la familia (cálculo privado) ------------------------------------------------
-- No mezcla: coste institucional (institutions/opportunities), tipo de ayuda (opportunities.aid_kind),
-- componente de oferta (athlete_offers) y este escenario privado. NULL = desconocido, nunca 0.
create table if not exists public.family_cost_scenarios (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  label text not null check (char_length(label) between 2 and 120),
  institution_id uuid references public.institutions (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  offer_id uuid references public.athlete_offers (id) on delete set null,
  currency text not null default 'USD' check (currency in ('USD', 'EUR', 'GBP')),
  tuition int check (tuition between 0 and 500000),
  fees int check (fees between 0 and 500000),
  housing int check (housing between 0 and 500000),
  meals int check (meals between 0 and 500000),
  insurance int check (insurance between 0 and 500000),
  travel int check (travel between 0 and 500000),
  other_costs int check (other_costs between 0 and 500000),
  athletic_aid int check (athletic_aid between 0 and 500000),
  academic_aid int check (academic_aid between 0 and 500000),
  other_aid int check (other_aid between 0 and 500000),
  housing_included boolean,
  source_note text check (char_length(source_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_cost_scenarios_athlete_idx on public.family_cost_scenarios (athlete_id, updated_at desc);
create index if not exists fkx_family_cost_scenarios_created_by on public.family_cost_scenarios (created_by);
create index if not exists fkx_family_cost_scenarios_institution_id on public.family_cost_scenarios (institution_id);
create index if not exists fkx_family_cost_scenarios_opportunity_id on public.family_cost_scenarios (opportunity_id);
create index if not exists fkx_family_cost_scenarios_offer_id on public.family_cost_scenarios (offer_id);
alter table public.family_cost_scenarios enable row level security;
create policy fcs_select on public.family_cost_scenarios for select to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'));
create policy fcs_insert on public.family_cost_scenarios for insert to authenticated
  with check ((athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs')) and created_by = (select auth.uid())
              and (offer_id is null or exists (select 1 from public.athlete_offers o where o.id = offer_id and o.athlete_id = family_cost_scenarios.athlete_id)));
create policy fcs_update on public.family_cost_scenarios for update to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'))
  with check ((athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'))
              and (offer_id is null or exists (select 1 from public.athlete_offers o where o.id = offer_id and o.athlete_id = family_cost_scenarios.athlete_id)));
create policy fcs_delete on public.family_cost_scenarios for delete to authenticated
  using (athlete_id = (select auth.uid()) or public.has_family_link(athlete_id, 'view_costs'));
grant select, insert, update, delete on public.family_cost_scenarios to authenticated;
create trigger t_family_cost_scenarios_updated before update on public.family_cost_scenarios
  for each row execute function public.set_updated_at();
-- athlete_id no cambia de dueño.
create or replace function public.guard_cost_scenario()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.athlete_id is distinct from old.athlete_id or new.created_by is distinct from old.created_by then
    raise exception 'scenario_owner_immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_cost_scenario before update on public.family_cost_scenarios for each row execute function public.guard_cost_scenario();
revoke execute on function public.guard_cost_scenario() from public, anon, authenticated;

-- 11. Notas familiares: nunca visibles para organizaciones ---------------------------------------------
-- 'guardians' = solo tutores del atleta; 'family' = tutores + atleta.
create table if not exists public.family_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  visibility text not null default 'guardians' check (visibility in ('guardians', 'family')),
  body text not null check (char_length(body) between 1 and 2000),
  context_type text check (context_type in ('institution', 'opportunity', 'offer', 'scenario')),
  context_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists family_notes_athlete_idx on public.family_notes (athlete_id, created_at desc);
create index if not exists fkx_family_notes_author_id on public.family_notes (author_id);
alter table public.family_notes enable row level security;
create policy family_notes_select on public.family_notes for select to authenticated
  using (author_id = (select auth.uid())
         or public.is_active_guardian(athlete_id)
         or (visibility = 'family' and athlete_id = (select auth.uid())));
create policy family_notes_insert on public.family_notes for insert to authenticated
  with check (author_id = (select auth.uid())
              and (public.is_active_guardian(athlete_id) or (athlete_id = (select auth.uid()) and visibility = 'family'))
              and body !~* '<\s*script|javascript:|on[a-z]+\s*=');
create policy family_notes_delete on public.family_notes for delete to authenticated
  using (author_id = (select auth.uid()));
grant select, insert, delete on public.family_notes to authenticated;

-- 12. Tareas compartidas: el motor central (pipeline_tasks) con responsable y origen ---------------------
alter table public.pipeline_tasks
  add column if not exists owner text not null default 'athlete' check (owner in ('athlete', 'guardian', 'both')),
  add column if not exists source text not null default 'athlete' check (source in ('athlete', 'family', 'gala', 'organization'));
-- La familia (activa) puede crear y cerrar tareas suyas o compartidas aunque no edite el perfil.
create policy pipeline_tasks_family_insert on public.pipeline_tasks for insert to authenticated
  with check (public.is_active_guardian(athlete_id) and created_by = auth.uid() and owner in ('guardian', 'both') and source = 'family'
              and (process_id is null or exists (select 1 from public.saved_items s where s.id = process_id and s.athlete_id = pipeline_tasks.athlete_id)));
create policy pipeline_tasks_family_update on public.pipeline_tasks for update to authenticated
  using (public.is_active_guardian(athlete_id) and owner in ('guardian', 'both'))
  with check (public.is_active_guardian(athlete_id) and owner in ('guardian', 'both'));

-- 13. Notificaciones familiares por categoría -----------------------------------------------------------
-- (notification_preferences.category es texto libre; las categorías familiares se documentan en FAMILY.md)

-- 14. Caducidad diaria de invitaciones (si pg_cron existe) ---------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gala-expire-family-invitations', '27 4 * * *', 'select public.expire_family_invitations()');
  end if;
end $$;

-- =============================================================================
-- ROLLBACK (manual, orden inverso; los valores de enum añadidos no se pueden quitar y son inocuos):
--   select cron.unschedule('gala-expire-family-invitations');
--   drop policy pipeline_tasks_family_insert/_update; alter table pipeline_tasks drop column owner, source;
--   drop table family_notes, family_cost_scenarios; alter table athlete_finances drop column budget_mode;
--   drop trigger on_consent_recorded; restaurar consent_granted (20261121000500); alter table consents drop column expires_at;
--   restaurar finances_select/docs_select/info_select con 'view_profile' y document_open (20261123000100);
--   drop trigger audit_family_link, stamp_family_link_verification; restaurar guard_family_link (20261113000100)
--   y has_family_link; drop function family_link_* , is_active_guardian, guardian_can_view_resource,
--   requires_guardian_consent, family_review_due_at, expire_family_invitations; drop table family_policies;
--   alter table parent_athlete_links drop column verification_status, verified_at, verified_by, restricted_at,
--   restriction_reason, last_reviewed_at, can_view_costs, can_view_documents, can_view_contacts, can_view_messages;
--   update parent_athlete_links set status = 'pending' where status = 'expired'; set status 'approved' where 'restricted'.
-- =============================================================================
