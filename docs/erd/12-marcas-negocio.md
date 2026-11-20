<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 12 · Marcas y negocio

Tablas: **3** · RLS activada en 3/3.
Se relaciona con: `athlete_profiles` (03), `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ BRAND_CAMPAIGNS : "brand_org_id"
  PROFILES |o--o{ BRAND_CAMPAIGNS : "created_by"
  ATHLETE_PROFILES ||--o{ CAMPAIGN_APPLICATIONS : "athlete_id"
  BRAND_CAMPAIGNS ||--o{ CAMPAIGN_APPLICATIONS : "campaign_id"
  ORGANIZATIONS |o--o{ SERVICE_REQUESTS : "organization_id"
  PROFILES ||--o{ SERVICE_REQUESTS : "user_id"
  BRAND_CAMPAIGNS {
    uuid id PK
    uuid brand_org_id FK
    uuid created_by FK
    text title
    text description
    text kind
    text_array sport_ids
    text deliverables
    text compensation_kind
    int4 compensation_usd
    text usage_rights
    text territory
    date application_deadline
    text status
    text review_note
    timestamptz published_at
    timestamptz created_at
    timestamptz updated_at
  }
  CAMPAIGN_APPLICATIONS {
    uuid id PK
    uuid campaign_id FK
    uuid athlete_id FK
    text status
    text message
    bool rules_acknowledged
    timestamptz created_at
    timestamptz updated_at
  }
  SERVICE_REQUESTS {
    uuid id PK
    uuid user_id FK
    text plan_code
    uuid organization_id FK
    text message
    text status
    text admin_note
    timestamptz created_at
    timestamptz updated_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `brand_campaigns` | Pública | — | organización (brand_org_id) → se borra<br>persona (created_by) → se anonimiza | Mientras esté publicado o vigente | — | KEEP |
| `campaign_applications` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `service_requests` | Personal | — | organización (organization_id) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
