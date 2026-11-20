// Catálogo de datos de The Gala Alliance: fuente única para el ERD (docs/erd), docs/DATA_ARCHITECTURE.md y el check de CI.
// Cada tabla creada en supabase/migrations DEBE aparecer aquí (lo comprueba `npm run check:erd`).
//
// cls      → clasificación: public · internal · personal · sensitive (ver DATA_ARCHITECTURE.md §3)
// minors   → puede contener datos de menores
// decision → KEEP · MERGE → destino · RENAME → nombre · DEPRECATE · REVIEW (ver §5)
// export   → true si sale en la descarga RGPD (/app/settings/export); si no, `noExport` explica por qué
// retention→ cuánto se conserva (por defecto: mientras exista su cuenta u organización)

export const DOMAINS = {
  '01-identidad': 'Identidad y cuentas',
  '02-familia-privacidad': 'Familia, consentimiento y privacidad',
  '03-passport': 'Passport del atleta',
  '04-catalogo': 'Catálogo deportivo y eventos',
  '05-organizaciones': 'Instituciones y organizaciones',
  '06-verificacion': 'Verificación',
  '07-oportunidades': 'Oportunidades, candidaturas y trials',
  '08-pipeline-atleta': 'Pipeline del atleta y Gala Match',
  '09-recruiting-staff': 'Discovery, shortlists y pipeline del staff',
  '10-agencias-clubes': 'Agencias y clubes',
  '11-comunicacion': 'Comunicación, avisos y seguridad',
  '12-marcas-negocio': 'Marcas y negocio',
  '13-ia-analitica': 'IA, academia, analítica y auditoría',
};

const ACCOUNT = 'Mientras exista la cuenta';
const ORG = 'Mientras exista la organización';
const NO_ORG_DATA = 'Dato interno de la organización sobre el atleta: lo exporta la organización, no el atleta';

export const TABLES = {
  // 01 · Identidad
  profiles: { domain: '01-identidad', cls: 'personal', decision: 'KEEP', export: true, note: '1:1 con auth.users. Nombre visible y avatar.' },
  private_profile_data: { domain: '01-identidad', cls: 'sensitive', minors: true, decision: 'KEEP', export: true, note: 'Fecha de nacimiento y datos que nunca se muestran.' },
  user_roles: { domain: '01-identidad', cls: 'personal', decision: 'KEEP', export: true },
  user_blocks: { domain: '01-identidad', cls: 'personal', decision: 'KEEP', export: true },
  notification_preferences: { domain: '01-identidad', cls: 'personal', decision: 'KEEP', export: true },
  entitlements: { domain: '01-identidad', cls: 'personal', decision: 'KEEP', export: true, note: 'Planes contratados (Stripe).' },

  // 02 · Familia y privacidad
  parent_athlete_links: { domain: '02-familia-privacidad', cls: 'sensitive', minors: true, decision: 'KEEP', export: true, retention: 'Invitaciones pendientes: 90 días tras caducar' },
  consents: { domain: '02-familia-privacidad', cls: 'sensitive', minors: true, decision: 'KEEP', export: true, retention: 'Inmutable; se borra con la persona, el tutor se anonimiza' },
  cookie_consent_logs: { domain: '02-familia-privacidad', cls: 'personal', decision: 'KEEP', noExport: 'Registro técnico de cookies del navegador; solo lectura de Gala', retention: 'Inmutable; se anonimiza al borrar la cuenta' },
  data_subject_requests: { domain: '02-familia-privacidad', cls: 'personal', decision: 'KEEP', export: true },

  // 03 · Passport
  athlete_profiles: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_academics: { domain: '03-passport', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },
  athlete_finances: { domain: '03-passport', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },
  athlete_documents: { domain: '03-passport', cls: 'sensitive', minors: true, decision: 'KEEP', export: true, note: 'Exporta metadatos; los ficheros se descargan desde Documentos.' },
  athlete_statistics: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_achievements: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_career: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_goals: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_languages: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_links: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_videos: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_updates: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true, retention: '30 días tras caducar' },
  athlete_discovery_settings: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  passport_field_policies: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  passport_views: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', noExport: 'Sin acceso directo (RLS): el atleta ve el resumen agregado en su Passport' },
  recruiting_links: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true, note: 'El token no se exporta.' },
  recruiting_link_views: { domain: '03-passport', cls: 'internal', decision: 'KEEP', noExport: 'Contador técnico de visitas al enlace, sin datos del visitante' },

  // 04 · Catálogo
  sports: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  sport_positions: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  sport_stat_definitions: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  showcase_events: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  showcase_entries: { domain: '04-catalogo', cls: 'personal', minors: true, decision: 'KEEP', export: true },

  // 05 · Organizaciones
  institutions: { domain: '05-organizaciones', cls: 'public', decision: 'KEEP', note: 'Catálogo de universidades reales (importado). No es una cuenta.' },
  institution_programs: { domain: '05-organizaciones', cls: 'public', decision: 'KEEP', note: 'Programas deportivos del catálogo.' },
  organizations: { domain: '05-organizaciones', cls: 'internal', decision: 'KEEP', note: 'La cuenta (tenant) de universidad, club, agencia o marca. Enlaza a institutions.' },
  organization_domains: { domain: '05-organizaciones', cls: 'internal', decision: 'KEEP' },
  organization_members: { domain: '05-organizaciones', cls: 'personal', decision: 'KEEP', export: true },
  organization_membership_records: { domain: '05-organizaciones', cls: 'internal', decision: 'KEEP', noExport: 'Historial de la organización (altas, suspensiones)' },
  organization_invitations: { domain: '05-organizaciones', cls: 'personal', decision: 'KEEP', noExport: 'Invitación emitida por la organización', retention: '90 días tras caducar si no se acepta' },
  org_programs: { domain: '05-organizaciones', cls: 'internal', decision: 'KEEP', note: 'Programa dentro de la organización; enlaza a institution_programs.' },
  program_memberships: { domain: '05-organizaciones', cls: 'personal', decision: 'KEEP', export: true },

  // 06 · Verificación
  verification_requests: { domain: '06-verificacion', cls: 'sensitive', decision: 'KEEP', export: true },
  verification_checks: { domain: '06-verificacion', cls: 'internal', decision: 'KEEP', noExport: 'Comprobaciones internas de Gala sobre la solicitud' },
  verification_evidence: { domain: '06-verificacion', cls: 'sensitive', decision: 'KEEP', noExport: 'Se consulta en /app/verify; ficheros privados en Storage' },
  verification_decisions: { domain: '06-verificacion', cls: 'internal', decision: 'KEEP', noExport: 'Decisión de Gala; el estado resultante se exporta en verification_requests', retention: 'Inmutable; el revisor se anonimiza' },
  email_verifications: { domain: '06-verificacion', cls: 'personal', decision: 'KEEP', export: true, note: 'El hash del token no se exporta.' },
  institution_claims: { domain: '06-verificacion', cls: 'personal', decision: 'MERGE → verification_requests (tipo institution_claim)', export: true },

  // 07 · Oportunidades
  opportunities: { domain: '07-oportunidades', cls: 'public', decision: 'KEEP', note: 'Pública cuando está publicada; borrador interno.' },
  opportunity_questions: { domain: '07-oportunidades', cls: 'personal', decision: 'KEEP', noExport: 'Quién pregunta no es legible ni por el propio usuario (columnas restringidas)' },
  opportunity_event_details: { domain: '07-oportunidades', cls: 'public', decision: 'KEEP' },
  applications: { domain: '07-oportunidades', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  application_notes: { domain: '07-oportunidades', cls: 'internal', decision: 'KEEP', noExport: NO_ORG_DATA },
  application_status_history: { domain: '07-oportunidades', cls: 'personal', decision: 'KEEP', export: true, note: 'Se exporta dentro de applications.', retention: 'Inmutable; se borra con la candidatura' },
  trial_registrations: { domain: '07-oportunidades', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  trial_registration_events: { domain: '07-oportunidades', cls: 'internal', decision: 'KEEP', noExport: 'Historial de la inscripción; el estado se exporta en trial_registrations' },

  // 08 · Pipeline del atleta
  saved_items: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'RENAME → athlete_processes (diferido)', export: true, note: 'Es el proceso del atleta, no un «guardado».' },
  match_signals: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  pipeline_events: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  pipeline_tasks: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  pipeline_contacts: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  process_documents: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_task_state: { domain: '08-pipeline-atleta', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  athlete_offers: { domain: '08-pipeline-atleta', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },

  // 09 · Recruiting del staff
  recruiting_needs: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_candidates: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', noExport: NO_ORG_DATA },
  org_shortlists: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_shortlist_members: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', noExport: NO_ORG_DATA },
  shortlist_access: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_labels: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_shortlist_member_labels: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_notes: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', noExport: NO_ORG_DATA },
  org_tasks: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_activity: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', retention: 'Inmutable; se anonimiza o se borra con la organización' },
  org_assignment_log: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  org_saved_searches: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  discovery_usage: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', export: true },
  saved_athletes: { domain: '09-recruiting-staff', cls: 'personal', decision: 'MERGE → org_shortlists privadas', export: true, note: 'Listas personales anteriores a las shortlists.' },
  saved_searches: { domain: '09-recruiting-staff', cls: 'personal', decision: 'MERGE → org_saved_searches (solo para staff)', export: true },

  // 10 · Agencias y clubes
  agent_representations: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },
  agency_contacts: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP' },
  agency_athlete_notes: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP', noExport: 'Nota interna de la agencia sobre el atleta' },
  recruiting_cases: { domain: '10-agencias-clubes', cls: 'internal', minors: true, decision: 'KEEP', noExport: 'Caso interno de la agencia' },
  recruiting_case_tasks: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP' },
  recruiting_case_activities: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP' },
  club_roster: { domain: '10-agencias-clubes', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  club_roster_invites: { domain: '10-agencias-clubes', cls: 'internal', decision: 'MERGE → organization_invitations (tipo roster)', retention: '90 días tras caducar' },
  club_recommendations: { domain: '10-agencias-clubes', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  news_posts: { domain: '10-agencias-clubes', cls: 'public', decision: 'KEEP' },

  // 11 · Comunicación
  contact_requests: { domain: '11-comunicacion', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  contact_messages: { domain: '11-comunicacion', cls: 'personal', minors: true, decision: 'KEEP', export: true, retention: 'Inmutable; se borra con la conversación o la cuenta' },
  info_requests: { domain: '11-comunicacion', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  notifications: { domain: '11-comunicacion', cls: 'personal', decision: 'KEEP', export: true, retention: 'Leídas: 6 meses · todas: 12 meses' },
  content_reports: { domain: '11-comunicacion', cls: 'sensitive', decision: 'KEEP', noExport: 'Denuncias: protegen a quien denuncia y a quien es denunciado' },
  user_feedback: { domain: '11-comunicacion', cls: 'personal', decision: 'KEEP', export: true, retention: '24 meses' },

  // 12 · Marcas y negocio
  brand_campaigns: { domain: '12-marcas-negocio', cls: 'public', decision: 'KEEP' },
  campaign_applications: { domain: '12-marcas-negocio', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  service_requests: { domain: '12-marcas-negocio', cls: 'personal', decision: 'KEEP', export: true },

  // 13 · IA, academia, analítica y auditoría
  ai_conversations: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true, retention: '90 días sin actividad; se borra al desactivar el historial' },
  ai_messages: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true, retention: 'Con su conversación' },
  ai_preferences: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true },
  ai_events: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Telemetría técnica sin contenido de las preguntas', retention: '13 meses' },
  ai_feedback: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true },
  ai_usage: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', export: true, retention: '90 días' },
  academy_progress: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true },
  academy_attempts: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true },
  product_events: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true, retention: '13 meses' },
  audit_logs: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Registro de seguridad de Gala', retention: 'Inmutable; se anonimiza al borrar la cuenta' },
};

export const DEFAULT_RETENTION = { personal: ACCOUNT, sensitive: ACCOUNT, internal: ORG, public: 'Mientras esté publicado o vigente' };
