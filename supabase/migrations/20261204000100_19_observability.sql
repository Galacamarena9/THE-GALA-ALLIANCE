-- =============================================================================================================
-- Prompt 19 · Observabilidad (criterio propio: el prompt no llegó). Señales de salud de la plataforma que no
-- dependen de un proveedor externo: colas atascadas, webhooks sin procesar, seguridad infantil sin atender,
-- interruptores apagados y jobs que fallan. Solo números agregados; ningún dato personal.
-- =============================================================================================================
create or replace function public.admin_platform_health()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'checked_at', now(),
    -- Seguridad infantil: objetivo de primera respuesta < 24 h.
    'child_safety_open', (select count(*) from public.content_reports where reason = 'child_safety' and status in ('open', 'reviewing')),
    'child_safety_oldest_hours', (select round(extract(epoch from now() - min(created_at)) / 3600) from public.content_reports where reason = 'child_safety' and status in ('open', 'reviewing')),
    'reports_open', (select count(*) from public.content_reports where status in ('open', 'reviewing')),
    'appeals_open_oldest_days', (select round(extract(epoch from now() - min(created_at)) / 86400) from public.moderation_appeals where status = 'open'),
    -- Verificación: objetivo < 72 h.
    'verifications_pending', (select count(*) from public.organizations where verification_status = 'submitted'),
    'support_open_oldest_hours', (select round(extract(epoch from now() - min(created_at)) / 3600) from public.support_cases where status = 'open'),
    -- Pagos: un evento de Stripe recibido y no procesado en 10 minutos es una alarma.
    'stripe_unprocessed', (select count(*) from public.stripe_events where processed_at is null and received_at < now() - interval '10 minutes'),
    'payments_disputed', (select count(*) from public.campaign_offers where payment_status = 'disputed'),
    'kill_switches_off', coalesce((select jsonb_agg(key) from public.feature_flags where not enabled), '[]'::jsonb),
    'break_glass_unreviewed', (select count(*) from public.break_glass_grants where reviewed_at is null and expires_at < now()),
    'representations_pending_review', (select count(*) from public.agent_representations where status = 'pending_review'),
    'cron_available', exists (select 1 from pg_extension where extname = 'pg_cron')
  ) into v;
  return v;
end;
$$;
revoke execute on function public.admin_platform_health() from public, anon;
grant execute on function public.admin_platform_health() to authenticated;
