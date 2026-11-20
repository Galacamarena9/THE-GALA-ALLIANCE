# Family Experience · QA E2E y pulido (Prompt 10D)

> Cierre de la fase Familia. TEST → IDENTIFY → FIX → RETEST → POLISH sobre el producto real, sin funcionalidades nuevas
> grandes. Regla de producto aplicada: **la familia ve arriba lo que tiene que hacer, lo demás a un toque, y nada de relleno.**

## 1. Estado

```
FAMILY EXPERIENCE STATUS
BLOCKERS  0
CRITICAL  0
HIGH      0 abiertos (2 encontrados y corregidos)
MEDIUM    0 abiertos (5 encontrados y corregidos)
LOW       2 en backlog
POLISH    3 aplicados
```

**Veredicto: Family Experience CERRADA.** Se cumplen las condiciones del punto 65 del prompt:

- funciona el recorrido principal;
- pasan RLS y los ataques de 10C;
- compartir documentos funciona y se puede retirar;
- el Cost Center no inventa cifras;
- los permisos de tutor funcionan.

## 2. Registro de incidencias

| ID | Severidad | Dónde | Problema | Corrección | Prueba |
|---|---|---|---|---|---|
| QA-F07 | High | Solicitudes de documentos | Un tutor activo de un menor no podía aprobar una solicitud sin «editar perfil»: el panel le pedía revisarla y el botón fallaba. | `respond_info_request`, `guard_document_grant` y la policy de concesiones aceptan el permiso `documents.approve_share` (tutor activo de menor). | P10D (recorrido completo) |
| QA-F02 | High | Panel y Privacidad | «Dejar de seguir» / «Desvincular» actuaba con un solo clic, sin explicar consecuencias. | Confirmación en dos pasos que explica qué cambia y qué no; el servidor exige `confirm=yes`. | Manual + build |
| QA-F03 | Medium | Invitar familia | Cada clic creaba otra invitación pendiente. | Se reutiliza la invitación pendiente y vigente. | Manual |
| QA-F04 | Medium | Aceptar invitación | Aceptar estando ya vinculados daba un error genérico. | Mensaje «Ya estáis vinculados». | Manual |
| QA-F05 | Medium | Invitación sin sesión | Al crear la cuenta se perdía el enlace. | El texto indica volver a abrir el mismo enlace. | Manual |
| QA-F01 | Medium | Panel (móvil) | La tabla de candidaturas obligaba a desplazarse en horizontal. | Lista de bloques que se adapta a 320 px. | e2e sin desbordamiento |
| QA-F06 | Medium | Onboarding | Tras aceptar no se explicaba qué puede ver la familia ni qué aprueba. | Tarjeta de bienvenida en 4 puntos y enlace a avisos. | e2e «bienvenida» |
| QA-F08 | Medium | Seguridad | No existía un sitio único con accesos activos y contactos pendientes; la pestaña «Seguridad» abría la bandeja de mensajes. | Nuevo **Centro de seguridad** (`/app/family/safety`): accesos activos con «Retirar acceso» confirmado, accesos terminados, contactos que esperan aprobación y controles en un sitio. | smoke + RLS P10D |
| QA-P01 | Polish | Cabecera | «Family Command Center»: jerga en inglés y texto largo. | «Familia · Lo que necesita vuestra atención». | — |
| QA-P02 | Polish | Copy | «Incompleto» en el neto. | «Sin datos suficientes» + explicación. | — |
| QA-P03 | Polish | Enlaces | «Solicitudes» → «Revisar solicitudes»; «Bandeja» → «Centro de seguridad». | — | — |
| QA-L01 | Low | Conversión de moneda | No hay tipo de cambio con fecha: no se convierte, se muestra la moneda original. | Backlog: fuente oficial de tipos con fecha. | — |
| QA-L02 | Low | Preferencias de aviso por hijo | Las preferencias son por categoría, no por hijo. | Backlog. | — |

## 3. Recorrido E2E (punto 60) — verificado en la base de datos

Prueba P10D en `npm run test:rls`:

1. Club A pide el expediente.
2. La madre (sin «editar perfil») lo aprueba.
3. Club A lo abre y queda registrado en auditoría.
4. Club B no lo abre.
5. La madre lo retira.
6. Club A pierde el acceso al instante.
7. El pipeline no cambia.

También con una concesión directa: la madre la crea y la retira, y un tutor en pausa no puede crearla.

## 4. Puntuación

| Área | Nota | Comentario |
|---|---|---|
| Onboarding | 8 | Bienvenida en 4 puntos. |
| Dashboard | 8 | Acción primero, luego plazos, proceso, costes, documentos, seguridad. |
| Recruiting clarity | 8 | Universidad guardada, oportunidad, oferta y decisión se nombran distinto. |
| Costs | 9 | «Desconocido» visible; nunca una cifra falsa. |
| Documents | 8 | Ya se puede aprobar y retirar con contexto (QA-F07). |
| Consent | 8 | Centro de seguridad con accesos activos y terminados. |
| Safety | 8 | Un solo sitio para todo. |
| Offers | 8 | Estructuradas; sin conversión de moneda (QA-L01). |
| Gala AI | 8 | Herramienta de familia con permisos; guardas de 10C. |
| Mobile | 8 | Sin tablas horizontales en el panel; barra con Hoy · Costes · Documentos · Seguridad. |
| Accessibility | 8 | Objetivos táctiles de 44 px, estados con texto (no solo color), `aria-current` en selectores. |
| Performance | 7 | `guardianLinks` hace una llamada `is_active_guardian` por hijo. Con 1-3 hijos es aceptable; se consolidará en el Prompt 18. |
| Visual consistency | 8 | Mismos componentes `Card`, `Badge`, `Notice` y `PageHeader`. La pasada transversal de diseño llega con el cierre global. |

## 5. Regresión

- `npm run test:rls`: todas en verde, incluidos los ataques de 10C y P10D.
- `npm run test:unit`, `lint`, `tsc`, `build`, `check:secrets`: en verde.
- e2e de Familia en 375 px y 1280 px: 12/12.
