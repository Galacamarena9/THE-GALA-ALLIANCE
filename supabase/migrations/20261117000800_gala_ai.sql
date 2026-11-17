-- GALA AI (Fase 06): observabilidad sin contenido, feedback y límite de ráfaga. Solo aditiva.
-- No se guarda el texto de las conversaciones (minimización): solo métricas técnicas.
-- Reversión: drop function public.log_ai_event, public.admin_ai_stats; drop table public.ai_feedback, public.ai_events;
--   restaurar consume_ai_request() de 20261113000300; alter table public.ai_usage drop column minute_start, drop column minute_count;

-- 1. Métricas por petición -------------------------------------------------------------------------
create table public.ai_events (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  intent text not null check (char_length(intent) <= 40),
  mode text not null check (mode in ('model', 'fallback', 'guard')),
  outcome text not null check (outcome in ('ok', 'fallback', 'guard', 'error')),
  provider text check (char_length(provider) <= 40),
  model text check (char_length(model) <= 80),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  tool_calls int not null default 0 check (tool_calls between 0 and 50),
  latency_ms int not null default 0 check (latency_ms >= 0),
  page text check (page is null or page ~ '^/[A-Za-z0-9/_-]{0,120}$'),
  created_at timestamptz not null default now()
);
create index ai_events_created_idx on public.ai_events (created_at desc);
create index ai_events_user_idx on public.ai_events (user_id, created_at desc);
alter table public.ai_events enable row level security;
create policy ai_events_select on public.ai_events for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.ai_events to authenticated;

create or replace function public.log_ai_event(p_id uuid, p_intent text, p_mode text, p_outcome text, p_provider text, p_model text,
  p_input int, p_output int, p_tools int, p_latency int, p_page text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.ai_events (id, user_id, intent, mode, outcome, provider, model, input_tokens, output_tokens, tool_calls, latency_ms, page)
  values (p_id, auth.uid(), left(p_intent, 40), p_mode, p_outcome, left(p_provider, 40), left(p_model, 80),
          greatest(p_input, 0), greatest(p_output, 0), least(greatest(p_tools, 0), 50), greatest(p_latency, 0),
          case when p_page ~ '^/[A-Za-z0-9/_-]{0,120}$' then p_page else null end)
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.log_ai_event(uuid, text, text, text, text, text, int, int, int, int, text) from public, anon;
grant execute on function public.log_ai_event(uuid, text, text, text, text, text, int, int, int, int, text) to authenticated;

-- 2. Feedback (útil / no útil + motivo), ligado a la petición, sin contenido ------------------------
create table public.ai_feedback (
  request_id uuid not null references public.ai_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  reason text check (reason in ('wrong', 'not_useful', 'unsafe', 'outdated', 'too_long', 'other', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
alter table public.ai_feedback enable row level security;
create policy ai_feedback_select on public.ai_feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ai_feedback_insert on public.ai_feedback for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.ai_events e where e.id = request_id and e.user_id = auth.uid()));
create policy ai_feedback_update on public.ai_feedback for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.ai_feedback to authenticated;

-- 3. Límite diario (40) + ráfaga (6 por minuto), atómico ------------------------------------------
alter table public.ai_usage add column minute_start timestamptz, add column minute_count int not null default 0;
create or replace function public.consume_ai_request()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_min int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, day, requests, minute_start, minute_count) values (auth.uid(), current_date, 1, now(), 1)
  on conflict (user_id, day) do update set
    requests = public.ai_usage.requests + 1,
    minute_start = case when public.ai_usage.minute_start is null or public.ai_usage.minute_start < now() - interval '1 minute' then now() else public.ai_usage.minute_start end,
    minute_count = case when public.ai_usage.minute_start is null or public.ai_usage.minute_start < now() - interval '1 minute' then 1 else public.ai_usage.minute_count + 1 end
  returning requests, minute_count into v_count, v_min;
  return v_count <= 40 and v_min <= 6;
end;
$$;

-- 4. Panel de admin: calidad y coste de los últimos 7 días ----------------------------------------
create or replace function public.admin_ai_stats()
returns table (requests bigint, users bigint, errors bigint, fallbacks bigint, guards bigint, avg_latency_ms int, p95_latency_ms int,
               input_tokens bigint, output_tokens bigint, helpful bigint, not_helpful bigint, top_intents jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  return query
  with e as (select * from public.ai_events where created_at > now() - interval '7 days')
  select count(*), count(distinct e.user_id), count(*) filter (where outcome = 'error'), count(*) filter (where outcome = 'fallback'),
         count(*) filter (where outcome = 'guard'), coalesce(avg(latency_ms), 0)::int,
         coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::int,
         coalesce(sum(e.input_tokens), 0)::bigint, coalesce(sum(e.output_tokens), 0)::bigint,
         (select count(*) from public.ai_feedback f where f.rating = 1 and f.created_at > now() - interval '7 days'),
         (select count(*) from public.ai_feedback f where f.rating = -1 and f.created_at > now() - interval '7 days'),
         coalesce((select jsonb_object_agg(intent, n) from (select intent, count(*) n from e group by intent order by n desc limit 6) t), '{}'::jsonb)
  from e;
end;
$$;
revoke all on function public.admin_ai_stats() from public, anon;
grant execute on function public.admin_ai_stats() to authenticated;

-- 5. Retención: métricas 13 meses (igual que product_events) --------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('gala-ai-retention', '37 3 * * *', $c$delete from public.ai_events where created_at < now() - interval '13 months'$c$);
  end if;
exception when others then
  raise notice 'pg_cron no disponible';
end $$;
