# CURRENT_STATE · The Gala Alliance (corredor Europa → EE. UU.)

> Fecha: 2026-11-24 · Autor: agente fundador USA (solo lectura del repo) · Método: skill `gala-usa-autonomous-founder`.
> Fuente: lectura de `/home/claude/the-gala-alliance` en el commit `b01dff9` (#107). **No se han ejecutado** lint, tipos,
> tests, RLS ni build en esta revisión (el repo lo está editando otro agente). Las cifras de pruebas que aparecen abajo
> son las que declaran los documentos del repo, no resultados reproducidos aquí.

## 1. Qué es hoy el producto

- Marketplace multilado de oportunidades deportivas; vertical principal «College Recruiting» (becas en EE. UU.).
  Posicionamiento en `README.md` y `src/content/brand.ts`.
- Foco comercial actual (commits #99–#108): **el agente/agencia europeo que lleva atletas a la NCAA**, con portada
  «La alianza» y pantallas de agente (`src/app/app/AgentHome.tsx`, `src/components/agent/HomeParts.tsx`).
- Cabeza de playa declarada: jugadoras europeas 15–19 de baloncesto, vóley y fútbol (`docs/LAUNCH_FOCUS.md`); en
  `docs/STRATEGY.md` §E el piloto es España → EE. UU. con baloncesto, tenis y fútbol. **Inconsistencia de foco a resolver.**

## 2. Stack y arquitectura real

| Capa | Estado | Evidencia |
|---|---|---|
| Web | Next.js 16 App Router, Server Actions con zod | `src/app/`, `src/app/actions/*.ts` |
| Datos/seguridad | Supabase Postgres + Auth + RLS en todas las tablas | `supabase/migrations/` (85 migraciones), `docs/ARCHITECTURE-AUDIT.md` (160 tablas, 160 con RLS) |
| Dominio puro | Lógica testeada sin I/O | `src/lib/domain/*.ts` (+ `*.test.ts`) |
| IA | Gala IA (Anthropic, con modo sin modelo) | `src/lib/ai/*`, `docs/GALA_AI.md` |
| Pagos | Stripe Checkout (pago único familias) + suscripciones (agencias) vía webhook | `src/app/actions/billing.ts`, `src/app/api/stripe/webhook/route.ts`, `docs/BILLING.md` |
| Analítica | Eventos propios en `product_events` vía `log_event()` | `src/lib/events.ts`, `docs/ANALYTICS_EVENTS.md` |
| Correo | Resend (pendiente dominio) | `docs/DEPLOYMENT.md` §4, `docs/OUTREACH.md` |
| Hosting | Netlify | `netlify.toml`, `docs/DEPLOYMENT.md` |
| Pruebas | Unitarias (Vitest-like `*.test.ts`), RLS (`supabase/tests/rls.test.mjs`), e2e Playwright (10 specs en `e2e/`) | `package.json`, `docs/AGENT-HOME.md` §G declara «RLS: 401 OK» |

## 3. Qué ya funciona para el agente (lado que paga)

| Capacidad | Dónde | Nota |
|---|---|---|
| Inicio del agente «Necesita atención» (5 rangos deterministas) | `src/lib/domain/agent-home.ts`, `docs/AGENT-HOME.md` | Sin datos privados en el contrato (probado) |
| Representación con alcance, permisos y asignaciones | `20261126000200_12a_representation_model.sql`, `docs/REPRESENTATION-ARCHITECTURE.md` | `agent_can()` como cadena de autorización |
| RLS del agente por representación | `20261127000100_12b_agent_rls.sql`, `docs/AGENT-RLS.md` | Dueño/admin de agencia **no** salta la cadena |
| Procesos por universidad (5 fases visibles; 13 pasos internos), tareas, actividades | `20261116000700_agency_core.sql` (`recruiting_cases`, `recruiting_case_tasks`, `recruiting_case_activities`) | Solo con representación **activa** |
| Contactos de coaches privados de la agencia + import CSV | `agency_contacts`, `src/lib/domain/csv-import.ts` (máx. 500 filas) | Importa **contactos**, no atletas |
| Buscador de oportunidades por atleta | `20261212000100_agent_opportunity_discovery.sql`, `src/lib/domain/opportunity-discovery.ts` | Vía `agent_discovery_athlete()` |
| Autoridad para mensajear | `20261213000100_agency_message_authority.sql` | Agencia sin representación vigente no escribe |
| «Listo para EE. UU.» (6 hitos) | `src/lib/domain/us-readiness.ts` (#107) | Elegibilidad siempre `unknown` (correcto: no afirma) |
| Lenguaje «acompañamiento» + atestación de tarifas | `src/app/actions/marketplace.ts` L95-128, `src/components/forms.tsx` L139-150 (#104) | Ver riesgo R3 |
| Precios v3 | `src/content/plans.ts`, `20261214000100_agent_pricing_v3.sql` (#108) | Ver `BUSINESS_MODEL.md` |
| Checkout de suscripción con prueba de 30 días y Stripe Tax | `src/app/actions/billing.ts` L53-80 (#105) | Sin claves live |

## 4. Huecos funcionales confirmados en código

1. **La agencia no puede traer su cartera actual.** `guard_recruiting_case()` exige `agency_has_active_representation`;
   la única vía de alta es `representation_request` (agencia → atleta ya registrado) o `representation_invitations`
   (atleta/familia → agencia). No existe «importar atletas + invitación para reclamar». *En construcción por otro agente
   (según el encargo); no visible aún en `main`.*
2. **Outreach a coaches sin envío ni seguimiento.** `recruiting_case_activities.kind` (`email`, `call`…) se registra a
   mano; no hay envío, apertura, respuesta ni recordatorio. `docs/OUTREACH.md` es difusión **de Gala a organizaciones**,
   no del agente a coaches.
3. **Cero eventos de embudo en procesos de agencia.** `src/app/actions/agency-cases.ts` y `portfolio.ts` no llaman a
   `logEvent`; `subscription_started` está reservado pero el webhook no lo emite.
4. **Atestación de tarifas no persistida como registro auditable.** Solo viaja como `props` de `representation_requested`
   en `product_events` (retención 13 meses; sin props si hay menor).
5. **Agencia sin dominio propio queda en revisión manual** (`auto_verify_organization` en
   `20261113000800_autonomous_operations.sql` solo verifica si el dominio del correo coincide con la web).
6. **Gala IA no tiene herramientas para el agente** (`src/lib/ai/tools.ts`: atleta, familia, universidad).

## 5. Bloqueos que dependen de Gala (gates)

| Gate | Por qué bloquea | Evidencia |
|---|---|---|
| Claves Stripe live + Stripe Tax + portal | Sin ellas no hay evidencia de disposición a pagar | `docs/BILLING.md` «Para activar» |
| Supabase Pro de producción (separado de staging) | Hoy solo staging | `docs/DEPLOYMENT.md` §1 |
| Dominio + Resend verificado | Correos de alta, invitaciones y reclamación | `docs/DEPLOYMENT.md` §4 |
| Entidad legal / NIF, términos B2B y DPA | Facturar a agencias y tratar datos por encargo | `docs/BUSINESS_MODEL.md` «Antes de activar cobros», `src/content/legal.ts` (borradores) |
| Abogado de cumplimiento NCAA en EE. UU. | Validar «acompañamiento» y atestación frente a bylaws de agentes | `docs/NCAA-1-AUDIT.md` §D/§H |
| Hosting | Netlify + Supabase (decisión D-07, 24-nov) | `netlify.toml` |

## 6. Riesgos principales

- **R1 Marketplace vacío** (crítico, `docs/STRATEGY.md` hallazgo 6): liquidez no demostrada.
- **R2 Borrado en cascada** al borrar una organización (45 FKs, `docs/ARCHITECTURE-AUDIT.md` C1).
- **R3 Cumplimiento NCAA**: reglas fijas sin versión (`ncaa_contact_opens_on`, `src/lib/domain/ncaa.ts`); atestación
  sin registro propio; sin validación legal en EE. UU.
- **R4 Precios desalineados entre catálogo y web** (ver `BUSINESS_MODEL.md` §4).
- **R5 Documentación interna desfasada**: `docs/BUSINESS_MODEL.md` aún dice «Agencia gratis en el piloto».

## 7. Evidencia de clientes

**Ninguna entrevista real registrada en el repo.** Todo lo que figura en `CUSTOMER_RESEARCH.md` y `PROBLEM_LEDGER.md`
son hipótesis de investigación de escritorio y role-play de revisiones anteriores.
