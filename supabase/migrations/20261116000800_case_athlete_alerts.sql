-- =============================================================================
-- Aviso al atleta sobre sus procesos de recruiting, SOLO si la agencia los comparte:
--   · al empezar a compartir un proceso;
--   · al cambiar de fase un proceso ya compartido.
-- Nunca se le avisa de notas, tareas ni próximas acciones (son internas de la agencia).
-- =============================================================================
create or replace function public.notify_case_athlete()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org text;
begin
  if not new.shared_with_athlete then
    return new;
  end if;
  select name into v_org from public.organizations where id = new.agency_id;
  if tg_op = 'UPDATE' and not old.shared_with_athlete then
    perform public.notify(new.athlete_id, 'case.shared',
      coalesce(v_org, 'Tu agencia') || ' comparte contigo tu proceso con ' || new.institution_name,
      'Verás la fase y cada cambio con su fecha.', '/app/agents');
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    perform public.notify(new.athlete_id, 'case.stage',
      new.institution_name || ': tu proceso ha avanzado',
      'Tu agencia ha actualizado la fase. Consulta el detalle.', '/app/agents');
  elsif tg_op = 'INSERT' then
    perform public.notify(new.athlete_id, 'case.shared',
      coalesce(v_org, 'Tu agencia') || ' comparte contigo tu proceso con ' || new.institution_name,
      'Verás la fase y cada cambio con su fecha.', '/app/agents');
  end if;
  return new;
end;
$$;
create or replace trigger notify_case_athlete after insert or update on public.recruiting_cases
  for each row execute function public.notify_case_athlete();

revoke execute on function public.notify_case_athlete() from public, anon, authenticated;
