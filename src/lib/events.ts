import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Eventos del embudo (lista cerrada en la BD, ver docs/ANALYTICS_EVENTS.md). Nunca rompe el flujo si falla. */
export type FunnelEvent =
  | 'signup_completed' | 'onboarding_completed' | 'passport_saved' | 'opportunity_viewed' | 'application_submitted'
  | 'contact_requested' | 'contact_accepted' | 'search_saved' | 'plan_requested' | 'academy_attempt'
  | 'document_uploaded' | 'roster_joined' | 'universities_compared'
  | 'passport_completed' | 'passport_shared' | 'video_uploaded' | 'university_viewed' | 'university_saved'
  | 'match_viewed' | 'opportunity_saved' | 'comparison_created' | 'task_completed' | 'dashboard_viewed'
  | 'pipeline_stage_changed' | 'interaction_logged' | 'offer_recorded' | 'pipeline_decision'
  | 'recruiting_need_created' | 'athlete_discovered' | 'athlete_shortlisted' | 'candidate_assigned' | 'candidate_stage_changed'
  | 'document_requested' | 'document_shared' | 'offer_created' | 'coach_dashboard_viewed' | 'candidates_exported';

export async function logEvent(event: FunnelEvent, props: Record<string, string | number | boolean> = {}) {
  try {
    const supabase = await createClient();
    await supabase.rpc('log_event', { p_event: event, p_props: props });
  } catch {
    // La medición nunca bloquea al usuario.
  }
}
