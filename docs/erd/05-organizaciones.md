<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 05 · Instituciones y organizaciones

Tablas: **9** · RLS activada en 9/9.
Se relaciona con: `profiles` (01), `sports` (04).

## AS-IS · Modelo actual

```mermaid
erDiagram
  INSTITUTIONS ||--o{ INSTITUTION_PROGRAMS : "institution_id"
  SPORTS ||--o{ INSTITUTION_PROGRAMS : "sport_id"
  PROFILES |o--o{ INSTITUTIONS : "links_verified_by"
  INSTITUTION_PROGRAMS |o--o{ ORG_PROGRAMS : "institution_program_id"
  ORGANIZATIONS ||--o{ ORG_PROGRAMS : "organization_id"
  SPORTS ||--o{ ORG_PROGRAMS : "sport_id"
  PROFILES |o--o{ ORGANIZATION_DOMAINS : "created_by"
  ORGANIZATIONS ||--o{ ORGANIZATION_DOMAINS : "organization_id"
  PROFILES |o--o{ ORGANIZATION_DOMAINS : "reviewed_by"
  PROFILES |o--o{ ORGANIZATION_INVITATIONS : "accepted_by"
  PROFILES ||--o{ ORGANIZATION_INVITATIONS : "invited_by"
  ORGANIZATIONS ||--o{ ORGANIZATION_INVITATIONS : "organization_id"
  PROFILES |o--o{ ORGANIZATION_MEMBERS : "invited_by"
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : "organization_id"
  PROFILES ||--o{ ORGANIZATION_MEMBERS : "user_id"
  PROFILES |o--o{ ORGANIZATION_MEMBERSHIP_RECORDS : "actor_id"
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIP_RECORDS : "organization_id"
  PROFILES ||--o{ ORGANIZATION_MEMBERSHIP_RECORDS : "user_id"
  PROFILES |o--o{ ORGANIZATIONS : "created_by"
  INSTITUTIONS |o--o{ ORGANIZATIONS : "institution_id"
  PROFILES |o--o{ ORGANIZATIONS : "verified_by"
  PROFILES |o--o{ PROGRAM_MEMBERSHIPS : "granted_by"
  ORGANIZATIONS ||--o{ PROGRAM_MEMBERSHIPS : "organization_id"
  ORG_PROGRAMS ||--o{ PROGRAM_MEMBERSHIPS : "program_id"
  PROFILES |o--o{ PROGRAM_MEMBERSHIPS : "revoked_by"
  PROFILES ||--o{ PROGRAM_MEMBERSHIPS : "user_id"
  INSTITUTION_PROGRAMS {
    uuid id PK
    uuid institution_id FK
    text sport_id FK
    text gender
    text association
    division division
    text conference
    text program_url
    text source
    text source_url
    timestamptz verified_at
    timestamptz created_at
    timestamptz updated_at
  }
  INSTITUTIONS {
    uuid id PK
    int4 ipeds_unitid
    text name
    text city
    text state
    text website_url
    text price_calculator_url
    int4 cost_attendance_usd
    int4 tuition_out_of_state_usd
    text data_source
    timestamptz source_fetched_at
    text association
    division division
    text conference
    text_array sports_offered
    text athletics_url
    text admissions_url
    text international_url
    text virtual_tour_url
    timestamptz links_verified_at
    uuid links_verified_by FK
    timestamptz created_at
    timestamptz updated_at
    int4 sat_avg
    numeric admission_rate
    int4 enrollment
    text ownership
    text locale
    numeric graduation_rate
    int4 tuition_in_state_usd
    int4 net_price_usd
    numeric intl_share
    text_array program_cips
    text athletic_source
    timestamptz athletic_updated_at
  }
  ORG_PROGRAMS {
    uuid id PK
    uuid organization_id FK
    text sport_id FK
    text gender
    text name
    uuid institution_program_id FK
    timestamptz archived_at
    timestamptz created_at
  }
  ORGANIZATION_DOMAINS {
    uuid id PK
    uuid organization_id FK
    text domain
    text domain_type
    bool is_primary
    text status
    text verification_method
    timestamptz verified_at
    timestamptz revoked_at
    uuid created_by FK
    uuid reviewed_by FK
    timestamptz created_at
  }
  ORGANIZATION_INVITATIONS {
    uuid id PK
    uuid organization_id FK
    uuid invited_by FK
    org_member_role member_role
    text token
    text status
    uuid accepted_by FK
    timestamptz expires_at
    timestamptz created_at
  }
  ORGANIZATION_MEMBERS {
    uuid organization_id PK,FK
    uuid user_id PK,FK
    org_member_role member_role
    timestamptz created_at
    text agency_role
    text title
    uuid_array program_ids
    text declared_role
    text role_verification
    text affiliation_verification
    uuid invited_by FK
    text invitation_source
    text program_scope
    timestamptz updated_at
    text team_scope
    uuid_array team_ids
  }
  ORGANIZATION_MEMBERSHIP_RECORDS {
    uuid id PK
    uuid organization_id FK
    uuid user_id FK
    text status
    org_member_role member_role
    text declared_role
    uuid_array program_ids
    text program_scope
    text title
    text reason
    uuid actor_id FK
    timestamptz created_at
  }
  ORGANIZATIONS {
    uuid id PK
    text name
    org_type type
    text country
    text city
    text website
    division division
    text_array sport_ids
    text description
    verification_status verification_status
    timestamptz verified_at
    uuid verified_by FK
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
    text state
    text conference
    text logo_url
    text international_support
    int4 annual_cost_usd
    text cost_source_url
    uuid institution_id FK
    text requester_email_domain
    text normalized_name
    text org_status
    text claim_status
    text source
    text external_id
    timestamptz last_reviewed_at
    text name_key
  }
  PROGRAM_MEMBERSHIPS {
    uuid id PK
    uuid organization_id FK
    uuid user_id FK
    uuid program_id FK
    text program_role
    text access_level
    text status
    uuid granted_by FK
    timestamptz granted_at
    uuid revoked_by FK
    timestamptz revoked_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `institution_programs` | Pública | — | En cascada con `institutions` | Mientras esté publicado o vigente | — | KEEP |
| `institutions` | Pública | — | persona (links_verified_by) → se anonimiza | Mientras esté publicado o vigente | — | KEEP |
| `org_programs` | Interna | — | organización (organization_id) → se borra | Mientras exista la organización | — | KEEP |
| `organization_domains` | Interna | — | persona (created_by) → se anonimiza<br>organización (organization_id) → se borra<br>persona (reviewed_by) → se anonimiza | Mientras exista la organización | — | KEEP |
| `organization_invitations` | Personal | — | persona (accepted_by) → se anonimiza<br>persona (invited_by) → se borra<br>organización (organization_id) → se borra | 90 días tras caducar si no se acepta | No: Invitación emitida por la organización | KEEP |
| `organization_members` | Personal | — | persona (invited_by) → se anonimiza<br>organización (organization_id) → se borra<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `organization_membership_records` | Interna | — | persona (actor_id) → se anonimiza<br>organización (organization_id) → se borra<br>persona (user_id) → se borra | Mientras exista la organización | No: Historial de la organización (altas, suspensiones) | KEEP |
| `organizations` | Interna | — | persona (created_by) → se anonimiza<br>persona (verified_by) → se anonimiza | Mientras exista la organización | — | KEEP |
| `program_memberships` | Personal | — | persona (granted_by) → se anonimiza<br>organización (organization_id) → se borra<br>persona (revoked_by) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |

- `institution_programs`: Programas deportivos del catálogo.
- `institutions`: Catálogo de universidades reales (importado). No es una cuenta.
- `org_programs`: Programa dentro de la organización; enlaza a institution_programs.
- `organizations`: La cuenta (tenant) de universidad, club, agencia o marca. Enlaza a institutions.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
