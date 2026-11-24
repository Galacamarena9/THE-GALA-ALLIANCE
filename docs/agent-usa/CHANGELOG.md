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
