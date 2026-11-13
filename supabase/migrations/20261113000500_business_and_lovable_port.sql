-- =============================================================================
-- Negocio, operación y funciones recuperadas de la versión Lovable (feb–mar 2026)
--   1. Instituciones: SAT medio y tasa de admisión (College Scorecard).
--   2. Bloqueo efectivo: una organización bloqueada no vuelve a ver ni contactar al atleta.
--   3. Academia SAT/TOEFL: progreso y prácticas (sin rachas ni rankings: protección de menores).
--   4. Búsquedas guardadas / necesidades de recruiting (las coincidencias nuevas se calculan
--      con la RLS de quien busca, nunca con un trigger que filtre menores a terceros).
--   5. Novedades del atleta (sustituye a "quick updates", visibles solo donde lo es el perfil).
--   6. Notificaciones internas generadas por el sistema.
--   7. Solicitudes de planes y servicios (validación comercial "concierge" antes de cobrar).
--   8. Feedback del piloto.
--   9. Panel de mando del admin: North Star, embudo, colas y liquidez por posición.
-- =============================================================================

-- 1. Instituciones ---------------------------------------------------------------
alter table public.institutions
  add column sat_avg int check (sat_avg between 400 and 1600),
  add column admission_rate numeric(5, 4) check (admission_rate between 0 and 1);

create or replace function public.guard_institution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    if (new.athletics_url, new.admissions_url, new.international_url, new.virtual_tour_url)
       is distinct from (old.athletics_url, old.admissions_url, old.international_url, old.virtual_tour_url) then
      new.links_verified_at := now();
      new.links_verified_by := auth.uid();
    end if;
    return new;
  end if;
  -- Los datos oficiales importados solo los cambia una nueva importación (admin).
  if (new.ipeds_unitid, new.name, new.city, new.state, new.website_url, new.price_calculator_url,
      new.cost_attendance_usd, new.tuition_out_of_state_usd, new.data_source, new.source_fetched_at,
      new.sat_avg, new.admission_rate)
     is distinct from
     (old.ipeds_unitid, old.name, old.city, old.state, old.website_url, old.price_calculator_url,
      old.cost_attendance_usd, old.tuition_out_of_state_usd, old.data_source, old.source_fetched_at,
      old.sat_avg, old.admission_rate) then
    raise exception 'official_data_admin_only' using errcode = '42501';
  end if;
  if (new.athletics_url, new.admissions_url, new.international_url, new.virtual_tour_url)
     is distinct from (old.athletics_url, old.admissions_url, old.international_url, old.virtual_tour_url) then
    new.links_verified_at := null;
    new.links_verified_by := null;
  else
    new.links_verified_at := old.links_verified_at;
    new.links_verified_by := old.links_verified_by;
  end if;
  return new;
end;
$$;

-- 2. Bloqueo efectivo ----------------------------------------------------------------
-- Un atleta (o su familia, si es menor) que bloquea una solicitud bloquea a la organización
-- entera: deja de ver el perfil y no puede volver a pedir contacto.
create or replace function public.is_blocked_by_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contact_requests r
     where r.athlete_id = p_athlete and r.status = 'blocked'
       and public.is_org_member(r.organization_id)
  );
$$;

create or replace function public.can_view_athlete(p_athlete uuid, p_block text default 'profile')
returns boolean language plpgsql stable security definer set search_path = public as $$
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

  select case p_block
           when 'academics' then academics_visibility
           when 'stats' then stats_visibility
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
    return v_uid is not null and v_vis in ('public', 'members') and public.is_verified_recruiter();
  end if;

  return case v_vis
           when 'public' then true
           when 'members' then v_uid is not null
           else false
         end;
end;
$$;

create or replace function public.guard_contact_request()
returns trigger language plpgsql security definer set search_path = public as $$
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

  v_is_guardian := exists (select 1 from public.parent_athlete_links
                            where athlete_id = new.athlete_id and parent_id = v_uid and status = 'approved');
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
$$;

-- 3. Academia SAT / TOEFL --------------------------------------------------------------
create table public.academy_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam text not null check (exam in ('sat', 'toefl')),
  topic_id text not null check (topic_id ~ '^[a-z0-9-]{2,40}$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, exam, topic_id)
);

create table public.academy_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam text not null check (exam in ('sat', 'toefl')),
  correct int not null check (correct >= 0),
  total int not null check (total between 1 and 50),
  duration_seconds int check (duration_seconds between 0 and 36000),
  created_at timestamptz not null default now(),
  constraint attempts_correct_le_total check (correct <= total)
);
create index academy_attempts_user_idx on public.academy_attempts (user_id, created_at desc);

create or replace function public.guard_academy_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  if (select count(*) from public.academy_attempts where user_id = new.user_id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_academy_attempt before insert on public.academy_attempts
  for each row execute function public.guard_academy_attempt();

alter table public.academy_progress enable row level security;
alter table public.academy_attempts enable row level security;
-- La familia vinculada puede seguir el estudio; nadie más (ni organizaciones ni marcas).
create policy academy_progress_select on public.academy_progress for select to authenticated
  using (user_id = auth.uid() or public.has_family_link(user_id, 'view_profile'));
create policy academy_progress_insert on public.academy_progress for insert to authenticated
  with check (user_id = auth.uid());
create policy academy_progress_delete on public.academy_progress for delete to authenticated
  using (user_id = auth.uid());
create policy academy_attempts_select on public.academy_attempts for select to authenticated
  using (user_id = auth.uid() or public.has_family_link(user_id, 'view_profile'));
create policy academy_attempts_insert on public.academy_attempts for insert to authenticated
  with check (user_id = auth.uid());

-- 4. Búsquedas guardadas / necesidades de recruiting -------------------------------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  filters jsonb not null default '{}'
    check (jsonb_typeof(filters) = 'object'
           and (filters - array['sport', 'position', 'grad', 'division', 'gpa', 'video', 'q']) = '{}'::jsonb),
  alerts_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, label)
);

create or replace function public.guard_saved_search()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    if not (public.has_role('university') or public.has_role('coach') or public.has_role('agent')
            or public.has_role('brand') or public.is_admin()) then
      raise exception 'recruiter_role_required' using errcode = '42501';
    end if;
    if (select count(*) from public.saved_searches where owner_id = new.owner_id) >= 25 then
      raise exception 'saved_search_limit' using errcode = 'P0001';
    end if;
  elsif new.owner_id is distinct from old.owner_id then
    raise exception 'owner_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_saved_search before insert or update on public.saved_searches
  for each row execute function public.guard_saved_search();

alter table public.saved_searches enable row level security;
create policy saved_searches_owner on public.saved_searches for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 5. Novedades del atleta -----------------------------------------------------------
create table public.athlete_updates (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('result', 'stat', 'video', 'academic', 'availability', 'other')),
  body text not null check (char_length(body) between 3 and 280),
  link_url text check (link_url is null or (link_url ~ '^https://' and char_length(link_url) <= 500)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index athlete_updates_feed_idx on public.athlete_updates (athlete_id, created_at desc);

create or replace function public.guard_athlete_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.athlete_id := auth.uid();
  new.created_at := now();
  new.expires_at := now() + interval '30 days';
  if public.is_minor(new.athlete_id) and (
       concat_ws(' ', new.body, new.link_url) ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
       or new.body ~ '\+?\d[\d\s().-]{7,}\d'
       or concat_ws(' ', new.body, new.link_url) ~* '(whatsapp|telegram|instagram|snapchat|tiktok|wa\.me)'
     ) then
    raise exception 'contact_data_not_allowed_with_minors' using errcode = 'P0001';
  end if;
  if (select count(*) from public.athlete_updates where athlete_id = new.athlete_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_athlete_update before insert on public.athlete_updates
  for each row execute function public.guard_athlete_update();

alter table public.athlete_updates enable row level security;
create policy athlete_updates_select on public.athlete_updates for select to anon, authenticated
  using (expires_at > now() and public.can_view_athlete(athlete_id, 'profile'));
create policy athlete_updates_insert on public.athlete_updates for insert to authenticated
  with check (athlete_id = auth.uid());
create policy athlete_updates_delete on public.athlete_updates for delete to authenticated
  using (athlete_id = auth.uid() or public.is_admin());

alter table public.content_reports drop constraint content_reports_entity_type_check;
alter table public.content_reports add constraint content_reports_entity_type_check
  check (entity_type in ('athlete_profile', 'opportunity', 'campaign', 'organization', 'contact_request',
                         'news_post', 'institution', 'athlete_update'));

-- 6. Notificaciones internas --------------------------------------------------------
-- Solo las crea el sistema (triggers). Sin envío masivo ni recordatorios agresivos.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  title text not null check (char_length(title) <= 160),
  body text check (char_length(body) <= 500),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.%-]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications (user_id, read_at, created_at desc);

create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if (new.user_id, new.kind, new.title, new.body, new.link, new.created_at)
     is distinct from (old.user_id, old.kind, old.title, old.body, old.link, old.created_at) then
    raise exception 'notification_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_notification_update before update on public.notifications
  for each row execute function public.guard_notification_update();

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
$$;

create or replace function public.notify_contact_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org text;
  r record;
begin
  select name into v_org from public.organizations where id = new.organization_id;
  if tg_op = 'INSERT' then
    if new.status = 'pending_guardian' then
      for r in select parent_id from public.parent_athlete_links where athlete_id = new.athlete_id and status = 'approved' loop
        perform public.notify(r.parent_id, 'contact.guardian_review', v_org || ' quiere contactar con tu hijo/a',
          'Revisa la solicitud y decide si la apruebas.', '/app/inbox');
      end loop;
    else
      perform public.notify(new.athlete_id, 'contact.new', v_org || ' quiere contactar contigo',
        'Organización verificada. Puedes aceptar, rechazar o bloquear.', '/app/inbox');
    end if;
  elsif new.status is distinct from old.status then
    if old.status = 'pending_guardian' and new.status = 'pending' then
      perform public.notify(new.athlete_id, 'contact.new', v_org || ' quiere contactar contigo',
        'Tu familia ha aprobado la solicitud. Ahora decides tú.', '/app/inbox');
    elsif new.status = 'accepted' then
      perform public.notify(new.requested_by, 'contact.accepted', 'Solicitud aceptada',
        'La conversación ya está abierta en Mensajes.', '/app/inbox/' || new.id);
    elsif new.status in ('declined', 'blocked') then
      -- No se revela si fue un rechazo o un bloqueo.
      perform public.notify(new.requested_by, 'contact.closed', 'Solicitud no aceptada', null, '/app/inbox');
    end if;
  end if;
  return new;
end;
$$;
create trigger notify_contact_request after insert or update on public.contact_requests
  for each row execute function public.notify_contact_request();

create or replace function public.notify_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if new.status is distinct from old.status and new.status not in ('withdrawn') then
    select o.title into v_title from public.opportunities o where o.id = new.opportunity_id;
    perform public.notify(new.athlete_id, 'application.status', 'Novedades en tu candidatura',
      coalesce(v_title, 'Oportunidad') || ': ' || replace(new.status::text, '_', ' '), '/app/applications');
  end if;
  return new;
end;
$$;
create trigger notify_application_status after update on public.applications
  for each row execute function public.notify_application_status();

create or replace function public.notify_org_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status and new.verification_status in ('verified', 'rejected') then
    perform public.notify(new.created_by, 'organization.verification',
      case new.verification_status when 'verified' then 'Organización verificada' else 'Verificación no superada' end,
      new.name, '/app/organization');
  end if;
  return new;
end;
$$;
create trigger notify_org_verification after update on public.organizations
  for each row execute function public.notify_org_verification();

-- 7. Planes y servicios: solicitudes (validación antes de activar cobros) ---------
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null check (plan_code ~ '^[a-z0-9_]{3,40}$'),
  organization_id uuid references public.organizations (id) on delete set null,
  message text check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  admin_note text check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_requests_pipeline_idx on public.service_requests (status, created_at desc);
create trigger t_service_requests_updated before update on public.service_requests
  for each row execute function public.set_updated_at();

create or replace function public.guard_service_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'new';
    new.admin_note := null;
    if new.organization_id is not null and not public.is_org_member(new.organization_id) then
      raise exception 'not_org_member' using errcode = '42501';
    end if;
    if (select count(*) from public.service_requests where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if (new.user_id, new.plan_code, new.organization_id, new.message, new.created_at)
     is distinct from (old.user_id, old.plan_code, old.organization_id, old.message, old.created_at) then
    raise exception 'service_request_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_service_request before insert or update on public.service_requests
  for each row execute function public.guard_service_request();

alter table public.service_requests enable row level security;
create policy service_requests_select on public.service_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy service_requests_insert on public.service_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy service_requests_admin on public.service_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 8. Feedback del piloto --------------------------------------------------------------
create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  page text check (char_length(page) <= 200),
  rating int check (rating between 1 and 5),
  message text not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);
alter table public.user_feedback enable row level security;
create policy feedback_insert on public.user_feedback for insert to authenticated with check (user_id = auth.uid());
create policy feedback_select on public.user_feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- 9. Panel de mando (solo admin) --------------------------------------------------------
-- Conexión cualificada (North Star) = atleta + organización verificada + señal real de intención:
-- solicitud de contacto aceptada o candidatura que avanza a contacto, entrevista, prueba, shortlist u oferta.
create or replace function public.admin_metrics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v jsonb;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'north_star', (
      (select count(*) from public.contact_requests where status = 'accepted' and responded_at >= v_since)
      + (select count(distinct application_id) from public.application_status_history
          where created_at >= v_since
            and new_status in ('contacted', 'information_requested', 'interview', 'tryout', 'shortlist', 'offer'))
    ),
    'users_by_role', coalesce((select jsonb_object_agg(role, n) from (select role::text, count(*) n from public.user_roles group by role) s), '{}'::jsonb),
    'new_users', (select count(*) from public.profiles where created_at >= v_since),
    'funnel', jsonb_build_object(
      'athletes', (select count(*) from public.user_roles where role = 'athlete'),
      'passport', (select count(*) from public.athlete_profiles where sport_id is not null and graduation_year is not null),
      'academics', (select count(*) from public.athlete_academics where gpa is not null),
      'video', (select count(*) from public.athlete_profiles where highlight_video_url is not null),
      'applied', (select count(distinct athlete_id) from public.applications),
      'contacted', (select count(distinct athlete_id) from public.contact_requests where status in ('pending', 'accepted')),
      'offer', (select count(distinct athlete_id) from public.applications where status in ('offer', 'accepted')),
      'placed', (select count(distinct athlete_id) from public.applications where status = 'accepted')
    ),
    'organizations', coalesce((select jsonb_object_agg(k, n) from (
        select type::text || ':' || verification_status::text k, count(*) n from public.organizations group by 1) s), '{}'::jsonb),
    'opportunities', coalesce((select jsonb_object_agg(status::text, n) from (
        select status, count(*) n from public.opportunities group by status) s), '{}'::jsonb),
    'queues', jsonb_build_object(
      'orgs_to_verify', (select count(*) from public.organizations where verification_status = 'submitted'),
      'opportunities_to_review', (select count(*) from public.opportunities where status = 'pending_review'),
      'reports_open', (select count(*) from public.content_reports where status in ('open', 'reviewing')),
      'reports_child_safety', (select count(*) from public.content_reports where status in ('open', 'reviewing') and priority = 0),
      'dsr_open', (select count(*) from public.data_subject_requests where status in ('received', 'in_progress')),
      'service_requests_new', (select count(*) from public.service_requests where status = 'new')
    ),
    'minors_share', (select round(100.0 * count(*) filter (where public.is_minor(user_id)) / nullif(count(*), 0), 1)
                       from public.athlete_profiles)
  ) into v;
  return v;
end;
$$;

-- Liquidez del marketplace por deporte y posición: oferta (atletas abiertos) frente a demanda
-- (oportunidades publicadas + búsquedas guardadas activas). Agregado, sin datos personales.
create or replace function public.admin_liquidity()
returns table (sport_id text, position_id int, position_name text, supply bigint, demand bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return query
  with supply as (
    select ap.sport_id, ap.primary_position_id as position_id, count(*) n
      from public.athlete_profiles ap
     where ap.open_to_opportunities and ap.sport_id is not null and ap.primary_position_id is not null
     group by 1, 2
  ), opp as (
    select o.sport_id, unnest(o.position_ids) as position_id, count(*) n
      from public.opportunities o where o.status = 'published' group by 1, 2
  ), searches as (
    select (s.filters ->> 'sport') as sport_id, (s.filters ->> 'position')::int as position_id, count(*) n
      from public.saved_searches s
     where s.alerts_enabled and s.filters ? 'sport' and (s.filters ->> 'position') ~ '^\d+$'
     group by 1, 2
  )
  select p.sport_id, p.id, p.name_es,
         coalesce(su.n, 0), coalesce(op.n, 0) + coalesce(se.n, 0)
    from public.sport_positions p
    left join supply su on su.sport_id = p.sport_id and su.position_id = p.id
    left join opp op on op.sport_id = p.sport_id and op.position_id = p.id
    left join searches se on se.sport_id = p.sport_id and se.position_id = p.id
   where coalesce(su.n, 0) + coalesce(op.n, 0) + coalesce(se.n, 0) > 0
   order by (coalesce(op.n, 0) + coalesce(se.n, 0))::numeric / greatest(coalesce(su.n, 0), 1) desc;
end;
$$;

-- 10. Privilegios -------------------------------------------------------------------
grant select on public.athlete_updates to anon;
grant select, insert, delete on public.academy_progress, public.athlete_updates to authenticated;
grant select, insert on public.academy_attempts, public.user_feedback to authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update on public.service_requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.is_blocked_by_athlete, public.guard_academy_attempt, public.guard_saved_search,
  public.guard_athlete_update, public.guard_notification_update, public.notify, public.notify_contact_request,
  public.notify_application_status, public.notify_org_verification, public.guard_service_request,
  public.admin_metrics, public.admin_liquidity from public;
grant execute on function public.is_blocked_by_athlete to anon, authenticated;
grant execute on function public.admin_metrics, public.admin_liquidity to authenticated;
