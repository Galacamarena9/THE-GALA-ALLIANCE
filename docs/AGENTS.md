# Agents & Agencies · Arquitectura (Prompts 12 → 12C)

> Principio: **el atleta es dueño de su identidad y sus datos; la agencia recibe una autorización con alcance,
> fechas y auditoría para actuar en contextos concretos.** La representación es una relación autorizada más,
> nunca un permiso maestro.

## 1. Inventario (antes de construir)

| Concepto | Ya existía | Decisión |
|---|---|---|
| Agencia | `organizations.type = 'agency'` | REUSE. No hay segunda arquitectura de organizaciones. |
| Agente | `user_roles = 'agent'` + `organization_members` + `agency_role` | REUSE + EXTEND: se añaden `athlete_manager` y `operations`. |
| Verificación de agencia y agente | Cola central: `organization_claim`, `organization_affiliation`, `role`, dominio verificado | REUSE. Nuevo tipo `credential`. |
| Licencias y credenciales | — | NEW: `professional_credentials` (12). |
| Representación | `agent_representations`: solo adultos, 4 estados, sin alcance | EXTEND en 12A: estados, tipo, deporte, territorio, tipo de oportunidad, permisos, asignaciones, acuerdo, conflictos y menores con tutor. |
| Notas internas | `agency_athlete_notes` (privadas de la agencia) | KEEP. |
| Contactos de agencia | `agency_contacts` | KEEP. Propiedad de la agencia, nunca públicos. |
| Pipeline de agencia | `recruiting_cases` (+ actividades y tareas) | KEEP como capa de trabajo de la agencia. En 12B/12C solo puede abrirse dentro del alcance de la representación y se enlaza al proceso central del atleta (no hay un segundo pipeline del atleta). |
| Oportunidades, Match, documentos, mensajes, ofertas | Sistemas centrales | REUSE: el agente accede mediante representación + permiso + concesión, nunca con copias. |

## 2. Roles de agencia

`agency_role` → rol del prompt:

| agency_role | Rol |
|---|---|
| `owner` | Agency Owner |
| `admin` | Agency Admin |
| `manager` | Senior Agent |
| `recruiter` (por defecto) | Agent |
| `athlete_manager` | Athlete Manager |
| `operations`, `compliance` | Operations |
| `scout` | Scout |
| `viewer` | Analyst / Viewer (solo lectura) |

Administrar la agencia **no** da acceso a los datos privados de un atleta. Hace falta la representación activa, una asignación a ese atleta y el permiso concreto (12A/12B).

## 3. Credenciales profesionales (12)

- **El agente declara.** El estado lo pone siempre el servidor: `declared`, luego `under_review`, luego `verified`, `rejected`, `expired` o `revoked`.
- **La verificación pasa por la cola central** (`credential_submit` → `verification_decide`). Si se edita una credencial verificada, vuelve a «declarada».
- **Lo público** (`verified_credentials`) solo incluye credenciales **verificadas y vigentes**, sin número. «Licencia verificada» no se muestra nunca sin esto.
- **Caducidad diaria** (`expire_professional_credentials`, pg_cron si está disponible).
- **La ven:** su titular, los administradores de su agencia y Gala. Las demás agencias, no.

## 4. Fases

| Fase | Contenido |
|---|---|
| 12 | Esta base: inventario, roles, credenciales y verificación. |
| 12A | Modelo de datos de la representación (fuente de verdad única). Ver [REPRESENTATION-ARCHITECTURE.md](REPRESENTATION-ARCHITECTURE.md). |
| 12A.1 | Pruebas de integridad, concurrencia y transiciones. |
| 12B | RLS y matriz de consentimiento: el agente accede a cada recurso del atleta solo si su permiso, deporte, territorio y tipo de oportunidad lo cubren. Ver [AGENT-RLS.md](AGENT-RLS.md). |
| 12C | Workspace multi-atleta, móvil, pentest y QA final. |
