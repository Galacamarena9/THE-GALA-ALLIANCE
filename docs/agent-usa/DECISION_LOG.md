# DECISION_LOG · decisiones de producto, negocio y arquitectura

> Formato: ID · fecha · decisión · motivo · evidencia (archivo/PR) · estado · reversibilidad.
> Solo decisiones verificables en el repo o tomadas explícitamente por Gala. Las propuestas del agente van marcadas
> «Propuesta» y requieren aprobación.

## Decisiones vigentes

| ID | Fecha | Decisión | Motivo | Evidencia | Estado | Reversible |
|---|---|---|---|---|---|---|
| D-01 | 2026-11-13 | Construir desde cero con Claude (Next.js + Supabase), sin depender de Lovable | Control del código y seguridad | `docs/LOVABLE_PORT.md`, `README.md` | Vigente | Sí |
| D-02 | 2026-11 | La visibilidad del atleta nunca se paga; Passport gratis | Misión + liquidez + ventaja frente a agencias que cobran «exposición» | `src/content/plans.ts` (`VISIBILITY_PROMISE`), `docs/BUSINESS_MODEL.md` | Vigente | No (principio) |
| D-03 | 2026-11-17 | Piloto España → EE. UU.: baloncesto, tenis, fútbol | Autoridad de la fundadora + becas por plaza + volumen | `docs/STRATEGY.md` §E | **En conflicto con D-04** | Sí |
| D-04 | 2026-11-20 | Cabeza de playa: jugadoras europeas 15–19, baloncesto/vóley/fútbol; producto abierto a todos | Probabilidad de éxito, Title IX, encaje fundadora | `docs/LAUNCH_FOCUS.md` | Vigente (marketing) | Sí |
| D-05 | 2026-11-22 | Supabase Pro y separar entornos (actual = staging; producción nuevo proyecto) | Seguridad de datos reales | `docs/DEPLOYMENT.md` §1 | Pendiente de ejecutar (gate) | Sí |
| D-06 | 2026-11-22 | Dominio `thegalaalliance.com` + Resend; compra aplazada hasta terminar plataforma | Correos de registro | `docs/DEPLOYMENT.md` §4, `docs/STRATEGY.md` §I | Pendiente (gate) | Sí |
| D-07 | 2026-11-24 | **Hosting: The Gala Alliance se queda en Netlify + Supabase** (decisión de Gala, 24-nov); los proyectos nuevos van a Cloudflare | Es el proyecto más grande; migrar no aporta ahora | `netlify.toml`, `docs/DEPLOYMENT.md` | Vigente | Sí |
| D-08 | 2026-11-23 | Foco comercial en el agente/agencia europeo hacia la NCAA | Es quien tiene el dolor de flujo y paga | Commits #99, #100, #95, #96 | Vigente | Sí |
| D-09 | 2026-11-22/23 | Pasar de «gratis hasta 31/03/2027» a precio fundador; luego precios v3: 79/199/desde 449 €, −40 % de por vida para 15 primeras, prueba 30 días | Señal de pago real; 29/79 € parecía barato | `20261211000100_agent_founder_pricing.sql`, `20261214000100_agent_pricing_v3.sql`, PR #108 | Vigente (sin cobro live) | Sí |
| D-10 | 2026-11 | Familias Core 247 € / Elite 497 € pago único; clubes gratis | Resultados concretos, no visibilidad | `src/content/plans.ts` | Vigente | Sí |
| D-11 | 2026-11 | Lenguaje «acompañamiento» y atestación obligatoria de tarifas no ligadas a beca | Riesgo NCAA bylaws 12.02.1 / 12.3.3 (desk research; sin validación legal) | PR #104, `src/app/actions/marketplace.ts` L95-128 | Vigente; validación legal pendiente | Sí |
| D-12 | 2026-11 | Representación como única fuente de verdad agencia–atleta (REUSE → EXTEND) | Evitar sistemas paralelos | `docs/REPRESENTATION-ARCHITECTURE.md` | Vigente | Costosa |
| D-13 | 2026-11 | Ser owner/admin de agencia no salta `agent_can` | Mínimo privilegio con atletas y menores | `docs/AGENT-RLS.md` | Vigente | No (seguridad) |
| D-14 | 2026-11 | Analítica propia sin cookies (`product_events`) en lugar de PostHog | Privacidad, menores, consentimiento | `docs/ANALYTICS_EVENTS.md` | Vigente | Sí |
| D-15 | 2026-11 | NO-GO a programar reglas NCAA sin fuente oficial fechada; GO a infraestructura sin reglas | No afirmar elegibilidad | `docs/NCAA-1-AUDIT.md` §H | Vigente | — |
| D-16 | 2026-11 | Demo coherente con una sola historia; «Listo para EE. UU.» en 6 hitos | Confianza en la venta; claridad para el agente | PR #106, PR #107 | Vigente | Sí |
| D-17 | 2026-11 | Checkout de suscripción con Stripe Tax y recogida de NIF/VAT | Facturación B2B correcta | PR #105, `src/app/actions/billing.ts` L68-80 | Vigente (sin claves live) | Sí |
| D-18 | 2026-11-24 | Ciclo 2: el email al coach sale del buzón de la agencia (mailto/copiar), no de la plataforma; la agencia registra enviado/respuesta. La agencia puede crear el enlace al Passport solo con representación activa y permisos `organization.contact` + `passport.view` (para menores, los aprobó la familia); el atleta lo ve y lo revoca | Sin dominio ni Resend todavía; reputación de envío y DPA de la agencia; no inventar entregas | `20261216000100_coach_outreach.sql`, `src/lib/domain/coach-outreach.ts` | Vigente | Sí (envío por Resend cuando haya dominio) |
| D-19 | 2026-11-24 | Ciclo 3: declaración de tarifas en tabla append-only con texto canónico versionado (lo fija el servidor), visible al atleta y su familia; cupo fundador aplicado por la base de datos (`checkout_plan`, `agency_founder_status`): 15 cuentas con suscripción v3 viva, una baja libera plaza; `subscription_started` lo emite `billing_apply_event` | Cierra P-03, P-04 y la medición de ingresos de P-06 | `20261217000100_fee_attestation_founder_cap.sql` | Vigente (sin claves live) | Sí |

## Propuestas del agente (pendientes de aprobación)

| ID | Propuesta | Motivo | Coste de no hacerlo |
|---|---|---|---|
| P-01 | Adoptar los 3 ciclos de `ROADMAP.md` (E1 → E2 → E3) | Ranking del `PROBLEM_LEDGER.md` | Agencias en prueba con panel vacío |
| P-02 | Unificar foco de deporte (resolver D-03 vs D-04) en un solo documento | Mensajes y SEO coherentes | Mensajes contradictorios en piloto |
| ~~P-03~~ | (Hecho en ciclo 3, D-19) Persistir la atestación en tabla append-only (no solo en `product_events`) | Prueba auditable ante familia/NCAA | Evidencia perdida a los 13 meses o sin props para menores |
| ~~P-04~~ | (Hecho en ciclo 3, D-19) Cupo fundador de 15 agencias aplicado en base de datos | Hoy el catálogo cobra 47/119 € a todos | Precio fundador indefinido para cualquiera |
| P-05 | Alinear `agent_scale` (249 € en catálogo vs «desde 449 €») y `free_until` al pasar a live | Coherencia de cobro | Facturas que no cuadran con la web |
| P-06 | Instrumentar eventos de agencia (`agency_case_created`, cambios de fase, outreach) | Sin ellos no se puede medir el North Star del lado que paga | Decidir a ciegas |
| P-07 | No migrar a la estructura `apps/*`/`packages/*` de la skill | El monolito actual ya es modular; coste sin beneficio medido | — |

## Decisiones explícitamente NO tomadas por el agente
Fusionar migraciones destructivas, cambiar credenciales, activar Stripe live, publicar textos legales, desplegar
producción o contactar clientes: todo requiere aprobación expresa de Gala.
