<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 11 · Comunicación, avisos y seguridad

Tablas: **6** · RLS activada en 6/6.
Se relaciona con: `athlete_documents` (03), `athlete_profiles` (03), `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  CONTACT_REQUESTS ||--o{ CONTACT_MESSAGES : "request_id"
  PROFILES ||--o{ CONTACT_MESSAGES : "sender_id"
  ATHLETE_PROFILES ||--o{ CONTACT_REQUESTS : "athlete_id"
  PROFILES |o--o{ CONTACT_REQUESTS : "guardian_approved_by"
  ORGANIZATIONS ||--o{ CONTACT_REQUESTS : "organization_id"
  PROFILES ||--o{ CONTACT_REQUESTS : "requested_by"
  PROFILES |o--o{ CONTENT_REPORTS : "decided_by"
  PROFILES |o--o{ CONTENT_REPORTS : "reporter_id"
  ATHLETE_PROFILES ||--o{ INFO_REQUESTS : "athlete_id"
  ATHLETE_DOCUMENTS |o--o{ INFO_REQUESTS : "document_id"
  ORGANIZATIONS ||--o{ INFO_REQUESTS : "organization_id"
  PROFILES |o--o{ INFO_REQUESTS : "requested_by"
  PROFILES |o--o{ INFO_REQUESTS : "responded_by"
  PROFILES ||--o{ NOTIFICATIONS : "user_id"
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
| `notifications` | Personal | — | persona (user_id) → se borra | Leídas: 6 meses · todas: 12 meses | Sí | KEEP |
| `user_feedback` | Personal | — | persona (user_id) → se anonimiza | 24 meses | Sí | KEEP |

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
