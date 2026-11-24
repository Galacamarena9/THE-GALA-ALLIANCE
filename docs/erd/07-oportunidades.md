<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 07 · Oportunidades, candidaturas y trials

Tablas: **5** · RLS activada en 5/5.
Se relaciona con: `age_categories` (04), `athlete_profiles` (03), `opportunity_invitations` (14), `org_programs` (05), `org_teams` (14), `organizations` (05), `profiles` (01), `recruiting_needs` (09), `sports` (04), `sports_seasons` (04).

## AS-IS · Modelo actual

```mermaid
erDiagram
  APPLICATIONS ||--o{ APPLICATION_NOTES : "application_id"
  PROFILES |o--o{ APPLICATION_NOTES : "author_id"
  APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : "application_id"
  PROFILES |o--o{ APPLICATION_STATUS_HISTORY : "changed_by"
  ATHLETE_PROFILES ||--o{ APPLICATIONS : "athlete_id"
  PROFILES |o--o{ APPLICATIONS : "decided_by"
  OPPORTUNITY_INVITATIONS |o--o{ APPLICATIONS : "invitation_id"
  OPPORTUNITIES ||--o{ APPLICATIONS : "opportunity_id"
  ORGANIZATIONS ||--o{ APPLICATIONS : "organization_id"
  AGE_CATEGORIES |o--o{ OPPORTUNITIES : "age_category_code"
  PROFILES |o--o{ OPPORTUNITIES : "created_by"
  PROFILES |o--o{ OPPORTUNITIES : "moderated_by"
  RECRUITING_NEEDS |o--o{ OPPORTUNITIES : "need_id"
  ORGANIZATIONS ||--o{ OPPORTUNITIES : "organization_id"
  ORG_PROGRAMS |o--o{ OPPORTUNITIES : "program_id"
  PROFILES |o--o{ OPPORTUNITIES : "reviewed_by"
  SPORTS_SEASONS |o--o{ OPPORTUNITIES : "season_id"
  SPORTS ||--o{ OPPORTUNITIES : "sport_id"
  ORG_TEAMS |o--o{ OPPORTUNITIES : "team_id"
  PROFILES |o--o{ OPPORTUNITIES : "updated_by"
  PROFILES |o--o{ OPPORTUNITY_QUESTIONS : "answered_by"
  PROFILES |o--o{ OPPORTUNITY_QUESTIONS : "asker_id"
  OPPORTUNITIES ||--o{ OPPORTUNITY_QUESTIONS : "opportunity_id"
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
    uuid organization_id FK
    text source
    timestamptz submitted_at
    text guardian_consent_status
    bool materials_complete
    uuid invitation_id FK
    timestamptz decided_at
    uuid decided_by FK
    text decision_message
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
    uuid program_id FK
    uuid team_id FK
    text season_id FK
    text age_category_code FK
    text age_category_custom
    timestamptz start_at
    timestamptz end_at
    text timezone
    bpchar country
    text region
    text city
    text venue_name
    text address
    text postal_code
    numeric latitude
    numeric longitude
    text visibility
    text moderation_status
    text moderation_reason
    uuid moderated_by FK
    timestamptz moderated_at
    uuid updated_by FK
    text source
    timestamptz archived_at
    text international_conditions
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
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `application_notes` | Interna | — | persona (author_id) → se anonimiza | Mientras exista la organización | No: Dato interno de la organización sobre el atleta: lo exporta la organización, no el atleta | KEEP |
| `application_status_history` | Personal | — | persona (changed_by) → se anonimiza | Inmutable; se borra con la candidatura | Sí | KEEP |
| `applications` | Personal | Sí | atleta (athlete_id) → se borra<br>persona (decided_by) → se anonimiza<br>organización (organization_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `opportunities` | Pública | — | persona (created_by) → se anonimiza<br>persona (moderated_by) → se anonimiza<br>organización (organization_id) → se borra<br>persona (reviewed_by) → se anonimiza<br>persona (updated_by) → se anonimiza | Mientras esté publicado o vigente | — | KEEP |
| `opportunity_questions` | Personal | — | persona (answered_by) → se anonimiza<br>persona (asker_id) → se anonimiza | Mientras exista la cuenta | No: Quién pregunta no es legible ni por el propio usuario (columnas restringidas) | KEEP |

- `application_status_history`: Se exporta dentro de applications.
- `opportunities`: Pública cuando está publicada; borrador interno.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
