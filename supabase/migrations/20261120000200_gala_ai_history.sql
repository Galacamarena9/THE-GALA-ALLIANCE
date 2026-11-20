-- GALA AI · historial y preferencias (Fase 06 · puntos 29 y 30). Solo aditiva.
-- Principio: por defecto NO se guarda el texto de las conversaciones. El usuario puede activarlo,
-- ver, retomar y borrar sus conversaciones. Nadie más las ve (ni familia, ni organizaciones, ni admin).
-- Retención: 90 días desde la última actividad.
-- Reversión: select cron.unschedule('gala-ai-history-retention');
--   drop table public.ai_messages, public.ai_conversations, public.ai_preferences;

-- 1. Preferencias editables ----------------------------------------------------------------------
create table public.ai_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  save_history boolean not null default false,
  language text not null default 'auto' check (language in ('auto', 'es', 'en')),
  answer_style text not null default 'short' check (answer_style in ('short', 'detailed')),
  updated_at timestamptz not null default now()
);
alter table public.ai_preferences enable row level security;
create policy ai_prefs_own on public.ai_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.ai_preferences to authenticated;

-- 2. Conversaciones (solo si el usuario activó el historial) --------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
alter table public.ai_conversations enable row level security;
create policy ai_conv_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.ai_conversations to authenticated;

create table public.ai_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, id);
alter table public.ai_messages enable row level security;
create policy ai_msg_select on public.ai_messages for select to authenticated using (user_id = auth.uid());
create policy ai_msg_delete on public.ai_messages for delete to authenticated using (user_id = auth.uid());
-- Solo se escribe en conversaciones propias y si el historial está activado (la base de datos lo exige, no solo la interfaz).
create policy ai_msg_insert on public.ai_messages for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  and exists (select 1 from public.ai_preferences p where p.user_id = auth.uid() and p.save_history)
);
grant select, insert, delete on public.ai_messages to authenticated;
grant usage on sequence public.ai_messages_id_seq to authenticated;

-- Límites: 200 conversaciones por usuario y 200 mensajes por conversación; la conversación se «toca» al escribir.
create or replace function public.guard_ai_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ai_messages where conversation_id = new.conversation_id) >= 200 then
    raise exception 'conversation_full' using errcode = 'P0001';
  end if;
  update public.ai_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
create trigger guard_ai_message before insert on public.ai_messages for each row execute function public.guard_ai_message();

create or replace function public.guard_ai_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ai_conversations where user_id = new.user_id) >= 200 then
    raise exception 'too_many_conversations' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.ai_preferences where user_id = new.user_id and save_history) then
    raise exception 'history_disabled' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_ai_conversation before insert on public.ai_conversations for each row execute function public.guard_ai_conversation();

-- Desactivar el historial borra lo guardado (lo que el usuario espera al apagarlo).
create or replace function public.ai_history_off()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.save_history and not new.save_history then
    delete from public.ai_conversations where user_id = new.user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger ai_history_off before update on public.ai_preferences for each row execute function public.ai_history_off();

-- 3. Retención ----------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gala-ai-history-retention', '41 3 * * *', $c$delete from public.ai_conversations where updated_at < now() - interval '90 days'$c$);
  end if;
end $$;
