# EIPD — Evaluación de impacto en protección de datos (borrador)

**Responsable:** [razón social, NIF] · **Versión:** 0.1 (borrador técnico) · **Fecha:** 2026-11-13 · **Revisión prevista:** antes del lanzamiento y cada 12 meses o ante cambios relevantes.

## 1. Por qué es necesaria

- Se tratan datos de **menores de edad** (atletas de 14 a 17 años) y de forma continuada: sujetos vulnerables (lista de la AEPD de tratamientos que requieren EIPD).
- Se **evalúa y compara** a personas (encaje con oportunidades, estadísticas deportivas) y se facilita el contacto con terceros (universidades, coaches).
- Se combinan datos de varias fuentes (atleta, familia, club, organizaciones).

## 2. Descripción del tratamiento

| Elemento | Detalle |
|---|---|
| Finalidad principal | Conectar a atletas con oportunidades deportivo-académicas en EE. UU. con transparencia de coste y seguridad para menores |
| Interesados | Atletas (menores desde 14 años y adultos), familias/tutores, personal de organizaciones (universidades, clubes, agencias, marcas) |
| Categorías de datos | Identificación, fecha de nacimiento (privada), datos deportivos, académicos (notas, exámenes), idiomas, vídeo, documentos del proceso (pasaporte, certificados, I-20…), mensajes, presupuesto familiar, datos de uso |
| Datos de categoría especial | No se solicitan. El documento "informe médico y vacunas" puede contener datos de salud: se guarda en almacenamiento privado sin acceso de organizaciones (ver riesgo R4) |
| Encargados | Supabase (BD, autenticación, archivos; región UE), Netlify (alojamiento), Anthropic (Gala IA), Stripe (pagos) |
| Transferencias | Proveedores con sede en EE. UU.: [mecanismo de cada uno: Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo] |

## 3. Necesidad y proporcionalidad

- **Minimización:** la fecha de nacimiento está en una tabla privada (`private_profile_data`); las organizaciones solo ven "menor/adulto". Marcas y agentes no ven perfiles de menores (RLS).
- **Visibilidad por bloques** (perfil, académico, estadísticas) decidida por el atleta; menores privados por defecto.
- **Consentimiento** registrado e inmutable; mayores de 14 años consienten por sí mismos (LOPDGDD art. 7) y el contacto con menores exige aprobación familiar.
- **Derechos en autoservicio:** exportación JSON completa, baja con borrado en cascada (`delete_my_account`), solicitudes con seguimiento.
- **Conservación limitada** con borrado automático diario (ver CONSERVACION.md).

## 4. Riesgos y medidas

| # | Riesgo | Prob. | Impacto | Medidas implantadas | Riesgo residual |
|---|---|---|---|---|---|
| R1 | Contacto de un adulto con malas intenciones con un menor | Media | Muy alto | Solo organizaciones verificadas (dominio oficial); contacto con menores solo tras aprobación familiar; bloqueo y denuncias; ocultación inmediata ante denuncia de seguridad infantil; agentes y marcas sin acceso a menores | Bajo |
| R2 | Suplantación de una universidad u organización | Media | Alto | Verificación automática por email confirmado del mismo dominio (.edu para universidades); dominios genéricos a revisión; sello de confianza y detector de señales de alarma en cada oferta | Bajo |
| R3 | Fraude económico a familias (pagos por "becas garantizadas") | Media | Alto | Detector de pagos previos, garantías y urgencia; publicación automática bloqueada si hay alarmas; memo de decisión con preguntas | Bajo |
| R4 | Acceso indebido a documentos (pasaporte, médicos) | Baja | Muy alto | Bucket privado; RLS por propietario y familia con permiso; enlaces firmados de 60 s; organizaciones y admin sin acceso; borrado por el usuario | Bajo |
| R5 | Fuga por error de configuración de permisos | Baja | Alto | RLS en todas las tablas; 117 pruebas automáticas de permisos; revocación explícita de funciones internas; advisors de Supabase | Bajo |
| R6 | Decisiones automatizadas con efecto significativo (art. 22) | Baja | Medio | El encaje es orientativo y explicado; ninguna admisión ni beca se decide en la plataforma; la publicación automática solo afecta a ofertas de organizaciones | Bajo |
| R7 | Uso de conversaciones con Gala IA por el proveedor | Baja | Medio | Proveedor sin entrenamiento con datos de API; aviso de no compartir datos sensibles; registros de uso borrados a los 90 días | Bajo |
| R8 | Clave secreta de Supabase expuesta | Baja | Muy alto | Solo en el webhook de Stripe con verificación de firma; nunca en el navegador; variables de entorno del servidor | Bajo |

## 5. Conclusión provisional

Con las medidas descritas, el riesgo residual se considera **aceptable** [a confirmar por el DPD/asesor]. No procede consulta previa a la AEPD (art. 36) salvo que el asesor identifique un riesgo residual alto.

## 6. Pendiente antes del lanzamiento

- [ ] Revisión y firma del asesor/DPD.
- [ ] DPA con Supabase, Netlify, Anthropic y Stripe.
- [ ] Prueba de penetración externa o revisión de seguridad independiente.
- [ ] Revisión en EE. UU.: COPPA (no hay usuarios menores de 13: el registro lo impide), FERPA (solo si una institución nos encarga registros educativos), normativa NCAA/NIL e inmigración F-1 antes de activar campañas de marca.
