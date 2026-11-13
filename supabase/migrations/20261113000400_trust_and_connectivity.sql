-- =============================================================================
-- Datos reales y enlazados, confianza, conectividad y comunicación
--   1. Instituciones con datos oficiales (College Scorecard, U.S. Dept. of Education)
--      y enlaces oficiales: web, deportes, admisiones, oficina internacional, campus virtual.
--   2. Enlaces verificables del atleta (club, federación, ranking, vídeo).
--   3. Denuncias y moderación (DSA: notice-and-action con decisión motivada).
--   4. Contacto seguro organización → atleta, con la familia en el circuito si es menor.
--   5. Actualidad: comunicados de organizaciones verificadas y fichajes con consentimiento.
-- =============================================================================

-- 1. Instituciones ------------------------------------------------------------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  ipeds_unitid int unique check (ipeds_unitid > 0),
  name text not null check (char_length(name) between 2 and 200),
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  website_url text check (website_url is null or website_url ~ '^https://'),
  price_calculator_url text check (price_calculator_url is null or price_calculator_url ~ '^https://'),
  cost_attendance_usd int check (cost_attendance_usd between 0 and 200000),
  tuition_out_of_state_usd int check (tuition_out_of_state_usd between 0 and 200000),
  data_source text check (data_source in ('college_scorecard', 'manual_admin')),
  source_fetched_at timestamptz,
  association text check (association in ('ncaa', 'naia', 'njcaa', 'other')),
  division public.division,
  conference text check (char_length(conference) <= 120),
  sports_offered text[] not null default '{}',
  athletics_url text check (athletics_url is null or athletics_url ~ '^https://'),
  admissions_url text check (admissions_url is null or admissions_url ~ '^https://'),
  international_url text check (international_url is null or international_url ~ '^https://'),
  virtual_tour_url text check (virtual_tour_url is null or virtual_tour_url ~ '^https://'),
  links_verified_at timestamptz,
  links_verified_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index institutions_name_idx on public.institutions using gin (to_tsvector('simple', name));
create index institutions_division_idx on public.institutions (division, state);
create trigger t_institutions_updated before update on public.institutions for each row execute function public.set_updated_at();

alter table public.organizations
  add column institution_id uuid references public.institutions (id) on delete set null,
  add column requester_email_domain text check (char_length(requester_email_domain) <= 253);

alter table public.institutions enable row level security;
create policy institutions_read on public.institutions for select to anon, authenticated using (true);
create policy institutions_admin_insert on public.institutions for insert to authenticated with check (public.is_admin());
create policy institutions_admin_delete on public.institutions for delete to authenticated using (public.is_admin());
create policy institutions_update on public.institutions for update to authenticated
  using (public.is_admin() or exists (select 1 from public.organizations o
         where o.institution_id = institutions.id and o.verification_status = 'verified' and public.is_org_member(o.id, true)))
  with check (public.is_admin() or exists (select 1 from public.organizations o
         where o.institution_id = institutions.id and o.verification_status = 'verified' and public.is_org_member(o.id, true)));

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
      new.cost_attendance_usd, new.tuition_out_of_state_usd, new.data_source, new.source_fetched_at)
     is distinct from
     (old.ipeds_unitid, old.name, old.city, old.state, old.website_url, old.price_calculator_url,
      old.cost_attendance_usd, old.tuition_out_of_state_usd, old.data_source, old.source_fetched_at) then
    raise exception 'official_data_admin_only' using errcode = '42501';
  end if;
  -- Enlaces cambiados por la universidad: pendientes de revisión hasta que admin los compruebe.
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
create trigger guard_institution before update on public.institutions
  for each row execute function public.guard_institution();

create or replace function public.guard_org_institution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id is distinct from old.institution_id and not public.is_admin() then
    raise exception 'institution_link_admin_only' using errcode = '42501';
  end if;
  if new.requester_email_domain is distinct from old.requester_email_domain and not public.is_admin() then
    new.requester_email_domain := old.requester_email_domain;
  end if;
  return new;
end;
$$;
create trigger guard_org_institution before update on public.organizations
  for each row execute function public.guard_org_institution();

-- 2. Enlaces del atleta ---------------------------------------------------------
create table public.athlete_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('club_profile', 'federation_stats', 'ranking', 'highlight_video', 'school', 'social')),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 500),
  label text check (char_length(label) <= 120),
  verified boolean not null default false,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.athlete_links enable row level security;
create policy alinks_read on public.athlete_links for select to anon, authenticated
  using (public.can_view_athlete(athlete_id, 'profile'));
create policy alinks_insert on public.athlete_links for insert to authenticated
  with check (athlete_id = auth.uid() and not verified and verified_by is null and verified_at is null);
create policy alinks_delete on public.athlete_links for delete to authenticated using (athlete_id = auth.uid());
create policy alinks_admin on public.athlete_links for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.athlete_statistics
  add column source_url text check (source_url is null or (source_url ~ '^https://' and char_length(source_url) <= 500));

-- 3. Denuncias (DSA) -------------------------------------------------------------
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  entity_type text not null check (entity_type in ('athlete_profile', 'opportunity', 'campaign', 'organization', 'contact_request', 'news_post', 'institution')),
  entity_id uuid not null,
  reason text not null check (reason in ('child_safety', 'harassment', 'fake_or_misleading', 'spam', 'illegal_content', 'privacy', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  priority int not null default 2 check (priority between 0 and 3),
  decision_reason text check (char_length(decision_reason) <= 2000),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index content_reports_queue_idx on public.content_reports (status, priority, created_at);
alter table public.content_reports enable row level security;

create or replace function public.guard_content_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.reporter_id := auth.uid();
    new.status := 'open';
    new.decided_by := null;
    new.decided_at := null;
    new.decision_reason := null;
    -- Seguridad infantil siempre primero en la cola.
    new.priority := case when new.reason = 'child_safety' then 0 when new.reason in ('harassment', 'illegal_content') then 1 else 2 end;
    return new;
  end if;
  if new.status in ('actioned', 'dismissed') and old.status not in ('actioned', 'dismissed') then
    if new.decision_reason is null or char_length(new.decision_reason) < 10 then
      raise exception 'decision_reason_required' using errcode = 'P0001';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'report.decided', 'content_reports', new.id, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;
create trigger guard_content_report before insert or update on public.content_reports
  for each row execute function public.guard_content_report();

create policy reports_insert on public.content_reports for insert to authenticated with check (auth.uid() is not null);
create policy reports_select on public.content_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin on public.content_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4. Contacto seguro ----------------------------------------------------------------
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  message text not null check (char_length(message) between 20 and 1500),
  status text not null default 'pending' check (status in ('pending_guardian', 'pending', 'accepted', 'declined', 'blocked')),
  is_minor_at_request boolean not null default false,
  guardian_approved_by uuid references public.profiles (id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index contact_requests_open_unique on public.contact_requests (organization_id, athlete_id)
  where status in ('pending_guardian', 'pending', 'accepted');
alter table public.contact_requests enable row level security;

create or replace function public.is_contact_participant(p_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contact_requests r
     where r.id = p_request
       and (r.athlete_id = auth.uid()
            or public.is_org_member(r.organization_id)
            or (r.is_minor_at_request and exists (
                  select 1 from public.parent_athlete_links l
                   where l.athlete_id = r.athlete_id and l.parent_id = auth.uid() and l.status = 'approved')))
  );
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
  elsif old.status = 'accepted' and (v_uid = new.athlete_id or (new.is_minor_at_request and v_is_guardian)) and new.status = 'blocked' then
    new.responded_at := now();
  else
    raise exception 'contact_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_contact_request before insert or update on public.contact_requests
  for each row execute function public.guard_contact_request();

-- La política usa las columnas de la fila (no una subconsulta por id) para que también
-- valga en el RETURNING del insert.
create policy contact_select on public.contact_requests for select to authenticated
  using (athlete_id = auth.uid() or public.is_org_member(organization_id)
         or (is_minor_at_request and exists (select 1 from public.parent_athlete_links l
              where l.athlete_id = contact_requests.athlete_id and l.parent_id = auth.uid() and l.status = 'approved')));
create policy contact_insert on public.contact_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_org_member(organization_id) and public.can_view_athlete(athlete_id));
create policy contact_update on public.contact_requests for update to authenticated
  using (public.is_contact_participant(id)) with check (public.is_contact_participant(id));

create table public.contact_messages (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.contact_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index contact_messages_thread_idx on public.contact_messages (request_id, created_at);
alter table public.contact_messages enable row level security;

create or replace function public.guard_contact_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_req public.contact_requests;
begin
  select * into v_req from public.contact_requests where id = new.request_id;
  if v_req.status is distinct from 'accepted' then
    raise exception 'conversation_not_open' using errcode = 'P0001';
  end if;
  new.sender_id := auth.uid();
  -- Con menores no se comparten emails, teléfonos ni redes: todo dentro de la plataforma.
  if v_req.is_minor_at_request and (
       new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
       or new.body ~ '\+?\d[\d\s().-]{7,}\d'
       or new.body ~* '(whatsapp|telegram|instagram|snapchat|tiktok|wa\.me)'
     ) then
    raise exception 'contact_data_not_allowed_with_minors' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_messages where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_contact_message before insert on public.contact_messages
  for each row execute function public.guard_contact_message();
create trigger contact_messages_immutable before update or delete on public.contact_messages
  for each row execute function public.forbid_mutation();

create policy cmsg_select on public.contact_messages for select to authenticated using (public.is_contact_participant(request_id));
create policy cmsg_insert on public.contact_messages for insert to authenticated with check (public.is_contact_participant(request_id));

-- Moderación: el admin no lee conversaciones directamente. Solo vía esta función,
-- con una denuncia abierta sobre esa conversación, y queda registrado.
create or replace function public.admin_read_thread(p_request uuid, p_report uuid)
returns setof public.contact_messages language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if not exists (select 1 from public.content_reports where id = p_report and entity_type = 'contact_request'
                 and entity_id = p_request and status in ('open', 'reviewing')) then
    raise exception 'open_report_required' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'moderation.thread_viewed', 'contact_requests', p_request, jsonb_build_object('report', p_report));
  return query select * from public.contact_messages where request_id = p_request order by created_at;
end;
$$;

-- 5. Actualidad --------------------------------------------------------------------
create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('announcement', 'signing', 'rule_update', 'event', 'story')),
  title text not null check (char_length(title) between 6 and 160),
  body text not null check (char_length(body) between 20 and 5000),
  source_url text check (source_url is null or source_url ~ '^https://'),
  athlete_id uuid references public.athlete_profiles (user_id) on delete cascade,
  athlete_consented_at timestamptz,
  status text not null default 'published' check (status in ('published', 'pending_consent', 'hidden')),
  hidden_reason text,
  created_at timestamptz not null default now()
);
create index news_posts_feed_idx on public.news_posts (status, created_at desc);
alter table public.news_posts enable row level security;

create or replace function public.guard_news_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.author_id := v_uid;
    new.hidden_reason := null;
    new.athlete_consented_at := null;
    -- Editorial sin organización: solo admin. Con organización: solo verificada.
    if new.organization_id is null and not public.is_admin() then
      raise exception 'editorial_admin_only' using errcode = '42501';
    end if;
    if new.organization_id is not null and not exists (
         select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'verified_organization_required' using errcode = 'P0001';
    end if;
    if new.athlete_id is not null then
      -- v1: los menores no aparecen en publicaciones.
      if public.is_minor(new.athlete_id) then raise exception 'minors_not_taggable' using errcode = 'P0001'; end if;
      new.status := 'pending_consent';
    else
      new.status := 'published';
    end if;
    return new;
  end if;
  if public.is_admin() then return new; end if;
  if (new.organization_id, new.author_id, new.kind, new.title, new.body, new.source_url, new.athlete_id, new.created_at)
     is distinct from (old.organization_id, old.author_id, old.kind, old.title, old.body, old.source_url, old.athlete_id, old.created_at) then
    raise exception 'news_post_immutable' using errcode = '42501';
  end if;
  -- El atleta etiquetado da (o retira) su consentimiento; el autor puede ocultar su publicación.
  if v_uid = new.athlete_id and old.status = 'pending_consent' and new.status = 'published' then
    new.athlete_consented_at := now();
  elsif v_uid = new.athlete_id and new.status = 'hidden' then
    new.hidden_reason := 'Retirado por el atleta';
  elsif public.is_org_member(new.organization_id) and new.status = 'hidden' then
    new.hidden_reason := 'Retirado por la organización';
  else
    raise exception 'news_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_news_post before insert or update on public.news_posts
  for each row execute function public.guard_news_post();

create policy news_read on public.news_posts for select to anon, authenticated
  using (status = 'published' or author_id = auth.uid() or athlete_id = auth.uid()
         or (organization_id is not null and public.is_org_member(organization_id)) or public.is_admin());
create policy news_insert on public.news_posts for insert to authenticated
  with check (public.is_admin() or (organization_id is not null and public.is_org_member(organization_id)));
create policy news_update on public.news_posts for update to authenticated
  using (athlete_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id)) or public.is_admin())
  with check (athlete_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id)) or public.is_admin());

-- 6. Privilegios -------------------------------------------------------------------
grant select on public.institutions, public.athlete_links, public.news_posts to anon;
grant select, insert, update, delete on public.institutions, public.athlete_links, public.content_reports,
  public.contact_requests, public.news_posts to authenticated;
grant select, insert on public.contact_messages to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.guard_institution, public.guard_org_institution, public.guard_content_report,
  public.guard_contact_request, public.guard_contact_message, public.guard_news_post,
  public.is_contact_participant, public.admin_read_thread from public;
grant execute on function public.is_contact_participant, public.admin_read_thread to authenticated;
