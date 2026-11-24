# CUSTOMER_RESEARCH · investigación de cliente

> **Aviso:** a fecha 2026-11-24 **no hay entrevistas ni observaciones reales registradas**. Todo lo de abajo son
> **hipótesis** (investigación de escritorio y role-play de revisiones previas). Nunca citar estas notas como
> testimonios ni datos de usuarios.

## 1. Segmentos y trabajos por hacer (hipótesis)

| Segmento | Trabajo principal | Dolor hipotético | Dónde lo resuelve hoy el producto |
|---|---|---|---|
| Agente solo (Europa → NCAA) | Colocar atletas en universidades de EE. UU. con poco tiempo | Cartera y contactos en Excel/WhatsApp; seguimientos olvidados | `/app/portfolio`, `recruiting_cases`, `agency_contacts` |
| Agencia pequeña (2–5) | Repartir atletas y universidades en equipo | Nadie sabe quién lleva qué; procesos parados | Roles `agency_role`, `representation_assignments`, panel de vencidos |
| Atleta 15–19 | Llegar a una beca sin depender de contactos | No sabe qué falta ni en quién confiar | Passport gratis, «Listo para EE. UU.» (`src/lib/domain/us-readiness.ts`) |
| Familia (tutor) | Decidir con seguridad y coste real | Miedo a agencias que cobran por «exposición» | Panel familiar, aprobaciones de menor, Core/Elite |
| Coach universitario EE. UU. | Encontrar internacionales fiables y comparables | Vídeos y notas sin verificar, traducciones | Portal Recruit (`recruiting_needs`, `org_candidates`), gratis en piloto |

Foco de pago en esta fase: **agente/agencia** (commits #99–#108). Atleta y familia sostienen la red (Passport gratis).

## 2. Hallazgos de revisiones anteriores (role-play, NO validados)

| ID | Hallazgo hipotético | Origen | Estado en producto |
|---|---|---|---|
| H1 | Una agencia que entra no puede traer sus atletas: el día 1 la cartera está vacía | Role-play de agencia | Hueco confirmado en código; en construcción («importar cartera + invitación para reclamar») |
| H2 | Si la agencia usa Gmail/dominio genérico, se queda en verificación | Role-play + lectura de `auto_verify_organization` | Hueco confirmado |
| H3 | El agente no puede hacer ni medir el outreach a coaches dentro del producto | Role-play | Hueco confirmado (`recruiting_case_activities` manual) |
| H4 | Las familias desconfían de quien cobra «por beca»; la NCAA restringe a agentes con honorarios ligados a la colocación (bylaws 12.02.1 / 12.3.3) | Desk research | Mitigado con «acompañamiento» + atestación (#104); falta validación legal en EE. UU. |
| H5 | El agente quiere ver de un vistazo qué documentos faltan para llegar a EE. UU. | Role-play | Hecho: 6 hitos (#107) |
| H6 | Una demo incoherente rompe la confianza en la venta | Revisión de producto | Hecho: demo coherente (#106) |
| H7 | 29/79 €/mes se percibe barato para agencias | Decisión de la fundadora (23-nov) | Precios v3 (#108); sin prueba de mercado |

## 3. Competencia (escritorio, por verificar)

| Competidor | Qué sabemos con certeza | Qué falta verificar con fuente primaria |
|---|---|---|
| ProductiveRecruit | Señalado como competidor directo en revisiones previas | Funciones, público (¿familias o agencias?), precios, cobertura internacional |
| Agencias tradicionales de becas | Cobran a familias (modelo a contrastar) | Estructura de tarifas y si dependen de la beca |
| Excel + WhatsApp + Gmail | Alternativa gratuita por defecto (hipótesis) | Tiempo real invertido por semana |

No se publicarán comparativas con competidores sin fuente fechada.

## 4. Plan de investigación por ciclo (2 semanas, cadencia de la skill)

Objetivo mínimo por ciclo: **5 profesionales** (agentes/agencias) + **5 atletas/familias**. Si no hay acceso, se
documenta «0 realizadas» y no se rellena con suposiciones.

### Guion · agente/agencia (45 min, observación > opinión)
1. «Enséñame cómo llevas hoy a tus atletas» (compartir pantalla de su hoja o herramienta). Medir columnas, nº atletas, tiempo de alta.
2. «Cuéntame el último contacto con un coach: cómo lo enviaste, cómo supiste si respondió».
3. «¿Cuánto tardaste la última vez en reunir vídeo, notas, inglés y pasaporte de un atleta?»
4. «¿Cómo cobras? ¿Depende de la beca o de la colocación?» (sin juicio; solo registrar).
5. «¿Qué pagas hoy en herramientas? ¿Qué dejarías de pagar?»
6. Prueba: importar su CSV real anonimizado en staging (cuando exista E1) y cronometrar.
7. Cierre: ofrecer el precio fundador (47/119 €) con prueba de 30 días; registrar sí/no/objeción literal.

### Guion · atleta/familia (30 min)
1. «¿Quién te ayuda hoy con el proceso? ¿Qué te preocupa de esa persona?»
2. Mostrar una invitación de reclamación (prototipo): «¿Qué entiendes? ¿La aceptarías? ¿Qué te frenaría?»
3. «¿Qué documentos crees que necesitas para ir a EE. UU.?» (contrastar con los 6 hitos).
4. Para familias: «¿Pagarías por Core/Elite? ¿Por qué no?»

### Registro de cada sesión
Fecha · segmento · país · deporte · consentimiento de grabación · tareas observadas · minutos medidos · herramientas y
coste declarado · citas literales · señal de pago (ninguna / verbal / LOI / pago) · actualización del `PROBLEM_LEDGER`.
Menores: solo con tutor presente y sin almacenar datos identificativos en estas notas.

## 5. Señales de disposición a pagar que contarán como evidencia

En orden de fuerza: pago real en Stripe > tarjeta en prueba de 30 días > LOI firmada > compromiso de importar su cartera
> interés verbal. El interés verbal por sí solo no cambia el rango de un problema.

## 6. Preguntas abiertas para Gala
- ¿Qué 5 agencias/agentes puede contactar personalmente este ciclo (red NCAA propia)?
- ¿Se graba con consentimiento o solo notas?
- ¿Confirmamos foco de deporte del piloto? (`docs/LAUNCH_FOCUS.md` vs `docs/STRATEGY.md` §E difieren).
