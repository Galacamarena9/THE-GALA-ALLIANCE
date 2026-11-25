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
  | 'trial_mobile_viewed' | 'trial_invitation_opened' | 'trial_consent_reviewed' | 'trial_consent_approved' | 'mobile_discovery_search' | 'scout_note_added'
  // 17 · flujos de 12-16
  | 'representation_requested' | 'representation_accepted' | 'representation_revoked' | 'agency_invited'
  | 'brand_offer_sent' | 'brand_offer_accepted' | 'deliverable_submitted' | 'collaborations_viewed'
  | 'trust_center_viewed' | 'support_case_opened' | 'subscription_started' | 'billing_viewed'
  // Prompt 5 · Inicio del agente
  | 'agent_home_viewed' | 'agent_attention_opened'
  // Ciclo 1 · importar cartera e invitar a reclamarla
  | 'athlete_invited' | 'invite_opened' | 'athlete_claimed'
  // Ciclo 2 · escribir a coaches y saber quién responde
  | 'coach_outreach_sent' | 'coach_reply_logged' | 'guardian_attested';

export async function logEvent(event: FunnelEvent, props: Record<string, string | number | boolean> = {}, dedupeKey?: string) {
  try {
    const supabase = await createClient();
    // Los eventos de menores se guardan sin propiedades (lo decide la base de datos). dedupeKey evita duplicados.
    await supabase.rpc('log_event', { p_event: event, p_props: props, p_dedupe: dedupeKey ?? null });
  } catch {
    // La medición nunca bloquea al usuario.
  }
}
