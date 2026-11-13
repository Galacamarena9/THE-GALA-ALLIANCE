# Política de conservación de datos — borrador

Los plazos marcados como **automático** están implementados en `public.run_retention()` (migración 0700), que se ejecuta cada día a las 03:17 UTC con pg_cron (`gala-retention-daily`) y deja un registro `retention.run` en la auditoría. El admin puede lanzarlo a mano desde el Panel de mando.

| Dato | Plazo | Cómo |
|---|---|---|
| Cuenta, Passport, candidaturas, mensajes | Mientras la cuenta esté activa | Baja autoservicio (`delete_my_account`) con borrado en cascada |
| Documentos subidos (archivos) | Hasta que el usuario los borre o se dé de baja | El usuario los borra; la baja elimina primero los archivos |
| Ofertas externas del comparador | Hasta que el usuario las borre o se dé de baja | Cascada |
| Eventos del embudo (`product_events`) | 13 meses | **Automático** |
| Notificaciones leídas | 6 meses desde la lectura | **Automático** |
| Notificaciones (cualquiera) | 12 meses | **Automático** |
| Novedades del atleta | 30 días después de caducar (caducan a los 30 días) | **Automático** |
| Registro de uso de Gala IA (`ai_usage`) | 90 días | **Automático** |
| Enlaces de roster caducados | 90 días tras caducar | **Automático** |
| Invitaciones de equipo no aceptadas | 90 días tras caducar | **Automático** |
| Invitaciones familiares pendientes | 90 días tras caducar | **Automático** |
| Comentarios de mejora | 24 meses | **Automático** |
| Registros de consentimiento | [plazo de prescripción a validar] | Inmutables; tras la baja quedan sin vínculo a la identidad |
| Auditoría (`audit_logs`) | [plazo a validar] | Inmutable; el actor pasa a nulo tras la baja |
| Derechos de plan y referencia de pago | [plazo fiscal a validar] | Cascada con la cuenta; Stripe conserva sus propios registros como responsable |

## Revisión

Cualquier cambio de plazo exige: nueva migración que modifique `run_retention()`, actualizar esta tabla y la sección "Conservación" de la política de privacidad (`src/content/legal.ts`).
