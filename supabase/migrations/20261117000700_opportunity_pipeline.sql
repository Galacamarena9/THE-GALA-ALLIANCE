-- OPPORTUNITY PIPELINE (Fase 05): el CRM del atleta.
-- Reutiliza saved_items como "proceso" (una universidad u oportunidad que el atleta sigue) en lugar de crear otra entidad.
-- Las candidaturas (applications) siguen siendo de la organización; aquí solo se reflejan como eventos con fuente "organización".
-- Solo aditiva: amplía restricciones, añade columnas/tablas y rellena procesos para candidaturas existentes (sin borrar nada).
-- Reversión (orden inverso):
--   select cron.unschedule('gala-pipeline-reminders'); drop function public.notify_pipeline_tasks();
--   drop trigger pipeline_from_application on public.applications; drop trigger pipeline_from_offer on public.athlete_offers;
--   drop trigger pipeline_log_process on public.saved_items; drop function public.pipeline_* ;
--   alter table public.athlete_offers drop column process_id, drop column status, drop column source, drop column scholarship_type;
--   drop table public.process_documents, public.pipeline_contacts, public.pipeline_tasks, public.pipeline_events;
--   alter table public.saved_items drop column archived_at, drop column next_action, drop column next_action_due,
--     drop column close_reason, drop column stage_changed_at, drop column decided_at;
--   restaurar el check de saved_items.status y guard_saved_item() de 20261117000300 (antes, pasar committed/closed a decision).

-- 1. Procesos -------------------------------------------------------------------------------------
alter table public.saved_items drop constraint saved_items_status_check;
alter table public.saved_items add constraint saved_items_status_check
  check (status in ('discovered', 'saved', 'applied', 'contacted', 'call', 'offer', 'decision', 'committed', 'closed'));
alter table public.saved_items
  add column archived_at timestamptz,
  add column next_action text check (char_length(next_action) <= 200),
  add column next_action_due date,
  add column close_reason text check (close_reason in ('not_interested', 'rejected', 'declined_offer', 'opportunity_closed', 'other')),
  add column stage_changed_at timestamptz not null default now(),
  add column decided_at timestamptz;
-- Solo un compromiso activo por atleta (decisión final).
create unique index saved_items_one_commitment on public.saved_items (athlete_id) where status = 'committed' and archived_at is null;
create index saved_items_pipeline_idx on public.saved_items (athlete_id, status) where archived_at is null;

-- Orden de las etapas (para avanzar automáticamente sin retroceder lo que decidió el atleta).
create or replace function public.pipeline_stage_rank(p text)
returns int language sql immutable set search_path = public as $$
  select case p when 'discovered' then 0 when 'saved' then 1 when 'applied' then 2 when 'contacted' then 3
    when 'call' then 4 when 'offer' then 5 when 'decision' then 6 when 'committed' then 7 when 'closed' then 8 else 0 end;
$$;

-- Una oportunidad ya cerrada puede seguir en el pipeline si el atleta se presentó a ella.
create or replace function public.guard_saved_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_kind = 'institution' and not exists (select 1 from public.institutions where id = new.target_id) then
    raise exception 'target_not_found' using errcode = '23503';
  end if;
  if new.target_kind = 'opportunity'
     and not exists (select 1 from public.opportunities where id = new.target_id and status = 'published')
     and not exists (select 1 from public.applications where opportunity_id = new.target_id and athlete_id = new.athlete_id) then
    raise exception 'target_not_found' using errcode = '23503';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.saved_items where athlete_id = new.athlete_id) >= 300 then
    raise exception 'too_many_saved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 2. Línea de tiempo con fuente (user / platform / organization) ----------------------------------
create table public.pipeline_events (
  id bigint generated always as identity primary key,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  process_id uuid not null references public.saved_items (id) on delete cascade,
  kind text not null check (kind in ('created', 'stage_changed', 'note', 'interaction', 'task_done', 'offer_recorded',
                                     'document_linked', 'application_update', 'archived', 'restored', 'decision', 'next_action')),
  source text not null check (source in ('user', 'platform', 'organization')),
  channel text check (channel in ('email', 'call', 'video', 'meeting', 'visit', 'message', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 2000),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pipeline_events_process_idx on public.pipeline_events (process_id, occurred_at desc);
alter table public.pipeline_events enable row level security;
create policy pipeline_events_select on public.pipeline_events for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy pipeline_events_insert on public.pipeline_events for insert to authenticated
  with check ((athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
              and exists (select 1 from public.saved_items s where s.id = process_id and s.athlete_id = pipeline_events.athlete_id));
-- Solo se borran notas e interacciones propias; lo que registra la plataforma u organización es auditoría.
create policy pipeline_events_delete on public.pipeline_events for delete to authenticated
  using (source = 'user' and kind in ('note', 'interaction') and (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile')));
grant select, insert, delete on public.pipeline_events to authenticated;

-- Un usuario no puede fingir que un evento viene de la plataforma o de la organización.
create or replace function public.guard_pipeline_event()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.source := 'user';
    new.created_by := auth.uid();
    if new.kind not in ('note', 'interaction', 'task_done', 'next_action', 'decision') then
      raise exception 'event_kind_not_allowed' using errcode = '42501';
    end if;
    if new.occurred_at > now() + interval '1 day' then new.occurred_at := now(); end if;
  end if;
  return new;
end;
$$;
create trigger guard_pipeline_event before insert on public.pipeline_events
  for each row execute function public.guard_pipeline_event();

-- 3. Tareas del proceso ---------------------------------------------------------------------------
create table public.pipeline_tasks (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  process_id uuid references public.saved_items (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  due_date date,
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pipeline_tasks_open_idx on public.pipeline_tasks (athlete_id, due_date) where done_at is null;
alter table public.pipeline_tasks enable row level security;
create policy pipeline_tasks_select on public.pipeline_tasks for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy pipeline_tasks_write on public.pipeline_tasks for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check ((athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
              and (process_id is null or exists (select 1 from public.saved_items s where s.id = process_id and s.athlete_id = pipeline_tasks.athlete_id)));
grant select, insert, update, delete on public.pipeline_tasks to authenticated;

-- 4. Contactos del proceso (agenda privada del atleta) --------------------------------------------
create table public.pipeline_contacts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  process_id uuid not null references public.saved_items (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  role text check (char_length(role) <= 80),
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or phone ~ '^[0-9+() .-]{6,25}$'),
  created_at timestamptz not null default now()
);
create index pipeline_contacts_process_idx on public.pipeline_contacts (process_id);
alter table public.pipeline_contacts enable row level security;
create policy pipeline_contacts_select on public.pipeline_contacts for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy pipeline_contacts_write on public.pipeline_contacts for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check ((athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
              and exists (select 1 from public.saved_items s where s.id = process_id and s.athlete_id = pipeline_contacts.athlete_id));
grant select, insert, update, delete on public.pipeline_contacts to authenticated;

-- 5. Checklist de documentos (reutiliza la bóveda athlete_documents) -------------------------------
create table public.process_documents (
  process_id uuid not null references public.saved_items (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('passport', 'transcript', 'translation', 'graduation_proof', 'english_test',
                                     'sat_act', 'highlight_video', 'i20', 'sevis_receipt', 'ds160', 'financial', 'medical', 'other')),
  document_id uuid references public.athlete_documents (id) on delete set null,
  sent_at date,
  primary key (process_id, kind)
);
alter table public.process_documents enable row level security;
create policy process_documents_select on public.process_documents for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy process_documents_write on public.process_documents for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check ((athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
              and exists (select 1 from public.saved_items s where s.id = process_id and s.athlete_id = process_documents.athlete_id)
              and (document_id is null or exists (select 1 from public.athlete_documents d where d.id = document_id and d.athlete_id = process_documents.athlete_id)));
grant select, insert, update, delete on public.process_documents to authenticated;

-- 6. Ofertas: enlace al proceso, estado y procedencia ----------------------------------------------
alter table public.athlete_offers
  add column process_id uuid references public.saved_items (id) on delete set null,
  add column status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  add column source text not null default 'athlete' check (source in ('athlete', 'organization')),
  add column scholarship_type text not null default 'unknown' check (scholarship_type in ('athletic', 'academic', 'mixed', 'unknown'));

-- Lo que registra el atleta o su familia siempre es "registrado por el atleta" (nunca "verificado").
create or replace function public.guard_offer_source()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' or new.source is distinct from old.source then new.source := 'athlete'; end if;
  end if;
  if new.process_id is not null and not exists (select 1 from public.saved_items s where s.id = new.process_id and s.athlete_id = new.athlete_id) then
    raise exception 'process_not_owned' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_offer_source before insert or update on public.athlete_offers
  for each row execute function public.guard_offer_source();

-- 7. Automatismos ---------------------------------------------------------------------------------
create or replace function public.pipeline_log_process()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- Las funciones del sistema marcan la fuente (organización / plataforma); por defecto actúa el usuario.
  v_src text := coalesce(nullif(current_setting('gala.pipeline_source', true), ''), 'user');
begin
  if tg_op = 'INSERT' then
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, created_by)
    values (new.athlete_id, new.id, 'created', v_src, 'Añadido al pipeline', auth.uid());
    return new;
  end if;
  if new.status is distinct from old.status then
    new.stage_changed_at := now();
    if new.status in ('committed', 'closed') then new.decided_at := now(); end if;
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, body, created_by)
    values (new.athlete_id, new.id, 'stage_changed', v_src, 'Etapa: ' || old.status || ' → ' || new.status, new.close_reason, auth.uid());
  end if;
  if new.archived_at is distinct from old.archived_at then
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, created_by)
    values (new.athlete_id, new.id, case when new.archived_at is null then 'restored' else 'archived' end, v_src,
            case when new.archived_at is null then 'Recuperado del archivo' else 'Archivado' end, auth.uid());
  end if;
  if (new.next_action, new.next_action_due) is distinct from (old.next_action, old.next_action_due) and new.next_action is not null then
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title, created_by)
    values (new.athlete_id, new.id, 'next_action', v_src, 'Siguiente paso: ' || left(new.next_action, 160), auth.uid());
  end if;
  return new;
end;
$$;
create trigger pipeline_log_process_ins after insert on public.saved_items
  for each row execute function public.pipeline_log_process();
create trigger pipeline_log_process_upd before update on public.saved_items
  for each row execute function public.pipeline_log_process();

-- Estado que ve el atleta de su candidatura (sin exponer etapas internas de la organización).
create or replace function public.application_stage_for_athlete(p application_status)
returns text language sql immutable set search_path = public as $$
  select case p::text
    when 'applied' then 'applied' when 'reviewed' then 'applied'
    when 'contacted' then 'contacted' when 'information_requested' then 'contacted' when 'shortlist' then 'contacted'
    when 'interview' then 'call' when 'tryout' then 'call'
    when 'offer' then 'offer' when 'accepted' then 'offer'
    when 'declined' then 'closed' when 'withdrawn' then 'closed' else 'applied' end;
$$;

create or replace function public.pipeline_from_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_stage text := public.application_stage_for_athlete(new.status);
  v_title text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  perform set_config('gala.pipeline_source', case when new.status = 'withdrawn' then 'user' else 'organization' end, true);
  insert into public.saved_items (athlete_id, target_kind, target_id, status)
  values (new.athlete_id, 'opportunity', new.opportunity_id, v_stage)
  on conflict (athlete_id, target_kind, target_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.saved_items where athlete_id = new.athlete_id and target_kind = 'opportunity' and target_id = new.opportunity_id;
    -- Avanza, nunca retrocede lo que decidió el atleta; una candidatura descartada cierra el proceso.
    update public.saved_items
       set status = v_stage,
           close_reason = case when v_stage = 'closed' then case when new.status = 'withdrawn' then 'not_interested' else 'rejected' end else close_reason end
     where id = v_id and status not in ('committed', 'closed')
       and (public.pipeline_stage_rank(v_stage) > public.pipeline_stage_rank(status) or v_stage = 'closed');
  end if;
  v_title := case new.status::text
    when 'applied' then 'Candidatura enviada' when 'reviewed' then 'La organización revisó tu candidatura'
    when 'contacted' then 'La organización te ha contactado' when 'information_requested' then 'Te piden información adicional'
    when 'interview' then 'Entrevista o llamada programada' when 'tryout' then 'Te proponen una prueba'
    when 'shortlist' then 'Estás en su lista de seguimiento' when 'offer' then 'La organización registró una oferta'
    when 'accepted' then 'Candidatura aceptada' when 'declined' then 'La organización no continúa el proceso'
    when 'withdrawn' then 'Retiraste tu candidatura' else 'Actualización de la candidatura' end;
  insert into public.pipeline_events (athlete_id, process_id, kind, source, title)
  values (new.athlete_id, v_id, 'application_update', case when new.status = 'withdrawn' then 'user' else 'organization' end, v_title);
  perform set_config('gala.pipeline_source', '', true);
  return new;
end;
$$;
create trigger pipeline_from_application after insert or update of status on public.applications
  for each row execute function public.pipeline_from_application();

create or replace function public.pipeline_from_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid := new.process_id;
begin
  perform set_config('gala.pipeline_source', case when new.source = 'organization' then 'organization' else 'user' end, true);
  if v_id is null and new.institution_id is not null then
    select id into v_id from public.saved_items
     where athlete_id = new.athlete_id and target_kind = 'institution' and target_id = new.institution_id;
    if v_id is null then
      insert into public.saved_items (athlete_id, target_kind, target_id, status)
      values (new.athlete_id, 'institution', new.institution_id, 'offer') returning id into v_id;
    end if;
    update public.athlete_offers set process_id = v_id where id = new.id;
  end if;
  if v_id is not null then
    update public.saved_items set status = 'offer'
     where id = v_id and public.pipeline_stage_rank(status) < public.pipeline_stage_rank('offer');
    insert into public.pipeline_events (athlete_id, process_id, kind, source, title)
    values (new.athlete_id, v_id, 'offer_recorded', case when new.source = 'organization' then 'organization' else 'user' end,
            'Oferta registrada' || case when new.in_writing then ' (por escrito)' else ' (sin confirmar por escrito)' end);
  end if;
  perform set_config('gala.pipeline_source', '', true);
  return new;
end;
$$;
create trigger pipeline_from_offer after insert on public.athlete_offers
  for each row execute function public.pipeline_from_offer();

-- 8. Relleno: cada candidatura existente tiene su proceso (no se pierde nada) ---------------------
select set_config('gala.pipeline_source', 'platform', true);
insert into public.saved_items (athlete_id, target_kind, target_id, status)
select a.athlete_id, 'opportunity', a.opportunity_id, public.application_stage_for_athlete(a.status)
  from public.applications a
 where not exists (select 1 from public.saved_items s where s.athlete_id = a.athlete_id and s.target_kind = 'opportunity' and s.target_id = a.opportunity_id)
on conflict do nothing;
update public.athlete_offers o set process_id = s.id
  from public.saved_items s
 where o.process_id is null and o.institution_id is not null
   and s.athlete_id = o.athlete_id and s.target_kind = 'institution' and s.target_id = o.institution_id;
select set_config('gala.pipeline_source', '', true);

-- 9. Recordatorios de tareas personales (día antes, sin duplicados) -------------------------------
create or replace function public.notify_pipeline_tasks()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select t.id, t.athlete_id, t.title, t.process_id from public.pipeline_tasks t
            where t.done_at is null and t.due_date = current_date + 1 loop
    continue when exists (select 1 from public.notifications where user_id = r.athlete_id and kind = 'deadline.task'
                            and link = '/app/process/' || coalesce(r.process_id::text, '') and title like '%' || left(r.title, 60) || '%'
                            and created_at > now() - interval '2 days');
    perform public.notify(r.athlete_id, 'deadline.task', 'Mañana: ' || left(r.title, 140), 'Tarea personal de tu pipeline.',
                          case when r.process_id is null then '/app/process' else '/app/process/' || r.process_id end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.notify_pipeline_tasks() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gala-pipeline-reminders', '27 7 * * *', 'select public.notify_pipeline_tasks()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: los recordatorios de tareas no se programarán';
end $$;

-- 10. Eventos de producto -------------------------------------------------------------------------
alter table public.product_events drop constraint product_events_event_check;
alter table public.product_events add constraint product_events_event_check check (event in (
  'signup_completed', 'onboarding_completed', 'passport_saved', 'opportunity_viewed', 'application_submitted',
  'contact_requested', 'contact_accepted', 'search_saved', 'plan_requested', 'academy_attempt',
  'document_uploaded', 'roster_joined', 'universities_compared',
  'passport_completed', 'passport_shared', 'video_uploaded', 'university_viewed', 'university_saved',
  'match_viewed', 'opportunity_saved', 'comparison_created', 'task_completed', 'dashboard_viewed',
  'pipeline_stage_changed', 'interaction_logged', 'offer_recorded', 'pipeline_decision'));
