-- Importar la cartera de la agencia e invitar a cada atleta a reclamarla (agente «Marketplace USA», ciclo 1).
-- Problema: el primer día la agencia tiene la cartera vacía; sus atletas actuales no están en la plataforma.
-- Solución: la agencia importa nombres (CSV/Excel) y comparte un enlace personal con cada atleta. El atleta, con su
-- cuenta, reclama la invitación; eso abre una representation_invitation (el mismo camino que si el atleta invitara a
-- la agencia), así que la propuesta posterior sigue todas las reglas existentes: agencia verificada para proponer,
-- alcance visible, familia en el circuito si es menor y casilla de tarifas no ligadas a la beca.
-- Seguridad: solo se guarda el hash del enlace; cada agencia ve solo sus invitaciones; nada se escribe sin RPC.

create table if not exists public.agency_athlete_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  sport text check (sport is null or char_length(sport) <= 60),
  graduation_year int check (graduation_year is null or graduation_year between 2000 and 2100),
  token_hash text not null unique,
  status text not null default 'sent' check (status in ('sent', 'opened', 'claimed', 'revoked')),
  opened_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index if not exists agency_athlete_invites_agency on public.agency_athlete_invites (agency_id, created_at desc);
create index if not exists agency_athlete_invites_invited_by on public.agency_athlete_invites (invited_by);
create index if not exists agency_athlete_invites_claimed_by on public.agency_athlete_invites (claimed_by);
alter table public.agency_athlete_invites enable row level security;

-- Lectura: solo los miembros de la agencia. Escritura: solo mediante las funciones de abajo.
create policy agency_invites_select on public.agency_athlete_invites for select to authenticated
  using (public.is_org_member(agency_id) or public.is_admin());
revoke all on public.agency_athlete_invites from anon, authenticated;
grant select on public.agency_athlete_invites to authenticated;

-- Crear una invitación. Devuelve el token en claro UNA vez (solo se guarda su hash).
-- No exige agencia verificada: importar la propia cartera es trabajo interno; proponer sí lo exige (representation_request).
create or replace function public.agency_invite_create(p_agency uuid, p_name text, p_email text default null, p_sport text default null, p_year int default null)
returns table (id uuid, token text) language plpgsql security definer set search_path = public as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex'); v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if not (public.has_role('agent') and public.agency_can_write(p_agency)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_agency and o.type = 'agency' and o.org_status = 'active') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.agency_athlete_invites i where i.agency_id = p_agency and i.status in ('sent', 'opened') and i.expires_at > now()) >= 500 then
    raise exception 'too_many_open_invites' using errcode = 'P0001';
  end if;
  insert into public.agency_athlete_invites (agency_id, invited_by, full_name, email, sport, graduation_year, token_hash)
  values (p_agency, auth.uid(), trim(p_name), nullif(lower(trim(coalesce(p_email, ''))), ''), nullif(trim(coalesce(p_sport, '')), ''), p_year,
          encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning agency_athlete_invites.id into v_id;
  perform public.audit('agency_invite_created', 'agency_athlete_invite', v_id, p_agency, '{}'::jsonb, null, 'security', null);
  return query select v_id, v_token;
end;
$$;

-- Generar un enlace nuevo (el anterior deja de valer) y renovar el plazo.
create or replace function public.agency_invite_reissue(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex'); v_agency uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select agency_id into v_agency from public.agency_athlete_invites where id = p_id and status in ('sent', 'opened');
  if v_agency is null or not (public.has_role('agent') and public.agency_can_write(v_agency)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.agency_athlete_invites set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'), expires_at = now() + interval '30 days'
   where id = p_id;
  return v_token;
end;
$$;

create or replace function public.agency_invite_revoke(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_agency uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select agency_id into v_agency from public.agency_athlete_invites where id = p_id and status in ('sent', 'opened');
  if v_agency is null or not (public.has_role('agent') and public.agency_can_write(v_agency)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.agency_athlete_invites set status = 'revoked' where id = p_id;
  perform public.audit('agency_invite_revoked', 'agency_athlete_invite', p_id, v_agency, '{}'::jsonb, null, 'security', null);
end;
$$;

-- Vista previa para quien abre el enlace: solo el nombre de la agencia y si está verificada (nada del atleta).
-- La primera apertura con sesión marca la invitación como vista, para que la agencia sepa que ha llegado.
create or replace function public.agency_invite_preview(p_token text)
returns table (agency_name text, agency_verified boolean, valid boolean) language plpgsql security definer set search_path = public as $$
declare r public.agency_athlete_invites;
begin
  select * into r from public.agency_athlete_invites where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then return query select null::text, false, false; return; end if;
  if auth.uid() is not null and r.status = 'sent' and r.expires_at > now() then
    update public.agency_athlete_invites set status = 'opened', opened_at = now() where id = r.id;
  end if;
  return query select o.name, o.verification_status = 'verified', (r.status in ('sent', 'opened') and r.expires_at > now())
    from public.organizations o where o.id = r.agency_id;
end;
$$;

-- Reclamar: solo una cuenta de atleta. Abre la invitación de representación (30 días) y avisa a la agencia.
create or replace function public.agency_invite_claim(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.agency_athlete_invites; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'athlete') then raise exception 'athlete_role_required' using errcode = 'P0001'; end if;
  select * into r from public.agency_athlete_invites
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or r.status not in ('sent', 'opened') or r.expires_at < now() then raise exception 'invitation_invalid' using errcode = 'P0001'; end if;
  if r.invited_by = v_uid then raise exception 'cannot_accept_own_invitation' using errcode = 'P0001'; end if;
  if public.athlete_blocks_org(v_uid, r.agency_id) then raise exception 'blocked' using errcode = '42501'; end if;

  update public.agency_athlete_invites set status = 'claimed', claimed_at = now(), claimed_by = v_uid where id = r.id;
  if not exists (select 1 from public.representation_invitations i where i.agency_id = r.agency_id and i.athlete_id = v_uid and i.status = 'open' and i.expires_at > now()) then
    update public.representation_invitations set status = 'cancelled' where agency_id = r.agency_id and athlete_id = v_uid and status = 'open';
    insert into public.representation_invitations (agency_id, athlete_id, invited_by) values (r.agency_id, v_uid, v_uid);
  end if;
  perform public.notify(r.invited_by, 'representation.invited', 'Un atleta ha aceptado tu invitación',
          r.full_name || ' ya está en The Gala Alliance. Envíale tu propuesta de acompañamiento desde su perfil.', '/app/portfolio');
  perform public.audit('agency_invite_claimed', 'agency_athlete_invite', r.id, r.agency_id, '{}'::jsonb, null, 'security', null);
  return r.id;
end;
$$;

revoke all on function public.agency_invite_create(uuid, text, text, text, int), public.agency_invite_reissue(uuid), public.agency_invite_revoke(uuid),
  public.agency_invite_claim(text), public.agency_invite_preview(text) from public, anon;
grant execute on function public.agency_invite_create(uuid, text, text, text, int), public.agency_invite_reissue(uuid), public.agency_invite_revoke(uuid),
  public.agency_invite_claim(text), public.agency_invite_preview(text) to authenticated;
grant execute on function public.agency_invite_preview(text) to anon;

-- Eventos del embudo del ciclo 1 (sin datos personales en props): athlete_invited {count, source}, invite_opened, athlete_claimed {source}.
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
  'athlete_invited', 'invite_opened', 'athlete_claimed'));

-- Coherencia con la web de precios v3: «Agencia grande desde 449 €/mes» (se contrata por solicitud).
update public.plan_catalog set price_cents = 44900 where code = 'agent_scale' and price_cents = 24900;
