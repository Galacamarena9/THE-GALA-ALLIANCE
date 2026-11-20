# Representación de atletas (Prompt 12A)

**Estado:** implementado en `20261126000200_12a_representation_model.sql`. Probado en local (P12A-1…10 en `rls.test.mjs`).

## Decisión

REUSE → EXTEND: `agent_representations` sigue siendo la única fuente de verdad de la relación agencia–atleta.
No hay un sistema paralelo. Se amplía con alcance, permisos, asignaciones, acuerdos y conflictos.

## Modelo

| Tabla | Qué guarda |
|---|---|
| `agent_representations` | La relación: tipo (`exclusive`, `non_exclusive`, `opportunity_specific`), fechas, estado, aprobaciones |
| `representation_coverage` | Alcance: deporte, territorio (`WORLD`, ISO-2 o región) y tipo de oportunidad (`university`, `club`, `academy`, `brand`) |
| `representation_permissions` | Qué puede hacer la agencia (catálogo cerrado de 14 permisos). Retirar uno conserva el historial |
| `representation_assignments` | Qué personas de la agencia trabajan al atleta (`primary`, `secondary`, `operations`, `collaborator`, `viewer`) |
| `representation_agreements` | Versiones del acuerdo firmado (el documento vive en `athlete_documents`) |
| `representation_conflicts` | Solapes exclusivos detectados; los revisa Gala (revisión operativa, no jurídica) |
| `representation_invitations` | Invitación del atleta o su familia a una agencia: la vía para menores |
| `territory_regions` | Catálogo EUROPE / NORTH_AMERICA / LATAM |

## Estados

`requested → (pending_guardian) → (pending_review) → active → expired | revoked | terminated`, más `declined`, `suspended` y `disputed`.
La cartera los agrupa en cuatro (en marcha, pendiente, rechazada, finalizada) para no sobrecargar.

## Reglas que garantiza la base de datos

- Nadie inserta ni cambia el estado a mano: solo las funciones `representation_*` (marca de transacción `gala.rep_rpc`).
- Solo una agencia **verificada y activa** propone. Pedirla dos veces devuelve la misma solicitud.
- Activa solo con la aceptación del atleta y, si es menor, la aprobación de su familia (queda un consentimiento `representation`).
- Los menores no son descubribles por agencias: solo reciben propuestas de una agencia que ellos o su familia invitaron (30 días).
- La familia puede recortar los permisos antes de aprobar; la agencia recibe solo eso.
- Dos exclusivas que se solapan en deporte, territorio, tipo y fechas no se activan: pasan a `pending_review` hasta que Gala resuelve.
- Revocar, terminar o caducar cierra las asignaciones al momento. Procesos, documentos y ofertas del atleta no se tocan.
- La caducidad es un job diario idempotente (`representation_expire_due`, pg_cron si existe). La renovación nunca es automática.
- Si un agente sale de la agencia, su asignación termina; la representación sigue y se asigna otro primario.

## Autorización: `agent_can(atleta, permiso, deporte, país, categoría, oportunidad)`

Verdadero solo si se cumplen todas: representación efectiva hoy, asignación activa del usuario, agencia verificada y activa,
permiso activo y alcance que cubra la consulta. Un `viewer` solo obtiene permisos de lectura.
**Ser admin de la agencia no basta.** 12B usará esta función en cada policy del atleta.

## Pendiente (siguientes prompts)

- 12A.1: pruebas de concurrencia e integridad de transiciones.
- 12B: aplicar `agent_can` a cada recurso del atleta (Passport, procesos, documentos, ofertas, mensajes, Gala AI).
- 12C: workspace del agente con alcance visible, invitación desde el lado del atleta en la UI y QA.

## Rollback

Ver el comentario final de la migración. En remoto se aplica primero en staging y con conciliación.
