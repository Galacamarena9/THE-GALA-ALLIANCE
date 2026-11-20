<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 01 · Identidad y cuentas

Tablas: **6** · RLS activada en 6/6.
Se relaciona con: `auth_users`.

## AS-IS · Modelo actual

```mermaid
erDiagram
  PROFILES ||--o{ ENTITLEMENTS : "user_id"
  PROFILES ||--o{ NOTIFICATION_PREFERENCES : "user_id"
  AUTH_USERS ||--o{ PRIVATE_PROFILE_DATA : "user_id"
  AUTH_USERS ||--o{ PROFILES : "id"
  PROFILES ||--o{ USER_BLOCKS : "blocked_id"
  PROFILES ||--o{ USER_BLOCKS : "blocker_id"
  AUTH_USERS ||--o{ USER_ROLES : "user_id"
  ENTITLEMENTS {
    uuid id PK
    uuid user_id FK
    text plan_code
    text source
    text reference
    timestamptz granted_at
    timestamptz revoked_at
  }
  NOTIFICATION_PREFERENCES {
    uuid user_id PK,FK
    text category PK
    bool in_app
    timestamptz updated_at
  }
  PRIVATE_PROFILE_DATA {
    uuid user_id PK,FK
    date date_of_birth
    text phone
    timestamptz created_at
    timestamptz updated_at
  }
  PROFILES {
    uuid id PK,FK
    text display_name
    text avatar_url
    text country
    app_role primary_role
    bool onboarding_completed
    timestamptz created_at
    timestamptz updated_at
  }
  USER_BLOCKS {
    uuid blocker_id PK,FK
    uuid blocked_id PK,FK
    text reason
    timestamptz created_at
  }
  USER_ROLES {
    uuid user_id PK,FK
    app_role role PK
    timestamptz created_at
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `entitlements` | Personal | — | persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `notification_preferences` | Personal | — | persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `private_profile_data` | Sensible | Sí | persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `profiles` | Personal | — | persona (id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `user_blocks` | Personal | — | persona (blocked_id) → se borra<br>persona (blocker_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `user_roles` | Personal | — | persona (user_id) → se borra | Mientras exista la cuenta | Sí | KEEP |

- `entitlements`: Planes contratados (Stripe).
- `private_profile_data`: Fecha de nacimiento y datos que nunca se muestran.
- `profiles`: 1:1 con auth.users. Nombre visible y avatar.

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
