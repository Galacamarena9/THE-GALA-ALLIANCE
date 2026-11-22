-- Lista de difusión (Operaciones Gala): organizaciones a las que invitar a probar la plataforma.
-- Principios:
--   · Solo ORGANIZACIONES con un canal público de contacto (agencias, universidades, federaciones, clubes, academias).
--     Nunca personas menores ni atletas sueltos: a ellos se llega a través de su club, federación o familia.
--   · LSSI art. 21: sin consentimiento previo no se envía publicidad. La plataforma envía UNA invitación que pide permiso
--     (con enlace de baja) y solo vuelve a escribir si la organización acepta. La baja es definitiva (lista de supresión).
--   · Solo administradores leen o cambian la lista. La respuesta pública entra por un token de un solo uso (hash sha256).

create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  segment text not null check (segment in ('agency','university','federation','club','academy','other')),
  organization_name text not null check (char_length(organization_name) between 2 and 160),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  website text check (website is null or website ~ '^https?://'),
  channel text not null default 'email' check (channel in ('email','web_form','phone','linkedin')),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_title text check (role_title is null or char_length(role_title) <= 120),
  source_url text not null check (source_url ~ '^https?://'),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'new' check (status in ('new','invited','contacted','accepted','declined','unsubscribed','registered','bounced')),
  invite_token_hash text,
  invite_expires_at timestamptz,
  invited_at timestamptz,
  responded_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_email_channel check (channel <> 'email' or email is not null)
);
create unique index if not exists outreach_contacts_email_uidx on public.outreach_contacts (lower(email)) where email is not null;
create unique index if not exists outreach_contacts_org_uidx on public.outreach_contacts (lower(organization_name), segment);
create index if not exists outreach_contacts_status_idx on public.outreach_contacts (status, segment);
create index if not exists outreach_contacts_created_by_idx on public.outreach_contacts (created_by);

-- Lista de supresión: quien se da de baja no vuelve a entrar aunque se borre y se vuelva a crear el contacto.
create table if not exists public.outreach_suppressions (
  email_hash text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_events (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.outreach_contacts (id) on delete cascade,
  kind text not null check (kind in ('created','invited','contacted','accepted','declined','unsubscribed','registered','bounced','note')),
  detail text check (detail is null or char_length(detail) <= 500),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists outreach_events_contact_idx on public.outreach_events (contact_id, created_at desc);
create index if not exists outreach_events_actor_idx on public.outreach_events (actor_id);

alter table public.outreach_contacts enable row level security;
alter table public.outreach_events enable row level security;
alter table public.outreach_suppressions enable row level security;

drop policy if exists outreach_contacts_admin on public.outreach_contacts;
create policy outreach_contacts_admin on public.outreach_contacts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists outreach_events_admin_read on public.outreach_events;
create policy outreach_events_admin_read on public.outreach_events for select to authenticated using (public.is_admin());
drop policy if exists outreach_events_admin_insert on public.outreach_events;
create policy outreach_events_admin_insert on public.outreach_events for insert to authenticated
  with check (public.is_admin() and actor_id = (select auth.uid()));
-- outreach_suppressions: sin políticas; solo la tocan las funciones de abajo.
revoke all on public.outreach_suppressions from anon, authenticated;
revoke all on public.outreach_contacts, public.outreach_events from anon;
grant select, insert, update, delete on public.outreach_contacts to authenticated;
grant select, insert on public.outreach_events to authenticated;

-- El servidor controla el estado y el token: nadie los fija a mano desde el cliente.
create or replace function public.guard_outreach_contact()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if new.email is not null and exists (select 1 from public.outreach_suppressions s where s.email_hash = encode(extensions.digest(lower(new.email), 'sha256'), 'hex')) then
      raise exception 'suppressed' using errcode = 'P0001', hint = 'Este correo pidió no recibir más mensajes.';
    end if;
    new.status := 'new'; new.invite_token_hash := null; new.invite_expires_at := null; new.invited_at := null; new.responded_at := null;
    new.created_by := auth.uid();
  else
    new.updated_at := now();
    if current_setting('outreach.internal', true) is distinct from 'on' then
      -- Desde el panel: solo datos descriptivos y transiciones manuales permitidas.
      new.invite_token_hash := old.invite_token_hash; new.invite_expires_at := old.invite_expires_at;
      new.invited_at := old.invited_at; new.responded_at := old.responded_at; new.created_by := old.created_by;
      if new.email is distinct from old.email and old.status <> 'new' then
        raise exception 'email_locked' using errcode = 'P0001', hint = 'El correo no se cambia después de contactar.';
      end if;
      if new.status is distinct from old.status and not (
           (old.status in ('new','invited') and new.status = 'contacted')      -- contacto manual (formulario, teléfono, LinkedIn)
        or (old.status in ('accepted','contacted','invited') and new.status = 'registered')
        or (old.status in ('invited','contacted') and new.status in ('accepted','declined'))  -- respuesta recibida por otra vía
        or (old.status = 'invited' and new.status = 'bounced')
      ) then
        raise exception 'bad_transition' using errcode = 'P0001';
      end if;
      if old.status = 'unsubscribed' then raise exception 'unsubscribed_locked' using errcode = 'P0001'; end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists outreach_contacts_guard on public.outreach_contacts;
create trigger outreach_contacts_guard before insert or update on public.outreach_contacts
  for each row execute function public.guard_outreach_contact();
revoke all on function public.guard_outreach_contact() from public, anon, authenticated;

-- Paso 1 (admin, al enviar): emite el token de la invitación. Una sola invitación por contacto; caduca a los 30 días.
create or replace function public.outreach_issue_invite(p_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex'); r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.outreach_contacts where id = p_id for update;
  if r.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if r.status <> 'new' or r.email is null then raise exception 'not_invitable' using errcode = 'P0001'; end if;
  if exists (select 1 from public.outreach_suppressions s where s.email_hash = encode(extensions.digest(lower(r.email), 'sha256'), 'hex')) then
    raise exception 'suppressed' using errcode = 'P0001';
  end if;
  perform set_config('outreach.internal', 'on', true);
  update public.outreach_contacts
     set invite_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         invite_expires_at = now() + interval '30 days', status = 'invited', invited_at = now()
   where id = p_id;
  perform set_config('outreach.internal', 'off', true);
  insert into public.outreach_events (contact_id, kind, actor_id) values (p_id, 'invited', auth.uid());
  return v_token;
end;
$$;

-- Si el proveedor de correo falla, se deshace la invitación para poder reintentar (sin dejar un token vivo).
create or replace function public.outreach_revert_invite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform set_config('outreach.internal', 'on', true);
  update public.outreach_contacts set status = 'new', invite_token_hash = null, invite_expires_at = null, invited_at = null
   where id = p_id and status = 'invited' and responded_at is null;
  perform set_config('outreach.internal', 'off', true);
  delete from public.outreach_events where contact_id = p_id and kind = 'invited' and created_at > now() - interval '5 minutes';
end;
$$;

-- Vista previa pública (sin sesión): solo el nombre de la organización y si el enlace sigue vivo.
create or replace function public.outreach_preview(p_token text)
returns table (organization_name text, segment text, status text, valid boolean)
language sql stable security definer set search_path = public, extensions as $$
  select c.organization_name, c.segment, c.status,
         (c.status = 'invited' and c.invite_expires_at > now()) as valid
    from public.outreach_contacts c
   where p_token ~ '^[a-f0-9]{64}$'
     and c.invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Paso 2 (la organización, sin sesión): acepta, rechaza o se da de baja. Avisa a los administradores en la app.
create or replace function public.outreach_respond(p_token text, p_answer text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_kind text; v_title text;
begin
  if p_answer not in ('accept','decline','unsubscribe') or p_token !~ '^[a-f0-9]{64}$' then return 'invalid'; end if;
  select * into r from public.outreach_contacts
   where invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if r.id is null then return 'invalid'; end if;
  -- La baja funciona siempre, aunque el enlace haya caducado o ya se hubiera respondido.
  if p_answer <> 'unsubscribe' and (r.status <> 'invited' or r.invite_expires_at < now()) then return 'expired'; end if;
  v_kind := case p_answer when 'accept' then 'accepted' when 'decline' then 'declined' else 'unsubscribed' end;
  perform set_config('outreach.internal', 'on', true);
  update public.outreach_contacts
     set status = v_kind, responded_at = now(),
         invite_token_hash = case when p_answer = 'accept' then invite_token_hash else null end
   where id = r.id;
  perform set_config('outreach.internal', 'off', true);
  if p_answer = 'unsubscribe' and r.email is not null then
    insert into public.outreach_suppressions (email_hash) values (encode(extensions.digest(lower(r.email), 'sha256'), 'hex'))
    on conflict do nothing;
  end if;
  insert into public.outreach_events (contact_id, kind) values (r.id, v_kind);
  v_title := case v_kind when 'accepted' then r.organization_name || ' quiere probar la plataforma'
                         when 'declined' then r.organization_name || ' no está interesada ahora'
                         else r.organization_name || ' pidió no recibir más mensajes' end;
  insert into public.notifications (user_id, kind, title, body, link)
  select ur.user_id, 'outreach_' || v_kind, left(v_title, 160),
         case when v_kind = 'accepted' then 'Escríbele o dale acceso de prueba desde la lista de difusión.' end,
         '/app/admin/difusion'
    from public.user_roles ur where ur.role = 'admin';
  return v_kind;
end;
$$;

revoke all on function public.outreach_issue_invite(uuid), public.outreach_revert_invite(uuid) from public, anon;
grant execute on function public.outreach_issue_invite(uuid), public.outreach_revert_invite(uuid) to authenticated;
revoke all on function public.outreach_preview(text), public.outreach_respond(text, text) from public;
grant execute on function public.outreach_preview(text), public.outreach_respond(text, text) to anon, authenticated;
