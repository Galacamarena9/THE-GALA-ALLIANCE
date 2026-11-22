# Agents & Agencies · revisión del Prompt 12 (22-11-2026)

Agents se construyó en los prompts 12 → 12C ([AGENTS.md](AGENTS.md), [REPRESENTATION-ARCHITECTURE.md](REPRESENTATION-ARCHITECTURE.md), [AGENT-RLS.md](AGENT-RLS.md), [AGENT-WORKSPACE-QA.md](AGENT-WORKSPACE-QA.md)). Después se reformó el producto con el agente primero: [AGENT-HOME.md](AGENT-HOME.md), [ATHLETES-CRM.md](ATHLETES-CRM.md), [ATHLETE-360.md](ATHLETE-360.md) y [TALENT-SEARCH.md](TALENT-SEARCH.md). Esta revisión contrasta el texto completo del Prompt 12 con el código y las pruebas, y cierra dos huecos.

## 1. Criterio de aceptación (§98)

Todas las pruebas son directas contra PostgreSQL (`npm run test:rls`, 412 en verde). El e2e es Playwright, con datos de ejemplo.

| Criterio | Prueba | Estado |
|---|---|---|
| La agencia se puede verificar | Cola central (`organization_claim`, dominio verificado); P12A.1 §7 (si pierde la verificación, nadie de ella accede) | ✅ |
| El agente se puede verificar | P12 credenciales (declara; nunca se autoverifica; caduca). «Licencia verificada» solo si está verificada y vigente | ✅ |
| El atleta acepta o rechaza la representación | P12A-1, P12A.1 §79 (nadie la activa por fuera de las funciones) | ✅ |
| El menor necesita a la familia | P12A-2, P12A.1 §12-14 (un tutor ajeno o desvinculado no aprueba) | ✅ |
| El roster sale de la representación real | P12A.1 §38-44; P12B-18 (otra agencia no puede reconstruirlo) | ✅ |
| El agente trabaja solo dentro de su alcance | P12A-8/9/10, P12B-5/6/7 (deporte, territorio, tipo de oportunidad) | ✅ |
| Cambiar de atleta sin fuga de contexto | Ficha 360 por URL de atleta y selector; e2e `athlete-360`, `agent-home` | ✅ (e2e con datos de ejemplo) |
| Descubrir oportunidades y Gala Match | Búsqueda de talento (`TALENT-SEARCH.md`) con el mismo motor de Match | ✅ |
| El pipeline central se reutiliza | `recruiting_cases` enlazado a los procesos del atleta; no hay segundo pipeline del atleta | ✅ |
| Los documentos siguen protegidos | P12B-9 (sin concesión no; con concesión solo quien tiene `documents.view`) | ✅ |
| El presupuesto familiar sigue privado | P12B-10/11 | ✅ |
| Las acciones sensibles requieren al atleta | P12B-12/13 (aceptar una oferta es del atleta) | ✅ |
| La revocación quita el acceso | P12A-6, P12B-15 (la siguiente consulta ya no ve nada) | ✅ |
| La caducidad quita el acceso | P12A-5, P12B-3 | ✅ |
| La agencia A no accede a la B | P12B-1/8, «Mis atletas: UUID ajeno», notas de agencia | ✅ |
| El agente no accede a un atleta sin representación | P12B-2 (ni el dueño de la agencia), P12A (ser admin de la agencia no basta) | ✅ |
| Gala AI respeta estos límites | Usa la sesión del usuario (hereda la RLS); filtro de otros atletas (10C) | ✅ |
| **En un Supabase real** | — | ⛔ El remoto no tiene ninguna migración de Agents (va por la 40 de 77) |

## 2. Cambios de hoy (`20261209000400_12r_agents_review.sql`)

| Hueco | Antes | Ahora | Prueba |
|---|---|---|---|
| Notas internas de agencia (§24-25, §62) | Cualquier miembro de la agencia, incluidos `viewer` y `scout`, podía leer el texto de todas las notas **pidiéndolo directamente a la API**. Solo la interfaz lo ocultaba | La base de datos aplica la regla de la ficha 360: leen los roles con trabajo sobre atletas o quien está asignado al atleta (primary, secondary u operations). Al terminar la asignación, deja de verlas en la siguiente consulta | «P12 revisión · notas internas de agencia» |
| Denunciar a un agente o agencia (§60) | Solo motivos genéricos y sin botón en «Mis agentes» | Motivos propios: representación no autorizada, suplantación, honorarios engañosos, pago sospechoso, contacto inapropiado, privacidad y uso no autorizado de documentos. Los tres más graves entran con prioridad alta en la cola de seguridad. Hay un botón «Denunciar a esta agencia» en cada representación | «P12 revisión · denunciar a una agencia…» |

Efecto en la interfaz: un `viewer` o un `scout` sin asignación ya no ve que existen notas. Antes veía «hubo una nota» sin el texto.

## 3. Lo que sigue abierto

| Punto del prompt | Estado |
|---|---|
| §51 Negociación como entidad aparte (aclaración, revisión, contrapropuesta con historial) | 🟡 No existe. La oferta original no se modifica nunca; el agente solo la ve y la anota |
| «Sugerir cambio» en el Passport (§12 `passport.suggest_edit`) | 🟡 No existe |
| §34 Pipeline multi-atleta con filtro por agente, país y tipo | 🟡 Filtra por fase, atleta y deporte |
| Cola de conflictos en el panel de Gala | 🟡 `representation_conflict_resolve` existe y está probada; falta la pantalla |
| §41 Importar contactos por CSV | ✅ `importContacts`: privados de la agencia, sin envíos y sin duplicar (misma universidad y nombre) |
| §76 Importar el roster de atletas | 🟡 No existe. Cuando se haga, cada fila debe generar una **invitación** de representación, nunca una representación activa (la base de datos ya lo impide: solo se activa por las funciones de aceptación) |
| §52 Comisiones | ⬜ Fuera de alcance, como pide el prompt. El acuerdo de representación ya está restringido a las partes |
| E2E del recorrido completo en navegador con dos agencias y familia | ⛔ Cubierto en la base de datos; el navegador necesita el remoto al día |
