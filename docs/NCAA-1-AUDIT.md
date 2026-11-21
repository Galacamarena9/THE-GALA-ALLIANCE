# NCAA-1 · Auditoría del corredor Atleta internacional → Universidad de EE. UU.

Alcance: solo auditoría (fase NCAA-1 del dossier USA/NCAA, noviembre 2026). **No se ha implementado nada**,
no se ha creado ninguna regla NCAA y no se afirma ninguna elegibilidad oficial.

## A. Lo que ya existe en el repositorio (USA/NCAA)

| Área | Entidades reales | Observación |
|---|---|---|
| Divisiones | enum `division` (`ncaa_d1`, `ncaa_d2`, `ncaa_d3`, `naia`, `njcaa`) | Sin separación por deporte ni por género del programa. |
| Universidades | `institutions` (IPEDS `unitid`), `institution_programs` (deporte, género, asociación, división, conferencia, `source`, `verified_at`), `institution_claims` | Directorio con datos oficiales del U.S. Department of Education; buena base de origen y fecha. |
| Passport académico | `athlete_academics` (GPA + escala, `gpa_4` **lineal**, inglés, SAT/ACT, curso) | `gpa_4` es una aproximación: el propio esquema dice que no es la conversión oficial. |
| Evidencia y confianza | `data_source` (`self_reported`, `documented`, `club_verified`), `verification_requests/evidence/decisions/checks`, `athlete_documents`, `document_access_grants`, `process_documents` | Existe jerarquía parcial: falta «determinación oficial» y caducidad por dato. |
| Oportunidades y becas | `opportunities` (división, coste, ayuda, plazo), `opportunity_requirements`, `athlete_offers` (coste, ayuda, renovable, por escrito, plazo) | `athlete_offers` es editable: **sin versiones inmutables** ni condiciones estructuradas. |
| Match | `gala-match` (motor + cambios), `match_signals` | Mezcla encaje deportivo y académico; no hay estado PASS/FAIL/UNKNOWN de elegibilidad separado. |
| Contacto / introducción | `contact_requests` (+ tutor para menores), `recruiting_links`, `info_requests` | Guardia de contacto en base de datos (bien), pero ver §D. |
| Recruiting | universidad: `recruiting_needs`, `org_candidates`, `org_tasks`, `org_activity`; agencia: `recruiting_cases` (+ actividades, tareas); atleta: `pipeline_*` | Tres capas que se reutilizan; no hay hitos de visita oficial/no oficial. |
| Menores y tutor | `parent_athlete_links`, `consents`, `is_minor_guardian_of`, aprobación de tutor en contacto | Sólido y probado (RLS). |
| Reglas NCAA en código | `public.ncaa_contact_opens_on()` + `src/lib/domain/ncaa.ts` (`ncaaContactOpensOn`, `NIL_GO_THRESHOLD_USD = 600`) | **Reglas escritas a mano, sin versión, fuente ni fechas de vigencia** (ver §D y §H). |
| Movilidad | — | No existe nada de I-20, visado, llegada ni matrícula. |

## B. Dominios reutilizables (REUSE → EXTEND)

- **Passport + bloques de visibilidad** (`can_view_athlete`): base para la proyección segura de elegibilidad.
- **Verificación central** (`verification_*` + `data_source`): extender con «official_determination» y caducidad, no crear otra cola.
- **Documentos con concesión** (`athlete_documents` + `document_access_grants`): sirve para expedientes, traducciones e I-20 si se añade clasificación de privacidad.
- **Oportunidades + requisitos** (`opportunity_requirements`): extender para requisitos por división/deporte con versión de regla.
- **Recruiting de organización** (`recruiting_needs`, `org_candidates`): roster needs y candidatos ya existen; añadir intake y checkpoints.
- **Procesos del atleta** (`pipeline_*`) y **casos de agencia** (`recruiting_cases`): hitos de admisión y movilidad como tareas, no como sistema paralelo.
- **Ofertas** (`athlete_offers`): extender con versiones inmutables; no crear una segunda tabla de becas sin reconciliar.
- **Analítica** (P17) con supresión de cohortes pequeñas ya prevista en `log_event` para menores.

## C. Entidades y flujos que faltan (contra el dossier)

| Dossier | Estado real | Propuesta |
|---|---|---|
| `ncaa_rule_sets` | No existe | NUEVA: reglas versionadas con `source_url`, `source_title`, `effective_from/to`, `verified_by`, `verified_at`. |
| `ncaa_eligibility_profiles/requirements/results` | No existe | NUEVA, con estados del dossier y PASS/FAIL/UNKNOWN; resultados guardan versión de regla y snapshot. |
| `ncaa_recruiting_periods` | No existe (solo la función fija) | NUEVA: periodos contact/quiet/dead/evaluation por deporte, división y temporada, **cargados desde fuente oficial**. |
| `university_roster_needs` | Equivale a `recruiting_needs` | EXTEND (temporada, intake, plazas) en lugar de duplicar. |
| `scholarship_packages` + `_versions` | Parcial: `athlete_offers` | EXTEND con versiones inmutables y condiciones; clasificación de privacidad. |
| `admission_checklists` | No existe | NUEVA sobre `process_documents`/tareas. |
| `mobility_cases` / `mobility_tasks` | No existe | NUEVA (P1), con PII de inmigración aislada y sin entrar en analítica. |
| `compliance_events` | Parcial: `audit_logs`, `pipeline_events` | EXTEND o vista sobre auditoría append-only. |
| Visitas oficiales/no oficiales | No existe | Hitos en el proceso del atleta y de la organización. |
| Autoridad de aceptación (tutor/agente) | Parcial: permisos de agente (`agent_can`) y tutor | Añadir permiso explícito `offers.accept` verificado en la RPC de aceptación. |

## D. Fuentes oficiales necesarias antes de implementar

Ninguna regla se debe programar sin estas fuentes vigentes, con fecha de consulta y de vigencia:

| Regla | Fuente que hay que consultar | Estado en el repo |
|---|---|---|
| Ventana de primer contacto por deporte y división | Manuales de Division I y II de la NCAA (ncaa.org) y calendarios de reclutamiento por deporte | **Hard-coded** en `ncaa_contact_opens_on` (D-I 15 jun / béisbol 1 ago / lacrosse 1 sep; D-II 15 jun). Revisar contra el manual vigente. |
| Periodos contact/quiet/dead/evaluation | Calendarios oficiales de la NCAA por deporte y temporada | No implementado. |
| Visitas oficiales y no oficiales | Manuales NCAA por división | No implementado. |
| Elegibilidad académica (core courses, GPA, tests) | NCAA Eligibility Center | No implementado; `gpa_4` no es la conversión oficial. |
| Amateurismo / NIL | NCAA y College Sports Commission (NIL Go) | **Hard-coded** umbral de 600 $ y 5 días hábiles en `ncaa.ts`. Revisar contra la fuente vigente. |
| Equivalencia de expedientes extranjeros | Eligibility Center y cada universidad | No implementado. |
| I-20 y visado de estudiante | Study in the States (DHS/SEVP) y Departamento de Estado de EE. UU. | No implementado. |
| NAIA / NJCAA | NAIA Eligibility Center y NJCAA | El repo las trata «sin límite de contacto»: verificar. |

## E. Riesgos de datos y privacidad

| Control | Riesgo en el estado actual |
|---|---|
| NCAASEC-003 (regla desactualizada) | **Alto**: dos reglas fijas sin versión ni fecha de vigencia. Cualquier cambio de calendario las deja obsoletas sin aviso. |
| NCAASEC-004 (estado oficial falso) | Medio: no hay estado oficial todavía; al crearlo, solo una fuente con rol `official` podrá escribirlo (servidor, nunca cliente). |
| NCAASEC-011 (mutación de oferta compartida) | **Alto** al lanzar becas: `athlete_offers` se puede editar. |
| NCAASEC-012 (agente/tutor revocado acepta) | Medio: no hay RPC de aceptación con comprobación de autoridad vigente. |
| NCAASEC-013 (PII de visado/I-20) | No aplica aún; diseñar tabla aislada, sin exportación a analítica ni logs. |
| NCAASEC-005/006/007/015 | Cubiertos hoy por RLS (aislamiento entre organizaciones, finanzas familiares, menores, supresión en analítica): mantener las pruebas. |
| NCAASEC-001/002 (FAIL compensado, UNKNOWN como FAIL) | No aplica aún: el Match actual no tiene capa de elegibilidad. Debe nacer separada. |

## F. Backlog y migraciones propuestas (aditivas)

1. **NCAA-001 Source map** (este documento) — hecho.
2. **NCAA-002 `ncaa_rule_sets`** + migrar `ncaa_contact_opens_on` a leer la regla vigente (manteniendo la función como fachada). Sin datos hasta tener fuente.
3. **NCAA-006/007** requisitos por división/deporte y periodos de reclutamiento como datos versionados.
4. **NCAA-008** guardia de contacto/visita que devuelve `ALLOWED / DENIED / NEEDS_COMPLIANCE_REVIEW` con la versión de regla usada.
5. **NCAA-002/003/012** perfiles y resultados de elegibilidad (pre-assessment ≠ evidencia verificada ≠ determinación oficial).
6. **NCAA-013/014/015** versiones inmutables de oferta + RPC de aceptación con autoridad de atleta/tutor/agente.
7. **NCAA-009/010/011/019** roster needs extendidos, proyección NCAA en Discovery y factores de Match con FAIL duro.
8. **NCAA-016/017/018** admisión e I-20/visado (P1) con PII aislada.
9. **NCAA-020** analítica con supresión.

## G. Plan de pruebas

- **Unitarias**: evaluador de elegibilidad (UNKNOWN ≠ FAIL; FAIL no compensable), selección de regla por fecha de vigencia, guardia de contacto con regla caducada → `NEEDS_COMPLIANCE_REVIEW`.
- **RLS/adversariales** (suite NCAA-024): cliente que intenta escribir un resultado oficial; versión de oferta compartida que se intenta editar; tutor o agente revocado que acepta; universidad B que lee candidatos de A; PII de visado desde analítica; cohorte pequeña en métricas.
- **Golden paths e2e**: atleta internacional, universidad, menor + tutor.
- **NO-GO automático** (los del dossier) como comprobaciones de CI.

## H. GO / NO-GO

- **NO-GO para implementar reglas NCAA** hasta tener las fuentes oficiales de §D con fechas de vigencia (decisión de producto/legal, no técnica).
- **GO para la infraestructura sin reglas**: `ncaa_rule_sets` vacío, estados de elegibilidad, versiones de oferta y autoridad de aceptación pueden construirse ya, porque no afirman nada oficial.
- **Acción recomendada ya**: marcar en la interfaz que la ventana de contacto y el umbral NIL actuales son orientativos y deben validarse, o moverlos a `ncaa_rule_sets` con su fuente en cuanto se verifique.
