# Registro de actividades de tratamiento (RGPD art. 30) — borrador

**Responsable:** [razón social, NIF, domicilio] · **Contacto de privacidad:** [email] · **DPD:** [si se designa]

| # | Actividad | Finalidad | Base jurídica | Interesados | Datos | Destinatarios | Transferencias | Conservación | Medidas |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Cuentas y autenticación | Acceso seguro | Contrato (6.1.b) | Todos los usuarios | Email, nombre, rol, fecha de nacimiento (privada) | Supabase (encargado) | [mecanismo] | Mientras la cuenta esté activa | Contraseñas gestionadas por Supabase Auth; MFA para admin |
| 2 | Opportunity Passport | Presentar al atleta a organizaciones verificadas | Contrato (6.1.b) y consentimiento para visibilidad (6.1.a) | Atletas | Deportivos, académicos, idiomas, vídeo | Organizaciones verificadas según visibilidad | — | Hasta la baja | Visibilidad por bloques; menores privados por defecto |
| 3 | Vínculo y supervisión familiar | Protección de menores | Interés legítimo / obligación de protección (6.1.f) | Atletas menores y tutores | Vínculo, permisos | Familia vinculada | — | Hasta revocación o baja | Aprobación del atleta; permisos granulares |
| 4 | Candidaturas y contactos | Gestionar el proceso de reclutamiento | Contrato (6.1.b) | Atletas, personal de organizaciones | Candidaturas, mensajes, historial | Organización destinataria | — | Hasta la baja | Aprobación familiar para menores; bloqueo |
| 5 | Centro de documentos | Preparar la documentación del proceso | Contrato (6.1.b) | Atletas y familias | Documentos (pasaporte, certificados, I-20, médicos) | Nadie más (ni organizaciones ni admin) | — | Hasta que el usuario los borre | Bucket privado, enlaces firmados de 60 s |
| 6 | Roster de clubes | Validación y seguimiento de colocaciones | Consentimiento del atleta (6.1.a) | Atletas, personal del club | Pertenencia, estado de candidaturas si lo comparte | Club verificado | — | Hasta salida del roster o baja | El atleta decide si comparte progreso |
| 7 | Pagos de planes | Cobrar y activar Core/Elite | Contrato (6.1.b) y obligación legal fiscal (6.1.c) | Compradores | Plan, referencia del pago (sin datos de tarjeta) | Stripe (encargado/responsable según su DPA) | [mecanismo] | Plazo fiscal [validar] | Webhook firmado; nunca se ven datos de tarjeta |
| 8 | Gala IA | Resolver dudas del proceso | Contrato (6.1.b) | Usuarios que la usan | Preguntas, contador de uso | Anthropic (encargado) | [mecanismo] | Uso: 90 días | Límite diario; aviso de no compartir datos sensibles |
| 9 | Medición del embudo | Mejorar el producto | Interés legítimo (6.1.f) | Usuarios con sesión | Eventos técnicos de lista cerrada | Solo admin (agregados) | — | 13 meses | Sin datos personales en propiedades; sin cookies de terceros |
| 10 | Moderación y seguridad | Proteger a los usuarios | Interés legítimo (6.1.f) y DSA | Denunciantes y denunciados | Denuncias, auditoría | Admin | — | [plazo de auditoría] | Ocultación automática ante riesgo infantil |
| 11 | Derechos de los interesados | Atender solicitudes | Obligación legal (6.1.c) | Solicitantes | Solicitudes y respuestas | — | — | [plazo] | Autoservicio de exportación y baja |
| 12 | Cookies | Preferencias de consentimiento | Consentimiento (6.1.a) y LSSI art. 22 | Visitantes | Elección, IP con hash salado | — | — | [plazo] | Registro inmutable; solo cookies técnicas sin consentimiento |
