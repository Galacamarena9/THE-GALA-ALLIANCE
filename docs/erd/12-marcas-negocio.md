<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 12 · Marcas y negocio

Tablas: **8** · RLS activada en 8/8.
Se relaciona con: `athlete_profiles` (03), `auth_users`, `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  CAMPAIGN_APPLICATIONS ||--o{ BRAND_APPLICATION_NOTES : "application_id"
  AUTH_USERS ||--o{ BRAND_APPLICATION_NOTES : "author_id"
  ORGANIZATIONS ||--o{ BRAND_APPLICATION_NOTES : "brand_org_id"
  ORGANIZATIONS ||--o{ BRAND_CAMPAIGNS : "brand_org_id"
  PROFILES |o--o{ BRAND_CAMPAIGNS : "created_by"
  ATHLETE_PROFILES ||--o{ CAMPAIGN_APPLICATIONS : "athlete_id"
  BRAND_CAMPAIGNS ||--o{ CAMPAIGN_APPLICATIONS : "campaign_id"
  AUTH_USERS ||--o{ CAMPAIGN_DELIVERABLE_SUBMISSIONS : "athlete_id"
  CAMPAIGN_DELIVERABLES ||--o{ CAMPAIGN_DELIVERABLE_SUBMISSIONS : "deliverable_id"
  CAMPAIGN_OFFERS ||--o{ CAMPAIGN_DELIVERABLES : "offer_id"
  CAMPAIGN_OFFERS ||--o{ CAMPAIGN_OFFER_COMPONENTS : "offer_id"
  CAMPAIGN_APPLICATIONS ||--o{ CAMPAIGN_OFFERS : "application_id"
  AUTH_USERS ||--o{ CAMPAIGN_OFFERS : "athlete_id"
  ORGANIZATIONS ||--o{ CAMPAIGN_OFFERS : "brand_org_id"
  BRAND_CAMPAIGNS ||--o{ CAMPAIGN_OFFERS : "campaign_id"
  AUTH_USERS |o--o{ CAMPAIGN_OFFERS : "sent_by"
  ORGANIZATIONS |o--o{ SERVICE_REQUESTS : "organization_id"
  PROFILES ||--o{ SERVICE_REQUESTS : "user_id"
  BRAND_APPLICATION_NOTES {
    uuid id PK
    uuid application_id FK
    uuid brand_org_id FK
    uuid author_id FK
    text body
    timestamptz created_at
  }
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
    text product_description
    int4 product_value_usd
    int4 usage_months
    text_array usage_channels
    bool paid_media
    text exclusivity_category
    int4 exclusivity_days
    int4 min_age
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
  CAMPAIGN_DELIVERABLE_SUBMISSIONS {
    uuid id PK
    uuid deliverable_id FK
    uuid athlete_id FK
    int4 version
    text url
    text note
    timestamptz submitted_at
  }
  CAMPAIGN_DELIVERABLES {
    uuid id PK
    uuid offer_id FK
    text kind
    text platform
    int4 quantity
    date due_date
    text description
    bool approval_required
    text status
    text feedback
    timestamptz reviewed_at
    timestamptz created_at
    timestamptz updated_at
  }
  CAMPAIGN_OFFER_COMPONENTS {
    uuid id PK
    uuid offer_id FK
    text kind
    numeric amount
    text currency
    bool guaranteed
    text description
  }
  CAMPAIGN_OFFERS {
    uuid id PK
    uuid campaign_id FK
    uuid application_id FK
    uuid brand_org_id FK
    uuid athlete_id FK
    int4 version
    text status
    bool compensation_unknown
    int4 usage_months
    text_array usage_channels
    text usage_territory
    bool organic_use
    bool paid_media
    text exclusivity_category
    int4 exclusivity_days
    text terms
    date starts_on
    date ends_on
    timestamptz expires_at
    uuid sent_by FK
    timestamptz responded_at
    text decline_reason
    text payment_status
    timestamptz payment_updated_at
    timestamptz created_at
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
| `brand_application_notes` | Interna | — | persona (author_id) → se borra<br>organización (brand_org_id) → se borra | Mientras exista la organización | — | KEEP |
| `brand_campaigns` | Pública | — | organización (brand_org_id) → se borra<br>persona (created_by) → se anonimiza | Mientras esté publicado o vigente | — | KEEP |
| `campaign_applications` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `campaign_deliverable_submissions` | Personal | — | persona (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `campaign_deliverables` | Personal | — | En cascada con `campaign_offers` | Mientras exista la cuenta | No: Lo define la marca; lo del atleta (sus entregas) se exporta en campaign_deliverable_submissions. | KEEP |
| `campaign_offer_components` | Sensible | — | En cascada con `campaign_offers` | Mientras exista la cuenta | No: Hija de la oferta; se exporta dentro de campaign_offers. | KEEP |
| `campaign_offers` | Sensible | — | persona (athlete_id) → se borra<br>organización (brand_org_id) → se borra<br>persona (sent_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `service_requests` | Personal | — | organización (organization_id) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |

- `brand_application_notes`: Notas internas de la marca; nunca visibles para el atleta.
- `campaign_deliverable_submissions`: Versiones de cada entrega; nunca se sobrescriben.
- `campaign_deliverables`: Entregables de la oferta.
- `campaign_offer_components`: Producto ≠ dinero; bonus siempre condicionado.
- `campaign_offers`: Oferta inmutable; cambiarla crea versión nueva.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
