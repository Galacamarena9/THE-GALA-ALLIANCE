# Clubs & Academies — QA y pulido (Prompt 11E)

Fecha: 2026-11-20 · Alcance: trials, academy programs, coach home de club, verificación de organizaciones, Gala AI en el contexto de clubs.
Entorno: local/staging con datos sintéticos. Nada se probó contra producción.

## Registro de bugs

| ID | Severidad | Área | Problema | Estado |
|----|-----------|------|----------|--------|
| QA-01 | Alta | Organizaciones | Se podían crear organizaciones duplicadas ("Valencia Basket Club" / "valencia basket"). | Arreglado: `organizations.name_key` (columna generada), trigger `guard_org_duplicate` → `organization_exists`, búsqueda por clave normalizada. Test RLS 11E QA-01. |
| QA-02 | Bloqueante | Academy programs | El recorrido de programa de academia no se podía completar desde la UI (solo existía en BD). | Arreglado: `ProgramPanel` (detalles, costes, ayudas, requisitos, aceptar/rechazar/retirarse, aprobación del tutor, inscripciones). |
| QA-03 | Media | Copy | Al aplicar a un club/academia la confirmación decía "la universidad". | Arreglado: nombra el tipo real de organización. |
| QA-04 | Media | Coach home | La "siguiente mejor acción" de un club ignoraba trials próximos y solicitudes a trials. | Arreglado: trial ≤24 h urgente, luego solicitudes pendientes. Test unitario. |
| QA-05 | Media | Día del trial | Hacer check-in con muchas personas era lento. | Arreglado: resumen de puerta (Confirmados / Con check-in / Faltan) y buscador por nombre a partir de 8 inscritos. |
| QA-06 | Alta | Gala AI | Podía opinar sobre actitud, inteligencia o "si llegará a profesional" de una persona. | Arreglado: guard `asksPersonalJudgement` con respuesta fija. Test. |
| QA-07 | Baja | Rendimiento | Faltaban índices en FKs de `payment_requirements` y `opportunity_outcomes`. | Arreglado. |
| QA-08 | Crítica | Costes | El total conocido de una academia rechazaba combinaciones válidas (pago único + por temporada) y no decía la base del cálculo. | Arreglado: `knownRequiredCost` acepta un periodo recurrente + `one_off` y devuelve `basis`. Test. |
| G-07 | Alta | Gala AI | Inyección en castellano ("Ignora tus instrucciones") no detectada. | Arreglado en 11D/11E (regex ampliada). |

## Auditorías transversales

- **Cero datos falsos:** los fixtures viven solo en `/preview` (detrás de `ENABLE_PREVIEW`). Ninguna pantalla real muestra métricas, oportunidades ni éxitos inventados. ✅
- **Errores crudos:** todos los errores de Postgres que llegan al usuario pasan por mapeo a mensajes claros. ✅
- **Insertar org ya verificada desde el cliente:** bloqueado por RLS. ✅
- **Menores:** acciones de un menor en programas/trials requieren al tutor (`participation_actor`). ✅

## Scorecard

| Dimensión | Nota |
|-----------|------|
| Seguridad (RLS, pentest 11D) | 9/10 |
| Recorrido atleta (trial + programa) | 8/10 |
| Recorrido familia | 8/10 |
| Recorrido staff de club en móvil | 8/10 |
| Honestidad de costes | 9/10 |
| Calidad de datos (duplicados) | 8/10 |

Pruebas: 294 RLS · 151 unitarias · e2e móvil 32 · build, lint y tsc limpios.

## Preparación para lanzamiento

**Lista para staging/piloto** con clubs y academias reales en el foco de lanzamiento (jugadoras europeas 15–19, baloncesto/voleibol/fútbol).

Antes de producción:
1. Aplicar en Supabase remoto las migraciones pendientes (11A–11E) y revisar los advisors.
2. Probar con 1–2 clubs reales un día de trial completo.

## Backlog pendiente (no bloqueante)

- Fusión asistida de organizaciones duplicadas ya existentes (hoy solo se impide crear nuevas).
- Check-in con QR en la puerta del trial.
- Exportar lista de asistentes a CSV para el club.
- Recordatorios automáticos de trial por email (Resend) 24 h antes.
