-- =============================================================================================================
-- Fase 5 de la auditoría: verificación real del tutor de un menor (riesgo residual de la fase 1).
-- Problema: un adulto «falso» (alguien que miente sobre su edad o su parentesco) con un vínculo aprobado podía
-- decidir por un menor: aprobar contactos, consentir pruebas, matrículas o representaciones, crear enlaces de su perfil.
--
-- Modelo (proporcionado, sin documentos de identidad en la plataforma):
--   1. Declaración del tutor (append-only, versionada): «soy su madre/padre/tutor legal y tengo autoridad para decidir».
--   2. Comprobaciones automáticas: email confirmado, tutor de 25 años o más y al menos 16 años mayor que el atleta.
--   3. Revisión humana: mientras el flag guardian_auto_verify esté apagado (piloto), TODA verificación la aprueba
--      administración (family_link_admin_verify ahora exige la declaración). Con el flag encendido, basta la
--      declaración + comprobaciones automáticas; si fallan, vuelve a revisión humana.
--   4. Solo cambia el poder de DECIDIR por un menor. Ver lo que el atleta comparte sigue igual (ya lo confirmó él).
--      Rechazar o retirar un consentimiento nunca se bloquea (va en la dirección protectora).
-- Verificación con documento/proveedor de identidad: decisión L5 de Gala (coste, proveedor, datos); no se implementa aquí.
-- ROLLBACK:
--   drop trigger if exists guard_guardian_consent on public.consents; drop function if exists public.guard_guardian_consent();
--   drop trigger if exists guard_guardian_contact_approval on public.contact_requests; drop function if exists public.guard_guardian_contact_approval();
--   drop function if exists public.guardian_attest(uuid, text); drop function if exists public.guardian_review(uuid, boolean, text);
--   drop function if exists public.guardian_verification_state(uuid); drop function if exists public.guardian_review_queue();
--   drop function if exists public.guardian_decision_ok(uuid, uuid); drop function if exists public.guardian_auto_checks(uuid);
--   drop table if exists public.guardian_attestations; delete from public.feature_flags where key = 'guardian_auto_verify';
--   restaurar is_guardian_of (20261218000100) y family_link_admin_verify (20261124000100).
-- =============================================================================================================

insert into public.feature_flags (key, enabled, description, kill_switch) values
  ('guardian_auto_verify', false, 'Verificar tutores sin revisión humana si pasan las comprobaciones automáticas (apagado en el piloto)', false)
on conflict (key) do nothing;

-- 1. Declaración del tutor ---------------------------------------------------------------------------------------
create table if not exists public.guardian_attestations (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.parent_athlete_links (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  statement_version text not null check (statement_version ~ '^guardian-\d{4}-\d{2}$'),
  relationship text not null,
  created_at timestamptz not null default now()
);
create index if not exists guardian_attestations_link on public.guardian_attestations (link_id, created_at desc);
create index if not exists guardian_attestations_parent on public.guardian_attestations (parent_id);
create index if not exists guardian_attestations_athlete on public.guardian_attestations (athlete_id);
alter table public.guardian_attestations enable row level security;
revoke all on public.guardian_attestations from anon, authenticated;
grant select on public.guardian_attestations to authenticated;
create policy guardian_attestations_select on public.guardian_attestations for select to authenticated
  using (parent_id = (select auth.uid()) or athlete_id = (select auth.uid()) or public.is_admin());

-- Versión vigente del texto que se declara (cambiarla obliga a declarar de nuevo).
create or replace function public.guardian_statement_version()
returns text language sql immutable set search_path = public as $$ select 'guardian-2026-11'::text $$;
grant execute on function public.guardian_statement_version() to authenticated;

-- 2. Comprobaciones automáticas (sin exponer edades a nadie) -----------------------------------------------------
create or replace function public.guardian_auto_checks(p_link uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select u.email_confirmed_at is not null
       and pg.date_of_birth <= current_date - interval '25 years'
       and pa.date_of_birth >= pg.date_of_birth + interval '16 years'
      from public.parent_athlete_links l
      join auth.users u on u.id = l.parent_id
      join public.private_profile_data pg on pg.user_id = l.parent_id
      join public.private_profile_data pa on pa.user_id = l.athlete_id
     where l.id = p_link), false);
$$;
revoke all on function public.guardian_auto_checks(uuid) from public, anon, authenticated;

-- 3. ¿Puede esta persona DECIDIR por este atleta? -----------------------------------------------------------------
create or replace function public.guardian_decision_ok(p_parent uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_minor(p_athlete) or exists (
    select 1 from public.parent_athlete_links l
     where l.parent_id = p_parent and l.athlete_id = p_athlete and l.status = 'approved'
       and l.relationship in ('parent', 'mother', 'father', 'legal_guardian')
       and not public.is_minor(l.parent_id)
       and exists (select 1 from public.guardian_attestations a
                    where a.link_id = l.id and a.statement_version = public.guardian_statement_version())
       and (l.verification_status = 'admin_verified'
            or (public.flag_enabled('guardian_auto_verify') and public.guardian_auto_checks(l.id)))
  );
$$;
revoke all on function public.guardian_decision_ok(uuid, uuid) from public, anon, authenticated;

-- is_guardian_of = poder de actuar por el menor (enlaces de reclutamiento, recomendaciones, showcase, borrados).
create or replace function public.is_guardian_of(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_athlete_links l
     where l.parent_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'approved'
       and l.relationship in ('parent', 'mother', 'father', 'legal_guardian')
       and not public.is_minor(l.parent_id)
  ) and public.guardian_decision_ok(auth.uid(), p_athlete);
$$;

-- 4. Puntos de decisión ---------------------------------------------------------------------------------------------
-- a) Todo consentimiento dado por un tutor en nombre de un menor (pruebas, matrículas, representación, políticas).
create or replace function public.guard_guardian_consent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.guardian_id is not null and new.granted and auth.uid() is not null and public.is_minor(new.user_id)
     and not public.guardian_decision_ok(new.guardian_id, new.user_id) then
    raise exception 'guardian_verification_required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_guardian_consent() from public, anon, authenticated;
drop trigger if exists guard_guardian_consent on public.consents;
create trigger guard_guardian_consent before insert on public.consents
  for each row execute function public.guard_guardian_consent();

-- b) Aprobar que una organización contacte a un menor (rechazar o bloquear sigue siempre permitido).
create or replace function public.guard_guardian_contact_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.status = 'pending_guardian' and new.status = 'pending'
     and not public.guardian_decision_ok(auth.uid(), new.athlete_id) then
    raise exception 'guardian_verification_required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_guardian_contact_approval() from public, anon, authenticated;
drop trigger if exists guard_guardian_contact_approval on public.contact_requests;
create trigger guard_guardian_contact_approval before update on public.contact_requests
  for each row execute function public.guard_guardian_contact_approval();

-- 5. Flujo ----------------------------------------------------------------------------------------------------------
-- El tutor firma la declaración (solo para vínculos aprobados con un menor).
create or replace function public.guardian_attest(p_link uuid, p_version text)
returns text language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into l from public.parent_athlete_links where id = p_link and parent_id = auth.uid() and status = 'approved';
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.is_minor(l.athlete_id) then raise exception 'not_required' using errcode = 'P0001'; end if;
  if l.relationship not in ('parent', 'mother', 'father', 'legal_guardian') then raise exception 'relationship_not_guardian' using errcode = 'P0001'; end if;
  if p_version is distinct from public.guardian_statement_version() then raise exception 'statement_outdated' using errcode = 'P0001'; end if;
  insert into public.guardian_attestations (link_id, parent_id, athlete_id, statement_version, relationship)
  values (l.id, l.parent_id, l.athlete_id, p_version, l.relationship);
  perform public.audit('guardian_attested', 'parent_athlete_links', l.id, null, jsonb_build_object('version', p_version), null, 'security', null);
  return public.guardian_verification_state(l.id);
end;
$$;
revoke all on function public.guardian_attest(uuid, text) from public, anon;
grant execute on function public.guardian_attest(uuid, text) to authenticated;

-- Estado para la interfaz (tutor, atleta o administración). Nunca devuelve edades.
create or replace function public.guardian_verification_state(p_link uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare l record;
begin
  select * into l from public.parent_athlete_links where id = p_link;
  if l.id is null or not (auth.uid() in (l.parent_id, l.athlete_id) or public.is_admin()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if l.athlete_id is null or not public.is_minor(l.athlete_id) then return 'not_required'; end if;
  if l.status::text <> 'approved' then return 'link_inactive'; end if;
  if l.relationship not in ('parent', 'mother', 'father', 'legal_guardian') then return 'not_guardian'; end if;
  if not exists (select 1 from public.guardian_attestations a where a.link_id = l.id and a.statement_version = public.guardian_statement_version()) then
    return 'needs_attestation';
  end if;
  if public.guardian_decision_ok(l.parent_id, l.athlete_id) then return 'verified'; end if;
  return 'pending_review';
end;
$$;
revoke all on function public.guardian_verification_state(uuid) from public, anon;
grant execute on function public.guardian_verification_state(uuid) to authenticated;

-- Cola de revisión para administración: vínculos con menor, declaración firmada y aún sin verificar.
create or replace function public.guardian_review_queue()
returns table (link_id uuid, parent_name text, athlete_name text, relationship text, attested_at timestamptz, auto_checks_ok boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select l.id, pp.display_name, pa.display_name, l.relationship, max(a.created_at), public.guardian_auto_checks(l.id)
      from public.parent_athlete_links l
      join public.guardian_attestations a on a.link_id = l.id and a.statement_version = public.guardian_statement_version()
      join public.profiles pp on pp.id = l.parent_id
      join public.profiles pa on pa.id = l.athlete_id
     where l.status = 'approved' and l.verification_status <> 'admin_verified' and public.is_minor(l.athlete_id)
     group by l.id, pp.display_name, pa.display_name, l.relationship
     order by max(a.created_at);
end;
$$;
revoke all on function public.guardian_review_queue() from public, anon;
grant execute on function public.guardian_review_queue() to authenticated;

-- Decisión de administración: aprobar (exige declaración) o rechazar (restringe el vínculo con motivo). Auditado.
create or replace function public.guardian_review(p_link uuid, p_approve boolean, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_reason), '')) < 10 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into l from public.parent_athlete_links where id = p_link and status::text in ('approved', 'restricted');
  if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform set_config('gala.family_rpc', 'on', true);
  if p_approve then
    if not exists (select 1 from public.guardian_attestations a where a.link_id = l.id and a.statement_version = public.guardian_statement_version()) then
      raise exception 'attestation_required' using errcode = 'P0001';
    end if;
    update public.parent_athlete_links set verification_status = 'admin_verified', verified_at = now(), verified_by = auth.uid() where id = l.id;
  else
    update public.parent_athlete_links set status = 'restricted', restricted_at = now(), restriction_reason = left(trim(p_reason), 300),
           verification_status = case when verification_status = 'admin_verified' then 'athlete_confirmed' else verification_status end
     where id = l.id;
  end if;
  perform public.audit(case when p_approve then 'guardian_verified' else 'guardian_rejected' end, 'parent_athlete_links', l.id, null,
                       '{}'::jsonb, trim(p_reason), 'security', null);
  return case when p_approve then 'verified' else 'restricted' end;
end;
$$;
revoke all on function public.guardian_review(uuid, boolean, text) from public, anon;
grant execute on function public.guardian_review(uuid, boolean, text) to authenticated;

-- La verificación administrativa antigua también exige la declaración (un solo camino coherente).
create or replace function public.family_link_admin_verify(p_link uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform public.guardian_review(p_link, true, 'Verificación administrativa del vínculo');
end $$;

-- 6. Evento de producto para medir el embudo de verificación (sin datos personales).
alter table public.product_events drop constraint if exists product_events_event_check;
alter table public.product_events add constraint product_events_event_check check (event in (
  'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
  'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
  'document_uploaded', 'roster_joined', 'universities_compared',
  'passport_completed', 'passport_shared', 'video_uploaded', 'university_viewed', 'university_saved',
  'match_viewed', 'opportunity_saved', 'comparison_created', 'task_completed', 'dashboard_viewed',
  'pipeline_stage_changed', 'interaction_logged', 'offer_recorded', 'pipeline_decision',
  'recruiting_need_created', 'athlete_discovered', 'athlete_shortlisted', 'candidate_assigned', 'candidate_stage_changed',
  'document_requested', 'document_shared', 'offer_created', 'coach_dashboard_viewed', 'candidates_exported',
  'trial_applied', 'trial_viewed', 'agent_trials_viewed',
  'athlete_search_performed', 'athlete_search_saved', 'athlete_promoted_to_pipeline', 'verification_requested',
  'athlete_quick_view', 'highlight_played', 'note_added',
  'trial_saved', 'trial_invitation_viewed', 'trial_invitation_sent', 'trial_registered', 'trial_checked_in',
  'academy_program_viewed', 'academy_program_applied', 'recruiting_process_started',
  'trial_mobile_viewed', 'trial_invitation_opened', 'trial_consent_reviewed', 'trial_consent_approved', 'mobile_discovery_search', 'scout_note_added',
  -- 12-16
  'representation_requested', 'representation_accepted', 'representation_revoked', 'agency_invited',
  'brand_offer_sent', 'brand_offer_accepted', 'deliverable_submitted', 'collaborations_viewed',
  'trust_center_viewed', 'support_case_opened', 'subscription_started', 'billing_viewed',
  'agent_home_viewed', 'agent_attention_opened',
  -- Ciclo 1 · importar cartera e invitar a reclamarla
  'athlete_invited', 'invite_opened', 'athlete_claimed',
  -- Ciclo 2 · escribir a coaches y saber quién responde
  'coach_outreach_sent', 'coach_reply_logged', 'guardian_attested'));
