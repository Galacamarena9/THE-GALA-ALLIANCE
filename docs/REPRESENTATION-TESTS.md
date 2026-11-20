# Representación · Pruebas de integridad (Prompt 12A.1)

Todo se prueba en local con datos sintéticos (`supabase/tests/rls.test.mjs`, bloques **P12A** y **P12A.1**). Nunca contra producción.

## Fallos encontrados y corregidos (`20261126000300_12a1_representation_integrity.sql`)

| # | Fallo | Corrección |
|---|---|---|
| 1 | Reactivar una suspensión solo miraba las fechas | Revalida agencia verificada, familia del menor, agente primario vigente y conflictos abiertos (→ `pending_review`) |
| 2 | Un menor seguía dando acceso a la agencia si su familia se desvinculaba | `agent_can` exige aprobación familiar y un vínculo familiar vigente |
| 3 | Un acuerdo con documento quedaba como «declarado» | La función fija «documentado»; «verificado» solo lo pone Gala |

## Cobertura del prompt

| Secciones | Estado |
|---|---|
| §4–10 integridad, FKs, tipo de organización, verificación de agencia, solicitud, aceptación y rechazo | ✅ |
| §11–14 menor, tutor incorrecto, tutor revocado, doble aprobación | ✅ |
| §15–18 fecha futura, fin < inicio (constraint), caducidad e idempotencia del job | ✅ |
| §19–22 revocación, revocación parcial de permisos, suspensión, reactivación | ✅ |
| §23–30 alcance: limitada, duplicados, permiso caducado, deporte, territorio, mundo, oportunidad concreta | ✅ |
| §31–37 exclusividad, no-conflictos (tipo, deporte, fechas), conflicto concurrente, resolución | ✅ |
| §38–45 primario único, cambio de primario, otra agencia, agente que sale, colaboradores, roster | ✅ |
| §46–50 acuerdo: documento ajeno, versiones, documentado ≠ verificado | ✅ |
| §51–65 documentos, pipeline, ofertas, mensajes, presupuesto familiar, notas, tareas **a través de la representación** | ➡️ 12B (las policies de cada recurso usarán `agent_can`) |
| §66–67 notificaciones y auditoría | ✅ |
| §68–69 migración y conciliación | ✅ en local (las representaciones antiguas pasan a `ended → terminated` con fecha de fin). En remoto: pendiente de aplicar con Gala |
| §70–79 huérfanos, todo-o-nada, idempotencia, concurrencia, fechas límite, transiciones inválidas, bypass | ✅ |
| §80 rendimiento | Índices por atleta, agencia y estado; `agent_can` usa claves indexadas. Medición con volumen real: Prompt 18 |
