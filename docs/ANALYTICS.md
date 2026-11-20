# Analítica (Prompt 17)

**Estado:** implementado en `20261202000100_17_analytics.sql` y en `/app/admin/analytics`. Probado en local (bloque P17).

## Cuatro capas, sin silo nuevo

| Capa | Dónde | Para qué |
|---|---|---|
| Auditoría | `audit_logs` (inmutable) | Seguridad y cumplimiento. **No** es analítica |
| Eventos de producto | `product_events` (13 meses) | Comportamiento: lista cerrada, sin datos de menores |
| Métricas derivadas | `admin_metrics`, `admin_marketplace_metrics` | Se calculan desde las tablas de negocio; nunca se escriben a mano |
| Finanzas | `billing_ledger` (Stripe) | El dinero real. Lo «declarado» en ofertas de marca se muestra aparte |

## Definiciones (`metric_definitions`)

- **Estrella polar:** conexiones cualificadas. Son los contactos aceptados más las candidaturas que avanzan. Miden encuentros reales, no clics.
- **Activación de atletas:** Passport con deporte y promoción, más una candidatura o un contacto en los primeros 14 días.
- **Liquidez:** oportunidades que reciben una candidatura en 14 días.
- **Tiempo hasta valor:** mediana de días desde el alta hasta el primer contacto aceptado.
- **Oferta y demanda por deporte:** sirve para ver dónde faltan oportunidades o atletas.
- **Retención por cohortes semanales:** semanas 1, 2 y 4.
- **Agentes, marcas, ingresos y seguridad:** cada uno con su fuente.

## Privacidad

- Solo admin, y todo agregado.
- **Los grupos de menos de 5 personas se ocultan** (k-anonimato).
- **Sin ranking de talento ni métricas por persona.**
- Los menores no llevan propiedades en sus eventos.
- La analítica es propia (first-party) y no se comparte con terceros.

## Pendiente

- Un almacén analítico (BigQuery o similar) cuando el volumen lo pida. Hoy las funciones leen directamente de Postgres.
- Calibración y revisión de equidad de Gala Match con datos reales, cuando haya volumen suficiente.
