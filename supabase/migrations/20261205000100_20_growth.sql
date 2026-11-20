-- =============================================================================================================
-- Prompt 20 · Crecimiento: invitaciones con atribución honesta. Sin recompensas que incentiven spam, sin
-- rankings de quién trae más gente, y sin bucles de crecimiento dirigidos a menores.
-- =============================================================================================================
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  referred_user uuid primary key references auth.users (id) on delete cascade,   -- una sola atribución por persona
  referrer_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  constraint referral_not_self check (referred_user <> referrer_id)
);
create index if not exists referrals_referrer on public.referrals (referrer_id);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
create policy referral_codes_own on public.referral_codes for select to authenticated using (user_id = (select auth.uid()));
-- Quien invita solo ve cuántas personas se unieron, no quiénes (las ve por su cuenta si se conectan).
create policy referrals_admin on public.referrals for select to authenticated using (public.is_admin());
grant select on public.referral_codes, public.referrals to authenticated;

create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if public.is_minor(auth.uid()) then return null; end if;   -- sin bucles de invitación para menores
  select code into v from public.referral_codes where user_id = auth.uid();
  if v is null then
    loop
      v := encode(extensions.gen_random_bytes(4), 'hex');
      exit when not exists (select 1 from public.referral_codes where code = v);
    end loop;
    insert into public.referral_codes (user_id, code) values (auth.uid(), v) on conflict (user_id) do nothing;
    select code into v from public.referral_codes where user_id = auth.uid();
  end if;
  return v;
end;
$$;

-- Atribuir el alta: una vez, en los 7 días siguientes a registrarse, nunca a uno mismo.
create or replace function public.referral_claim(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ref uuid;
begin
  if auth.uid() is null or p_code !~ '^[a-z0-9]{8}$' then return false; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and created_at > now() - interval '7 days') then return false; end if;
  select user_id into v_ref from public.referral_codes where code = p_code;
  if v_ref is null or v_ref = auth.uid() then return false; end if;
  insert into public.referrals (referred_user, referrer_id, code) values (auth.uid(), v_ref, p_code) on conflict do nothing;
  return found;
end;
$$;

create or replace function public.my_referral_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.referrals where referrer_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array['my_referral_code()', 'referral_claim(text)', 'my_referral_count()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

/* ROLLBACK: drop referrals, referral_codes y las tres funciones. */
