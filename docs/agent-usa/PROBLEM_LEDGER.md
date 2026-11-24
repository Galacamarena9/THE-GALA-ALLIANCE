# PROBLEM_LEDGER · problemas de cliente priorizados

> Estado de la evidencia: **HIPÓTESIS**. Ninguna fila procede de entrevistas reales. Origen: revisiones anteriores
> (investigación de escritorio y role-play) + lectura del código. Los minutos, frecuencias y costes son **desconocidos**
> hasta medirlos; se marcan «? (medir)». No se inventan cifras.

## 1. Escala de priorización

Cada dimensión se puntúa cualitativamente: **A** (alta) · **M** (media) · **B** (baja). Esfuerzo: **A** = caro.
Orden = frecuencia y severidad primero, luego disposición a pagar (DAP), efecto red y confianza; el esfuerzo desempata.

| # | Problema (actor) | Frec. | Sever. | Coste actual | DAP | Efecto red | Confianza/riesgo | Esfuerzo | Rango |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Agencia empieza con cartera vacía: no puede importar sus atletas | A (día 1 de cada agencia) | A (bloquea la activación) | ? (medir) | M-A (hip.) | **A** (cada atleta invitado entra a la red) | M | M | **1** |
| P2 | Seguimiento de contactos con coaches disperso (email/WhatsApp/Excel) | A (diario, hip.) | A | ? (medir) | A (hip.: es el trabajo que se cobra) | M (trae coaches como contactos, no como usuarios) | M | M | **2** |
| P3 | Riesgo NCAA: tarifas ligadas a colocación/beca (bylaws 12.02.1 / 12.3.3) | B (por representación) | **A** (elegibilidad del atleta) | ? | B directa / A indirecta | M | **A** | B | **3** |
| P4 | Agencia sin dominio propio queda atascada en verificación | M | A (no puede proponer representación) | ? | — | M | A | B-M | 4 |
| P5 | Sin saber qué documentos/hitos faltan para EE. UU. | A | M | ? | M | B | M | — (hecho #107) | 5 |
| P6 | Familia sin claridad de proceso y coste real | M | A (emocional) | ? | M (Core/Elite, sin ventas aún) | M | M | — (existe) | 6 |
| P7 | Universidades sin talento internacional comparable (liquidez) | ? | M | ? | B en piloto (gratis) | **A** | M | A | 7 |

## 2. Fichas (campos de la skill)

### P1 · Importar cartera + invitación para reclamar
- **Actor:** agente / agencia (owner, recruiter). **Workflow:** dar de alta a los atletas que ya lleva y abrir sus procesos.
- **Disparador:** primer acceso tras registrarse; nuevo atleta firmado fuera de la plataforma.
- **Herramientas actuales (hip.):** Excel/Google Sheets, WhatsApp, carpetas de Drive.
- **Minutos por ocurrencia / ocurrencias al mes:** ? (medir en test de usabilidad con CSV real anonimizado).
- **Coste directo:** ? · **Coste de error/riesgo:** duplicados, datos de menores fuera de control, procesos sin historial.
- **Fricción emocional:** «pago y veo un panel vacío» → abandono en la prueba de 30 días.
- **Workaround hoy en el producto:** ninguno; `guard_recruiting_case()` (`20261116000700_agency_core.sql`) exige representación activa.
- **Comprador:** owner de la agencia. **Beneficiario:** agencia + atleta (Passport gratis, control de su perfil).
- **Evidencia de DAP:** ninguna real. Hipótesis: es condición para que la prueba se convierta.
- **Resultado propuesto:** subir CSV → filas privadas «pendientes de reclamar» → invitación al atleta (o a su familia si es menor) → al aceptar, representación activa y procesos abiertos.
- **Métrica de éxito:** % agencias con ≥1 atleta reclamado en 7 días; % invitaciones reclamadas.
- **Confianza:** media (problema lógico y visible en código; magnitud sin validar). **Siguiente test:** 5 agencias, sesión guiada con su propia hoja.

### P2 · Outreach a coaches con seguimiento
- **Actor:** agente (recruiter). **Workflow:** escribir a coaches por atleta y universidad, perseguir respuestas.
- **Disparador:** proceso en fase `approved_to_contact` / `contacted` (`recruiting_cases.stage`).
- **Herramientas actuales (hip.):** Gmail, plantillas sueltas, hoja de seguimiento.
- **Min./ocurrencia; ocurr./mes:** ? (medir). **Coste directo:** ? (posibles herramientas de mailing de terceros).
- **Coste de error:** coach contactado dos veces, seguimientos olvidados, contacto en ventana NCAA no permitida.
- **Fricción:** alta, repetitiva. **Workaround en producto:** registrar `recruiting_case_activities` a mano; sin envío ni estado.
- **Comprador:** agencia. **Beneficiario:** agencia, atleta (ve avances si `shared_with_athlete`).
- **Evidencia de DAP:** ninguna real; competidor de referencia: ProductiveRecruit (funciones y precios **por verificar** con fuente).
- **Resultado propuesto:** envío desde el proceso con plantilla, estado (enviado/respondido/sin respuesta) y recordatorio en «Necesita atención».
- **Métrica:** tasa de respuesta de coach por proceso; procesos que pasan de `contacted` a `response_received`.
- **Confianza:** media-baja. **Siguiente test:** concierge manual con 3 agencias durante 2 semanas.

### P3 · Cumplimiento NCAA de las tarifas
- **Actor:** agencia (riesgo), atleta (víctima). **Workflow:** proponer representación.
- **Disparador:** `requestRepresentation` (`src/app/actions/marketplace.ts` L95).
- **Herramientas actuales:** contratos propios de cada agencia. **Coste de error:** pérdida de elegibilidad del atleta (grave, irreversible).
- **Mitigación existente:** lenguaje «acompañamiento» + casilla obligatoria (#104).
- **Hueco:** la atestación solo queda en `product_events.props` (no auditable ni conservada; sin props para menores).
- **Comprador:** n/a (higiene de confianza). **Beneficiario:** atleta y familia.
- **Resultado propuesto:** registro inmutable de atestación (versión del texto, fecha, usuario, agencia) + revisión por abogado de EE. UU.
- **Métrica:** 100 % de representaciones activas con atestación registrada. **Confianza:** alta en el hueco técnico; baja en la redacción legal (falta abogado).
- **Siguiente test:** revisión del texto por abogado NCAA (gate de Gala).

### P4 · Verificación de agencia
- **Workaround:** queda en `submitted` hasta revisión de admin. **Métrica:** tiempo hasta `verified` (hoy no se mide: falta evento).
- **Propuesta:** verificación por evidencia (`professional_credentials`, `verification_requests` ya existen) con SLA y visibilidad del estado. **Confianza:** media.

### P5–P7
- P5 resuelto en primera versión (#107); falta medir uso (no hay evento propio).
- P6: oferta Core/Elite existe; sin ventas reales por falta de Stripe live.
- P7: depende de piloto con universidades (`docs/BUSINESS_MODEL.md` «Validación»).

## 3. Build test de la skill para las 3 épicas principales

| Pregunta (`marketplace-core.md`) | E1 · Importar cartera + reclamar | E2 · Outreach a coaches con seguimiento | E3 · Atestación de tarifas auditable |
|---|---|---|---|
| 1. ¿Qué fricción desaparece? | Fragmentación de descubrimiento y coordinación: la cartera vive en Excel | Coordinación: contactos, seguimientos y respuestas en canales sueltos | Asimetría de confianza: la familia no sabe si la agencia cobra por beca |
| 2. ¿Qué actores se conectan mejor? | Agencia ↔ atleta ↔ familia | Agencia ↔ coach universitario ↔ atleta | Agencia ↔ atleta/familia (y Gala como garante) |
| 3. ¿Qué información oculta se vuelve fiable? | Qué atletas representa de verdad (aceptado por el atleta, no autodeclarado) | Estado real de cada contacto (enviado, respondido, fecha) | Compromiso de tarifas con versión y fecha |
| 4. Siguiente acción recíproca | El atleta reclama y completa su Passport | El coach responde; el atleta ve el avance | El atleta/familia acepta la representación con la atestación visible |
| 5. ¿Cómo adquiere/retiene otro lado? | Cada fila importada es una invitación → nuevo atleta (gratis) en la red | Coaches reciben enlaces a Passports → futura captación de universidades | Aumenta aceptación de representación (hip.) |
| 6. ¿Quién paga y por qué no daña liquidez? | La agencia (plan Agente/Agencia); el atleta no paga por reclamar | La agencia (productividad); el coach no paga por responder | Nadie paga; es confianza que sostiene la conversión |
| 7. Métrica que cambia | `athlete_claimed` / invitaciones; activación de agencia a 7 días | Respuestas de coach por proceso; `pipeline_advanced` en agencias | % representaciones con atestación; tasa de aceptación |

## 4. Reglas de mantenimiento
Actualizar cada ciclo de 2 semanas con evidencia real; cambiar «hip.» por «validado (n=…)» solo con entrevistas o
datos registrados. Si una ficha no gana evidencia en 2 ciclos, bajarla de rango.
