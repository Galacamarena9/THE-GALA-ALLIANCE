-- Prompt 12 · Agents & Agencies — cimientos.
-- REUSE → EXTEND → SPECIALIZE: la agencia ya es una organización (organization_type = agency), el agente ya es
-- un miembro (organization_members + agency_role) y la verificación ya es la central (verification_requests).
-- Aquí se añade lo que la representación profesional necesita y no existía:
--   1. Credenciales profesionales (licencias de federación, registros de liga…) con caducidad y verificación real.
--   2. Roles de agencia que faltaban (athlete_manager, operations) sin romper los existentes.
--   3. Verificación de credencial por la cola central (nuevo tipo 'credential').
-- La relación Athlete ↔ Agency (representación) se modela en 12A.

-- 1. Roles de agencia ---------------------------------------------------------------------------------------
alter table public.organization_members drop constraint if exists organization_members_agency_role_check;
alter table public.organization_members add constraint organization_members_agency_role_check
  check (agency_role in ('owner', 'admin', 'manager', 'recruiter', 'scout', 'compliance', 'viewer', 'athlete_manager', 'operations'));
comment on column public.organization_members.agency_role is
  'owner=Agency Owner · admin=Agency Admin · manager=Senior Agent · recruiter=Agent · athlete_manager=Athlete Manager · operations/compliance=Operations · scout · viewer=Analyst/Viewer';

-- 2. Credenciales profesionales ------------------------------------------------------------------------------
create table if not exists public.professional_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  issuing_body text not null check (char_length(btrim(issuing_body)) between 2 and 160),
  credential_type text not null check (credential_type in ('federation_license', 'league_registration', 'jurisdiction_registration', 'professional_certification', 'other')),
  credential_number text check (char_length(credential_number) <= 80),
  country text check (country ~ '^[A-Z]{2}$'),
  sport_id text references public.sports (id),
  issued_on date,
  expires_on date,
  status text not null default 'declared' check (status in ('declared', 'under_review', 'verified', 'rejected', 'expired', 'revoked')),
  verification_request_id uuid references public.verification_requests (id) on delete set null,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credential_dates check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create index if not exists professional_credentials_user_idx on public.professional_credentials (user_id);
create index if not exists fkx_professional_credentials_organization_id on public.professional_credentials (organization_id);
create index if not exists fkx_professional_credentials_sport_id on public.professional_credentials (sport_id);
create index if not exists fkx_professional_credentials_verification_request_id on public.professional_credentials (verification_request_id);
alter table public.professional_credentials enable row level security;

-- El estado de verificación NUNCA lo pone el cliente: solo la revisión central o la caducidad.
create or replace function public.guard_professional_credential()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if current_user not in ('authenticated', 'anon') or public.is_admin() or current_setting('gala.credential_rpc', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'declared'; new.verified_at := null; new.last_checked_at := null; new.verification_request_id := null;
    new.user_id := auth.uid();
    if new.organization_id is not null and not exists (select 1 from public.organization_members where organization_id = new.organization_id and user_id = auth.uid()) then
      raise exception 'not_a_member' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.user_id, new.status, new.verified_at, new.verification_request_id, new.created_at)
     is distinct from (old.user_id, old.status, old.verified_at, old.verification_request_id, old.created_at) then
    raise exception 'credential_status_server_only' using errcode = '42501';
  end if;
  -- Cambiar el contenido de una credencial verificada la devuelve a «declarada».
  if old.status = 'verified' and (new.issuing_body, new.credential_type, new.credential_number, new.country, new.expires_on)
     is distinct from (old.issuing_body, old.credential_type, old.credential_number, old.country, old.expires_on) then
    new.status := 'declared'; new.verified_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_professional_credential() from public, anon, authenticated;
drop trigger if exists guard_professional_credential on public.professional_credentials;
create trigger guard_professional_credential before insert or update on public.professional_credentials
  for each row execute function public.guard_professional_credential();

-- Quién ve una credencial completa: su titular, administradores de su agencia y Gala.
create policy credentials_select on public.professional_credentials for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin()
         or (organization_id is not null and public.is_org_member(organization_id, true)));
create policy credentials_insert on public.professional_credentials for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_role('agent'));
create policy credentials_update on public.professional_credentials for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy credentials_delete on public.professional_credentials for delete to authenticated
  using (user_id = (select auth.uid()) and status <> 'verified');
grant select, insert, update, delete on public.professional_credentials to authenticated;

-- Lo público: solo credenciales VERIFICADAS y vigentes, sin número. «Licensed Agent» solo con esto.
create or replace function public.verified_credentials(p_user uuid)
returns table (issuing_body text, credential_type text, country text, sport_id text, expires_on date)
language sql stable security definer set search_path = public as $$
  select c.issuing_body, c.credential_type, c.country, c.sport_id, c.expires_on
    from public.professional_credentials c
   where c.user_id = p_user and c.status = 'verified' and (c.expires_on is null or c.expires_on >= current_date);
$$;
revoke execute on function public.verified_credentials(uuid) from public;
grant execute on function public.verified_credentials(uuid) to anon, authenticated;

-- Pedir la verificación de una credencial: crea la solicitud en la cola central.
create or replace function public.credential_submit(p_credential uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.professional_credentials; v_req uuid;
begin
  select * into c from public.professional_credentials where id = p_credential for update;
  if c.id is null or c.user_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.status in ('verified', 'under_review') then return c.verification_request_id; end if;
  insert into public.verification_requests (subject_user, organization_id, verification_type, declared_role, status, submitted_at)
  values (auth.uid(), c.organization_id, 'credential', left(c.issuing_body || ' · ' || c.credential_type, 80), 'submitted', now())
  returning id into v_req;
  perform set_config('gala.credential_rpc', 'on', true);
  update public.professional_credentials set status = 'under_review', verification_request_id = v_req where id = c.id;
  perform set_config('gala.credential_rpc', '', true);
  perform public.audit('verification_requested', 'verification_request', v_req, c.organization_id, jsonb_build_object('type', 'credential'), null, 'security', null);
  return v_req;
end;
$$;
revoke execute on function public.credential_submit(uuid) from public, anon;
grant execute on function public.credential_submit(uuid) to authenticated;

alter table public.verification_requests drop constraint if exists verification_requests_verification_type_check;
alter table public.verification_requests add constraint verification_requests_verification_type_check
  check (verification_type in ('identity', 'institutional_email', 'organization_claim', 'organization_affiliation', 'program_affiliation', 'role', 'domain', 'credential'));

-- La decisión central también resuelve credenciales (sin tocar el resto de efectos de verification_decide).
create or replace function public.sync_credential_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_type <> 'credential' or new.status is not distinct from old.status then return new; end if;
  perform set_config('gala.credential_rpc', 'on', true);
  update public.professional_credentials
     set status = case new.status when 'approved' then 'verified' when 'partially_approved' then 'verified'
                                  when 'rejected' then 'rejected' when 'revoked' then 'revoked' when 'suspended' then 'revoked' else status end,
         verified_at = case when new.status in ('approved', 'partially_approved') then now() else verified_at end,
         last_checked_at = now()
   where verification_request_id = new.id;
  perform set_config('gala.credential_rpc', '', true);
  return new;
end;
$$;
revoke execute on function public.sync_credential_decision() from public, anon, authenticated;
drop trigger if exists sync_credential_decision on public.verification_requests;
create trigger sync_credential_decision after update on public.verification_requests
  for each row execute function public.sync_credential_decision();

-- Caducidad: una credencial vencida deja de contar como verificada (idempotente; la usa el job diario).
create or replace function public.expire_professional_credentials()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform set_config('gala.credential_rpc', 'on', true);
  update public.professional_credentials set status = 'expired', last_checked_at = now()
   where status in ('verified', 'declared', 'under_review') and expires_on is not null and expires_on < current_date;
  get diagnostics n = row_count;
  perform set_config('gala.credential_rpc', '', true);
  return n;
end;
$$;
revoke execute on function public.expire_professional_credentials() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-professional-credentials', '15 3 * * *', 'select public.expire_professional_credentials()');
  end if;
exception when others then null;
end $$;

/* ROLLBACK:
drop trigger if exists sync_credential_decision on public.verification_requests; drop function if exists public.sync_credential_decision();
drop function if exists public.credential_submit(uuid); drop function if exists public.verified_credentials(uuid);
drop function if exists public.expire_professional_credentials(); drop table if exists public.professional_credentials;
-- y restaurar los checks de verification_type y agency_role anteriores.
*/
