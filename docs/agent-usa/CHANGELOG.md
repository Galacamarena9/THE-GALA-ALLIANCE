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

## [QA agente] 2026-11-26 · Prueba visible, contratar sin callejones, mensajes y bandeja que dicen a quién contestar
Origen: QA de la vista del agente (`/tmp/qa/agente.md`, hallazgos 1-8, 10, 11 y 20). GALA MONSTER OS: 05 Engineering, revisa 06 QA. Riesgo L3 (fuera de producción); migración aditiva.
Cambios (rama `fix/agente-flujos`):
- Prueba y cupo: aviso en Hoy y en Mis atletas con días que quedan y atletas usados/límite, urgente con ≤ 5 días, rojo sin plan y con plan contratado solo al acercarse al límite (`planBanner`, `PlanBanner`). Acceso directo a Facturación.
- Checkout: Stripe ya no regala otros 30 días. La prueba enviada es la que queda de la app; 0 si terminó o si la agencia ya tuvo suscripción (`checkoutTrialDays`, con prueba unitaria). Botón «Contratar» con «sin cargo hasta que acabe tu prueba» solo cuando es verdad.
- Sin claves de Stripe: «Solicitar alta» registra la solicitud con el flujo existente (`requestPlan` → `service_requests`, evento `plan_requested`); `requestPlan` acepta ahora los planes de agencia.
- Ficha 360: «Mensaje» abre la conversación de la agencia o, si no existe, `/app/inbox/nuevo` para escribir el primer mensaje (`openAgencyThread`; con menores la base de datos lo manda a la familia). Ya no lleva al perfil público, y sin permiso `messages.participate` no se ofrece.
- Bandeja: cada hilo muestra al atleta (y «su familia» si es menor), extracto del último mensaje y de quién es, no leídos y «Te toca responder»; primero lo que espera respuesta. Migración `20261223000500_contact_thread_reads.sql` (marca de lectura propia, solo vía `contact_mark_read`, sin escritura directa; ROLLBACK en cabecera).
- Cartera vacía: Hoy y Mis atletas proponen primero «Importar mi cartera (Excel/CSV)» (ancla `#importar`); «Buscar talento» queda secundario. El texto de importación ya no promete un envío que no existe: «te damos un enlace por atleta para que se lo envíes».
- Misma siguiente acción en Hoy y Mis atletas (`nextStepFor`; una oferta que caduca manda). Contadores de Hoy «Ofertas» y «Necesitan atención» filtran Mis atletas; «Revisar oferta» abre la pestaña de oportunidades.
- Tablero: botones accesibles «fase anterior / siguiente» en cada tarjeta (`moveCase`, que ya no falla en silencio).
- Fuentes oficiales según el deporte: FIBA, EuroLeague y federación de baloncesto solo para baloncesto.
Pruebas: unit 306/306; RLS 455/455 (nueva: marcas de lectura); tsc OK; build OK.
Pendiente de Gala (L5): claves Stripe live; si quiere envío real de invitaciones por email (Resend) y que reclamar la invitación acepte la representación.

## [Fase 8 auditoría] 2026-11-25 · Mínimo privilegio y pulido
Origen: auditoría integral (hallazgos S7, U5–U8). GALA MONSTER OS: 05 Engineering, 06 QA, 03 Design consultado. Riesgo L4 (privilegios) en staging.
Cambios:
- S7: `20261222000100_phase8_least_privilege.sql` retira los privilegios por defecto de Supabase sobre el esquema public y vuelve a conceder solo lo que piden las migraciones; los objetos futuros no heredan nada. `supabase_stub.sql` replica los privilegios por defecto, así que las pruebas ven lo mismo que Supabase. Prueba MP-1.
- Bug encontrado al cruzar privilegios: la ficha de un proceso llamaba a `is_minor` (cerrada desde 11D) y nunca sabía si el atleta era menor; ahora usa `viewer_is_minor`.
- U6: coach y universidad tienen Mensajes en primer nivel (también en la barra móvil); «Mis listas» pasa dentro de «Buscar atletas». «Más» deja de repetir lo que ya está en el menú de usuario (privacidad, planes, invitar).
- U7: en el inicio del agente solo es dorado el botón de lo más urgente.
- U8: la tabla de atletas y el tablero de procesos no desbordan a 1024 px; el tablero desplazable se puede usar con teclado; los enlaces del pie miden al menos 24 px de alto.
- U5: verificado sin cambios (el destino se llama «Mi perfil» en navegación y menú; «Passport» es el contenido).
Pruebas: RLS 454/454 con privilegios por defecto de Supabase; unit 298/298; e2e 406 OK; build OK.
Pendiente de Gala: foto de la fundadora en mejor resolución (U7).

## [Fase 7 auditoría] 2026-11-25 · Errores dentro de la app, «sin acceso» y formatos únicos
Origen: auditoría integral (hallazgos U4 y U3). Riesgo L2. Sin cambios de base de datos.
Cambios:
- U4: `app/app/error.tsx` y `app/app/not-found.tsx`: un fallo o un 404 dentro de la app ya no saca al usuario de su barra lateral. Nueva página `/app/sin-acceso`: entrar en una sección de otro tipo de cuenta lo explica en vez de devolver al inicio en silencio (`requireSession`). En castellano e inglés.
- U3: `src/lib/i18n/format.ts` (`formatHeight`, `formatUsd`, `formatInt`): altura «1,98 m» (inglés «6′6″ (198 cm)») y dólares «18.000 US$» / «$18,000» en Passport, tarjetas, Discover, listas, comparador, vista rápida, CV, ficha /r/…, cartera, familia, Match y universidades.
Pruebas: unit 298/298 (`format.test.ts`); e2e 406 OK; build OK.

## [Fase 6 auditoría] 2026-11-25 · Privacidad fina
Origen: auditoría integral (hallazgos S4, S5, S8, S9, S10 y S11). GALA MONSTER OS: 05 Engineering responsable, 06 QA, Legal & Privacy consultado. Riesgo L4 en staging.
Cambios:
- S4: altura, peso, equipo, liga, objetivos y vídeo destacado ya no se pueden leer de `athlete_profiles` saltándose su bloque; salen por `athlete_block_fields()` / `athlete_block_fields_many()`. `athlete_directory` y la exportación RGPD usan la misma vía.
- S8: `has_contact_data()` detecta emails con «arroba»/«(at)», teléfonos con cifras separadas y más redes; lo usan los mensajes y las novedades de menores. Las listas de años no cuentan como teléfono.
- S9: la ficha /r/… de un menor ya no enseña GPA, inglés ni SAT.
- S5: darse de baja borra también las fotos del Passport y las evidencias de verificación.
- S10: se pueden reproducir vídeos de YouTube (sin cookies) y Vimeo dentro del Passport. `unsafe-inline` sigue (riesgo aceptado, D-26).
- S11: la política de menores explica que una agencia solo ve a un menor si la familia aprueba la representación.
Pruebas: RLS 453/453 (F6-1…F6-3); unit 295/295; e2e 406 OK; build OK.

## [Fase 5 auditoría] 2026-11-25 · Solo un tutor verificado decide por un menor
Origen: riesgo residual de la fase 1 (un adulto falso podía actuar como tutor). Coordinado con GALA MONSTER OS (05 Engineering responsable, 06 QA, Legal & Privacy de la Launch Suite consultado). Riesgo L4 en staging; la verificación con proveedor de identidad es L5 (Gala).
Cambios:
- Migración `20261220000100_phase5_guardian_verification.sql`: declaración del tutor (append-only, versionada), comprobaciones automáticas sin exponer edades, `guardian_decision_ok`, `is_guardian_of` endurecido, triggers en `consents` (consentimiento dado por un tutor) y `contact_requests` (aprobar contacto), cola y decisión de administración con motivo y auditoría, flag `guardian_auto_verify` apagado, evento `guardian_attested`. ROLLBACK en la cabecera.
- Familia: tarjeta «Confirma que eres su tutor legal» con la declaración; mensajes claros si una aprobación se frena. Trust & Safety: cola «Tutores por verificar».
- Exportación RGPD y ERD incluyen `guardian_attestations`.
Pruebas: RLS 450/450 (P5-1…P5-5); unit 293/293; e2e 406 OK con `guardian-verification.spec.ts`; build OK.

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
