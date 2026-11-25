# CHANGELOG · agente fundador USA

> Registro de ciclos del método `gala-usa-autonomous-founder`. Cada entrada: evidencia, cambios, pruebas **realmente
> ejecutadas**, métricas y siguiente gate. No se declara ejecución que no ocurrió.

## [Ciclo 0] 2026-11-24 · Línea base documental (solo lectura)

### Hecho
- Lectura de la skill (`SKILL.md`, `references/*.md`, `references/001_core_schema.sql`).
- Inspección de solo lectura del repo en el commit `b01dff9`: `README.md`, `docs/` (estrategia, negocio, analítica,
  Gala IA, agentes, representación, NCAA-1, facturación, despliegue, auditoría de arquitectura), nombres de las 85
  migraciones y SQL relevante (agency core, 12A/12B, pricing v2/v3, autoridad de mensajes, discovery del agente,
  billing, gala_ai), `src/lib/domain/` (agent-home, us-readiness, csv-import), `src/content/plans.ts`,
  `src/lib/events.ts`, `src/app/actions/{marketplace,billing}.ts`, `src/lib/ai/tools.ts`.
- Creación de los 11 documentos de `/docs/agent-usa/` **fuera del repo**, en `/tmp/agent-usa-docs/` (el repo lo edita
  otro agente; no se ha escrito nada dentro).

### No hecho (y por qué)
- **No** se ejecutaron lint, typecheck, unitarias, RLS, Playwright, accesibilidad, escaneo de secretos/dependencias ni
  build: instrucción de solo lectura y edición concurrente. Los recuentos de pruebas citados vienen de los docs del repo.
- **No** se crearon ramas, migraciones ni PR.
- **No** hubo entrevistas con clientes: toda la evidencia de cliente es hipótesis (desk research / role-play).

### Contexto de PR recientes incorporados (de `git log`)
| PR | Cambio | Efecto en estos documentos |
|---|---|---|
| #104 | «Acompañamiento» + atestación de tarifas | P3 del ledger; propuesta P-03 |
| #105 | Stripe Checkout listo para cobrar | Gate: claves live + Tax |
| #106 | Demo coherente | Confianza en la venta (H6) |
| #107 | «Listo para EE. UU.» 6 hitos | P5 resuelto en v1 |
| #108 | Precios v3 de agencias | `BUSINESS_MODEL.md`; inconsistencias I1–I5 |

### Hallazgos clave
1. La agencia no puede importar su cartera: `guard_recruiting_case()` exige representación activa (E1 en curso por otro agente).
2. Outreach a coaches sin envío ni seguimiento; `recruiting_case_activities` es manual.
3. Las acciones de procesos de agencia no emiten ningún evento; `subscription_started` y `passport_completed` reservados sin emitir.
4. Atestación de tarifas solo en `product_events.props`.
5. Catálogo cobra precio fundador sin cupo; `agent_scale` 249 € vs «desde 449 €»; `free_until` sigue activo.
6. Gala IA sin herramientas para el rol agente; `ai_events` sin versión de prompt ni IDs fuente.
7. Conflicto de foco de deportes (D-03 vs D-04) y de hosting (D-07).

### Métricas
Ninguna medida en este ciclo (sin acceso a datos de producción/staging).

### Siguiente acción y gate pendiente
- Siguiente acción: ciclo 1 de `ROADMAP.md` (E1), coordinado con el agente que ya lo construye.
- Gates de Gala: Stripe live + Tax; Supabase Pro producción; dominio + Resend; entidad/NIF + términos B2B + DPA;
  abogado NCAA en EE. UU.; decisión de hosting (D-07).

---

## [Ciclo 2] 2026-11-24 · Escribir a coaches y saber quién responde
Evidencia de cliente: ninguna entrevista real todavía (hipótesis del `PROBLEM_LEDGER.md`, problema nº 2).
Problema atacado y predicción: el agente no tiene dónde escribir al coach ni saber si abrió el perfil. Métrica: tasa de respuesta por proceso contactado y procesos `contacted → response_received` por agencia/semana. Primero línea base; sin objetivo inventado.
Cambios: rama `feat/coach-outreach`; migración `20261216000100_coach_outreach.sql` (tabla `case_outreach` sin escrituras directas; RPC `case_outreach_create/mark/list`; `guard_recruiting_link` admite la RPC; eventos `coach_outreach_sent`, `coach_reply_logged`; ROLLBACK en cabecera). Plantilla en inglés (`coach-outreach.ts`), panel «Escribir al coach» en cada proceso, aviso NCAA orientativo, «Necesita atención» a los 10 días sin respuesta.
Pruebas: unit 264/264; RLS 436/436 (C2-1…C2-4: otra agencia, atleta, escritura directa, sin permiso, sin aprobar, representación terminada); e2e completo + `coach-outreach.spec.ts` con axe; build OK.
Seguridad y menores: el email guarda el marcador, no el enlace; menores con nombre e inicial; tope de 100 emails/día por agencia; baja en cada email.
Riesgos abiertos: envío por Resend con dominio propio (D-06); DPA de la agencia para contactos de coaches; revisión legal NCAA.

## [Ciclo 3] 2026-11-24 · Declaración de tarifas auditable + cupo fundador + medición de suscripciones
Evidencia de cliente: ninguna entrevista real todavía (riesgo regulatorio y de cobro, no de demanda).
Problema atacado y predicción: la atestación solo vivía en `product_events` y el precio fundador se cobraba a todas. Métrica: % de propuestas con declaración (objetivo técnico 100 % de las nuevas) y suscripciones iniciadas por semana (línea base).
Cambios: rama `feat/fee-attestation-founder-cap`; migración `20261217000100_fee_attestation_founder_cap.sql` (tabla `representation_fee_attestations` append-only, `representation_attest_fees`, `fee_statement`; catálogo v4 79/199 € y v3 fundador oculto; `agency_founder_status`, `checkout_plan`; `billing_apply_event` respeta `metadata.plan_version` y emite `subscription_started`; ROLLBACK en cabecera). Propuesta del atleta y de la familia muestran la declaración con fecha y versión; facturación y /precios muestran «quedan X de 15 plazas»; texto antiguo de /precios («gratis hasta 31-mar-2027, 50 %») corregido.
Pruebas: unit 266/266; RLS 438/438 (C3-1, C3-2); e2e 370 OK + `founder-pricing.spec.ts`; build OK.
Riesgos abiertos: representaciones anteriores sin declaración (se muestran con aviso «pídesela»); claves Stripe live y `free_until` (gate de Gala); validación legal NCAA del texto.

## [Fase 4c auditoría] 2026-11-25 · Portada, precios, alta y login en inglés
Origen: auditoría integral con el Agente Maestro PRO (hallazgo U2).
Cambios:
- Portada (titulares, FAQ, JSON-LD con `inLanguage`), /precios (planes, notas y plazas de precio fundador), /signup y /login (incluidos los mensajes de error) en inglés. Selector ES/EN en la cabecera pública de esas páginas, en el alta y en el login.
- El selector anuncia el idioma completo a los lectores de pantalla («ES · Castellano», WCAG 2.5.3).
Pruebas: unit 288/288 (paridad de portada, planes y tipos de cuenta); e2e 399 OK con portada, precios, alta y login en inglés y el selector; accesibilidad sin fallos graves; build OK.

## [Fase 4b auditoría] 2026-11-25 · Recruiting en inglés
Origen: auditoría integral con el Agente Maestro PRO (hallazgo U2).
Cambios:
- Traductor `tx()` (servidor: `getT()`; cliente: `useT()` con `I18nProvider` en la app) y diccionario `en.ts` con unos 435 textos y 16 patrones.
- En inglés: Hoy, Descubrir (filtros, encaje, vista rápida), listas y su detalle, procesos y ficha del candidato, necesidades, tareas, comparar, trials y la cabecera del portal. También los títulos de página, los deportes, las posiciones, las estadísticas y las fechas.
- Vista previa `/preview/recruit-shell`.
Pruebas: unit 287/287 (`recruit-parity.test.ts`: cada texto marcado tiene traducción; acciones del coach con cifras); e2e 392 OK; build OK.

## [Fase 4a auditoría] 2026-11-25 · El aviso de cookies no tapa nada y el coach entra en inglés
Origen: auditoría integral con el Agente Maestro PRO (hallazgos U1 y U2).
Cambios:
- U1: el aviso de cookies reserva su altura (`--cookie-banner-space`), queda encima de la barra inferior de la app y es más compacto en móvil.
- U2: `src/lib/i18n` (`pickLocale`, `getLocale`, cookie `tga_lang`) y `LanguageSwitcher` (en el alta y en el menú de usuario).
- U2: en inglés quedan el aviso de cookies (también en la ficha `/r/…`), el alta (textos y errores), la navegación de coach/universidad y el menú de usuario. Pedir acceso desde la ficha deja la sesión en inglés.
- La política de cookies recoge `tga_lang`.
Pruebas: unit 283/283 (paridad de traducciones); e2e 388 OK con `phase4-cookies-english.spec.ts`, en escritorio y móvil; build OK.

## [Fase 3 auditoría] 2026-11-24 · Ninguna escritura falla en silencio
Origen: auditoría integral con el Agente Maestro PRO (hallazgo H3).
Cambios:
- `must()` / `bestEffort()` en `src/lib/supabase/must.ts`; 139 escrituras en 34 ficheros (acciones, webhook de Stripe y Gala IA) pasan por uno de los dos.
- `writes-checked.test.ts` recorre el código del servidor y falla si aparece una escritura sin comprobar.
- La pantalla de error avisa de que lo que se estaba guardando no se ha guardado.
Pruebas: unit 275/275; e2e 376 OK; build OK. Sin cambios de base de datos.

## [Fase 2 auditoría] 2026-11-24 · Los límites de plan se cumplen
Origen: auditoría integral con el Agente Maestro PRO (hallazgo H1).
Cambios:
- Migración `20261219000100_phase2_plan_limits.sql`: retira `free_until`; prueba de 30 días por agencia (`agency_trials`, ampliable por administración con motivo); `agency_plan_features`/`agency_plan_status`; triggers que bloquean añadir atletas o puestos por encima del plan. ROLLBACK en la cabecera.
- Facturación muestra la prueba (días restantes) y el uso frente al límite; mensajes claros al importar cartera, proponer representación o unirse a un equipo lleno.
Pruebas: unit 272/272; RLS 445/445 (P2-1…P2-4); e2e 376 OK con `plan-limits.spec.ts`; build OK.

## [Fase 1 auditoría] 2026-11-24 · Confianza para el piloto
Origen: auditoría integral con el Agente Maestro PRO (hallazgos S1, S2, H2, S6).
Cambios:
- Migración `20261218000100_phase1_guardian_trust.sql`: un menor no puede tener roles de adulto vía API; un vínculo familiar aprobado exige tutor adulto y distinto del atleta; `has_family_link`, `is_guardian_of` y `minor_has_active_family` ignoran vínculos con tutor menor. ROLLBACK en la cabecera.
- El alta conserva `next` (invitación de agencia) hasta el onboarding; `safeRedirectPath` en login, MFA y callback (rechaza `/\dominio`).
Pruebas: unit 268/268; RLS 441/441 (F1-1…F1-3); e2e 374 OK con `signup-next.spec.ts`; build OK.
Riesgo que queda: una cuenta que miente sobre su edad sigue pareciendo adulta → verificar al tutor (fase 5).

## Plantilla para próximos ciclos

```
## [Ciclo N] AAAA-MM-DD · <corte vertical>
Evidencia de cliente (n entrevistas reales, citas, señales de pago):
Problema del ledger atacado y predicción (métrica y valor esperado):
Cambios (rama, PR, migraciones con ROLLBACK):
Pruebas ejecutadas con resultado exacto (lint/tipos/unit/RLS/e2e/axe/build/escaneos):
Revisión de seguridad, privacidad, menores y accesibilidad:
Métricas observadas vs predicción → iterar / parar:
Riesgos abiertos · gate pendiente:
```
