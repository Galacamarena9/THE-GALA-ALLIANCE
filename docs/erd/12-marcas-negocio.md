<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 12 · Marcas y negocio

Tablas: **15** · RLS activada en 15/15.
Se relaciona con: `athlete_profiles` (03), `auth_users`, `organizations` (05), `profiles` (01).

## AS-IS · Modelo actual

```mermaid
erDiagram
  ORGANIZATIONS |o--o{ BILLING_ACCOUNTS : "organization_id"
  AUTH_USERS |o--o{ BILLING_ACCOUNTS : "user_id"
  BILLING_ACCOUNTS |o--o{ BILLING_LEDGER : "billing_account_id"
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
  AUTH_USERS |o--o{ SEAT_ASSIGNMENTS : "assigned_by"
  SUBSCRIPTIONS ||--o{ SEAT_ASSIGNMENTS : "subscription_id"
  AUTH_USERS ||--o{ SEAT_ASSIGNMENTS : "user_id"
  ORGANIZATIONS |o--o{ SERVICE_REQUESTS : "organization_id"
  PROFILES ||--o{ SERVICE_REQUESTS : "user_id"
  BILLING_ACCOUNTS ||--o{ SUBSCRIPTIONS : "billing_account_id"
  PLAN_CATALOG ||--o{ SUBSCRIPTIONS : "plan_code"
  BILLING_ACCOUNTS {
    uuid id PK
    uuid user_id FK
    uuid organization_id FK
    text stripe_customer_id
    text billing_email
    text country
    text tax_id
    timestamptz created_at
  }
  BILLING_LEDGER {
    uuid id PK
    uuid billing_account_id FK
    text kind
    int8 amount_cents
    text currency
    text stripe_object_id
    text description
    timestamptz occurred_at
    timestamptz created_at
  }
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
  PLAN_CATALOG {
    text code PK
    int4 version PK
    text audience
    text name
    text billing_interval
    int4 price_cents
    text currency
    int4 seats_included
    jsonb features
    text stripe_price_id
    date free_until
    bool active
    timestamptz created_at
  }
  SEAT_ASSIGNMENTS {
    uuid subscription_id PK,FK
    uuid user_id PK,FK
    uuid assigned_by FK
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
  STRIPE_EVENTS {
    text id PK
    text type
    timestamptz stripe_created
    timestamptz received_at
    timestamptz processed_at
    text outcome
  }
  SUBSCRIPTIONS {
    uuid id PK
    uuid billing_account_id FK
    text plan_code FK
    int4 plan_version
    text status
    text stripe_subscription_id
    int4 seats
    timestamptz current_period_start
    timestamptz current_period_end
    bool cancel_at_period_end
    timestamptz trial_end
    timestamptz last_event_at
    timestamptz created_at
    timestamptz updated_at
  }
  USAGE_COUNTERS {
    uuid subject_id PK
    text feature PK
    date period_start PK
    int4 used
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `billing_accounts` | Sensible | — | organización (organization_id) → se borra<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `billing_ledger` | Sensible | — | No depende de personas | Obligación fiscal (6 años) | No: Registro financiero de la cuenta; append-only | KEEP |
| `brand_application_notes` | Interna | — | persona (author_id) → se borra<br>organización (brand_org_id) → se borra | Mientras exista la organización | — | KEEP |
| `brand_campaigns` | Pública | — | organización (brand_org_id) → se borra<br>persona (created_by) → se anonimiza | Mientras esté publicado o vigente | — | KEEP |
| `campaign_applications` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `campaign_deliverable_submissions` | Personal | — | persona (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `campaign_deliverables` | Personal | — | En cascada con `campaign_offers` | Mientras exista la cuenta | No: Lo define la marca; lo del atleta (sus entregas) se exporta en campaign_deliverable_submissions. | KEEP |
| `campaign_offer_components` | Sensible | — | En cascada con `campaign_offers` | Mientras exista la cuenta | No: Hija de la oferta (sin columna de persona); el titular la ve junto a su oferta en la app. | KEEP |
| `campaign_offers` | Sensible | — | persona (athlete_id) → se borra<br>organización (brand_org_id) → se borra<br>persona (sent_by) → se anonimiza | Mientras exista la cuenta | Sí | KEEP |
| `plan_catalog` | Pública | — | No depende de personas | Mientras esté publicado o vigente | — | KEEP |
| `seat_assignments` | Personal | — | persona (assigned_by) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `service_requests` | Personal | — | organización (organization_id) → se anonimiza<br>persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `stripe_events` | Interna | — | No depende de personas | Mientras exista la organización | No: Idempotencia técnica del webhook | KEEP |
| `subscriptions` | Sensible | — | En cascada con `billing_accounts` | Mientras exista la cuenta | No: De la cuenta de facturación (persona u organización); la escribe solo el webhook | KEEP |
| `usage_counters` | Personal | — | No depende de personas | Mientras exista la cuenta | Sí | KEEP |

- `billing_accounts`: Sin datos de tarjeta: solo el id de cliente de Stripe.
- `brand_application_notes`: Notas internas de la marca; nunca visibles para el atleta.
- `campaign_deliverable_submissions`: Versiones de cada entrega; nunca se sobrescriben.
- `campaign_deliverables`: Entregables de la oferta.
- `campaign_offer_components`: Producto ≠ dinero; bonus siempre condicionado.
- `campaign_offers`: Oferta inmutable; cambiarla crea versión nueva.
- `plan_catalog`: Catálogo versionado: los límites salen de aquí, no del código.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
