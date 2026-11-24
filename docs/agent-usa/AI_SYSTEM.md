# AI_SYSTEM · Gala IA frente a la doctrina de IA de la skill

> Fuentes: `docs/GALA_AI.md`, `src/lib/ai/{orchestrator,router,safety,tools,knowledge,galaContext}.ts`,
> `src/lib/ai/eval/cases.ts`, migraciones `20261117000800_gala_ai.sql` y `20261120000200_gala_ai_history.sql`.

## 1. Lo que existe

| Pieza | Implementación | Cumple doctrina |
|---|---|---|
| Sin datos propios; consulta con permisos del usuario | Herramientas solo lectura con el cliente del usuario (RLS) | Sí |
| Separación datos/instrucciones | Resultados de herramientas como `<untrusted_data>` | Sí |
| Guardas antes del modelo | `safety.ts`: menores/acoso → respuesta fija; datos de terceros → rechazo; inyección marcada | Sí |
| Enrutador determinista ES/EN | `router.ts` | Sí |
| Proveedor abstraído + modo sin modelo | `orchestrator.ts` (Anthropic si hay `ANTHROPIC_API_KEY`; `ANTHROPIC_MODEL_FAST` para intenciones simples) | Sí |
| Acciones solo propuestas | `propose_action` → el usuario confirma (`confirmAiProposal`) | Sí (asesora, no decide) |
| Borradores nunca enviados | `present_drafts` (3 tonos) | Sí |
| Fuentes con fecha y estado de revisión | `search_knowledge` + `src/content/guide-meta.ts` (`published`/`review_pending`/`draft`) | Sí |
| Límites | `consume_ai_request`: 40/día y 6/min | Sí |
| Observabilidad sin contenido | `ai_events` (intención, modo, resultado, proveedor, modelo, tokens, latencia, nº herramientas, página) | Parcial |
| Feedback | `ai_feedback` (👍/👎) | Sí |
| Historial opt-in, 90 días | `ai_conversations`/`ai_messages`, solo dueño | Sí |
| Evaluación | `src/lib/ai/eval/cases.ts` en `npm run test:unit` (capas deterministas) | Parcial (sin eval del modelo) |

## 2. Herramientas por rol (`src/lib/ai/tools.ts`)

| Rol | Herramientas |
|---|---|
| Atleta | `get_next_best_action`, `get_pipeline_summary`, `get_deadlines`, `get_passport_gaps`, `explain_match`, `search_universities`, `compare_universities` |
| Familia | `get_family_overview` |
| Universidad | `get_recruiting_overview` |
| Todos | `search_knowledge`, `propose_action`, `present_drafts` |
| **Agente** | **Ninguna específica** |

El rol que paga (agente) no tiene herramientas propias: es el mayor hueco de valor de IA.

## 3. Huecos frente a `architecture.md` / `marketplace-core.md`

| Requisito skill | Estado | Propuesta (aditiva) |
|---|---|---|
| `ai_runs` con versión de prompt | Falta `prompt_version` en `ai_events` | Columna nueva `prompt_version text` |
| IDs de registros fuente por salida | No se guardan | Columna `source_refs jsonb` con tipo + id (nunca contenido) |
| Filtro por tenant en recuperación | Implícito por RLS del usuario | Añadir `organization_id` en `ai_events` para métricas por agencia |
| Confianza cuando aplica | No se expone | Solo en `explain_match` (el motor ya calcula confianza, rules-1.1) |
| Redacción de PII antes del modelo | Contexto mínimo en `galaContext.ts` (no verificado línea a línea aquí) | Auditoría específica antes de herramientas de agente |
| No entrenar con datos del tenant | Depende de términos del proveedor | Documentar en DPA (gate legal) |
| Abstenerse en temas legales/NCAA sin fuente | Capítulos `review_pending` se usan avisando | Para NCAA: abstenerse si la regla no está en `ncaa_rule_sets` con fuente (hoy no existe) |
| Brief diario grounded | Inicio del agente es determinista, sin IA (`agent-home.ts`) | Mantener determinista; IA solo para redactar |

## 4. Herramientas de agente propuestas (orden por valor, todas solo lectura + propuesta)

| Herramienta | Fuente de verdad | Permiso | Uso |
|---|---|---|---|
| `get_agency_attention` | `buildAttention()` (`src/lib/domain/agent-home.ts`) | Sesión del agente | «¿Qué hago hoy?» |
| `get_case_summary(case)` | `recruiting_cases` + actividades (sin notas internas en la salida al modelo salvo que el usuario sea autor) | `case_access` | Preparar llamada con coach |
| `get_us_readiness(athlete)` | `usReadiness()` (`src/lib/domain/us-readiness.ts`) | `agent_can(…, 'passport.view')` | Qué falta para EE. UU. |
| `draft_coach_email(case)` | Passport mínimo vía `agent_discovery_athlete()` + plantilla | `pipeline.manage` | Borrador en EN; **nunca se envía solo** |
| `explain_opportunity_fit(athlete, opp)` | `opportunity-discovery.ts` | `agent_can` | Explicar encaje y datos que faltan |

Prohibido: seleccionar o descartar atletas, afirmar elegibilidad NCAA, prometer becas, mencionar tarifas ligadas a beca,
o mezclar datos de dos agencias. Añadir casos a `src/lib/ai/eval/cases.ts` para cada prohibición.

## 5. Evaluación mínima antes de lanzar herramientas de agente

1. Casos de inyección en notas de agencia y en textos de oportunidad.
2. Petición de datos de un atleta no representado → rechazo (equivalente a `OTHERS_SCOPE`).
3. Petición «¿es elegible para la NCAA?» → abstención + enlace a fuente oficial.
4. Borrador de email sin datos de menores (fecha de nacimiento, presupuesto, contacto).
5. Revisión manual de respuestas (doc del repo lo exige antes de cambiar prompt o modelo).

## 6. Coste

Desconocido: depende de `ANTHROPIC_MODEL`, tokens por petición (registrados en `ai_events`) y uso real. Calcular
coste por agencia/mes con los primeros datos antes de ampliar cuotas en `plan_catalog.features`.
