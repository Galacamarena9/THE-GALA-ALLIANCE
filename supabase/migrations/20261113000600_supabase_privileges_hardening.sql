-- =============================================================================
-- Endurecimiento para Supabase
-- Supabase concede por defecto EXECUTE de las funciones nuevas a anon y authenticated
-- (no solo a PUBLIC). Las funciones internas no deben poder llamarse por RPC:
--   - notify(): permitiría crear notificaciones falsas a cualquier usuario.
--   - funciones de trigger y de solo administración: se retiran a anon y, si no hacen falta, a authenticated.
-- =============================================================================
revoke execute on function public.notify(uuid, text, text, text, text) from anon, authenticated;

revoke execute on function
  public.handle_new_user(), public.handle_new_organization(), public.set_updated_at(), public.forbid_mutation(),
  public.guard_family_link(), public.guard_org_verification(), public.guard_opportunity_status(),
  public.guard_application(), public.log_application_status(),
  public.audit_organization_verification(), public.audit_opportunity_status(), public.audit_campaign_status(),
  public.guard_agent_representation(), public.guard_brand_campaign(), public.guard_campaign_application(),
  public.guard_institution(), public.guard_org_institution(), public.guard_content_report(),
  public.guard_contact_request(), public.guard_contact_message(), public.guard_news_post(),
  public.guard_academy_attempt(), public.guard_saved_search(), public.guard_athlete_update(),
  public.guard_notification_update(), public.guard_service_request(),
  public.notify_contact_request(), public.notify_application_status(), public.notify_org_verification()
from anon, authenticated;

-- Funciones que exigen sesión: nunca para anónimos.
revoke execute on function
  public.accept_family_invitation(text), public.accept_organization_invitation(text),
  public.consume_ai_request(), public.admin_metrics(int), public.admin_liquidity(),
  public.admin_read_thread(uuid, uuid)
from anon;

-- search_path fijo en las funciones de trigger sin SECURITY DEFINER (advisor 0011).
alter function public.set_updated_at() set search_path = public;
alter function public.forbid_mutation() set search_path = public;
alter function public.guard_notification_update() set search_path = public;

-- Revisado y aceptado (advisors 0028/0029): has_role, is_admin, is_minor, has_family_link, is_org_member,
-- is_verified_recruiter, can_view_athlete, has_connection_with_athlete, application_org, campaign_org,
-- is_blocked_by_athlete e is_contact_participant deben poder ejecutarse con el rol de quien consulta porque
-- las políticas RLS las invocan; solo responden sobre el propio usuario o devuelven identificadores sin datos
-- personales. Las previsualizaciones de invitación requieren el token secreto.
