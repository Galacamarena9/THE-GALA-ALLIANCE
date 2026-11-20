# Observabilidad (Prompt 19 · criterio propio)

El prompt 19 no llegó. Esto es lo mínimo serio para operar en producción sin depender de un proveedor concreto.

## Señales

| Señal | Dónde | Detalle |
|---|---|---|
| **Logs estructurados** | `src/lib/observability/log.ts` | Una línea JSON por evento. **Redacta** emails, teléfonos, claves, JWT y tokens. Solo admite campos conocidos: el resto se marca como `[omitted]` |
| **Errores de servidor** | `src/instrumentation.ts` (`onRequestError`) | Se registra cada error con su ruta, id de petición y *digest*, que es el código que el usuario ve en la pantalla de error. Con `ERROR_WEBHOOK_URL` (Sentry, Slack…) se reenvía el resumen |
| **Id de petición** | `src/proxy.ts` | Cabecera `x-request-id` en cada petición y respuesta, para cruzar lo que cuenta un usuario con los logs |
| **Salud** | `GET /api/health` | Responde si la app y la base de datos funcionan, cuánto tarda y qué versión corre. Sin datos ni secretos. Para UptimeRobot o Better Stack |
| **Salud de la plataforma** | `admin_platform_health()` y `/app/admin/ops` | Colas de seguridad infantil, denuncias, verificaciones, soporte, eventos de Stripe sin procesar, pagos en disputa, interruptores apagados, break glass sin revisar y pg_cron |
| **Webhook de Stripe** | Log de cada evento y su resultado | Si falla, devuelve 500 y Stripe reintenta |

## Objetivos (SLO) y alertas recomendadas

| Qué | Objetivo | Alerta |
|---|---|---|
| Disponibilidad de `/api/health` | 99,9 % mensual | 2 fallos seguidos (monitor cada minuto) |
| Primera respuesta a una denuncia de seguridad infantil | < 24 h | Panel de salud ≥ 24 h |
| Verificación de una organización | < 72 h | Pendientes con más de 72 h |
| Eventos de Stripe | Procesados en < 10 min | `stripe_unprocessed` > 0 |
| Errores de servidor | < 0,5 % de las peticiones | Pico en `server_error` |

## Respuesta a incidentes y brechas (plan base)

1. **Contener.**
   - Apagar la funcionalidad afectada con su interruptor (`/app/admin/ops`), sin tumbar todo Gala.
   - Rotar las claves si hay sospecha: Supabase, Stripe y Resend.
2. **Evaluar.**
   - Qué datos, de quién y desde cuándo, usando `audit_logs`, que es inmutable.
   - Prioridad máxima si hay **menores**.
3. **Notificar.**
   - Si hay riesgo para las personas, a la AEPD en **72 h** (RGPD art. 33).
   - A los afectados sin demora si el riesgo es alto (art. 34).
   - En EE. UU., según el estado de residencia.
4. **Corregir y verificar.** Corregir con PR, probar en staging (nunca pentest en producción) y desplegar.
5. **Post-mortem sin culpas.** Qué pasó, por qué, qué cambia y su prueba de regresión.

## Para activar (standby con Gala)

- Monitor externo sobre `/api/health`.
- `ERROR_WEBHOOK_URL`, por ejemplo hacia Sentry o un canal de Slack.
- pg_cron en Supabase, para caducidades y limpiezas.
- `pg_stat_statements`, para ver las consultas más lentas.
