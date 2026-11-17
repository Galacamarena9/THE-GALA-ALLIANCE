# Gala AI · arquitectura

**Principio:** Gala AI no tiene datos propios. Consulta, con los permisos del usuario, las mismas fuentes de verdad que el resto de la plataforma (Passport, Gala Match, pipeline, plazos, guía) y nunca ejecuta una acción con consecuencias sin confirmación.

## Flujo de una petición (`POST /api/gala-ia`, modo `chat`)
1. **Sesión y límites** (`consume_ai_request`): 40 peticiones/día y 6/minuto, atómico en base de datos.
2. **Guardas antes del modelo** (`src/lib/ai/safety.ts`): riesgo para menores o acoso → respuesta fija de seguridad; petición de datos privados de terceros → rechazo; intento de inyección → se marca y no se obedece.
3. **Enrutador de intenciones** (`router.ts`, ES/EN, determinista): decide las herramientas mínimas.
4. **Proveedor** (`orchestrator.ts`): Anthropic si existe `ANTHROPIC_API_KEY` (modelo en `ANTHROPIC_MODEL`). Sin clave, **modo sin modelo**: ejecuta las herramientas y muestra los datos reales sin redacción generativa.
5. **Herramientas internas** (`tools.ts`): solo lectura y siempre con el cliente del usuario (RLS). Sus resultados entran al modelo como `<untrusted_data>` (separación datos / instrucciones). Máximo 3 rondas y 900 tokens de salida.
6. **Respuesta estructurada** en NDJSON: `meta`, `status`, `text`, `sources` (con fecha de revisión y aviso si la revisión está pendiente), `proposals` (acciones que el usuario confirma), `drafts` (3 tonos, nunca se envían), `done`.
7. **Observabilidad sin contenido** (`ai_events`): intención, modo, resultado, tokens, latencia y herramientas. **No se guarda el texto.** Feedback 👍/👎 en `ai_feedback`. Panel en `/app/admin`. Retención: 13 meses.

## Herramientas
| Herramienta | Fuente de verdad |
|---|---|
| `get_next_best_action`, `get_deadlines` | `src/lib/domain/dashboard.ts` (Command Center) |
| `get_pipeline_summary` | Pipeline del atleta (`saved_items` + eventos) |
| `get_passport_gaps` | Recruiting Readiness |
| `explain_match`, `search_universities`, `compare_universities` | Motor Gala Match + directorio de universidades |
| `search_knowledge` | Guía editorial (`src/content/guide.ts`) con fuentes oficiales y fecha de revisión |
| `propose_action` | No ejecuta: el usuario confirma (`confirmAiProposal`) |
| `present_drafts` | Borradores en 3 tonos |

## Evaluación
`src/lib/ai/eval/cases.ts` contiene el conjunto de evaluación (intención, idioma, guardas, conocimiento y frases prohibidas). `npm run test:unit` lo ejecuta en CI sobre las capas deterministas. Antes de cambiar el prompt o el modelo, revisa a mano las respuestas a estos casos y comprueba que no aparecen las frases prohibidas.
