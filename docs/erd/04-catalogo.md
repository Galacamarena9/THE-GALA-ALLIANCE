<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: `npm run erd`. -->
# 04 · Catálogo deportivo y eventos

Tablas: **7** · RLS activada en 7/7.
Se relaciona con: `athlete_profiles` (03).

## AS-IS · Modelo actual

```mermaid
erDiagram
  ATHLETE_PROFILES ||--o{ SHOWCASE_ENTRIES : "athlete_id"
  SHOWCASE_EVENTS ||--o{ SHOWCASE_ENTRIES : "event_id"
  SPORTS |o--o{ SHOWCASE_EVENTS : "sport_id"
  SPORTS ||--o{ SPORT_POSITIONS : "sport_id"
  SPORTS ||--o{ SPORT_STAT_DEFINITIONS : "sport_id"
  AGE_CATEGORIES {
    text code PK
    text label
    int2 max_age
    int2 min_age
    text kind
    int2 sort
  }
  SHOWCASE_ENTRIES {
    uuid event_id PK,FK
    uuid athlete_id PK,FK
    timestamptz created_at
  }
  SHOWCASE_EVENTS {
    uuid id PK
    text title
    text description
    text sport_id FK
    timestamptz starts_at
    timestamptz ends_at
    timestamptz created_at
  }
  SPORT_POSITIONS {
    int4 id PK
    text sport_id FK
    text code
    text name_es
    text name_en
  }
  SPORT_STAT_DEFINITIONS {
    int4 id PK
    text sport_id FK
    text code
    text label_es
    text label_en
    text unit
    bool higher_is_better
    int4 sort_order
  }
  SPORTS {
    text id PK
    text name_es
    text name_en
    bool active
  }
  SPORTS_SEASONS {
    text id PK
    text label
    date starts_on
    date ends_on
  }
```

## Inventario

| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |
|---|---|---|---|---|---|---|
| `age_categories` | Pública | — | No depende de personas | Mientras esté publicado o vigente | — | KEEP |
| `showcase_entries` | Personal | Sí | atleta (athlete_id) → se borra | Mientras exista la cuenta | Sí | KEEP |
| `showcase_events` | Pública | — | No depende de personas | Mientras esté publicado o vigente | — | KEEP |
| `sport_positions` | Pública | — | En cascada con `sports` | Mientras esté publicado o vigente | — | KEEP |
| `sport_stat_definitions` | Pública | — | En cascada con `sports` | Mientras esté publicado o vigente | — | KEEP |
| `sports` | Pública | — | No depende de personas | Mientras esté publicado o vigente | — | KEEP |
| `sports_seasons` | Pública | — | No depende de personas | Mientras esté publicado o vigente | — | KEEP |

- `age_categories`: Categorías U14…First Team con regla de edad cuando existe.
- `sports_seasons`: Temporadas normalizadas («2027-28»).

## TO-BE · Modelo objetivo

Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).
