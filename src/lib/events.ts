import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Eventos del embudo (lista cerrada en la BD, ver docs/ANALYTICS_EVENTS.md). Nunca rompe el flujo si falla. */
export type FunnelEvent =
  | 'signup_completed' | 'onboarding_completed' | 'passport_saved' | 'opportunity_viewed' | 'application_submitted'
  | 'contact_requested' | 'contact_accepted' | 'search_saved' | 'plan_requested' | 'academy_attempt'
  | 'document_uploaded' | 'roster_joined' | 'universities_compared';

export async function logEvent(event: FunnelEvent, props: Record<string, string | number | boolean> = {}) {
  try {
    const supabase = await createClient();
    await supabase.rpc('log_event', { p_event: event, p_props: props });
  } catch {
    // La medición nunca bloquea al usuario.
  }
}
