# Agentes · RLS y matriz de consentimiento (Prompt 12B)

**Estado:** implementado en `20261127000100_12b_agent_rls.sql`. Probado en local (bloque P12B, 364 pruebas RLS en verde).

## Cadena de autorización

Para que un agente acceda a algo de un atleta se tiene que cumplir **todo**, y lo comprueba la base de datos (`agent_can` / `agent_can_via`):

1. Es miembro de una agencia **verificada y activa**.
2. Está **asignado** a esa representación (primario, secundario, operaciones, colaborador o viewer).
3. La representación está **activa y vigente hoy** (entre `start_date` y `end_date`).
4. Si el atleta es menor, la familia la **aprobó** y sigue **vinculada**.
5. El **permiso** concreto está activo y no ha caducado.
6. El **alcance** cubre la consulta: deporte, territorio, tipo de oportunidad y, si es de una sola oportunidad, esa oportunidad.

Ser dueño o admin de la agencia **no** salta la cadena. Un `viewer` solo obtiene permisos de lectura.

## Matriz (esquema real)

| Recurso | Atleta | Familia (menor) | Agente asignado | Miembro sin asignar | Dirección de la agencia sin asignar | Otra agencia |
|---|---|---|---|---|---|---|
| Passport (`athlete_profiles` y bloques) | Total | Según vínculo | Con `passport.view`, aunque sea privado (académico no) | No | No | No |
| Pipeline de la agencia (`recruiting_cases`, tareas, actividad) | Lo que se le comparte | — | Ver: `pipeline.view` · Crear/mover: `pipeline.manage`, en su deporte | No | Solo lectura del historial | No |
| Documentos | Total | Según alcance | Concesión a la agencia **y** `documents.view` | No | No | No |
| Ofertas (`athlete_offers`) | Total | Según alcance | Ver con `offers.view`. Aceptar, editar o borrar: nunca | No | No | No |
| Inscripciones a trials/campus en su nombre | Total | Total | `opportunities.manage` de esa agencia | No | No | No |
| Presupuesto familiar | Total | Según alcance | **Nunca**, ni con `financial_context.view` | No | No | No |
| Notas de familia | Según política | Sí | **Nunca** | No | No | No |
| Notas internas de la agencia | No | No | Sí | Sí (interno) | Sí | No |
| Acuerdo de representación | Sí | Sí | Sí | No | Sí | No |
| Roster (`agency_roster`) | — | — | Su agencia | Su agencia | Su agencia | No |

## Revocación, caducidad y suspensión

Tienen efecto en la **siguiente consulta**: no hay caché de permisos, y Realtime y Gala IA usan el cliente del usuario, así que pasan por la misma RLS. No se borra nada del atleta: procesos, documentos y ofertas siguen.

## Gala IA

No usa la service role: consulta con la sesión del usuario, así que solo ve lo mismo que ve el agente. Además, el filtro de 10C (`OTHERS_SCOPE`) bloquea pedir datos de otros atletas.

## Pendiente en 12C

- Workspace del agente con el alcance visible y los permisos explicados.
- Negociación de ofertas como entidad aparte (la oferta original no se toca).
- Sugerir cambios en el Passport (el agente propone; el atleta aprueba).
