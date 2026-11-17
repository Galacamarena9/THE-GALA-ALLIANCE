# Backlog priorizado (Fase 0 → PRs pequeños)

Una propuesta de cambios por ticket; sin mezclar rediseño, migración y permisos. Cada PR: lint, typecheck, test:unit, test:rls, build y E2E con axe (WCAG 2.2).
Estado de partida: lint ✓ · typecheck ✓ · 86/86 tests ✓ · build ✓ (ver [README](README.md)).

## P0: antes de abrir el registro o captar tráfico

| ID | Ticket | Origen | Tipo | Archivos | Criterio de aceptación | Migración |
|---|---|---|---|---|---|---|
| P0-01 | Estado vacío útil en `/oportunidades`: alerta por deporte, edad, país y destino sin crear cuenta, más "pide que invitemos a una organización" | content-audit | UI + BD | `app/oportunidades/page.tsx`, nueva tabla `opportunity_waitlist` | Dado un marketplace vacío, cuando dejo email y preferencias, se guarda con consentimiento explícito y finalidad única; sin email, nada se envía | Nueva tabla con RLS (solo insert anónimo y lectura admin); reversible |
| P0-02 | Quitar el mensaje repetido en `/oportunidades` | content-audit | UI | `app/oportunidades/page.tsx` | Una sola explicación de confianza | — |
| P0-03 | Mecanismo de recurso DSA: botón "Recurrir" en la decisión, con registro y plazo | PRIV-02, CONT-03 | BD + UI | `content_reports`, `app/app/admin` | Una decisión de moderación permite un recurso que entra en cola con estado y fecha | Columnas nuevas, reversible |
| P0-04 | Plan de inventario real (no es código): 25-50 organizaciones socias y 100-300 oportunidades en un corredor y 1-2 deportes | auditoría externa | Negocio | — | Lista de socios con responsable y fecha | — |
| P0-05 | Revisión jurídica: transferencias internacionales, menores, términos, NIL y agentes | PRIV-04 | Legal | `docs/legal/` | Borradores revisados y firmados | — |

## P1: confianza, seguridad y conversión

| ID | Ticket | Origen | Archivos | Criterio de aceptación |
|---|---|---|---|---|
| P1-01 ✅ | Columnas internas fuera del alcance de `anon` en oportunidades (`review_note`, `created_by`, `reviewed_by`) y organizaciones (`created_by`, `verified_by`) | T-01 | `20261116001000_public_column_privileges.sql`, consultas públicas con `is_reviewed` | 5 pruebas RLS; fallan sin la migración |
| P1-02 ✅ | Arreglar el nombre accesible del logo (WCAG 2.5.3) | A11Y-01 | `components/Logo.tsx` | axe con etiquetas 2.2 sin infracciones en las rutas públicas |
| P1-03 ✅ | Cartera a 320 px | A11Y-02 | `app/app/portfolio/PortfolioView.tsx` | Sin desborde a 320 px |
| P1-04 ✅ | E2E con la etiqueta `wcag21a` que faltaba | A11Y-03 | `e2e/smoke.spec.ts` | El CI falla ante infracciones graves de 2.2 |
| P1-05 | Sello clicable con "qué se verificó, cuándo, por quién y qué no significa" | content-audit | `TrustSeal`, `trust.ts` | Cada comprobación muestra su fecha y su fuente |
| P1-06 | Filtros avanzados en `/oportunidades` con estado en la URL | content-audit | `app/oportunidades` | Deporte, país, división, plazo y ayuda; URL compartible |
| P1-07 | Conservar el contexto al registrarse desde una oportunidad | content-audit | `signup`, `onboarding` | Tras el onboarding se vuelve a la oportunidad |
| P1-08 | Señales de riesgo en mensajes (pagos privados, secreto, salida a WhatsApp/Telegram, gift cards, cripto) | PRIV-06, T-04 | trigger o acción + aviso en la UI | Aviso al destinatario y cola de revisión humana; nunca bloqueo automático grave |
| P1-09 | Observabilidad: errores de servidor y cliente con datos personales eliminados | T-11 | Sentry u OpenTelemetry (necesita cuenta) | Errores visibles con alertas; sin datos personales |
| P1-10 | Analítica sin datos personales y con consentimiento (rol, deporte, franja de edad, país) | PRIV-05, PERF-03 | `lib/events.ts`, catálogo | Ningún evento contiene texto libre ni identificadores directos |
| P1-11 | Verificación de la persona dentro de la organización (L2) | PERM-01, T-02 | BD + admin | El contacto con menores exige L2 |
| P1-12 | Agentes: licencia, jurisdicción, vigencia y mandato | PERM-02 | BD + UI | Sin mandato no hay "representa a" |
| P1-13 | Retención por tipo de dato | PRIV-03 | `run_retention()` | Tabla de plazos aplicada y probada |
| P1-14 | Umbral de edad digital por país | PRIV-01 | `age.ts` + BD | Configurable; España validada por un jurista |
| P1-15 | i18n ES/EN en las páginas públicas | CONT-05 | `content/`, componentes públicos | Home, oportunidades y seguridad en inglés |

## P2

Webhook de Stripe sin notificaciones duplicadas (T-05) · límite de tiempo en las consultas públicas (T-09, PERF-01) · antivirus en las subidas (T-07) ·
cuatro ojos en administración (T-08, PERM-05) · `security.txt` y política de divulgación (T-12) · declaración de accesibilidad (PRIV-08) ·
fecha de vigencia y versión en los textos legales (CONT-04) · borrar `Timeline.tsx` (CONT-06) · Readiness como "x de y" (CONT-01) · SSO/SCIM, API y avisos de datos (fase posterior).

## Orden de los PRs propuesto

1. **P1-01** (seguridad de datos, pequeño, con prueba RLS) · 2. **P1-02 + P1-03 + P1-04** (accesibilidad, un PR) · 3. **P0-02 + P0-01** (oportunidades útiles aunque estén vacías) ·
4. **P1-07** · 5. **P1-05** · 6. **P1-06** · 7. **P0-03** · 8. **P1-08** · luego P1-09 y P1-10 (necesitan cuentas o decisiones) y el resto.
