# BUSINESS_MODEL · modelo de negocio (USA / corredor NCAA)

> Fuente de verdad de precios públicos: `src/content/plans.ts`. Catálogo cobrable: tabla `plan_catalog`
> (`20261130000100_15_billing.sql`, `20261211000100_agent_founder_pricing.sql`, `20261214000100_agent_pricing_v3.sql`).
> Sin ingresos reales todavía: Stripe no está en modo live. Ninguna cifra de conversión o margen es conocida.

## 1. Principios (no negociables, ya en el código)

- **La visibilidad del atleta nunca se paga** (`VISIBILITY_PROMISE` en `src/content/plans.ts`). Responder a una
  invitación genuina es gratis. Sin ranking pagado.
- Se cobra productividad, colaboración, confianza y ejecución de flujo (doctrina `business-engine.md`).
- Sin comisiones ni cobro por contactar en los planes de agente (`plans.ts`, `includes`).
- Tarifas de agencia **no ligadas a la beca** (atestación #104) para proteger la elegibilidad NCAA.

## 2. Precios v3 (decididos por Gala el 23-11-2026, PR #108)

| Plan | Pagador | Precio público | Precio fundador | Límites (catálogo) | Cobro |
|---|---|---|---|---|---|
| Passport | Atleta | 0 € | — | `athlete_free` | — |
| Core | Familia | 247 € pago único | — | `family_core` | Checkout |
| Elite | Familia | 497 € pago único | — | `family_elite` | Checkout |
| Signature 1:1 | Familia | A medida (hip. 1.500–3.000 €, `docs/BUSINESS_MODEL.md`) | — | `family_signature` | Solicitud |
| Agente | Agente solo | 79 €/mes | 47 €/mes de por vida (15 primeras agencias) | 1 asiento, 25 atletas, 50 búsquedas/día | Suscripción, 30 días de prueba |
| Agencia | Agencia 2–5 | 199 €/mes | 119 €/mes de por vida (15 primeras) | 5 asientos, 100 atletas, 200 búsquedas/día | Suscripción, 30 días de prueba |
| Agencia grande | Agencia >5 | Desde 449 €/mes | — | 15 asientos, ilimitado | Solicitud (a medida) |
| Recruit | Universidad/coach | Gratis en piloto | — | 10 asientos | — |
| Portal club/academia | Club | Gratis | — | 5 asientos | Afiliados (cuando haya pagos) |
| Campañas | Marca | Tras validación legal | — | — | — |

Comparación con los rangos de experimento de la skill (`business-engine.md`): Agente 79 € está dentro de 29–79;
Agencia 199 € dentro de 149–399. Son **precios a validar**, no finales.

## 3. Entitlements: ROI declarado por plan (formato `marketplace-core.md`)

| Plan | Trabajo | Dolor cuantificado | Resultado esperado | Medición | Alternativa gratis | Gatillo de upgrade/cancelación |
|---|---|---|---|---|---|---|
| Agente | Llevar procesos por universidad | ? (medir, P1/P2) | Menos seguimientos perdidos | Procesos con próxima acción al día; respuestas de coach | Excel + Gmail | >25 atletas activos → Agencia; sin uso en 30 días → cancelación |
| Agencia | Repartir trabajo en equipo | ? (medir) | Responsable claro y vencidos visibles | Vencidos/semana; uso por asiento | Hoja compartida | >5 asientos o >100 atletas → Grande |
| Core | Plan de la familia | ? | Saber qué hacer y qué cuesta | `task_completed`, compra | Guía y calculadora gratis | Ofertas reales → Elite |
| Elite | Decidir entre ofertas | ? | Decisión con coste neto y riesgos | Uso del comparador/memo | Hoja propia | — |

Los «?» se rellenan solo con datos de `CUSTOMER_RESEARCH.md`.

## 4. Inconsistencias detectadas (a corregir, no se corrigen aquí)

| # | Inconsistencia | Evidencia | Propuesta |
|---|---|---|---|
| I1 | El catálogo v3 cobra **47/119 €** (precio fundador) a cualquiera; no hay contador de «15 primeras agencias» | `20261214000100_agent_pricing_v3.sql` | Añadir cupo fundador (contador + versión de catálogo de lista 79/199 al agotarse) |
| I2 | `agent_scale` en catálogo = 249 €/mes (v1) vs «desde 449 €» público | `20261130000100_15_billing.sql` L43 vs `plans.ts` | Alinear al activar ventas (cta `request`, no se cobra por checkout hoy) |
| I3 | `free_until = 2027-03-31` sigue en v3 y además hay 30 días de prueba | `20261211000100_agent_founder_pricing.sql` (comentario) y `billing.ts` L72-73 | Poner `free_until = null` en la migración de paso a live (ya previsto en el comentario) |
| I4 | `docs/BUSINESS_MODEL.md` dice «Agencia: gratis en el piloto» | `docs/BUSINESS_MODEL.md` tabla «Ingresos» | Actualizar doc |
| I5 | `subscription_started` reservado y no emitido | `docs/ANALYTICS_EVENTS.md`, webhook | Emitir desde el webhook (dedupe por sesión) |

## 5. Bucle multilado y liquidez

1. Agencia paga → importa cartera (E1) → cada atleta recibe invitación gratuita → reclama Passport.
2. Agencia contacta coaches con enlaces al Passport (E2) → coaches ven perfiles verificables → captación de universidades (Recruit gratis).
3. Universidades publican necesidades → más oportunidades para atletas y agencias → retención.
4. Familias con hijos ya en la red compran Core/Elite cuando aparecen ofertas reales.

Riesgo: si el bucle 2 no trae coaches, el valor para la agencia queda en «CRM» y compite con Excel.

## 6. Umbrales de validación (de `docs/BUSINESS_MODEL.md`, objetivos, no logros)

- ≥ 3 de cada 10 familias contactadas compran Core.
- ≥ 40 % de atletas con Passport básico en 72 h.
- ≥ 1 conexión cualificada por cada 10 atletas activos al mes.
Para agencias **no hay umbral definido**: se propone en `ROADMAP.md` (a aprobar por Gala).

## 7. Unit economics: desconocidos

CAC, ciclo de venta, margen bruto (coste Anthropic + Supabase Pro + hosting + Resend), soporte por cuenta y churn:
**sin datos**. Se registrarán por plan desde la primera agencia de pago antes de estandarizar precios.

## 8. Requisitos antes de cobrar (gates de Gala)

Stripe live + Stripe Tax + portal de cliente; entidad legal/NIF; términos B2B y DPA (la agencia es responsable y
Gala encargada para los datos de su cartera); revisión NCAA por abogado en EE. UU. del modelo de «acompañamiento».
