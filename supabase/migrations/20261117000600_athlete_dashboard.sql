-- ATHLETE COMMAND CENTER (Fase 04). Solo aditiva: no modifica ni borra datos existentes.
-- 1. athlete_task_state: completar / posponer / descartar las tareas que calcula el panel.
-- 2. notification_preferences: el usuario silencia categorías; notify() las respeta (salvo seguridad y familia).
-- 3. notify_upcoming_deadlines(): recordatorio real a 7 y 1 día de un plazo OFICIAL guardado o con candidatura.
-- Reversión (orden inverso):
--   select cron.unschedule('gala-deadline-reminders');
--   drop function public.notify_upcoming_deadlines();
--   restaurar public.notify() original (20261113000500) y drop function public.notification_category(text);
--   drop table public.notification_preferences, public.athlete_task_state;

-- 1. Estado de tareas ------------------------------------------------------------------------------
create table public.athlete_task_state (
  athlete_id uuid not null references public.athlete_profiles (user_id) on delete cascade,
  task_key text not null check (task_key ~ '^[a-z_]+(:[A-Za-z0-9_-]+)?$' and char_length(task_key) <= 80),
  status text not null check (status in ('done', 'snoozed', 'dismissed')),
  snoozed_until date,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, task_key),
  constraint task_snooze_date check ((status = 'snoozed') = (snoozed_until is not null))
);
alter table public.athlete_task_state enable row level security;
create policy task_state_select on public.athlete_task_state for select to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'view_profile'));
create policy task_state_write on public.athlete_task_state for all to authenticated
  using (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'))
  with check (athlete_id = auth.uid() or public.has_family_link(athlete_id, 'edit_profile'));

create or replace function public.stamp_task_state()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  if new.status = 'snoozed' and (new.snoozed_until <= current_date or new.snoozed_until > current_date + 60) then
    raise exception 'invalid_snooze' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger stamp_task_state before insert or update on public.athlete_task_state
  for each row execute function public.stamp_task_state();
grant select, insert, update, delete on public.athlete_task_state to authenticated;

-- 2. Preferencias de avisos ------------------------------------------------------------------------
create or replace function public.notification_category(p_kind text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_kind like 'contact.%' or p_kind like 'family.%' or p_kind like 'security.%' or p_kind like 'account.%' then 'essential'
    when p_kind like 'message.%' then 'messages'
    when p_kind like 'application%' or p_kind like 'offer%' then 'applications'
    when p_kind like 'deadline%' then 'deadlines'
    when p_kind like 'saved_%' or p_kind like 'match%' or p_kind like 'opportunit%' then 'matches'
    else 'platform'
  end;
$$;

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('messages', 'applications', 'deadlines', 'matches', 'platform')),
  in_app boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.notification_preferences enable row level security;
create policy notif_prefs_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- notify(): misma firma; si el usuario silenció la categoría no se crea el aviso. Lo esencial siempre llega.
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.notification_preferences
              where user_id = p_user and category = public.notification_category(p_kind) and not in_app) then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
end;
$$;

-- 3. Recordatorios de plazos oficiales -------------------------------------------------------------
-- Solo oportunidades publicadas con fecha límite real, que el atleta guardó o a las que se presentó.
-- Sin duplicados: un aviso por (atleta, oportunidad, umbral).
create or replace function public.notify_upcoming_deadlines()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_n int := 0;
  v_kind text;
begin
  for r in
    select distinct a.athlete_id, o.id, o.title, o.deadline, (o.deadline - current_date) as days
      from public.opportunities o
      join (
        select athlete_id, target_id as opportunity_id from public.saved_items
         where target_kind = 'opportunity' and status in ('saved', 'discovered')
        union
        select athlete_id, opportunity_id from public.applications
         where status not in ('declined', 'withdrawn', 'accepted')
      ) a on a.opportunity_id = o.id
     where o.status = 'published' and o.deadline is not null
       and (o.deadline - current_date) in (7, 1)
  loop
    v_kind := 'deadline.d' || r.days;
    continue when exists (select 1 from public.notifications
                           where user_id = r.athlete_id and kind = v_kind and link = '/app/opportunities/' || r.id);
    perform public.notify(r.athlete_id, v_kind,
      left(r.title, 110) || case when r.days = 1 then ' cierra mañana' else ' cierra en 7 días' end,
      'Plazo oficial publicado por la organización: ' || to_char(r.deadline, 'DD/MM/YYYY') || '.',
      '/app/opportunities/' || r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.notify_upcoming_deadlines() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gala-deadline-reminders', '17 7 * * *', 'select public.notify_upcoming_deadlines()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: los recordatorios de plazos no se programarán';
end $$;
