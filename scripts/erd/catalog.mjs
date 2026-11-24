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
  '14-clubs-academias': 'Clubs & Academies: trials, programas y participación',
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
  plan_catalog: { domain: '12-marcas-negocio', cls: 'public', decision: 'KEEP', note: 'Catálogo versionado: los límites salen de aquí, no del código.' },
  billing_accounts: { domain: '12-marcas-negocio', cls: 'sensitive', decision: 'KEEP', export: true, note: 'Sin datos de tarjeta: solo el id de cliente de Stripe.' },
  subscriptions: { domain: '12-marcas-negocio', cls: 'sensitive', decision: 'KEEP', noExport: 'De la cuenta de facturación (persona u organización); la escribe solo el webhook' },
  seat_assignments: { domain: '12-marcas-negocio', cls: 'personal', decision: 'KEEP', export: true },
  stripe_events: { domain: '12-marcas-negocio', cls: 'internal', decision: 'KEEP', noExport: 'Idempotencia técnica del webhook' },
  billing_ledger: { domain: '12-marcas-negocio', cls: 'sensitive', decision: 'KEEP', noExport: 'Registro financiero de la cuenta; append-only', retention: 'Obligación fiscal (6 años)' },
  usage_counters: { domain: '12-marcas-negocio', cls: 'personal', decision: 'KEEP', export: true },
  entitlements: { domain: '01-identidad', cls: 'personal', decision: 'KEEP', export: true, note: 'Planes contratados (Stripe).' },

  // 02 · Familia y privacidad
  family_policies: { domain: '02-familia-privacidad', cls: 'internal', decision: 'KEEP', note: 'Política familiar configurable por jurisdicción (ventana de revisión al cumplir 18).' },
  family_notes: { domain: '02-familia-privacidad', cls: 'sensitive', minors: true, decision: 'KEEP', export: true, note: 'Notas privadas de la familia; nunca visibles para organizaciones.' },
  family_cost_scenarios: { domain: '02-familia-privacidad', cls: 'sensitive', minors: true, decision: 'KEEP', export: true, note: 'Cálculo privado de coste por opción; NULL = desconocido.' },
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
  document_access_grants: { domain: '03-passport', cls: 'sensitive', minors: true, decision: 'KEEP', noExport: 'Concesiones del atleta a organizaciones: visibles en Documentos; se exportarán con 11B', note: 'Acceso a un documento concreto, con propósito, contexto y caducidad.' },
  recruiting_links: { domain: '03-passport', cls: 'personal', minors: true, decision: 'KEEP', export: true, note: 'El token no se exporta.' },
  recruiting_link_views: { domain: '03-passport', cls: 'internal', decision: 'KEEP', noExport: 'Contador técnico de visitas al enlace, sin datos del visitante' },

  // 04 · Catálogo
  sports: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  sport_positions: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  sport_stat_definitions: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  showcase_events: { domain: '04-catalogo', cls: 'public', decision: 'KEEP' },
  sports_seasons: { domain: '04-catalogo', cls: 'public', decision: 'KEEP', note: 'Temporadas normalizadas («2027-28»).' },
  age_categories: { domain: '04-catalogo', cls: 'public', decision: 'KEEP', note: 'Categorías U14…First Team con regla de edad cuando existe.' },
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
  applications: { domain: '07-oportunidades', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  application_notes: { domain: '07-oportunidades', cls: 'internal', decision: 'KEEP', noExport: NO_ORG_DATA },
  application_status_history: { domain: '07-oportunidades', cls: 'personal', decision: 'KEEP', export: true, note: 'Se exporta dentro de applications.', retention: 'Inmutable; se borra con la candidatura' },

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
  org_assignment_log: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', note: 'Log inmutable: athlete_id, candidate_id y shortlist_id son referencias históricas sin FK (a propósito).' },
  org_saved_searches: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP' },
  discovery_usage: { domain: '09-recruiting-staff', cls: 'internal', decision: 'KEEP', export: true },
  saved_athletes: { domain: '09-recruiting-staff', cls: 'personal', decision: 'MERGE → org_shortlists privadas', export: true, note: 'Listas personales anteriores a las shortlists.' },
  saved_searches: { domain: '09-recruiting-staff', cls: 'personal', decision: 'MERGE → org_saved_searches (solo para staff)', export: true, note: 'Ampliada en el Prompt 4 (búsqueda de talento) pese a la decisión de fusión: fase B1 de ARCHITECTURE-AUDIT.md.' },

  // 10 · Agencias y clubes
  agent_representations: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },
  agency_contacts: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP' },
  representation_coverage: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: false, noExport: 'Se identifica por la representación, no por la persona; el alcance va en representations.', note: 'Alcance de la representación.' },
  representation_permissions: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: false, noExport: 'Hija de la representación; sin columna de persona.', note: 'Permisos concedidos por el atleta; historial conservado.' },
  representation_assignments: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },
  representation_agreements: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: false, noExport: 'El documento del acuerdo ya se exporta con los documentos del atleta.', note: 'Versiones del acuerdo.' },
  representation_conflicts: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP', export: false, note: 'Revisión operativa de Gala, no jurídica.' },
  representation_invitations: { domain: '10-agencias-clubes', cls: 'sensitive', minors: true, decision: 'KEEP', export: true },
  territory_regions: { domain: '10-agencias-clubes', cls: 'public', decision: 'KEEP', export: false, note: 'Catálogo de regiones (Europa, Norteamérica, Latam).' },
  professional_credentials: { domain: '10-agencias-clubes', cls: 'sensitive', decision: 'KEEP', export: true, note: 'Licencias del agente; el número nunca es público.' },
  agency_athlete_notes: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP', noExport: 'Nota interna de la agencia sobre el atleta' },
  agency_athlete_invites: { domain: '10-agencias-clubes', cls: 'internal', minors: true, decision: 'KEEP', noExport: 'Invitación de la agencia a un atleta de su cartera (solo hash del enlace)' },
  recruiting_cases: { domain: '10-agencias-clubes', cls: 'internal', minors: true, decision: 'KEEP', noExport: 'Caso interno de la agencia' },
  recruiting_case_tasks: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP' },
  recruiting_case_activities: { domain: '10-agencias-clubes', cls: 'internal', decision: 'KEEP' },
  case_outreach: { domain: '10-agencias-clubes', cls: 'internal', minors: true, decision: 'KEEP', noExport: 'Email de la agencia a un coach desde un proceso (texto con marcador, sin el enlace)' },
  representation_fee_attestations: { domain: '10-agencias-clubes', cls: 'internal', minors: true, decision: 'KEEP', noExport: 'Declaración de tarifas de la agencia (append-only; el atleta la ve en la propuesta)' },
  club_roster: { domain: '10-agencias-clubes', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  club_roster_invites: { domain: '10-agencias-clubes', cls: 'internal', decision: 'MERGE → organization_invitations (tipo roster)', retention: '90 días tras caducar' },
  club_recommendations: { domain: '10-agencias-clubes', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  news_posts: { domain: '10-agencias-clubes', cls: 'public', decision: 'KEEP' },

  // 11 · Comunicación
  contact_requests: { domain: '11-comunicacion', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  contact_messages: { domain: '11-comunicacion', cls: 'personal', minors: true, decision: 'KEEP', export: true, retention: 'Inmutable; se borra con la conversación o la cuenta' },
  info_requests: { domain: '11-comunicacion', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  notifications: { domain: '11-comunicacion', cls: 'personal', decision: 'KEEP', export: true, retention: 'Leídas: 6 meses · todas: 12 meses' },
  outreach_contacts: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Lista interna de Operaciones: solo organizaciones con contacto público, no usuarios', note: 'Lista de difusión. Solo admins (RLS). Invitación única que pide permiso (LSSI art. 21).' },
  outreach_events: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Registro interno de Operaciones sobre organizaciones, no sobre usuarios', note: 'Historial de la lista de difusión.' },
  outreach_suppressions: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Solo el hash sha256 del correo dado de baja', retention: 'Indefinida: es la prueba de que no se debe volver a escribir', note: 'Lista de exclusión de la difusión.' },
  referral_codes: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true, note: 'Código de invitación (no para menores).' },
  referrals: { domain: '13-ia-analitica', cls: 'personal', decision: 'KEEP', export: true, note: 'Una atribución por persona; quien invita solo ve el número.' },
  metric_definitions: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', note: 'Definición escrita y versionada de cada métrica.' },
  feature_flags: { domain: '13-ia-analitica', cls: 'public', decision: 'KEEP', note: 'Interruptores de funcionalidad; no sustituyen permisos.' },
  support_cases: { domain: '11-comunicacion', cls: 'personal', decision: 'KEEP', export: true, note: 'Casos de soporte.' },
  support_case_notes: { domain: '11-comunicacion', cls: 'personal', decision: 'KEEP', noExport: 'Notas del equipo de Gala; las públicas se ven en la app' },
  admin_approvals: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Doble aprobación interna de Gala' },
  safety_cases: { domain: '11-comunicacion', cls: 'sensitive', decision: 'KEEP', noExport: 'Investigación interna de Trust & Safety', note: 'Caso que agrupa denuncias, pruebas y medidas.' },
  safety_case_events: { domain: '11-comunicacion', cls: 'sensitive', decision: 'KEEP', noExport: 'Línea de tiempo interna del caso' },
  moderation_actions: { domain: '11-comunicacion', cls: 'sensitive', decision: 'KEEP', export: true, note: 'Medidas proporcionales con ámbito y duración; la persona afectada las ve.' },
  moderation_appeals: { domain: '11-comunicacion', cls: 'sensitive', decision: 'KEEP', export: true },
  break_glass_grants: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Acceso de emergencia de Gala: auditoría interna' },
  admin_roles: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Roles internos de Gala' },
  rate_limit_events: { domain: '13-ia-analitica', cls: 'internal', decision: 'KEEP', noExport: 'Contadores técnicos anti-spam (7 días)', retention: '7 días' },
  content_reports: { domain: '11-comunicacion', cls: 'sensitive', decision: 'KEEP', noExport: 'Denuncias: protegen a quien denuncia y a quien es denunciado' },
  user_feedback: { domain: '11-comunicacion', cls: 'personal', decision: 'KEEP', export: true, retention: '24 meses' },

  // 12 · Marcas y negocio
  brand_campaigns: { domain: '12-marcas-negocio', cls: 'public', decision: 'KEEP' },
  campaign_applications: { domain: '12-marcas-negocio', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  campaign_offers: { domain: '12-marcas-negocio', cls: 'sensitive', decision: 'KEEP', export: true, note: 'Oferta inmutable; cambiarla crea versión nueva.' },
  campaign_offer_components: { domain: '12-marcas-negocio', cls: 'sensitive', decision: 'KEEP', export: false, noExport: 'Hija de la oferta (sin columna de persona); el titular la ve junto a su oferta en la app.', note: 'Producto ≠ dinero; bonus siempre condicionado.' },
  campaign_deliverables: { domain: '12-marcas-negocio', cls: 'personal', decision: 'KEEP', export: false, noExport: 'Lo define la marca; lo del atleta (sus entregas) se exporta en campaign_deliverable_submissions.', note: 'Entregables de la oferta.' },
  campaign_deliverable_submissions: { domain: '12-marcas-negocio', cls: 'personal', decision: 'KEEP', export: true, note: 'Versiones de cada entrega; nunca se sobrescriben.' },
  brand_application_notes: { domain: '12-marcas-negocio', cls: 'internal', decision: 'KEEP', export: false, note: 'Notas internas de la marca; nunca visibles para el atleta.' },
  service_requests: { domain: '12-marcas-negocio', cls: 'personal', decision: 'KEEP', export: true },

  // 14 · Clubs & Academies
  org_teams: { domain: '14-clubs-academias', cls: 'internal', decision: 'KEEP', note: 'Equipo dentro de un programa de la misma organización.' },
  trial_details: { domain: '14-clubs-academias', cls: 'public', decision: 'KEEP', note: 'Especialización 1:0..1 de una oportunidad de tipo trial (sustituye a opportunity_event_details).' },
  academy_program_details: { domain: '14-clubs-academias', cls: 'public', decision: 'KEEP', note: 'Especialización 1:0..1 de un programa de academia.' },
  opportunity_cost_components: { domain: '14-clubs-academias', cls: 'public', decision: 'KEEP', note: 'Todos los importes (obligatorios / opcionales / incluidos).' },
  opportunity_requirements: { domain: '14-clubs-academias', cls: 'public', decision: 'KEEP', note: 'Requisitos estructurados para Gala Match.' },
  opportunity_required_materials: { domain: '14-clubs-academias', cls: 'public', decision: 'KEEP', note: 'Sustituye progresivamente a opportunities.required_materials (array legado).' },
  opportunity_invitations: { domain: '14-clubs-academias', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  opportunity_registrations: { domain: '14-clubs-academias', cls: 'personal', minors: true, decision: 'KEEP', export: true, note: 'Antes trial_registrations (renombrada en 11A).' },
  opportunity_registration_events: { domain: '14-clubs-academias', cls: 'internal', decision: 'KEEP', noExport: 'Historial de la inscripción; el estado se exporta en opportunity_registrations' },
  opportunity_attendance: { domain: '14-clubs-academias', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  opportunity_outcomes: { domain: '14-clubs-academias', cls: 'internal', decision: 'KEEP', noExport: 'Resultado INTERNO del club; el atleta solo recibe el mensaje que el club comparte (opportunity_registrations.athlete_update)' },
  program_enrollments: { domain: '14-clubs-academias', cls: 'personal', minors: true, decision: 'KEEP', export: true },
  payment_requirements: { domain: '14-clubs-academias', cls: 'personal', decision: 'KEEP', export: true, note: 'Preparado para Stripe; sin datos bancarios.' },

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
