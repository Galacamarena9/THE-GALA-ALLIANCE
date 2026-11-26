-- =============================================================================================================
-- QA agente (hallazgo 5): «no leídos» en la bandeja. Una marca por persona y conversación con la última vez que
-- la abrió. Solo la escribe la función contact_mark_read (para quien participa en la conversación) y cada uno solo
-- lee sus propias marcas. No guarda contenido de mensajes ni dice nada a la otra parte (no hay «visto»).
-- ROLLBACK:
--   drop function if exists public.contact_mark_read(uuid);
--   drop table if exists public.contact_thread_reads;
-- =============================================================================================================

create table if not exists public.contact_thread_reads (
  request_id uuid not null references public.contact_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists contact_thread_reads_user_idx on public.contact_thread_reads (user_id);
alter table public.contact_thread_reads enable row level security;

-- Deny by default: solo lectura de las marcas propias; nada de escritura directa.
revoke all on public.contact_thread_reads from anon, authenticated;
grant select on public.contact_thread_reads to authenticated;
create policy contact_thread_reads_own on public.contact_thread_reads for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.contact_mark_read(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_contact_participant(p_request) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.contact_thread_reads (request_id, user_id, last_read_at)
  values (p_request, auth.uid(), now())
  on conflict (request_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function public.contact_mark_read(uuid) from public, anon;
grant execute on function public.contact_mark_read(uuid) to authenticated;
