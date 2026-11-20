<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 11 · Comunicación, avisos y seguridad

Tablas: **10** · RLS activada en 10/10.
Se relaciona con: `athlete_documents` (03), `athlete_profiles` (03), `auth_users`, `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  CONTACT_REQUESTS ||--o{ CONTACT_MESSAGES : "request_id"
  PROFILES ||--o{ CONTACT_MESSAGES : "sender_id"
  ATHLETE_PROFILES ||--o{ CONTACT_REQUESTS : "athlete_id"
  PROFILES |o--o{ CONTACT_REQUESTS : "guardian_approved_by"
  ORGANIZATIONS ||--o{ CONTACT_REQUESTS : "organization_id"
  PROFILES ||--o{ CONTACT_REQUESTS : "requested_by"
  SAFETY_CASES |o--o{ CONTENT_REPORTS : "case_id"
  PROFILES |o--o{ CONTENT_REPORTS : "decided_by"
  PROFILES |o--o{ CONTENT_REPORTS : "reporter_id"
  ATHLETE_PROFILES ||--o{ INFO_REQUESTS : "athlete_id"
  ATHLETE_DOCUMENTS |o--o{ INFO_REQUESTS : "document_id"
  ORGANIZATIONS ||--o{ INFO_REQUESTS : "organization_id"
  PROFILES |o--o{ INFO_REQUESTS : "requested_by"
  PROFILES |o--o{ INFO_REQUESTS : "responded_by"
  SAFETY_CASES |o--o{ MODERATION_ACTIONS : "case_id"
  AUTH_USERS |o--o{ MODERATION_ACTIONS : "created_by"
  CONTENT_REPORTS |o--o{ MODERATION_ACTIONS : "report_id"
  AUTH_USERS |o--o{ MODERATION_ACTIONS : "reverted_by"
  ORGANIZATIONS |o--o{ MODERATION_ACTIONS : "subject_org"
  AUTH_USERS |o--o{ MODERATION_ACTIONS : "subject_user"
  MODERATION_ACTIONS ||--o{ MODERATION_APPEALS : "action_id"
  AUTH_USERS ||--o{ MODERATION_APPEALS : "appellant_id"
  AUTH_USERS |o--o{ MODERATION_APPEALS : "decided_by"
  PROFILES ||--o{ NOTIFICATIONS : "user_id"
  AUTH_USERS |o--o{ SAFETY_CASE_EVENTS : "actor_id"
  SAFETY_CASES ||--o{ SAFETY_CASE_EVENTS : "case_id"
  AUTH_USERS |o--o{ SAFETY_CASES : "assigned_to"
  AUTH_USERS |o--o{ SAFETY_CASES : "created_by"
  ORGANIZATIONS |o--o{ SAFETY_CASES : "subject_org"
  AUTH_USERS |o--o{ SAFETY_CASES : "subject_user"
  PROFILES |o--o{ USER_FEEDBACK : "user_id"
  CONTACT_MESSAGES {
    int8 id PK
    uuid request_id FK
    uuid sender_id FK
    text body
    timestamptz created_at
  }
  CONTACT_REQUESTS {
    uuid id PK
    uuid organization_id FK
    uuid requested_by FK
    uuid athlete_id FK
    text message
    text status
    bool is_minor_at_request
    uuid guardian_approved_by FK
    timestamptz responded_at
    timestamptz created_at
  }
  CONTENT_REPORTS {
    uuid id PK
    uuid reporter_id FK
    text entity_type
    uuid entity_id
    text reason
    text details
    text status
    int4 priority
    text decision_reason
    uuid decided_by FK
    timestamptz decided_at
    timestamptz created_at
    uuid case_id FK
  }
  INFO_REQUESTS {
    uuid id PK
    uuid organization_id FK
    uuid athlete_id FK
    uuid requested_by FK
    text kind
    text message
    text status
    uuid document_id FK
    date shared_until
    uuid responded_by FK
    timestamptz responded_at
    timestamptz created_at
  }
  MODERATION_ACTIONS {
    uuid id PK
    uuid case_id FK
    uuid report_id FK
    uuid subject_user FK
    uuid subject_org FK
    text action
    text_array scopes
    text reason
    timestamptz starts_at
    timestamptz ends_at
    uuid created_by FK
    timestamptz created_at
    timestamptz reverted_at
    uuid reverted_by FK
    text revert_reason
  }
  MODERATION_APPEALS {
    uuid id PK
    uuid action_id FK
    uuid appellant_id FK
    text body
    text status
    uuid decided_by FK
    timestamptz decided_at
    text decision_reason
    timestamptz created_at
  }
  NOTIFICATIONS {
    int8 id PK
    uuid user_id FK
    text kind
    text title
    text body
    text link
    timestamptz read_at
    timestamptz created_at
  }
  SAFETY_CASE_EVENTS {
    uuid id PK
    uuid case_id FK
    uuid actor_id FK
    text kind
    text body
    timestamptz created_at
  }
  SAFETY_CASES {
    uuid id PK
    text title
    text category
    text priority
    text status
    uuid subject_user FK
    uuid subject_org FK
    uuid assigned_to FK
    uuid created_by FK
    timestamptz created_at
    timestamptz closed_at
  }
  USER_FEEDBACK {
    uuid id PK
    uuid user_id FK
    text page
    int4 rating
    text message
    timestamptz created_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `contact_messages` | Personal | Sí | persona (sender_id) → se borra | Inmutable; se borra con la conversación o la cuenta | Sí | KEEP |
| `contact_requests` | Personal | Sí | atleta (athlete_id) → se borra<br>persona (guardian_approved_by) → se anonimiza<br>organización (organization_id) → se borra<br>persona (requested_by) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `content_reports` | Sensible | — | persona (decided_by) → se anonimiza<br>persona (reporter_id) → se anonimiza | Mientras exista la cuenta | No: Denuncias: protegen a quien denuncia y a quien es denunciado | KEEP |
| `info_requests` | Personal | Sí | atleta (athlete_id) → se borra<br>organización (organization_id) → se borra<br>persona (requested_by) → se anonimiza<br>persona (responded_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `moderation_actions` | Sensible | — | persona (created_by) → se anonimiza<br>persona (reverted_by) → se anonimiza<br>organización (subject_org) → se borra<br>persona (subject_user) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `moderation_appeals` | Sensible | — | persona (appellant_id) → se borra<br>persona (decided_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `notifications` | Personal | — | persona (user_id) → se borra | Leídas: 6 meses · todas: 12 meses | Sí | KEEP |
| `safety_case_events` | Sensible | — | persona (actor_id) → se anonimiza | Mientras exista la cuenta | No: Línea de tiempo interna del caso | KEEP |
| `safety_cases` | Sensible | — | persona (assigned_to) → se anonimiza<br>persona (created_by) → se anonimiza<br>organización (subject_org) → se anonimiza<br>persona (subject_user) → se anonimiza | Mientras exista la cuenta | No: Investigación interna de Trust & Safety | KEEP |
| `user_feedback` | Personal | — | persona (user_id) → se anonimiza | 24 meses | Sí | KEEP |

- `moderation_actions`: Medidas proporcionales con ámbito y duración; la persona afectada las ve.
- `safety_cases`: Caso que agrupa denuncias, pruebas y medidas.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
