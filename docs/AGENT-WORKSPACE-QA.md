# Workspace del agente · QA y pentest (Prompt 12C)

## Qué cambia en la app

**Agente.** Al entrar ve lo que necesita atención: representaciones que vencen en 30 días o menos, esperas de la familia, revisiones de Gala y suspensiones. Son hechos reales, sin urgencia inventada.

**Ficha del atleta**
- Banner fijo «Actuando para» con el papel del agente (principal, de apoyo, operaciones, colaborador o solo lectura).
- Selector para cambiar de atleta: cada atleta abre su propia ficha, sin arrastrar nada del anterior.
- Panel de representación con el alcance real: tipo, vigencia, deporte, territorio, oportunidades, qué permite el atleta y cuándo vence.
- Si el agente no está asignado, se le dice claramente que no puede actuar.

**Atleta**
- Ve el alcance exacto antes de aceptar.
- Puede revocar.
- Edita los permisos cuando quiera.
- Puede invitar a una agencia verificada.

**Familia (menores).** En «Seguridad» la familia:
- aprueba o rechaza la representación;
- recorta permisos antes de aprobar;
- revoca;
- invita a una agencia verificada (las agencias no pueden encontrar a menores).

## Pentest (`rls.test.mjs`: P12B y P12C). Todo en local, con datos sintéticos

| § | Ataque | Resultado |
|---|---|---|
| 22 | Otra agencia | Denegado: Passport, ofertas, pipeline, roster y asignaciones |
| 23 | Atleta no representado | Denegado, incluso al dueño de la agencia |
| 24 | Agente sin asignar | Denegado |
| 25 | Representación caducada o revocada | Acceso fuera en la siguiente consulta; no se borra nada |
| 26 | Escalada de alcance | El agente no puede tocar permisos ni asignaciones |
| 27–30 | Deporte, territorio, tipo u oportunidad equivocados | Denegado |
| 31–32 | Presupuesto y notas de familia | Nunca, ni con contexto económico |
| 33 | IDOR de documentos | `not_found` sin concesión y permiso |
| 35 | Aceptar una oferta | Solo el atleta o la familia |
| 36 | Menor sin familia | Sin acceso (12A.1) |
| 37 | Escalada del admin o dueño de la agencia | Sin asignación no ve nada; asignarse queda auditado |
| 41–43 | Gala IA y service role | Gala IA usa la sesión del usuario (no hay service role en `src/`) y el filtro de otros atletas de 10C |

## Pendiente (honesto)

- **Negociación de ofertas como entidad aparte.** Hoy el agente solo ve las ofertas. La oferta original no se toca nunca.
- **«Sugerir cambio» en el Passport.** El agente propone y el atleta aprueba.
- **Pipeline multi-atleta con filtros por agente, país y tipo.** Hoy `/app/pipeline` filtra por fase y atleta.
- **Cola de conflictos en el panel de Gala.** La función `representation_conflict_resolve` ya existe. La interfaz entra en el Prompt 16 (Admin).
- **E2E del flujo completo con dos agencias y familia.** Cubierto a nivel de base de datos. El navegador necesita los datos remotos aplicados (standby con Gala).
