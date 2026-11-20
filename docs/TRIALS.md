# Clubs & Academies · 11A · Trials y programas (enfocado al agente)

**Principio:** un solo Opportunity Network. Un trial, camp o programa de academia es una `opportunity` (tipos `tryout`, `camp_showcase`, `academy`, `club_recruitment`). Lo propio de trials vive en `opportunity_event_details` (1:1), no en columnas nuevas de `opportunities`.

## Para quién es (prioridad de producto)
El **agente** es el cliente que paga. En `/app/portfolio/trials` tiene:
1. **Seguimiento** de todos los trials de sus representados, agrupado por lo que necesita acción: pendiente del atleta/familia → esperando al club → confirmados → después del trial → cerrados.
2. **Abiertos para tus atletas**: trials de organizaciones **verificadas** que encajan por deporte, posición y promoción (si el club los indica), con fecha local, lugar, coste, alojamiento y viaje **antes** del botón.
3. **Inscribir** a un representado con un clic. Si el trial es de pago, queda como propuesta: el atleta acepta el coste (el agente nunca compromete dinero del atleta).
4. **Avisos** de cada cambio del club sobre sus atletas (confirmación, lista de espera, asistencia, resultado).

## Estados (`trial_registrations.status`)
`invited` (el club invita) · `interested` · `registered` (inscripción enviada) · `confirmed` (el club confirma la plaza) · `waitlisted` (no es un rechazo) · `declined` · `withdrawn` · `attended` / `no_show` (solo tras empezar el evento y marcado explícitamente) + `outcome` (`follow_up`, `continue_recruiting`, `not_selected`).
«Continuar recruiting» crea o reactiva el candidato en el pipeline del club (`org_candidates.source = 'trial'`). **Nunca crea una oferta.**

## Quién puede hacer qué (en la base de datos, no en la interfaz)
| Acción | Función | Quién |
|---|---|---|
| Inscribir | `trial_register` | Atleta, familia con permiso de edición, agente con representación **activa** |
| Interesado / aceptar coste / retirarse | `trial_respond` | Atleta y familia (aceptar coste); retirarse también el agente |
| Aprobación familiar | `trial_respond('guardian_approve')` | Solo la familia. Un menor no pasa a inscrito sin ella |
| Invitar | `trial_org_invite` | Staff con permiso `contact`, solo a atletas visibles para su organización |
| Confirmar, lista de espera, no continuar, asistencia, resultado | `trial_org_action` | Staff con permiso `candidates` |

Inserciones y cambios directos en `trial_registrations` están prohibidos: todo pasa por estas funciones (transaccionales e idempotentes: un registro por atleta y oportunidad). Cada paso queda en `trial_registration_events` y en `org_activity`.

## Transparencia y anti-estafa
- Solo organizaciones verificadas reciben inscripciones.
- Un trial de pago siempre tiene importe y moneda (`paid_has_price`); uno gratuito no tiene importe.
- La capacidad solo se guarda si está confirmada y **no** se usa para «quedan X plazas».
- Fecha y hora se guardan **locales** con su zona IANA y se muestran así («10:00 (Europe/Madrid)»), sin convertir.

## Siguiente (11B–11D)
Matriz RLS de clubes ampliada, modo scout móvil, gestión de trials para el staff con vista por evento y QA E2E.
