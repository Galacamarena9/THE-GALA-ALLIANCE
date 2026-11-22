# Lista de difusión (Operaciones Gala)

**Ruta:** `/app/admin/difusion`. Solo la ven los administradores, con MFA. Entrada en el menú de Operaciones Gala → Más → Difusión.

## Qué hace

1. **Guarda organizaciones** (agencias, universidades, federaciones, clubes y academias) con su canal de contacto y la página pública de donde sale el contacto. La fuente es obligatoria, y hay que marcar que es una organización y no un atleta ni un menor.
2. **«Cargar lista inicial»** añade las 16 organizaciones del informe de fuentes (`src/content/outreach-seed.ts`). Solo dos llevan correo público; las demás quedan como «formulario web» para completarlas a mano.
3. **Invitación automática por correo:**
   - Va a las organizaciones marcadas que tienen correo y nunca se han contactado, como máximo 25 por clic.
   - Pide permiso («¿Os puedo dar acceso de prueba?»), cita la fuente y lleva tres enlaces: sí, ahora no y baja.
4. **Respuesta pública** en `/difusion/<token>`, sin cuenta:
   - Cada opción es un botón (POST), para que un antivirus que abre el enlace no responda por la organización.
   - Al responder, la base de datos crea un aviso en la app para todos los administradores.
   - Si existe `OUTREACH_NOTIFY_EMAIL`, también llega un correo a Gala.
5. **Contacto a mano** (formulario web, LinkedIn o teléfono): se muestra un texto listo para copiar, y después se marca «Contactada a mano». Las respuestas que llegan por otra vía se marcan «Dijo que sí» o «Dijo que no».

## Reglas (en la base de datos, no solo en la pantalla)

- **LSSI art. 21:** sin consentimiento previo no se envía publicidad por correo. Se envía **una** invitación que pide permiso. La base de datos no deja emitir una segunda invitación para el mismo contacto (`not_invitable`).
- **Baja definitiva:** el hash del correo va a `outreach_suppressions`. Ese correo no se puede volver a añadir aunque se borre el contacto, y la baja funciona aunque el enlace haya caducado.
- **Estado y token los pone el servidor.** El panel solo permite estas transiciones manuales:
  - de «Sin contactar» o «Invitada» a «Contactada a mano»;
  - de «Invitada» o «Contactada» a «Dijo que sí» o «Dijo que no»;
  - a «Ya está dentro»;
  - de «Invitada» a «Rebotó».
- **Token:** 32 bytes aleatorios; solo se guarda su sha256 y caduca a los 30 días. Aceptar o rechazar es de un solo uso.
- **Si el proveedor de correo falla,** la invitación se deshace y se puede reintentar. Si el correo no está configurado, no se marca nada como enviado.
- `/difusion/` no se indexa (`robots.txt` y `noindex`).

## Para activarlo en producción

| Variable | Qué es |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Proveedor de correo y remitente, con dominio verificado en Resend |
| `OUTREACH_NOTIFY_EMAIL` | Correo de Gala para los avisos de respuesta |
| `OUTREACH_REPLY_TO` | A dónde llegan las respuestas al correo (por defecto, el de aviso) |
| `OUTREACH_SENDER_NAME` | Nombre con el que se firma (por defecto «Gala») |

Además hay que aplicar la migración `20261208000100_outreach.sql`.

## Pruebas

- **RLS** (3):
  - solo los administradores leen o crean contactos; los anónimos y los demás roles no ven nada;
  - el estado y el token los pone el servidor;
  - la invitación es de un solo uso, el aviso llega a los administradores y la baja es definitiva y bloquea volver a añadir el correo.
- **Unitarias:** `outreach.test.ts` (4).
- **E2E:** `e2e/outreach.spec.ts` (7). Cubre la lista, la fuente de cada organización, que solo se marquen las invitables, el alta con fuente obligatoria, la lista vacía, la respuesta pública con axe y el diseño a 360 y 1440 px.
