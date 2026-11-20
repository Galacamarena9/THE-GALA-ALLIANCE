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
  | 'document_requested' | 'document_shared' | 'offer_created' | 'coach_dashboard_viewed' | 'candidates_exported'
  | 'trial_applied' | 'trial_viewed' | 'agent_trials_viewed'
  | 'athlete_search_performed' | 'athlete_search_saved' | 'athlete_promoted_to_pipeline' | 'verification_requested'
  | 'athlete_quick_view' | 'highlight_played' | 'note_added'
  | 'trial_saved' | 'trial_invitation_viewed' | 'trial_invitation_sent' | 'trial_registered' | 'trial_checked_in'
  | 'academy_program_viewed' | 'academy_program_applied' | 'recruiting_process_started'
  | 'trial_mobile_viewed' | 'trial_invitation_opened' | 'trial_consent_reviewed' | 'trial_consent_approved' | 'mobile_discovery_search' | 'scout_note_added';

export async function logEvent(event: FunnelEvent, props: Record<string, string | number | boolean> = {}) {
  try {
    const supabase = await createClient();
    await supabase.rpc('log_event', { p_event: event, p_props: props });
  } catch {
    // La medición nunca bloquea al usuario.
  }
}
