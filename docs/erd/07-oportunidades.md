<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 07 · Oportunidades, candidaturas y trials

Tablas: **8** · RLS activada en 8/8.
Se relaciona con: `athlete_profiles` (03), `organizations` (05), `profiles` (01), `recruiting_needs` (09), `sports` (04).

## AS-IS · Modelo actual

```mermaid
erDiagram
  APPLICATIONS ||--o{ APPLICATION_NOTES : "application_id"
  PROFILES |o--o{ APPLICATION_NOTES : "author_id"
  APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : "application_id"
  PROFILES |o--o{ APPLICATION_STATUS_HISTORY : "changed_by"
  ATHLETE_PROFILES ||--o{ APPLICATIONS : "athlete_id"
  OPPORTUNITIES ||--o{ APPLICATIONS : "opportunity_id"
  PROFILES |o--o{ OPPORTUNITIES : "created_by"
  RECRUITING_NEEDS |o--o{ OPPORTUNITIES : "need_id"
  ORGANIZATIONS ||--o{ OPPORTUNITIES : "organization_id"
  PROFILES |o--o{ OPPORTUNITIES : "reviewed_by"
  SPORTS ||--o{ OPPORTUNITIES : "sport_id"
  OPPORTUNITIES ||--o{ OPPORTUNITY_EVENT_DETAILS : "opportunity_id"
  PROFILES |o--o{ OPPORTUNITY_QUESTIONS : "answered_by"
  PROFILES |o--o{ OPPORTUNITY_QUESTIONS : "asker_id"
  OPPORTUNITIES ||--o{ OPPORTUNITY_QUESTIONS : "opportunity_id"
  PROFILES |o--o{ TRIAL_REGISTRATION_EVENTS : "actor_id"
  TRIAL_REGISTRATIONS ||--o{ TRIAL_REGISTRATION_EVENTS : "registration_id"
  ORGANIZATIONS |o--o{ TRIAL_REGISTRATIONS : "agency_id"
  ATHLETE_PROFILES ||--o{ TRIAL_REGISTRATIONS : "athlete_id"
  PROFILES |o--o{ TRIAL_REGISTRATIONS : "created_by"
  OPPORTUNITIES ||--o{ TRIAL_REGISTRATIONS : "opportunity_id"
  ORGANIZATIONS ||--o{ TRIAL_REGISTRATIONS : "organization_id"
  APPLICATION_NOTES {
    uuid id PK
    uuid application_id FK
    uuid author_id FK
    text body
    timestamptz created_at
  }
  APPLICATION_STATUS_HISTORY {
    int8 id PK
    uuid application_id FK
    application_status old_status
    application_status new_status
    uuid changed_by FK
    timestamptz created_at
  }
  APPLICATIONS {
    uuid id PK
    uuid opportunity_id FK
    uuid athlete_id FK
    application_status status
    text athlete_message
    timestamptz created_at
    timestamptz updated_at
  }
  OPPORTUNITIES {
    uuid id PK
    uuid organization_id FK
    uuid created_by FK
    opportunity_type type
    text title
    text description
    text sport_id FK
    int4_array position_ids
    int4_array graduation_years
    division division
    numeric min_gpa_4
    text english_required
    text location
    text start_term
    date deadline
    int4 places
    int4 annual_cost_usd
    int4 aid_amount_usd
    text aid_kind
    text financial_source
    opportunity_status status
    text review_note
    uuid reviewed_by FK
    timestamptz published_at
    timestamptz created_at
    timestamptz updated_at
    bool is_reviewed
    timestamptz last_confirmed_at
    text scholarship_status
    text_array required_materials
    text international_eligible
    uuid need_id FK
    date expires_at
    text contact_method
  }
  OPPORTUNITY_EVENT_DETAILS {
    uuid opportunity_id PK,FK
    text age_category
    int2 age_min
    int2 age_max
    bpchar country
    text region
    text city
    text venue
    date event_start_date
    date event_end_date
    time start_time_local
    text timezone
    int2 duration_days
    int4 capacity
    text fee_type
    numeric fee_amount
    bpchar currency
    text_array fee_includes
    text refundable
    text refund_details
    jsonb extra_costs
    text accommodation
    text meals
    text travel
    text education_support
    text program_schedule
    text video_requirements
    text minor_policy
    timestamptz updated_at
  }
  OPPORTUNITY_QUESTIONS {
    uuid id PK
    uuid opportunity_id FK
    uuid asker_id FK
    text body
    text answer
    uuid answered_by FK
    timestamptz answered_at
    timestamptz created_at
  }
  TRIAL_REGISTRATION_EVENTS {
    int8 id PK
    uuid registration_id FK
    uuid actor_id FK
    text actor_kind
    text from_status
    text to_status
    text detail
    timestamptz created_at
  }
  TRIAL_REGISTRATIONS {
    uuid id PK
    uuid opportunity_id FK
    uuid organization_id FK
    uuid athlete_id FK
    text status
    text outcome
    text origin
    uuid agency_id FK
    uuid created_by FK
    bool needs_athlete_ok
    text guardian_status
    timestamptz created_at
    timestamptz updated_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `application_notes` | Interna | — | persona (author_id) → se anonimiza | Mientras exista la organización | No: Dato interno de la organización sobre el atleta: lo exporta la organización, no el atleta | KEEP |
| `application_status_history` | Personal | — | persona (changed_by) → se anonimiza | Inmutable; se borra con la candidatura | Sí | KEEP |
| `applications` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `opportunities` | Pública | — | persona (created_by) → se anonimiza<br>organización (organization_id) → se borra<br>persona (reviewed_by) → se anonimiza | Mientras esté publicado o vigente | — | KEEP |
| `opportunity_event_details` | Pública | — | En cascada con `opportunities` | Mientras esté publicado o vigente | — | KEEP |
| `opportunity_questions` | Personal | — | persona (answered_by) → se anonimiza<br>persona (asker_id) → se anonimiza | Mientras exista la cuenta | No: Quién pregunta no es legible ni por el propio usuario (columnas restringidas) | KEEP |
| `trial_registration_events` | Interna | — | persona (actor_id) → se anonimiza | Mientras exista la organización | No: Historial de la inscripción; el estado se exporta en trial_registrations | KEEP |
| `trial_registrations` | Personal | Sí | organización (agency_id) → se anonimiza<br>atleta (athlete_id) → se borra<br>persona (created_by) → se anonimiza<br>organización (organization_id) → se borra | Mientras exista la cuenta | Sí | KEEP |

- `application_status_history`: Se exporta dentro de applications.
- `opportunities`: Pública cuando está publicada; borrador interno.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
