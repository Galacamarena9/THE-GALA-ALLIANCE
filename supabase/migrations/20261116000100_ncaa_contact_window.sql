-- Cumplimiento NCAA por diseño: ventana de primer contacto de las universidades.
-- NCAA D-I (Bylaw 13.4.1 y calendario de reclutamiento): sin correspondencia ni llamadas de reclutamiento
-- antes del 15 de junio al terminar el 2.º curso de secundaria (sophomore year); béisbol, 1 de agosto
-- antes del 3.er curso; lacrosse, 1 de septiembre del 3.er curso. D-II: 15 de junio antes del 3.er curso.
-- D-III, NAIA y NJCAA no limitan el contacto electrónico. graduation_year = año de graduación de secundaria,
-- así que el 2.º curso termina en primavera de graduation_year - 2.

create or replace function public.ncaa_contact_opens_on(p_grad_year int, p_division public.division, p_sport text)
returns date language sql immutable set search_path = public as $$
  select case
    when p_grad_year is null or p_division is null then null
    when p_division = 'ncaa_d1' and p_sport = 'baseball' then make_date(p_grad_year - 2, 8, 1)
    when p_division = 'ncaa_d1' and p_sport = 'lacrosse' then make_date(p_grad_year - 2, 9, 1)
    when p_division in ('ncaa_d1', 'ncaa_d2') then make_date(p_grad_year - 2, 6, 15)
    else null
  end
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
    if exists (select 1 from public.contact_requests where organization_id = new.organization_id
               and athlete_id = new.athlete_id and status = 'blocked') then
      raise exception 'blocked_by_athlete' using errcode = '42501';
    end if;
    -- Cumplimiento NCAA: una universidad D-I/D-II no inicia contacto antes de la ventana de su deporte.
    if exists (
      select 1
      from public.organizations o
      join public.athlete_profiles ap on ap.user_id = new.athlete_id
      where o.id = new.organization_id
        and o.type in ('university', 'college')
        and public.ncaa_contact_opens_on(ap.graduation_year, o.division, ap.sport_id) > current_date
    ) then
      raise exception 'ncaa_contact_window_closed' using errcode = 'P0001';
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
  elsif old.status in ('accepted', 'declined') and (v_uid = new.athlete_id or (new.is_minor_at_request and v_is_guardian)) and new.status = 'blocked' then
    new.responded_at := now();
  else
    raise exception 'contact_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
