-- Networking: preguntas abiertas en cada beca. El atleta pregunta (de forma anónima en público),
-- la organización responde una vez y la respuesta queda visible para todos los que ven la beca.

create table public.opportunity_questions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  asker_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 10 and 500),
  answer text check (answer is null or char_length(btrim(answer)) between 2 and 1500),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index opportunity_questions_opp_idx on public.opportunity_questions (opportunity_id, answered_at);
create index opportunity_questions_asker_idx on public.opportunity_questions (asker_id);
create index opportunity_questions_answered_by_idx on public.opportunity_questions (answered_by);
alter table public.opportunity_questions enable row level security;

create or replace function public.guard_opportunity_question()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_title text;
begin
  select organization_id, title into v_org, v_title from public.opportunities where id = coalesce(new.opportunity_id, old.opportunity_id);
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.opportunities where id = new.opportunity_id and status = 'published') then
      raise exception 'opportunity_not_published' using errcode = 'P0001';
    end if;
    -- Espacio público: nada de emails, teléfonos ni redes.
    if new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or new.body ~ '\+?\d[\d\s().-]{7,}\d'
       or new.body ~* '(whatsapp|telegram|instagram|snapchat|tiktok|wa\.me)' then
      raise exception 'contact_data_not_allowed' using errcode = 'P0001';
    end if;
    if (select count(*) from public.opportunity_questions where asker_id = v_uid and created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    new.asker_id := v_uid;
    new.answer := null; new.answered_by := null; new.answered_at := null;
    return new;
  end if;
  if (new.opportunity_id, new.asker_id, new.body, new.created_at) is distinct from (old.opportunity_id, old.asker_id, old.body, old.created_at) then
    raise exception 'question_immutable' using errcode = '42501';
  end if;
  if new.answer is distinct from old.answer then
    if not public.is_org_member(v_org) then
      raise exception 'answer_not_allowed' using errcode = '42501';
    end if;
    if new.answer ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or new.answer ~ '\+?\d[\d\s().-]{7,}\d' then
      raise exception 'contact_data_not_allowed' using errcode = 'P0001';
    end if;
    new.answered_by := v_uid;
    new.answered_at := now();
    if old.answer is null and old.asker_id is not null then
      perform public.notify(old.asker_id, 'question.answered', 'Han respondido tu pregunta', left(v_title, 160), '/app/opportunities/' || old.opportunity_id);
    end if;
  end if;
  return new;
end $$;
create trigger opportunity_questions_guard before insert or update on public.opportunity_questions
  for each row execute function public.guard_opportunity_question();
revoke execute on function public.guard_opportunity_question() from public, anon, authenticated;

-- Respondidas: visibles para quien ve la beca. Sin responder: quien pregunta y la organización.
create policy oq_select_public on public.opportunity_questions for select to anon
  using (answered_at is not null and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'published'));
create policy oq_select on public.opportunity_questions for select to authenticated using (
  (answered_at is not null and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'published'))
  or asker_id = (select auth.uid())
  or exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_org_member(o.organization_id))
  or public.is_admin()
);
create policy oq_insert on public.opportunity_questions for insert to authenticated with check (true);
create policy oq_update on public.opportunity_questions for update to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_org_member(o.organization_id)))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_org_member(o.organization_id)));

-- Privacidad: nadie lee quién preguntó (ni otros atletas ni la organización).
revoke all on public.opportunity_questions from anon, authenticated;
grant select (id, opportunity_id, body, answer, answered_at, created_at) on public.opportunity_questions to anon, authenticated;
grant insert (opportunity_id, body) on public.opportunity_questions to authenticated;
grant update (answer) on public.opportunity_questions to authenticated;
