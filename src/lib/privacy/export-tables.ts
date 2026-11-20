/**
 * Qué sale en la descarga RGPD (derecho de acceso y portabilidad).
 * Fuente única: el check de CI (`npm run check:erd`) exige que toda tabla marcada `export: true`
 * en scripts/erd/catalog.mjs esté aquí, y que las demás expliquen por qué no.
 * La consulta usa el cliente del usuario: la RLS sigue decidiendo qué puede ver de sí mismo.
 */
export type ExportSource = {
  key: string;
  table: string;
  /** Columna que identifica al titular (por defecto user_id). */
  column?: string;
  /** Columnas a exportar (por defecto todas): se omiten tokens, hashes y campos internos. */
  select?: string;
  /** Filtro alternativo cuando la persona puede estar en dos columnas. */
  either?: [string, string];
};

export const EXPORT_SOURCES: ExportSource[] = [
  // Identidad
  { key: 'profile', table: 'profiles', column: 'id' },
  { key: 'private_data', table: 'private_profile_data' },
  { key: 'roles', table: 'user_roles' },
  { key: 'blocked_users', table: 'user_blocks', column: 'blocker_id' },
  { key: 'notification_preferences', table: 'notification_preferences' },
  { key: 'plans', table: 'entitlements' },
  { key: 'professional_credentials', table: 'professional_credentials' },
  // Familia y privacidad
  { key: 'family_links', table: 'parent_athlete_links', select: 'id, parent_id, athlete_id, status, relationship, verification_status, verified_at, restricted_at, last_reviewed_at, can_view_profile, can_view_applications, can_view_academics, can_edit_profile, can_view_costs, can_view_budget, can_view_documents, can_view_contacts, can_view_messages, created_at, approved_at, revoked_at', either: ['parent_id', 'athlete_id'] },
  { key: 'family_notes', table: 'family_notes', column: 'author_id' },
  { key: 'family_cost_scenarios', table: 'family_cost_scenarios', column: 'athlete_id' },
  { key: 'consents', table: 'consents' },
  { key: 'data_requests', table: 'data_subject_requests' },
  // Passport
  { key: 'athlete_profile', table: 'athlete_profiles' },
  { key: 'academics', table: 'athlete_academics', column: 'athlete_id' },
  { key: 'finances', table: 'athlete_finances', column: 'athlete_id' },
  { key: 'documents', table: 'athlete_documents', column: 'athlete_id', select: 'id, kind, title, due_date, mime_type, size_bytes, uploaded_at, created_at' },
  { key: 'statistics', table: 'athlete_statistics', column: 'athlete_id' },
  { key: 'achievements', table: 'athlete_achievements', column: 'athlete_id' },
  { key: 'career', table: 'athlete_career', column: 'athlete_id' },
  { key: 'goals', table: 'athlete_goals', column: 'athlete_id' },
  { key: 'languages', table: 'athlete_languages', column: 'athlete_id' },
  { key: 'links', table: 'athlete_links', column: 'athlete_id' },
  { key: 'videos', table: 'athlete_videos', column: 'athlete_id' },
  { key: 'athlete_updates', table: 'athlete_updates', column: 'athlete_id' },
  { key: 'discovery_settings', table: 'athlete_discovery_settings', column: 'athlete_id' },
  { key: 'field_policies', table: 'passport_field_policies', column: 'athlete_id' },
  { key: 'recruiting_links', table: 'recruiting_links', column: 'athlete_id', select: 'id, label, expires_at, revoked_at, created_at' },
  { key: 'showcase_entries', table: 'showcase_entries', column: 'athlete_id' },
  // Organizaciones y verificación
  { key: 'memberships', table: 'organization_members' },
  { key: 'program_memberships', table: 'program_memberships' },
  { key: 'verification_requests', table: 'verification_requests', column: 'subject_user', select: 'id, organization_id, institution_id, program_id, verification_type, declared_role, status, submitted_at, reviewed_at, decision, decision_reason, expires_at, revoked_at, created_at' },
  { key: 'email_verifications', table: 'email_verifications', select: 'id, organization_id, email, email_domain, sent_at, token_expires_at, verified_at, result, revoked_at, created_at' },
  { key: 'institution_claims', table: 'institution_claims', select: 'id, institution_id, organization_id, work_email, role_title, status, reviewed_at, created_at' },
  // Oportunidades y pipeline del atleta (el historial de estados va dentro de cada candidatura)
  { key: 'applications', table: 'applications', column: 'athlete_id', select: '*, application_status_history(*)' },
  { key: 'trials', table: 'opportunity_registrations', column: 'athlete_id' },
  { key: 'trial_invitations', table: 'opportunity_invitations', column: 'athlete_id', select: 'id, opportunity_id, organization_id, status, message, sent_at, viewed_at, responded_at, expires_at' },
  { key: 'attendance', table: 'opportunity_attendance', column: 'athlete_id' },
  { key: 'program_enrollments', table: 'program_enrollments', column: 'athlete_id' },
  { key: 'payments', table: 'payment_requirements', column: 'athlete_id' },
  { key: 'processes', table: 'saved_items', column: 'athlete_id' },
  { key: 'match_signals', table: 'match_signals', column: 'athlete_id' },
  { key: 'process_events', table: 'pipeline_events', column: 'athlete_id' },
  { key: 'process_tasks', table: 'pipeline_tasks', column: 'athlete_id' },
  { key: 'process_contacts', table: 'pipeline_contacts', column: 'athlete_id' },
  { key: 'process_documents', table: 'process_documents', column: 'athlete_id' },
  { key: 'task_state', table: 'athlete_task_state', column: 'athlete_id' },
  { key: 'external_offers', table: 'athlete_offers', column: 'athlete_id' },
  // Staff (lo que es de la persona, no de su organización)
  { key: 'discovery_usage', table: 'discovery_usage' },
  { key: 'saved_athletes', table: 'saved_athletes', column: 'owner_id' },
  { key: 'saved_searches', table: 'saved_searches', column: 'owner_id' },
  // Agencias y clubes
  { key: 'representations', table: 'agent_representations', column: 'athlete_id' },
  { key: 'representation_invitations', table: 'representation_invitations', column: 'athlete_id' },
  { key: 'representation_assignments', table: 'representation_assignments', column: 'user_id' },
  { key: 'club_rosters', table: 'club_roster', column: 'athlete_id' },
  { key: 'club_recommendations', table: 'club_recommendations', column: 'athlete_id' },
  // Comunicación
  { key: 'contact_requests', table: 'contact_requests', column: 'athlete_id' },
  { key: 'messages_sent', table: 'contact_messages', column: 'sender_id' },
  { key: 'info_requests', table: 'info_requests', column: 'athlete_id' },
  { key: 'notifications', table: 'notifications' },
  { key: 'feedback', table: 'user_feedback' },
  // Marcas y negocio
  { key: 'campaign_applications', table: 'campaign_applications', column: 'athlete_id' },
  { key: 'service_requests', table: 'service_requests' },
  // IA, academia y analítica
  { key: 'ai_conversations', table: 'ai_conversations' },
  { key: 'ai_messages', table: 'ai_messages' },
  { key: 'ai_preferences', table: 'ai_preferences' },
  { key: 'ai_feedback', table: 'ai_feedback' },
  { key: 'ai_usage', table: 'ai_usage' },
  { key: 'academy_progress', table: 'academy_progress' },
  { key: 'academy_attempts', table: 'academy_attempts' },
  { key: 'product_events', table: 'product_events' },
];
