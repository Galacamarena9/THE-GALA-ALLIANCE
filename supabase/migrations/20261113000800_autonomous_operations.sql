-- =============================================================================
-- Operación autónoma: la plataforma funciona sin intervención manual de la fundadora.
--   1. Verificación automática de organizaciones por dominio de email confirmado.
--   2. Publicación automática de oportunidades de organizaciones verificadas sin señales de alarma.
--   3. Ocultación preventiva por denuncias (la decisión final la toma una persona, como exige el DSA).
--   4. Baja de cuenta autoservicio (derecho de supresión sin esperar a nadie).
--   5. Derechos de plan (entitlements) concedidos automáticamente por el pago (webhook de Stripe).
-- Lo que no supera las reglas automáticas queda en la cola de revisión del admin.
-- =============================================================================

-- 1. Verificación automática -------------------------------------------------------------
create or replace function public.free_email_domain(p_domain text)
returns boolean language sql immutable set search_path = public as $$
  select lower(p_domain) = any (array['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es',
    'live.com', 'msn.com', 'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
    'gmx.com', 'gmx.es', 'mail.com', 'zoho.com', 'yandex.com', 'telefonica.net']);
$$;

create or replace function public.host_of(p_url text)
returns text language sql immutable set search_path = public as $$
  select nullif(lower(regexp_replace(regexp_replace(coalesce(p_url, ''), '^https?://(www\.)?', ''), '[/:?#].*$', '')), '');
$$;

-- Dominio del email confirmado coincide con la web oficial de la organización (o es un subdominio suyo).
-- Universidades: además el dominio debe ser .edu o coincidir con la web de su institución importada.
create or replace function public.org_domain_matches(p_org uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  o public.organizations;
  v_email text;
  v_confirmed timestamptz;
  v_domain text;
  v_site text;
  v_inst text;
begin
  select * into o from public.organizations where id = p_org;
  if not found then return false; end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = o.created_by;
  if v_email is null or v_confirmed is null then return false; end if;
  v_domain := split_part(v_email, '@', 2);
  v_site := public.host_of(o.website);
  if v_domain = '' or v_site is null or public.free_email_domain(v_domain) then return false; end if;
  if not (v_domain = v_site or v_domain like '%.' || v_site or v_site like '%.' || v_domain) then return false; end if;
  if o.type in ('university', 'college') then
    select public.host_of(i.website_url) into v_inst from public.institutions i where i.id = o.institution_id;
    return v_domain like '%.edu' or (v_inst is not null and (v_domain = v_inst or v_domain like '%.' || v_inst));
  end if;
  return true;
end;
$$;

create or replace function public.guard_org_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Paso automático controlado por auto_verify_organization() en esta misma transacción.
  if current_setting('gala.auto_verify', true) = 'on' then
    if new.verification_status = 'verified' and old.verification_status <> 'verified' then
      new.verified_at := now();
      new.verified_by := null;
    end if;
    return new;
  end if;
  if not public.is_admin() then
    if new.verification_status is distinct from old.verification_status
       and not (new.verification_status = 'submitted' and old.verification_status in ('unverified', 'rejected')) then
      raise exception 'verification_admin_only' using errcode = '42501';
    end if;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
    new.created_by := old.created_by;
    if old.verification_status = 'verified'
       and (new.name, new.type, new.website, new.country) is distinct from (old.name, old.type, old.website, old.country) then
      new.verification_status := 'submitted';
      new.verified_at := null;
      new.verified_by := null;
    end if;
  elsif new.verification_status = 'verified' and old.verification_status <> 'verified' then
    new.verified_at := now();
    new.verified_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.auto_verify_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status = 'submitted'
     and (tg_op = 'INSERT' or old.verification_status <> 'submitted')
     and public.org_domain_matches(new.id) then
    perform set_config('gala.auto_verify', 'on', true);
    update public.organizations set verification_status = 'verified' where id = new.id;
    perform set_config('gala.auto_verify', 'off', true);
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'organization.auto_verified', 'organizations', new.id, jsonb_build_object('rule', 'email_domain_matches_website'));
  end if;
  return null;
end;
$$;
create trigger zz_auto_verify_organization after insert or update of verification_status on public.organizations
  for each row execute function public.auto_verify_organization();

-- 2. Publicación automática ------------------------------------------------------------
create or replace function public.opportunity_red_flags(p_description text, p_deadline date, p_aid int, p_cost int, p_source text)
returns text[] language sql immutable set search_path = public as $$
  select array_remove(array[
    case when p_description ~* '(pago por adelantado|pago anticipado|adelanto|dep[oó]sito|transferencia|western union|bizum|bitcoin|cripto|upfront|deposit|wire transfer|processing fee|tasa de reserva|beca garantizada|guaranteed scholarship|plaza garantizada)'
         then 'payment_or_guarantee_language' end,
    case when p_deadline is not null and p_deadline < current_date + 3 then 'deadline_pressure' end,
    case when p_aid is not null and p_source is null then 'aid_without_source' end,
    case when p_aid is not null and p_cost is not null and p_aid = p_cost and p_source = 'organization_provided' then 'full_aid_unverified' end
  ], null);
$$;

create or replace function public.auto_publish_opportunity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending_review'
     and exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified')
     and coalesce(array_length(public.opportunity_red_flags(new.description, new.deadline, new.aid_amount_usd, new.annual_cost_usd, new.financial_source), 1), 0) = 0
     and not exists (select 1 from public.content_reports where entity_type = 'opportunity' and entity_id = new.id and status in ('open', 'reviewing')) then
    new.status := 'published';
    new.published_at := now();
    new.reviewed_by := null;
    new.review_note := 'Publicación automática: organización verificada y sin señales de alarma.';
  end if;
  return new;
end;
$$;
create trigger zz_auto_publish_opportunity before insert or update on public.opportunities
  for each row execute function public.auto_publish_opportunity();

-- 3. Ocultación preventiva por denuncias --------------------------------------------------
create or replace function public.auto_protect_on_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reporters int;
begin
  select count(distinct reporter_id) into v_reporters from public.content_reports
   where entity_type = new.entity_type and entity_id = new.entity_id and status in ('open', 'reviewing');
  if new.reason = 'child_safety' or v_reporters >= 3 then
    if new.entity_type = 'athlete_update' then
      update public.athlete_updates set expires_at = now() where id = new.entity_id;
    elsif new.entity_type = 'opportunity' then
      update public.opportunities set status = 'pending_review', published_at = null
       where id = new.entity_id and status = 'published';
    end if;
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (null, 'moderation.auto_protect', new.entity_type, new.entity_id,
            jsonb_build_object('reason', new.reason, 'reporters', v_reporters));
  end if;
  return null;
end;
$$;
create trigger auto_protect_on_report after insert on public.content_reports
  for each row execute function public.auto_protect_on_report();

-- 4. Baja de cuenta autoservicio ----------------------------------------------------------
-- Los registros inmutables solo ceden ante una supresión RGPD ejecutada por el sistema.
create or replace function public.forbid_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('gala.erasure', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'immutable_record' using errcode = '42501';
end;
$$;

create or replace function public.delete_my_account(p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if p_confirm is distinct from 'ELIMINAR' then raise exception 'confirmation_required' using errcode = 'P0001'; end if;
  if public.is_admin() then raise exception 'admin_cannot_self_delete' using errcode = 'P0001'; end if;
  if exists (select 1 from public.organizations where created_by = v_uid) then
    raise exception 'transfer_organizations_first' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.opportunities where created_by = v_uid)
     or exists (select 1 from public.application_notes where author_id = v_uid)
     or exists (select 1 from public.brand_campaigns where created_by = v_uid) then
    raise exception 'organization_staff_contact_support' using errcode = 'P0001';
  end if;
  perform set_config('gala.erasure', 'on', true);
  update public.application_status_history set changed_by = null where changed_by = v_uid;
  update public.contact_requests set guardian_approved_by = null where guardian_approved_by = v_uid;
  update public.consents set guardian_id = null where guardian_id = v_uid;
  update public.organization_invitations set accepted_by = null where accepted_by = v_uid;
  -- Registro mínimo de la baja (sin datos personales) para acreditar el cumplimiento.
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (null, 'account.self_deleted', 'profiles', null);
  delete from auth.users where id = v_uid;
  perform set_config('gala.erasure', 'off', true);
end;
$$;

-- 5. Derechos de plan ------------------------------------------------------------------------
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null check (plan_code ~ '^[a-z0-9_]{3,40}$'),
  source text not null check (source in ('stripe', 'admin')),
  reference text check (char_length(reference) <= 200),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (source, reference)
);
create index entitlements_user_idx on public.entitlements (user_id) where revoked_at is null;
alter table public.entitlements enable row level security;
create policy entitlements_select on public.entitlements for select to authenticated
  using (user_id = auth.uid() or public.has_family_link(user_id, 'view_profile') or public.is_admin());
create policy entitlements_admin on public.entitlements for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and source = 'admin');

create or replace function public.has_plan(p_user uuid, p_plan text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.entitlements where user_id = p_user and revoked_at is null
                 and (plan_code = p_plan
                      or (p_plan = 'family_core' and plan_code in ('family_elite', 'family_signature'))
                      or (p_plan = 'family_elite' and plan_code = 'family_signature')));
$$;

-- 5b. Ofertas recibidas fuera de la plataforma (email de un coach) para el comparador y el memo -----
create table public.athlete_offers (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  university_name text not null check (char_length(university_name) between 2 and 200),
  institution_id uuid references public.institutions (id) on delete set null,
  annual_cost_usd int check (annual_cost_usd between 0 and 200000),
  aid_amount_usd int check (aid_amount_usd between 0 and 200000),
  renewable text not null default 'unknown' check (renewable in ('yes', 'no', 'unknown')),
  in_writing boolean not null default false,
  deadline date,
  source_text text check (char_length(source_text) <= 5000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint offer_aid_not_above_cost check (aid_amount_usd is null or annual_cost_usd is null or aid_amount_usd <= annual_cost_usd)
);
create index athlete_offers_athlete_idx on public.athlete_offers (athlete_id);
alter table public.athlete_offers enable row level security;
create policy offers_select on public.athlete_offers for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy offers_write on public.athlete_offers for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

create or replace function public.limit_athlete_offers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.athlete_offers where athlete_id = new.athlete_id) >= 20 then
    raise exception 'offers_limit' using errcode = 'P0001';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;
create trigger limit_athlete_offers before insert on public.athlete_offers
  for each row execute function public.limit_athlete_offers();

-- 6. Privilegios -----------------------------------------------------------------------------
grant select, insert, update, delete on public.entitlements, public.athlete_offers to authenticated;
revoke execute on function public.free_email_domain, public.host_of, public.org_domain_matches, public.auto_verify_organization,
  public.opportunity_red_flags, public.auto_publish_opportunity, public.auto_protect_on_report, public.delete_my_account,
  public.has_plan, public.limit_athlete_offers from public;
do $$ begin
  revoke execute on function public.org_domain_matches(uuid), public.auto_verify_organization(),
    public.auto_publish_opportunity(), public.auto_protect_on_report(), public.limit_athlete_offers() from anon, authenticated;
  revoke execute on function public.delete_my_account(text) from anon;
exception when undefined_object then null; end $$;
grant execute on function public.delete_my_account, public.has_plan to authenticated;
grant execute on function public.opportunity_red_flags, public.host_of, public.free_email_domain to anon, authenticated;
