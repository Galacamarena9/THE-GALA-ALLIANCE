<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 02 · Familia, consentimiento y privacidad

Tablas: **4** · RLS activada en 4/4.
Se relaciona con: `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  PROFILES |o--o{ CONSENTS : "guardian_id"
  PROFILES ||--o{ CONSENTS : "user_id"
  PROFILES |o--o{ COOKIE_CONSENT_LOGS : "user_id"
  PROFILES ||--o{ DATA_SUBJECT_REQUESTS : "user_id"
  PROFILES |o--o{ PARENT_ATHLETE_LINKS : "athlete_id"
  PROFILES ||--o{ PARENT_ATHLETE_LINKS : "invited_by"
  PROFILES |o--o{ PARENT_ATHLETE_LINKS : "parent_id"
  CONSENTS {
    uuid id PK
    uuid user_id FK
    text purpose
    text document_version
    bool granted
    uuid guardian_id FK
    timestamptz created_at
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
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `consents` | Sensible | Sí | persona (guardian_id) → se anonimiza<br>persona (user_id) → se borra | Inmutable; se borra con la persona, el tutor se anonimiza | Sí | KEEP |
| `cookie_consent_logs` | Personal | — | persona (user_id) → se anonimiza | Inmutable; se anonimiza al borrar la cuenta | No: Registro técnico de cookies del navegador; solo lectura de Gala | KEEP |
| `data_subject_requests` | Personal | — | persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `parent_athlete_links` | Sensible | Sí | persona (athlete_id) → se borra<br>persona (invited_by) → se borra<br>persona (parent_id) → se borra | Invitaciones pendientes: 90 días tras caducar | Sí | KEEP |

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
