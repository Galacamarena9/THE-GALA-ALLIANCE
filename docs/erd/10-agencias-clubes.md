<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 10 · Agencias y clubes

Tablas: **10** · RLS activada en 10/10.
Se relaciona con: `athlete_profiles` (03), `institutions` (05), `organizations` (05), `profiles` (01), `sports` (04).

## AS-IS · Modelo actual

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ AGENCY_ATHLETE_NOTES : "agency_id"
  ATHLETE_PROFILES ||--o{ AGENCY_ATHLETE_NOTES : "athlete_id"
  PROFILES ||--o{ AGENCY_ATHLETE_NOTES : "author_id"
  ORGANIZATIONS ||--o{ AGENCY_CONTACTS : "agency_id"
  PROFILES |o--o{ AGENCY_CONTACTS : "created_by"
  INSTITUTIONS |o--o{ AGENCY_CONTACTS : "institution_id"
  SPORTS |o--o{ AGENCY_CONTACTS : "sport_id"
  ORGANIZATIONS ||--o{ AGENT_REPRESENTATIONS : "agency_id"
  PROFILES ||--o{ AGENT_REPRESENTATIONS : "agent_id"
  ATHLETE_PROFILES ||--o{ AGENT_REPRESENTATIONS : "athlete_id"
  ATHLETE_PROFILES ||--o{ CLUB_RECOMMENDATIONS : "athlete_id"
  PROFILES |o--o{ CLUB_RECOMMENDATIONS : "author_id"
  ORGANIZATIONS ||--o{ CLUB_RECOMMENDATIONS : "organization_id"
  ATHLETE_PROFILES ||--o{ CLUB_ROSTER : "athlete_id"
  ORGANIZATIONS ||--o{ CLUB_ROSTER : "organization_id"
  PROFILES ||--o{ CLUB_ROSTER_INVITES : "created_by"
  ORGANIZATIONS ||--o{ CLUB_ROSTER_INVITES : "organization_id"
  ATHLETE_PROFILES |o--o{ NEWS_POSTS : "athlete_id"
  PROFILES ||--o{ NEWS_POSTS : "author_id"
  ORGANIZATIONS |o--o{ NEWS_POSTS : "organization_id"
  PROFILES |o--o{ RECRUITING_CASE_ACTIVITIES : "actor_id"
  RECRUITING_CASES ||--o{ RECRUITING_CASE_ACTIVITIES : "case_id"
  PROFILES |o--o{ RECRUITING_CASE_TASKS : "assignee_id"
  RECRUITING_CASES ||--o{ RECRUITING_CASE_TASKS : "case_id"
  PROFILES |o--o{ RECRUITING_CASE_TASKS : "created_by"
  ORGANIZATIONS ||--o{ RECRUITING_CASES : "agency_id"
  ATHLETE_PROFILES ||--o{ RECRUITING_CASES : "athlete_id"
  AGENCY_CONTACTS |o--o{ RECRUITING_CASES : "contact_id"
  INSTITUTIONS |o--o{ RECRUITING_CASES : "institution_id"
  PROFILES |o--o{ RECRUITING_CASES : "owner_id"
  SPORTS |o--o{ RECRUITING_CASES : "sport_id"
  AGENCY_ATHLETE_NOTES {
    uuid id PK
    uuid agency_id FK
    uuid athlete_id FK
    uuid author_id FK
    text kind
    text body
    date due_date
    bool done
    timestamptz done_at
    timestamptz created_at
    timestamptz updated_at
  }
  AGENCY_CONTACTS {
    uuid id PK
    uuid agency_id FK
    uuid institution_id FK
    text institution_name
    text sport_id FK
    text name
    text role_title
    text email
    text phone
    text notes
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }
  AGENT_REPRESENTATIONS {
    uuid id PK
    uuid agency_id FK
    uuid agent_id FK
    uuid athlete_id FK
    text status
    text message
    timestamptz responded_at
    timestamptz ended_at
    timestamptz created_at
  }
  CLUB_RECOMMENDATIONS {
    uuid id PK
    uuid athlete_id FK
    uuid organization_id FK
    uuid author_id FK
    text body
    text status
    timestamptz created_at
    timestamptz decided_at
  }
  CLUB_ROSTER {
    uuid organization_id PK,FK
    uuid athlete_id PK,FK
    text season PK
    text status
    bool shares_progress
    timestamptz joined_at
    timestamptz ended_at
  }
  CLUB_ROSTER_INVITES {
    uuid id PK
    uuid organization_id FK
    uuid created_by FK
    text season
    text token
    int4 max_uses
    int4 uses
    text status
    timestamptz expires_at
    timestamptz created_at
  }
  NEWS_POSTS {
    uuid id PK
    uuid organization_id FK
    uuid author_id FK
    text kind
    text title
    text body
    text source_url
    uuid athlete_id FK
    timestamptz athlete_consented_at
    text status
    text hidden_reason
    timestamptz created_at
  }
  RECRUITING_CASE_ACTIVITIES {
    uuid id PK
    uuid case_id FK
    text kind
    text from_stage
    text to_stage
    text body
    date occurred_on
    uuid actor_id FK
    timestamptz created_at
  }
  RECRUITING_CASE_TASKS {
    uuid id PK
    uuid case_id FK
    text title
    uuid assignee_id FK
    date due_date
    bool done
    timestamptz done_at
    uuid created_by FK
    timestamptz created_at
  }
  RECRUITING_CASES {
    uuid id PK
    uuid agency_id FK
    uuid athlete_id FK
    uuid institution_id FK
    text institution_name
    text sport_id FK
    text cycle
    text stage
    uuid owner_id FK
    uuid contact_id FK
    text next_action
    date next_action_due
    text outcome_reason
    bool shared_with_athlete
    timestamptz created_at
    timestamptz updated_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `agency_athlete_notes` | Interna | — | organización (agency_id) → se borra<br>atleta (athlete_id) → se borra<br>persona (author_id) → se borra | Mientras exista la organización | No: Nota interna de la agencia sobre el atleta | KEEP |
| `agency_contacts` | Interna | — | organización (agency_id) → se borra<br>persona (created_by) → se anonimiza | Mientras exista la organización | — | KEEP |
| `agent_representations` | Sensible | Sí | organización (agency_id) → se borra<br>persona (agent_id) → se borra<br>atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `club_recommendations` | Personal | Sí | atleta (athlete_id) → se borra<br>persona (author_id) → se anonimiza<br>organización (organization_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `club_roster` | Personal | Sí | atleta (athlete_id) → se borra<br>organización (organization_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `club_roster_invites` | Interna | — | persona (created_by) → se borra<br>organización (organization_id) → se borra | 90 días tras caducar | — | MERGE → organization_invitations (tipo roster) |
| `news_posts` | Pública | — | atleta (athlete_id) → se borra<br>persona (author_id) → se borra<br>organización (organization_id) → se borra | Mientras esté publicado o vigente | — | KEEP |
| `recruiting_case_activities` | Interna | — | persona (actor_id) → se anonimiza | Mientras exista la organización | — | KEEP |
| `recruiting_case_tasks` | Interna | — | persona (assignee_id) → se anonimiza<br>persona (created_by) → se anonimiza | Mientras exista la organización | — | KEEP |
| `recruiting_cases` | Interna | Sí | organización (agency_id) → se borra<br>atleta (athlete_id) → se borra<br>persona (owner_id) → se anonimiza | Mientras exista la organización | No: Caso interno de la agencia | KEEP |

## TO-BE · Modelo objetivo

- `club_roster_invites` → **MERGE → organization_invitations (tipo roster)**. Plan: docs/DATA_ARCHITECTURE.md §6.
