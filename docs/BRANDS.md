# Marcas · ofertas comerciales (Prompt 13)

**Estado:** implementado en `20261128000100_13_brands.sql`. Probado en local (bloque P13). Las colaboraciones siguen siendo **solo para mayores de edad** (decisión conservadora; abrirlas a menores exigiría tutor, límites de contenido y revisión legal por país).

## Arquitectura

| Concepto | Decisión |
|---|---|
| Marca | REUSE `organizations.type='brand'` + verificación central |
| Campaña | EXTEND `brand_campaigns`: producto y su valor, meses y canales de uso, publicidad pagada, exclusividad (categoría + días), edad mínima. Cambiar términos de una campaña publicada la devuelve a revisión |
| Candidatura | REUSE `campaign_applications` |
| Oferta al atleta | NEW `campaign_offers`, inmutable y versionada (una sola abierta por candidatura) |
| Compensación | NEW `campaign_offer_components`: dinero, producto, viaje, material, bonus (siempre condicionado), otro. «No especificada» se dice tal cual |
| Entregables | NEW `campaign_deliverables` + `campaign_deliverable_submissions` (versiones, nunca se sobrescriben) |
| Notas internas | NEW `brand_application_notes`: solo la marca |
| Pago | Estado en la oferta: la marca declara «pagado», **solo el atleta confirma o disputa**. Stripe: Prompt 15 |

## Reglas que garantiza la base de datos

- Solo una marca **verificada y activa** envía ofertas, y solo a atletas **seleccionados** y mayores de edad.
- Sin compensación explícita (o «no especificada») ni entregables, no hay oferta. Exclusividad sin categoría: rechazada.
- Nadie escribe ofertas, componentes, entregables ni entregas a mano (`brand_rpc_only`).
- **Solo el atleta acepta.** Ni la marca ni el agente pueden. El agente con `offers.view` y alcance «marcas» puede verla.
- La marca pide cambios con un motivo; nunca edita el contenido del atleta.
- Las ofertas caducan (job diario idempotente).
- Sin «influence score» ni inferencias de personalidad.

## En la app

- **Marca:** campaña con términos estructurados → selecciona → envía la oferta desglosada → revisa entregas → declara el pago.
- **Atleta:** `/app/collaborations` con «Por decidir» (todo explícito: qué es dinero y qué no, entregables, uso de imagen, exclusividad, caducidad), «En marcha» (entregar por enlace, ver cambios pedidos, confirmar pago) e historial.

## Pendiente

- Varios entregables por oferta desde la interfaz (la función ya acepta una lista; el formulario envía uno).
- Pagos reales (Prompt 15) y alertas de fraude en pagos (Prompt 14).
