# ROADMAP · próximos 3 ciclos de 2 semanas

> Un corte vertical por ciclo (UI + server action + migración aditiva + RLS + pruebas + eventos), con métrica
> predefinida. Las metas numéricas son **objetivos de validación propuestos**, a confirmar por Gala; no son logros.
> Fechas orientativas desde 2026-11-24. Coordinar con el agente que ya construye la importación (ciclo 1).

## Pre-requisito transversal (en paralelo, gates de Gala)

| Gate | Desbloquea | Responsable |
|---|---|---|
| Stripe live + Stripe Tax + portal | Medir pago real de agencias (ciclos 1–3) | Gala |
| Supabase Pro producción | Datos reales de agencias fuera de staging | Gala |
| Dominio + Resend verificado | Correos de reclamación (C1) y outreach (C2) | Gala |
| Entidad/NIF, términos B2B, DPA | Cobro y tratamiento por encargo de la cartera importada | Gala + asesor |
| Abogado NCAA (EE. UU.) | Texto definitivo de atestación (C3) | Gala |
| Decisión de hosting (D-07) | Despliegue de producción | Gala |

## Ciclo 1 (≈ 25-nov → 8-dic) · «Mi cartera desde el día 1»

**Épica E1: importar cartera + invitación para reclamar** (en construcción por otro agente; este plan es la vara de medir).

- Corte vertical:
  1. Subir CSV (reutilizar `parseCsv` de `src/lib/domain/csv-import.ts`) → vista previa con errores por línea.
  2. Tabla aditiva de importaciones (ver `DATA_MODEL.md` §6.1) con RLS por agencia (ver `RLS_MATRIX.md` §5).
  3. Invitación por correo con token hash de un solo uso y caducidad; menores → invitación al tutor.
  4. Reclamar = RPC que deriva en `representation_request` aceptada por el atleta/tutor; nunca crea Passport sin la persona.
  5. Estado vacío del Inicio (`docs/AGENT-HOME.md` §E «Vacío») muestra «Importar mi cartera».
- Eventos nuevos: `athlete_claim_invited`, `athlete_claim_opened`, `athlete_claimed`, `agency_case_created`.
- Pruebas: unitarias del parser y estados; RLS negativas (otra agencia, viewer, token caducado/reusado, menor sin tutor);
  e2e importación → invitación → reclamación; axe a 360/768/1440.
- **Métrica:** % de agencias activadas (≥1 atleta reclamado en 7 días). Objetivo propuesto: medir línea base con las primeras 5 agencias piloto.
- Secundaria: % invitaciones reclamadas en 7 días.
- Parar/iterar si: <1 de 5 agencias piloto llega a importar su hoja (problema de UX o de confianza, no de código).

## Ciclo 2 (≈ 9-dic → 22-dic) · «Escribir a coaches y saber quién responde»

**Épica E2: outreach a coaches con seguimiento.**

- Corte vertical:
  1. Desde un proceso (`recruiting_cases`) en `approved_to_contact`: plantilla EN editable con enlace al Passport compartido (`recruiting_links`).
  2. Envío vía Resend con remitente de la agencia (reply-to), registro en `recruiting_case_activities` extendida.
  3. Estado: enviado / rebotado / respondido (respuesta marcada por el agente o por webhook) / sin respuesta a N días.
  4. Recordatorio automático en «Necesita atención» (nuevo tipo en `buildAttention()`, rango 2–3).
  5. Guardia NCAA orientativa: aviso si `ncaa_contact_opens_on` indica ventana cerrada (texto «orientativo», `docs/NCAA-1-AUDIT.md` §H).
- Eventos: `coach_outreach_sent`, `coach_reply_logged`, emitir `pipeline_stage_changed` también en cambios de fase de agencia.
- Pruebas: RLS (otra agencia, viewer no envía, representación revocada no envía — reutilizar `agency_may_message`);
  e2e enviar → respuesta → fase avanza; límites de envío por día (cuota en `plan_catalog.features`).
- **Métrica:** tasa de respuesta de coach por proceso contactado y nº de procesos que pasan de `contacted` a `response_received` por agencia/semana. Línea base primero; sin objetivo inventado.
- Consentimiento: los coaches son contactos profesionales de la agencia (responsable = agencia; requiere DPA). Incluir baja en cada correo.

## Ciclo 3 (≈ 23-dic → 5-ene) · «Confianza que se puede enseñar» + cobro real

**Épica E3: atestación de tarifas auditable + instrumentación de ingresos.**

- Corte vertical:
  1. Tabla append-only de atestaciones (`DATA_MODEL.md` §6.3) escrita dentro de la RPC `representation_request`.
  2. El atleta/familia ve en la propuesta: «Esta agencia declara que sus tarifas no dependen de la beca» con fecha y versión.
  3. Panel de cumplimiento de la agencia: representaciones sin atestación (las anteriores a #104).
  4. Webhook emite `subscription_started`; cupo fundador de 15 agencias (`BUSINESS_MODEL.md` I1) con contador visible.
  5. `organization_verified` como evento; verificación por evidencia para agencias sin dominio propio (P4).
- Pruebas: append-only (update/delete denegados), cupo fundador concurrente (16.ª agencia paga lista), webhook idempotente.
- **Métrica principal:** % de representaciones activas con atestación registrada (objetivo: 100 % de las nuevas).
- **Métrica de negocio:** agencias en prueba → pago al día 30 (solo medible si Stripe live está activo).

## Fuera de estos 3 ciclos (backlog ordenado)

1. Herramientas de agente en Gala IA (`AI_SYSTEM.md` §4).
2. `ncaa_rule_sets` versionado sin datos hasta tener fuente (`docs/NCAA-1-AUDIT.md` §F.2).
3. Mitigar cascadas de borrado de organización (`docs/ARCHITECTURE-AUDIT.md` C1).
4. Evaluaciones estructuradas por deporte.
5. Sentry + comprobación sintética de alta y reclamación.

## Cadencia por ciclo (skill)

5 entrevistas profesionales + 5 atleta/familia (`CUSTOMER_RESEARCH.md` §4) · revisión de embudo y tickets ·
actualizar `PROBLEM_LEDGER.md` · un corte vertical · informe de ciclo con evidencia vs predicción en `CHANGELOG.md`.
