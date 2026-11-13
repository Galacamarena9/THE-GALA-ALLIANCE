# Modelo de negocio y lanzamiento

## Diagnóstico

El problema es real y emocional (familias con incertidumbre, sistema basado en contactos). El riesgo principal no es técnico: es un **marketplace vacío**. Por eso:
1. Se capta antes la oferta B2B (programas y academias verificadas) que la demanda masiva.
2. Se cobra a las familias por resultados concretos y no por visibilidad.
3. La plataforma funciona sola: verificación, publicación, moderación de urgencia, cobro, entrega, bajas y borrado son automáticos. El tiempo de la fundadora solo se vende como servicio premium (Signature).

## Principio no negociable

**La visibilidad del atleta nunca se paga.** Perfil, escaparate, candidaturas y recibir contacto son gratis para siempre. Es la misión ("si tienes nivel, tienes que poder optar") y también la ventaja competitiva frente a las agencias que cobran por "exposición".

## Ingresos

| Línea | Oferta | Precio | Tipo |
|---|---|---|---|
| Atleta | Passport | 0 € | Gratis siempre |
| Familia | Core (automático): informe del Passport por impacto, Sports CV en inglés imprimible, shortlist automática de universidades reales con coste oficial y encaje, calendario de SAT y documentos por promoción | 247 € | Pago único, Stripe Checkout |
| Familia | Elite (automático): Core + comparador de hasta 5 ofertas (también recibidas por email), memo de decisión imprimible, detector de señales de alarma y calendario de visado (I-20, SEVIS, DS-160) | 497 € | Pago único, Stripe Checkout |
| Familia | Signature 1:1 con Gala (personal): Elite + sesiones 1:1, revisión personal de vídeo/CV/mensajes, acompañamiento en ofertas hasta la firma | A medida, plazas limitadas (hipótesis 1.500–3.000 €) | Solicitud → propuesta escrita |
| Universidad/coach | Recruit (escaparate, alertas, pipeline, equipo) | Gratis en el piloto; hipótesis posterior de 150–600 €/mes | SaaS |
| Academia/club | Portal de roster (autoservicio): invitación por enlace, validación de estadísticas, colocaciones + afiliados | Gratis en el piloto; hipótesis de 2.000–12.000 €/año | B2B2C |
| Agencia | Cartera y prospectos | Gratis en el piloto | SaaS |
| Marca | Campañas | Tras la revisión legal de NIL, fiscalidad e inmigración | Fee por campaña |

Los precios de las organizaciones son hipótesis que hay que validar en el piloto; no se publican hasta tener señal.

## North Star y métricas (ya en el panel de mando)

- **North Star: conexiones cualificadas al mes.** Cuenta un contacto aceptado o una candidatura que avanza a contactado, información, entrevista, prueba, shortlist u oferta.
- **Embudo:** registrados → Passport básico → con notas → con vídeo → han aplicado → contactados → con oferta → colocados.
- **Liquidez:** oferta (atletas abiertos) frente a demanda (oportunidades publicadas + búsquedas guardadas) por posición.
- **Ventas:** solicitudes nuevas → contactadas → ganadas o perdidas, por plan.

## Operación autónoma (qué hace la plataforma sin intervención)

| Proceso | Cómo se resuelve solo | Cuándo interviene una persona |
|---|---|---|
| Verificar organizaciones | Correo confirmado del mismo dominio que su web; universidades además .edu o la web oficial de la institución | Dominios genéricos (gmail, etc.) quedan en revisión |
| Publicar becas | Organización verificada + sin señales de alarma (pagos, garantías, plazos imposibles, ayudas sin fuente) | Ofertas con alarmas quedan en revisión |
| Moderación urgente | Denuncia de seguridad infantil o 3 denunciantes ocultan el contenido al momento | Revisión posterior de la cola |
| Cobro y entrega | Stripe Checkout → webhook → plan activado para quien paga y sus atletas vinculados; reembolso → plan retirado | Nunca |
| Bajas RGPD | Autoservicio en Privacidad (archivos, cuenta y datos) | Cuentas con organizaciones a su nombre |
| Retención | Borrado diario programado (pg_cron) | Nunca |
| Métricas | Eventos del embudo y panel de mando | Lectura semanal |

## Validación (próximas 8–12 semanas)

1. **Oferta primero:** de 5 a 10 universidades o colleges y de 3 a 5 academias o clubes en el programa fundador, con una LOI sencilla por escrito.
2. **Pago directo:** Core y Elite se venden con Stripe Checkout desde el primer día (ya integrado). Signature valida la disposición a pagar por el acompañamiento personal sin consumir tiempo en el resto.
3. **Umbrales para seguir:**
   - ≥ 3 de cada 10 familias contactadas compran Core;
   - ≥ 40 % de atletas con Passport básico en 72 h;
   - ≥ 1 conexión cualificada por cada 10 atletas activos al mes.
   - Si no se alcanzan, se cambia la oferta (precio o alcance) antes de construir más.

## Canales de adquisición (bajo coste)

- **Academias y clubes españoles (B2B2C):** portal de roster con co-branding y comisión de afiliado. Una sola academia puede aportar entre 30 y 300 atletas.
- **Credibilidad propia:** Gala fue jugadora NCAA D1 con beca completa. Contenido "build in public" en LinkedIn, Instagram y TikTok sobre el proceso real, con la guía y la calculadora como lead magnets.
- **Bucles de crecimiento:**
  - Sports CV compartido → visita → registro.
  - Una universidad pide información → el atleta completa el perfil.
  - Una colocación con consentimiento → caso de éxito → nueva academia.

## Antes de activar cobros

- Términos de servicios de pago, desistimiento (14 días), política de reembolso y facturación (NIF).
- Stripe Checkout en modo pago único para Core y Elite (ya implementado; se activa al definir `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`). Connect solo si se activan marcas o afiliados.
- Casilla de consentimiento expreso para la entrega inmediata del contenido digital y la pérdida informada del desistimiento (art. 103 m del TRLGDCU): implementada; el texto debe validarlo el asesor.
- Revisión fiscal de las comisiones de afiliados y de NIL. La revisión de inmigración para atletas F-1 es obligatoria antes de cualquier pago NIL.
