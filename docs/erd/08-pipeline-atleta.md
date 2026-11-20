<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 08 · Pipeline del atleta y Gala Match

Tablas: **8** · RLS activada en 8/8.
Se relaciona con: `athlete_documents` (03), `athlete_profiles` (03), `institutions` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  ATHLETE_PROFILES ||--o{ ATHLETE_OFFERS : "athlete_id"
  PROFILES |o--o{ ATHLETE_OFFERS : "created_by"
  INSTITUTIONS |o--o{ ATHLETE_OFFERS : "institution_id"
  SAVED_ITEMS |o--o{ ATHLETE_OFFERS : "process_id"
  ATHLETE_PROFILES ||--o{ ATHLETE_TASK_STATE : "athlete_id"
  PROFILES |o--o{ ATHLETE_TASK_STATE : "updated_by"
  ATHLETE_PROFILES ||--o{ MATCH_SIGNALS : "athlete_id"
  ATHLETE_PROFILES ||--o{ PIPELINE_CONTACTS : "athlete_id"
  SAVED_ITEMS ||--o{ PIPELINE_CONTACTS : "process_id"
  ATHLETE_PROFILES ||--o{ PIPELINE_EVENTS : "athlete_id"
  PROFILES |o--o{ PIPELINE_EVENTS : "created_by"
  SAVED_ITEMS ||--o{ PIPELINE_EVENTS : "process_id"
  ATHLETE_PROFILES ||--o{ PIPELINE_TASKS : "athlete_id"
  PROFILES |o--o{ PIPELINE_TASKS : "created_by"
  SAVED_ITEMS |o--o{ PIPELINE_TASKS : "process_id"
  ATHLETE_PROFILES ||--o{ PROCESS_DOCUMENTS : "athlete_id"
  ATHLETE_DOCUMENTS |o--o{ PROCESS_DOCUMENTS : "document_id"
  SAVED_ITEMS ||--o{ PROCESS_DOCUMENTS : "process_id"
  ATHLETE_PROFILES ||--o{ SAVED_ITEMS : "athlete_id"
  ATHLETE_OFFERS {
    uuid id PK
    uuid athlete_id FK
    text university_name
    uuid institution_id FK
    int4 annual_cost_usd
    int4 aid_amount_usd
    text renewable
    bool in_writing
    date deadline
    text source_text
    uuid created_by FK
    timestamptz created_at
    uuid process_id FK
    text status
    text source
    text scholarship_type
  }
  ATHLETE_TASK_STATE {
    uuid athlete_id PK,FK
    text task_key PK
    text status
    date snoozed_until
    uuid updated_by FK
    timestamptz updated_at
  }
  MATCH_SIGNALS {
    int8 id PK
    uuid athlete_id FK
    text target_kind
    uuid target_id
    text signal
    int4 match_score
    text engine_version
    timestamptz created_at
  }
  PIPELINE_CONTACTS {
    uuid id PK
    uuid athlete_id FK
    uuid process_id FK
    text name
    text role
    text email
    text phone
    timestamptz created_at
  }
  PIPELINE_EVENTS {
    int8 id PK
    uuid athlete_id FK
    uuid process_id FK
    text kind
    text source
    text channel
    text title
    text body
    timestamptz occurred_at
    uuid created_by FK
    timestamptz created_at
  }
  PIPELINE_TASKS {
    uuid id PK
    uuid athlete_id FK
    uuid process_id FK
    text title
    date due_date
    timestamptz done_at
    uuid created_by FK
    timestamptz created_at
  }
  PROCESS_DOCUMENTS {
    uuid process_id PK,FK
    uuid athlete_id FK
    text kind PK
    uuid document_id FK
    date sent_at
  }
  SAVED_ITEMS {
    uuid id PK
    uuid athlete_id FK
    text target_kind
    uuid target_id
    text status
    text shortlist_tier
    text note
    int4 match_score_at_save
    timestamptz created_at
    timestamptz updated_at
    timestamptz archived_at
    text next_action
    date next_action_due
    text close_reason
    timestamptz stage_changed_at
    timestamptz decided_at
    jsonb match_snapshot
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `athlete_offers` | Sensible | Sí | atleta (athlete_id) → se borra<br>persona (created_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `athlete_task_state` | Personal | Sí | atleta (athlete_id) → se borra<br>persona (updated_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `match_signals` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `pipeline_contacts` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `pipeline_events` | Personal | Sí | atleta (athlete_id) → se borra<br>persona (created_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `pipeline_tasks` | Personal | Sí | atleta (athlete_id) → se borra<br>persona (created_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `process_documents` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `saved_items` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | RENAME → athlete_processes (diferido) |

- `saved_items`: Es el proceso del atleta, no un «guardado».

## TO-BE · Modelo objetivo

- `saved_items` → **RENAME → athlete_processes (diferido)**. Plan: docs/DATA_ARCHITECTURE.md §6.
