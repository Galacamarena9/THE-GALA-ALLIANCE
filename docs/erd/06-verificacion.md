<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 06 · Verificación

Tablas: **6** · RLS activada en 6/6.
Se relaciona con: `institutions` (05), `org_programs` (05), `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  ORGANIZATIONS |o--o{ EMAIL_VERIFICATIONS : "organization_id"
  PROFILES ||--o{ EMAIL_VERIFICATIONS : "user_id"
  INSTITUTIONS ||--o{ INSTITUTION_CLAIMS : "institution_id"
  ORGANIZATIONS |o--o{ INSTITUTION_CLAIMS : "organization_id"
  PROFILES |o--o{ INSTITUTION_CLAIMS : "reviewed_by"
  PROFILES ||--o{ INSTITUTION_CLAIMS : "user_id"
  PROFILES |o--o{ VERIFICATION_CHECKS : "checked_by"
  VERIFICATION_REQUESTS ||--o{ VERIFICATION_CHECKS : "request_id"
  VERIFICATION_REQUESTS ||--o{ VERIFICATION_DECISIONS : "request_id"
  PROFILES |o--o{ VERIFICATION_DECISIONS : "reviewer_id"
  VERIFICATION_REQUESTS ||--o{ VERIFICATION_EVIDENCE : "request_id"
  PROFILES |o--o{ VERIFICATION_EVIDENCE : "reviewed_by"
  PROFILES ||--o{ VERIFICATION_EVIDENCE : "submitted_by"
  PROFILES |o--o{ VERIFICATION_REQUESTS : "assigned_reviewer"
  INSTITUTIONS |o--o{ VERIFICATION_REQUESTS : "institution_id"
  ORGANIZATIONS |o--o{ VERIFICATION_REQUESTS : "organization_id"
  ORG_PROGRAMS |o--o{ VERIFICATION_REQUESTS : "program_id"
  PROFILES ||--o{ VERIFICATION_REQUESTS : "subject_user"
  EMAIL_VERIFICATIONS {
    uuid id PK
    uuid user_id FK
    uuid organization_id FK
    text email
    text email_domain
    text token_hash
    timestamptz sent_at
    timestamptz token_expires_at
    int2 attempts
    timestamptz verified_at
    text result
    timestamptz revoked_at
    timestamptz created_at
  }
  INSTITUTION_CLAIMS {
    uuid id PK
    uuid institution_id FK
    uuid user_id FK
    uuid organization_id FK
    text work_email
    text email_domain
    text role_title
    text status
    bool domain_matches
    text review_note
    uuid reviewed_by FK
    timestamptz reviewed_at
    timestamptz created_at
  }
  VERIFICATION_CHECKS {
    int8 id PK
    uuid request_id FK
    text method
    text result
    text detail
    uuid checked_by FK
    timestamptz checked_at
  }
  VERIFICATION_DECISIONS {
    int8 id PK
    uuid request_id FK
    text previous_status
    text new_status
    text decision
    text reason
    uuid reviewer_id FK
    text restrictions
    date review_by
    timestamptz created_at
  }
  VERIFICATION_EVIDENCE {
    uuid id PK
    uuid request_id FK
    text evidence_type
    text reference_url
    text storage_path
    uuid submitted_by FK
    timestamptz submitted_at
    text validation_result
    uuid reviewed_by FK
    timestamptz reviewed_at
    timestamptz expires_at
    text classification
  }
  VERIFICATION_REQUESTS {
    uuid id PK
    uuid subject_user FK
    uuid organization_id FK
    uuid institution_id FK
    uuid program_id FK
    text verification_type
    text declared_role
    text status
    text risk_level
    timestamptz submitted_at
    uuid assigned_reviewer FK
    timestamptz reviewed_at
    text decision
    text decision_reason
    timestamptz expires_at
    timestamptz revoked_at
    uuid legacy_claim_id
    timestamptz created_at
    timestamptz updated_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `email_verifications` | Personal | — | organización (organization_id) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `institution_claims` | Personal | — | organización (organization_id) → se anonimiza<br>persona (reviewed_by) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | MERGE → verification_requests (tipo institution_claim) |
| `verification_checks` | Interna | — | persona (checked_by) → se anonimiza | Mientras exista la organización | No: Comprobaciones internas de Gala sobre la solicitud | KEEP |
| `verification_decisions` | Interna | — | persona (reviewer_id) → se anonimiza | Inmutable; el revisor se anonimiza | No: Decisión de Gala; el estado resultante se exporta en verification_requests | KEEP |
| `verification_evidence` | Sensible | — | persona (reviewed_by) → se anonimiza<br>persona (submitted_by) → se borra | Mientras exista la cuenta | No: Se consulta en /app/verify; ficheros privados en Storage | KEEP |
| `verification_requests` | Sensible | — | persona (assigned_reviewer) → se anonimiza<br>organización (organization_id) → se borra<br>persona (subject_user) → se borra | Mientras exista la cuenta | Sí | KEEP |

- `email_verifications`: El hash del token no se exporta.

## TO-BE · Modelo objetivo

- `institution_claims` → **MERGE → verification_requests (tipo institution_claim)**. Plan: docs/DATA_ARCHITECTURE.md §6.
