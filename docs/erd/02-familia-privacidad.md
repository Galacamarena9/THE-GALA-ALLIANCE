<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 02 · Familia, consentimiento y privacidad

Tablas: **8** · RLS activada en 8/8.
Se relaciona con: `athlete_offers` (08), `athlete_profiles` (03), `institutions` (05), `opportunities` (07), `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  PROFILES |o--o{ CONSENTS : "guardian_id"
  ORGANIZATIONS |o--o{ CONSENTS : "organization_id"
  PROFILES ||--o{ CONSENTS : "user_id"
  PROFILES |o--o{ COOKIE_CONSENT_LOGS : "user_id"
  PROFILES ||--o{ DATA_SUBJECT_REQUESTS : "user_id"
  ATHLETE_PROFILES ||--o{ FAMILY_COST_SCENARIOS : "athlete_id"
  PROFILES |o--o{ FAMILY_COST_SCENARIOS : "created_by"
  INSTITUTIONS |o--o{ FAMILY_COST_SCENARIOS : "institution_id"
  ATHLETE_OFFERS |o--o{ FAMILY_COST_SCENARIOS : "offer_id"
  OPPORTUNITIES |o--o{ FAMILY_COST_SCENARIOS : "opportunity_id"
  ATHLETE_PROFILES ||--o{ FAMILY_NOTES : "athlete_id"
  PROFILES ||--o{ FAMILY_NOTES : "author_id"
  PROFILES ||--o{ GUARDIAN_ATTESTATIONS : "athlete_id"
  PARENT_ATHLETE_LINKS ||--o{ GUARDIAN_ATTESTATIONS : "link_id"
  PROFILES ||--o{ GUARDIAN_ATTESTATIONS : "parent_id"
  PROFILES |o--o{ PARENT_ATHLETE_LINKS : "athlete_id"
  PROFILES ||--o{ PARENT_ATHLETE_LINKS : "invited_by"
  PROFILES |o--o{ PARENT_ATHLETE_LINKS : "parent_id"
  PROFILES |o--o{ PARENT_ATHLETE_LINKS : "verified_by"
  CONSENTS {
    uuid id PK
    uuid user_id FK
    text purpose
    text document_version
    bool granted
    uuid guardian_id FK
    timestamptz created_at
    text target_type
    uuid target_id
    uuid organization_id FK
    text scope
    timestamptz expires_at
  }
  COOKIE_CONSENT_LOGS {
    uuid id PK
    uuid user_id FK
    text anonymous_id
    bool essential_allowed
    bool analytics_allowed
    bool functional_allowed
    bool third_party_allowed
    text user_agent
    text ip_hash
    timestamptz created_at
  }
  DATA_SUBJECT_REQUESTS {
    uuid id PK
    uuid user_id FK
    text request_type
    text details
    text status
    timestamptz resolved_at
    timestamptz created_at
  }
  FAMILY_COST_SCENARIOS {
    uuid id PK
    uuid athlete_id FK
    uuid created_by FK
    text label
    uuid institution_id FK
    uuid opportunity_id FK
    uuid offer_id FK
    text currency
    int4 tuition
    int4 fees
    int4 housing
    int4 meals
    int4 insurance
    int4 travel
    int4 other_costs
    int4 athletic_aid
    int4 academic_aid
    int4 other_aid
    bool housing_included
    text source_note
    timestamptz created_at
    timestamptz updated_at
  }
  FAMILY_NOTES {
    uuid id PK
    uuid athlete_id FK
    uuid author_id FK
    text visibility
    text body
    text context_type
    uuid context_id
    timestamptz created_at
  }
  FAMILY_POLICIES {
    text jurisdiction PK
    int4 review_window_days
    timestamptz updated_at
  }
  GUARDIAN_ATTESTATIONS {
    uuid id PK
    uuid link_id FK
    uuid parent_id FK
    uuid athlete_id FK
    text statement_version
    text relationship
    timestamptz created_at
  }
  PARENT_ATHLETE_LINKS {
    uuid id PK
    uuid parent_id FK
    uuid athlete_id FK
    uuid invited_by FK
    text invitation_token
    link_status status
    text relationship
    bool can_view_profile
    bool can_edit_profile
    bool can_view_applications
    bool can_view_academics
    bool guardian_consent_given
    timestamptz expires_at
    timestamptz approved_at
    timestamptz revoked_at
    timestamptz created_at
    text verification_status
    timestamptz verified_at
    uuid verified_by FK
    timestamptz restricted_at
    text restriction_reason
    timestamptz last_reviewed_at
    bool can_view_costs
    bool can_view_documents
    bool can_view_contacts
    bool can_view_messages
    bool can_view_budget
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `consents` | Sensible | Sí | persona (guardian_id) → se anonimiza<br>organización (organization_id) → se anonimiza<br>persona (user_id) → se borra | Inmutable; se borra con la persona, el tutor se anonimiza | Sí | KEEP |
| `cookie_consent_logs` | Personal | — | persona (user_id) → se anonimiza | Inmutable; se anonimiza al borrar la cuenta | No: Registro técnico de cookies del navegador; solo lectura de Gala | KEEP |
| `data_subject_requests` | Personal | — | persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `family_cost_scenarios` | Sensible | Sí | atleta (athlete_id) → se borra<br>persona (created_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `family_notes` | Sensible | Sí | atleta (athlete_id) → se borra<br>persona (author_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `family_policies` | Interna | — | No depende de personas | Mientras exista la organización | — | KEEP |
| `guardian_attestations` | Sensible | Sí | persona (athlete_id) → se borra<br>persona (parent_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `parent_athlete_links` | Sensible | Sí | persona (athlete_id) → se borra<br>persona (invited_by) → se borra<br>persona (parent_id) → se borra<br>persona (verified_by) → se anonimiza | Invitaciones pendientes: 90 días tras caducar | Sí | KEEP |

- `family_cost_scenarios`: Cálculo privado de coste por opción; NULL = desconocido.
- `family_notes`: Notas privadas de la familia; nunca visibles para organizaciones.
- `family_policies`: Política familiar configurable por jurisdicción (ventana de revisión al cumplir 18).
- `guardian_attestations`: Declaración firmada del tutor (versionada, solo añadir); prueba para decidir por un menor.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
