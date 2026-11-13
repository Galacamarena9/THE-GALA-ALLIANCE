# Plan de respuesta a brechas de seguridad (RGPD arts. 33–34) — borrador

**Responsable del plan:** [nombre] · **Suplente:** [nombre] · **Asesor externo:** [contacto] · **DPD:** [si existe]

## Plazos que marca la ley

- **72 horas** desde que se tiene constancia para notificar a la AEPD (sede electrónica, formulario de notificación de brechas), salvo que sea improbable que suponga un riesgo para los derechos de las personas (art. 33). Si se notifica más tarde, hay que explicar el motivo del retraso.
- **Sin dilación indebida** a las personas afectadas cuando la brecha suponga un alto riesgo (art. 34). Con menores implicados, presumir alto riesgo salvo análisis en contra.
- Toda brecha, notificada o no, se documenta en el registro interno (art. 33.5).

## Fases

| Fase | Plazo objetivo | Acciones |
|---|---|---|
| 1. Detección | Inmediato | Fuentes: alertas de Supabase/Netlify/Stripe, avisos de usuarios, denuncias, revisión de `audit_logs`. Abrir incidente con hora de detección. |
| 2. Contención | < 4 h | Rotar claves afectadas (publicable, secreta de Supabase, Stripe, Anthropic); revocar sesiones; desactivar la función o ruta afectada; si hay archivos expuestos, regenerar políticas del bucket. |
| 3. Evaluación | < 24 h | Qué datos, cuántas personas, si hay menores, documentos o datos de salud, si los datos estaban cifrados, consecuencias probables. Clasificar: sin riesgo / riesgo / alto riesgo. |
| 4. Notificación AEPD | < 72 h | Si hay riesgo: naturaleza, categorías y número aproximado de interesados y registros, contacto, consecuencias, medidas. Se puede notificar por fases. |
| 5. Comunicación a afectados | Sin dilación | Si hay alto riesgo: lenguaje claro, qué ha pasado, qué hacemos, qué pueden hacer (cambiar contraseña, vigilar suplantaciones). Para menores, también a la familia vinculada. |
| 6. Cierre | < 30 días | Causa raíz, correcciones, prueba automática nueva que lo impida (`supabase/tests`), actualización de la EIPD. |

## Contactos de proveedores

- Supabase: [soporte/seguridad] · Netlify: [soporte] · Stripe: [soporte] · Anthropic: [soporte].

## Registro interno (plantilla)

| Fecha detección | Descripción | Datos y personas | Menores | Riesgo | ¿AEPD? (fecha) | ¿Afectados? (fecha) | Medidas | Responsable |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |
