-- =============================================================================
-- Piezas del dossier: centro de documentos, portal de academias/clubes,
-- eventos del embudo y conservación/borrado automático.
-- =============================================================================

-- 1. Centro de documentos familiar --------------------------------------------------
-- Cada fila es un punto de la checklist. El archivo (si existe) vive en un bucket PRIVADO
-- y solo se descarga con URL firmada de corta duración. Ni organizaciones ni admins acceden.
create table public.athlete_documents (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('passport', 'transcript', 'translation', 'graduation_proof', 'english_test',
                                     'sat_act', 'highlight_video', 'i20', 'sevis_receipt', 'ds160', 'financial', 'medical', 'other')),
  title text not null check (char_length(title) between 2 and 120),
  due_date date,
  storage_path text unique check (storage_path is null or storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,180}$'),
  mime_type text check (mime_type is null or mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes int check (size_bytes is null or size_bytes between 1 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint file_fields_together check ((storage_path is null) = (uploaded_at is null)),
  constraint path_belongs_to_athlete check (storage_path is null or split_part(storage_path, '/', 1) = athlete_id::text)
);
create index athlete_documents_athlete_idx on public.athlete_documents (athlete_id, due_date);
alter table public.athlete_documents enable row level security;

create policy docs_select on public.athlete_documents for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy docs_insert on public.athlete_documents for insert to authenticated
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
create policy docs_update on public.athlete_documents for update to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));
create policy docs_delete on public.athlete_documents for delete to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

-- Dueño del documento a partir de la ruta "athlete_uuid/archivo" (nulo si la ruta no es válida).
create or replace function public.document_owner(p_path text)
returns uuid language sql immutable set search_path = public as $$
  select case when split_part(p_path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_path, '/', 1)::uuid end;
$$;

-- Bucket privado y políticas de Storage (solo existe en Supabase; en pruebas locales se omite).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('athlete-documents', 'athlete-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$create policy docs_storage_select on storage.objects for select to authenticated
      using (bucket_id = 'athlete-documents' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'view_profile')))$p$;
    execute $p$create policy docs_storage_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'athlete-documents' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'edit_profile')))$p$;
    execute $p$create policy docs_storage_delete on storage.objects for delete to authenticated
      using (bucket_id = 'athlete-documents' and (public.document_owner(name) = auth.uid()
             or public.has_family_link(public.document_owner(name), 'edit_profile')))$p$;
  end if;
end $$;

-- 2. Portal de academias y clubes ------------------------------------------------------
create table public.club_roster_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  season text not null check (season ~ '^[0-9]{4}-[0-9]{2,4}$'),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  max_uses int not null default 200 check (max_uses between 1 and 500),
  uses int not null default 0,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

create table public.club_roster (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  season text not null check (season ~ '^[0-9]{4}-[0-9]{2,4}$'),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  shares_progress boolean not null default true,
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (organization_id, athlete_id, season)
);

alter table public.athlete_statistics add column verified_by_org uuid references public.organizations (id) on delete set null;

alter table public.club_roster_invites enable row level security;
alter table public.club_roster enable row level security;

create or replace function public.is_club_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org, true) and exists (
    select 1 from public.organizations where id = p_org and type in ('club', 'academy') and verification_status = 'verified');
$$;

create policy roster_inv_select on public.club_roster_invites for select to authenticated
  using (public.is_org_member(organization_id) or public.is_admin());
create policy roster_inv_insert on public.club_roster_invites for insert to authenticated
  with check (created_by = auth.uid() and public.is_club_admin(organization_id) and uses = 0 and status = 'active');
create policy roster_inv_revoke on public.club_roster_invites for update to authenticated
  using (public.is_club_admin(organization_id)) with check (public.is_club_admin(organization_id) and status = 'revoked');

create policy roster_select on public.club_roster for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile')
         or public.is_org_member(organization_id) or public.is_admin());

create or replace function public.guard_club_roster()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.organization_id, new.athlete_id, new.season, new.joined_at) is distinct from (old.organization_id, old.athlete_id, old.season, old.joined_at) then
    raise exception 'roster_immutable' using errcode = '42501';
  end if;
  if auth.uid() = new.athlete_id then
    if new.status not in ('active', 'left') or (old.status <> 'active' and new.status = 'active') then
      raise exception 'roster_transition_not_allowed' using errcode = '42501';
    end if;
  elsif public.is_club_admin(new.organization_id) then
    if new.status <> 'removed' or new.shares_progress is distinct from old.shares_progress then
      raise exception 'roster_transition_not_allowed' using errcode = '42501';
    end if;
  else
    raise exception 'roster_transition_not_allowed' using errcode = '42501';
  end if;
  if new.status <> 'active' and old.status = 'active' then new.ended_at := now(); end if;
  return new;
end;
$$;
create trigger guard_club_roster before update on public.club_roster
  for each row execute function public.guard_club_roster();
create policy roster_update on public.club_roster for update to authenticated
  using (athlete_id = auth.uid() or public.is_club_admin(organization_id))
  with check (athlete_id = auth.uid() or public.is_club_admin(organization_id));

create or replace function public.preview_roster_invitation(p_token text)
returns table (organization_name text, organization_type public.org_type, season text, valid boolean)
language sql stable security definer set search_path = public as $$
  select o.name, o.type, i.season,
         i.status = 'active' and i.expires_at > now() and i.uses < i.max_uses and o.verification_status = 'verified'
    from public.club_roster_invites i join public.organizations o on o.id = i.organization_id
   where i.token = p_token;
$$;

create or replace function public.accept_roster_invitation(p_token text, p_shares_progress boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv public.club_roster_invites;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select * into v_inv from public.club_roster_invites where token = p_token for update;
  if not found or v_inv.status <> 'active' or v_inv.expires_at < now() or v_inv.uses >= v_inv.max_uses
     or not public.is_club_admin_org_verified(v_inv.organization_id) then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.athlete_profiles where user_id = v_uid) then
    raise exception 'athlete_profile_required' using errcode = 'P0001';
  end if;
  insert into public.club_roster (organization_id, athlete_id, season, shares_progress)
  values (v_inv.organization_id, v_uid, v_inv.season, coalesce(p_shares_progress, true))
  on conflict (organization_id, athlete_id, season) do update set status = 'active', ended_at = null,
    shares_progress = excluded.shares_progress;
  update public.club_roster_invites set uses = uses + 1 where id = v_inv.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (v_uid, 'club_roster.joined', 'organizations', v_inv.organization_id);
  return v_inv.organization_id;
end;
$$;

create or replace function public.is_club_admin_org_verified(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations where id = p_org and type in ('club', 'academy') and verification_status = 'verified');
$$;

-- El club valida una estadística de un atleta activo en su roster ("confirmado por el club").
create or replace function public.club_verify_statistic(p_stat uuid, p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_athlete uuid;
begin
  if not public.is_club_admin(p_org) then raise exception 'club_admin_required' using errcode = '42501'; end if;
  select athlete_id into v_athlete from public.athlete_statistics where id = p_stat;
  if v_athlete is null or not exists (select 1 from public.club_roster where organization_id = p_org
                                       and athlete_id = v_athlete and status = 'active') then
    raise exception 'not_in_roster' using errcode = 'P0001';
  end if;
  update public.athlete_statistics set source = 'club_verified', verified_by_org = p_org where id = p_stat;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'statistic.club_verified', 'athlete_statistics', p_stat, jsonb_build_object('organization', p_org));
end;
$$;

-- Resumen para el club: progreso de recruiting solo de quien lo comparte.
create or replace function public.club_roster_summary(p_org uuid)
returns table (athlete_id uuid, display_name text, season text, graduation_year int, sport_id text,
               shares_progress boolean, applications bigint, best_status text, placed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_org_member(p_org) or public.is_admin()) then raise exception 'org_member_required' using errcode = '42501'; end if;
  return query
  select r.athlete_id, p.display_name, r.season, ap.graduation_year, ap.sport_id, r.shares_progress,
         case when r.shares_progress then (select count(*) from public.applications a where a.athlete_id = r.athlete_id) else null end,
         case when r.shares_progress then (
           select a.status::text from public.applications a where a.athlete_id = r.athlete_id
            order by array_position(array['accepted','offer','shortlist','tryout','interview','information_requested','contacted','reviewed','applied','declined','withdrawn']::text[], a.status::text)
            limit 1) else null end,
         case when r.shares_progress then exists (select 1 from public.applications a where a.athlete_id = r.athlete_id and a.status = 'accepted') else null end
    from public.club_roster r
    join public.profiles p on p.id = r.athlete_id
    join public.athlete_profiles ap on ap.user_id = r.athlete_id
   where r.organization_id = p_org and r.status = 'active'
   order by ap.graduation_year nulls last, p.display_name;
end;
$$;

-- El roster activo cuenta como conexión: el club ve el perfil de sus atletas.
create or replace function public.has_connection_with_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.organization_members m on m.organization_id = o.organization_id
     where a.athlete_id = p_athlete and m.user_id = auth.uid() and a.status <> 'withdrawn'
  ) or exists (
    select 1 from public.campaign_applications ca
      join public.brand_campaigns c on c.id = ca.campaign_id
      join public.organization_members m on m.organization_id = c.brand_org_id
     where ca.athlete_id = p_athlete and m.user_id = auth.uid() and ca.status <> 'withdrawn'
  ) or exists (
    select 1 from public.agent_representations r
      join public.organization_members m on m.organization_id = r.agency_id
     where r.athlete_id = p_athlete and m.user_id = auth.uid() and r.status = 'active'
  ) or exists (
    select 1 from public.club_roster cr
      join public.organization_members m on m.organization_id = cr.organization_id
     where cr.athlete_id = p_athlete and m.user_id = auth.uid() and cr.status = 'active'
  );
$$;

-- 3. Eventos del embudo (lista cerrada, sin datos de contenido) ------------------------
create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  event text not null check (event in (
    'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
    'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
    'document_uploaded', 'roster_joined', 'universities_compared')),
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 512),
  created_at timestamptz not null default now()
);
create index product_events_time_idx on public.product_events (event, created_at);
alter table public.product_events enable row level security;
create policy events_admin_read on public.product_events for select to authenticated using (public.is_admin());
-- Derecho de acceso (RGPD art. 15): cada persona puede leer y exportar sus propios eventos.
create policy events_own_read on public.product_events for select to authenticated using (user_id = auth.uid());

create or replace function public.log_event(p_event text, p_props jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.product_events where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.product_events (user_id, event, props) values (auth.uid(), p_event, coalesce(p_props, '{}'));
end;
$$;

create or replace function public.admin_event_counts(p_days int default 30)
returns table (event text, users bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return query
  select e.event, count(distinct e.user_id), count(*)
    from public.product_events e
   where e.created_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
   group by e.event order by 3 desc;
end;
$$;

-- 4. Conservación y borrado automático ---------------------------------------------------
-- Plazos operativos propuestos por el dossier; validar con la asesoría jurídica.
create or replace function public.run_retention()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb := '{}'::jsonb;
  n int;
begin
  -- La ejecuta pg_cron (sin usuario) o un admin desde el panel; nadie más.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  delete from public.product_events where created_at < now() - interval '13 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('product_events', n);
  delete from public.notifications where read_at is not null and read_at < now() - interval '6 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('notifications_read', n);
  delete from public.notifications where created_at < now() - interval '12 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('notifications_old', n);
  delete from public.athlete_updates where expires_at < now() - interval '30 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('athlete_updates', n);
  delete from public.ai_usage where day < current_date - 90;
  get diagnostics n = row_count; v := v || jsonb_build_object('ai_usage', n);
  delete from public.club_roster_invites where expires_at < now() - interval '90 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('roster_invites', n);
  delete from public.organization_invitations where status <> 'accepted' and expires_at < now() - interval '90 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('org_invitations', n);
  delete from public.parent_athlete_links where status = 'pending' and expires_at < now() - interval '90 days';
  get diagnostics n = row_count; v := v || jsonb_build_object('family_invitations', n);
  delete from public.user_feedback where created_at < now() - interval '24 months';
  get diagnostics n = row_count; v := v || jsonb_build_object('feedback', n);
  insert into public.audit_logs (actor_id, action, entity, details) values (auth.uid(), 'retention.run', 'system', v);
  return v;
end;
$$;

-- Programación diaria con pg_cron cuando está disponible (Supabase); en local se omite.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('gala-retention-daily', '17 3 * * *', 'select public.run_retention()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: ejecuta run_retention() desde el panel de admin';
end $$;

-- 5. Privilegios ---------------------------------------------------------------------------
grant select, insert, update, delete on public.athlete_documents, public.club_roster_invites to authenticated;
grant select, update on public.club_roster to authenticated;
grant select on public.product_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.document_owner, public.is_club_admin, public.is_club_admin_org_verified,
  public.guard_club_roster, public.preview_roster_invitation, public.accept_roster_invitation,
  public.club_verify_statistic, public.club_roster_summary, public.log_event, public.admin_event_counts,
  public.run_retention from public;
do $$ begin
  revoke execute on function public.guard_club_roster() from anon, authenticated;
  revoke execute on function public.accept_roster_invitation(text, boolean), public.club_verify_statistic(uuid, uuid),
    public.club_roster_summary(uuid), public.log_event(text, jsonb), public.admin_event_counts(int), public.run_retention() from anon;
exception when undefined_object then null; end $$;
grant execute on function public.document_owner, public.is_club_admin, public.is_club_admin_org_verified to anon, authenticated;
grant execute on function public.preview_roster_invitation to anon, authenticated;
grant execute on function public.accept_roster_invitation, public.club_verify_statistic, public.club_roster_summary,
  public.log_event, public.admin_event_counts, public.run_retention to authenticated;
