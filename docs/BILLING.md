# Facturación y Stripe (Prompt 15)

**Estado:** implementado en `20261130000100_15_billing.sql`, en el webhook (`src/app/api/stripe/webhook/route.ts`) y en `/app/billing`. Probado en local con eventos de Stripe sintéticos (bloque P15). **Sin cobros reales**: hacen falta las claves de Stripe y los precios (ver «Para activar»).

## Principios

- **La visibilidad del atleta nunca se paga.** Lo que se cobra son herramientas: planes familiares de pago único y suscripciones de organizaciones.
- **El webhook firmado es la única verdad de pago.** Ni el navegador ni la página de «pago completado» activan nada.
- **Un derecho de plan no es una autorización.** Tener Elite da cuotas y funciones, nunca acceso a datos ajenos: la RLS no cambia.
- **Sin nombres de plan en el código de permisos.** Las cuotas salen de `plan_catalog.features`.

## Modelo

| Tabla | Para qué |
|---|---|
| `plan_catalog` | Planes versionados con sus cuotas (`-1` ilimitado, `0` no incluido), asientos, precio, `stripe_price_id` y `free_until` (lanzamiento) |
| `billing_accounts` | Una por persona u organización. Guarda solo el id de cliente de Stripe; **nunca la tarjeta** |
| `subscriptions` | Estado real (activa, en prueba, pago pendiente, cancelada…). Solo la escribe el webhook |
| `seat_assignments` | Asientos: nunca más de lo contratado; al salir de la organización se liberan solos |
| `stripe_events` | Idempotencia por id de evento |
| `billing_ledger` | Cobros, reembolsos y disputas. **Solo se añade**: no se edita ni se borra, ni siquiera desde la base de datos |
| `usage_counters` | Consumo de cuotas por día o mes, **atómico** (dos peticiones simultáneas no superan el límite) |
| `entitlements` | (Ya existía) planes familiares de pago único. El motor los suma |

## Motor de derechos (`feature_limit`, `consume_usage`)

Para cada función se toma la cuota mayor (o ilimitada) de todas estas fuentes:

1. Las suscripciones activas o en prueba, o en «pago pendiente» durante 7 días de gracia. En organizaciones, cuenta solo si la persona tiene asiento, o si la suscripción aún no reparte asientos.
2. Los pagos únicos.
3. El periodo de lanzamiento anunciado: el plan de agencia es gratis hasta el 31/03/2027.
4. El plan gratuito.

## Webhook

- Se verifica la firma y se reenvían los eventos de suscripción, facturas, reembolsos y disputas a `billing_apply_event`. Esa función solo la puede llamar el servidor con la clave secreta.
- Un evento repetido devuelve `duplicate`. Uno atrasado (más antiguo que el último aplicado) se ignora con `stale_event`.
- Si falla un cobro, avisamos a quien dirige la cuenta y hay 7 días de gracia.
- El pago único familiar sigue igual: Checkout, concesión del plan y retirada si hay reembolso.

## Para activar (standby con Gala)

1. Crear en Stripe los productos y precios de `agent_solo`, `agent_team` y `agent_scale`, y guardar su `stripe_price_id` en `plan_catalog`.
2. Configurar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `SUPABASE_SECRET_KEY` en el servidor, y apuntar el webhook a `/api/stripe/webhook` con los eventos de la lista.
3. Activar Stripe Tax y el portal de cliente: facturas, tarjeta y cancelación en un clic.

## Pendiente

- **Stripe Connect para pagos marca → atleta.** Requiere validación legal: NIL, visados y fiscalidad internacional. Por ahora el pago marca–atleta se registra y lo confirma el atleta (Prompt 13), sin mover dinero.
- **Trials y campus de pago con cobro integrado.** Hoy `payment_requirements` informa del importe sin cobrarlo.
- **Job de conciliación con la API de Stripe.** Necesita las claves.
