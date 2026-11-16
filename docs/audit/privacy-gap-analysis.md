# Análisis de brechas de privacidad y menores

No es asesoramiento jurídico. Los textos de `src/content/legal.ts` y `docs/legal/` son **borradores** pendientes de revisión
por un profesional, y nada de lo que sigue afirma cumplimiento.

## Lo que ya está implementado (con evidencia)

| Control | Evidencia |
|---|---|
| Menores privados por defecto y nunca visibles para anónimos | `can_view_athlete` (última versión en `20261113000500_business_and_lovable_port.sql:65`): un menor devuelve `false` si no hay sesión |
| Marcas y agentes sin acceso a menores | Misma función + campañas solo 18+ |
| Bloqueo de cuentas de menores de 13 años | `checkAge` (`src/lib/domain/age.ts`) en el registro y en la BD |
| Datos sensibles separados | `private_profile_data`, `athlete_finances` con RLS propia |
| Sin datos de contacto en mensajes con menores | Error `contact_data_not_allowed_with_minors` (`src/app/actions/connect.ts:14`) |
| Mensajes, consentimientos y auditoría inmutables | Triggers `contact_messages_immutable`, `audit_immutable`; `revoke update, delete` (`foundation.sql:1064`) |
| Cookies opcionales bloqueadas hasta consentimiento, con registro | `cookie_consent_logs`, `CookieBanner`, IP con hash y sal (`CONSENT_IP_SALT`) |
| Derechos RGPD: descarga, baja y borrado programado | `/app/settings/export`, `data_subject_requests`, `run_retention()` con `pg_cron` |
| Documentos en bucket privado | `athlete-documents` con `public = false`, 10 MB y PDF/JPEG/PNG (`20261113000700_…:50`); URL firmada de 60 s |
| DSA: denuncias con decisión motivada y ocultación preventiva | `content_reports`, `20261113000800_autonomous_operations.sql:5` |
| Normas NCAA de contacto | `ncaa_contact_opens_on` (`20261116000100_ncaa_contact_window.sql`) |
| EIPD, RAT, plan de brechas y conservación (borradores) | `docs/legal/` |

## Brechas

| ID | Brecha | Riesgo | Prioridad |
|---|---|---|---|
| PRIV-01 | Umbral de consentimiento digital del menor fijo para España; no parametrizado por país para la expansión a la UE (13-16 años) | Tratamiento sin base válida fuera de España | P1 (antes de abrir otros países) |
| PRIV-02 | El recurso frente a decisiones de moderación es "escribir a [email]" (`legal.ts:80`): sin flujo de recurso ni registro | DSA: falta mecanismo de recurso trazable | P1 |
| PRIV-03 | Retención de mensajes, vídeos y denuncias no parametrizada por tipo de dato (solo `run_retention` general) | Conservar más de lo necesario | P1 |
| PRIV-04 | Sin análisis de transferencias internacionales (universidades de EE. UU. ven datos de atletas de la UE) | Transferencias sin garantías documentadas | P0 legal (antes de abrir el registro) |
| PRIV-05 | Analítica de producto solo para usuarios con sesión; sin esquema documentado de propiedades sin datos personales | Medición incompleta o con riesgo de datos personales si se amplía mal | P1 |
| PRIV-06 | Sin detección de señales de riesgo en mensajes (pagos privados, secreto, presión, salida a WhatsApp/Telegram) | Captación o fraude en conversaciones con menores | P1 |
| PRIV-07 | Sin canal urgente separado para riesgos de menores | Respuesta lenta en casos críticos | P1 |
| PRIV-08 | Declaración de accesibilidad no publicada | European Accessibility Act, según el alcance | P2 |
