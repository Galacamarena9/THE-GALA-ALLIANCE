-- Networking: avisos automáticos útiles (sin spam).
--  · message.new        → mensaje nuevo en una conversación (uno sin leer por conversación).
--  · profile.view       → alguien abrió tu enlace de reclutamiento (uno al día por enlace).
--  · opportunity.match  → se publica una beca de tu deporte, posición y promoción.

-- 1) Mensajes nuevos.
create or replace function public.alert_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_target uuid;
  v_link text := '/app/inbox/' || new.request_id;
begin
  select athlete_id, requested_by into r from public.contact_requests where id = new.request_id;
  foreach v_target in array array[r.athlete_id, r.requested_by] loop
    continue when v_target is null or v_target = new.sender_id;
    -- Un solo aviso sin leer por conversación: no llenamos la bandeja con cada mensaje.
    continue when exists (select 1 from public.notifications where user_id = v_target and kind = 'message.new' and link = v_link and read_at is null);
    perform public.notify(v_target, 'message.new', 'Tienes un mensaje nuevo', left(new.body, 140), v_link);
  end loop;
  return new;
end $$;
drop trigger if exists contact_messages_alert on public.contact_messages;
create trigger contact_messages_alert after insert on public.contact_messages
  for each row execute function public.alert_new_message();

-- 2) Perfil abierto desde un enlace de reclutamiento.
create or replace function public.alert_profile_view()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_athlete uuid;
  v_label text;
begin
  select athlete_id, label into v_athlete, v_label from public.recruiting_links where id = new.link_id;
  if v_athlete is null then return new; end if;
  if exists (
    select 1 from public.notifications
    where user_id = v_athlete and kind = 'profile.view' and body = v_label and created_at > now() - interval '1 day'
  ) then return new; end if;
  perform public.notify(v_athlete, 'profile.view', 'Alguien ha abierto tu perfil', v_label, '/app/share');
  return new;
end $$;
drop trigger if exists recruiting_link_views_alert on public.recruiting_link_views;
create trigger recruiting_link_views_alert after insert on public.recruiting_link_views
  for each row execute function public.alert_profile_view();

-- 3) Beca publicada que encaja (deporte; posición y promoción si la oferta las indica). Máx. 500 avisos por beca.
create or replace function public.alert_opportunity_match()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org text;
  r record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  select name into v_org from public.organizations where id = new.organization_id;
  for r in
    select ap.user_id
    from public.athlete_profiles ap
    where ap.sport_id = new.sport_id
      and ap.open_to_opportunities
      and (coalesce(array_length(new.position_ids, 1), 0) = 0 or ap.primary_position_id = any (new.position_ids))
      and (coalesce(array_length(new.graduation_years, 1), 0) = 0 or ap.graduation_year = any (new.graduation_years))
    limit 500
  loop
    perform public.notify(r.user_id, 'opportunity.match', 'Nueva beca que encaja contigo',
      left(coalesce(v_org, 'Una organización verificada') || ': ' || new.title, 300), '/app/opportunities/' || new.id);
  end loop;
  return new;
end $$;
drop trigger if exists opportunities_match_alert on public.opportunities;
create trigger opportunities_match_alert after insert or update of status on public.opportunities
  for each row execute function public.alert_opportunity_match();

-- Funciones de trigger: nadie las llama por la API.
revoke execute on function public.alert_new_message() from public, anon, authenticated;
revoke execute on function public.alert_profile_view() from public, anon, authenticated;
revoke execute on function public.alert_opportunity_match() from public, anon, authenticated;
