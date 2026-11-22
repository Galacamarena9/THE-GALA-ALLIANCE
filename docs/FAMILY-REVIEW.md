# Family Experience · revisión del Prompt 10 (22-11-2026)

La fase Familia se construyó en los prompts 10 → 10D (ver [FAMILY.md](FAMILY.md), [FAMILY-RLS.md](FAMILY-RLS.md), [FAMILY-PENTEST.md](FAMILY-PENTEST.md) y [FAMILY-QA.md](FAMILY-QA.md)). Esta revisión contrasta el texto completo del Prompt 10 con el código y las pruebas actuales, cierra el hueco de avisos y deja claro lo que sigue abierto.

## 1. Condición de cierre del prompt

> «Guardian A puede acceder a los recursos autorizados de Athlete A, pero no a los de Athlete B, y University A jamás puede acceder a documentos que solo fueron autorizados para University B.»

| Comprobación | Prueba directa contra PostgreSQL (`npm run test:rls`) | Estado |
|---|---|---|
| Tutor A → recursos autorizados de A | P10A matriz (atleta, tutor completo, tutor sin costes…) | ✅ |
| Tutor A → atleta B, también cambiando `athlete_id` | P10, P10C IDOR (9 recursos, 0 filas) | ✅ |
| Tutor revocado | P10 pausar/revocar, P10C sesión revocada (tablas, Storage, RPC) | ✅ |
| Shortlist sí, notas privadas del atleta no | P10 «notas privadas: nunca», P10A | ✅ |
| Documentos sí y mensajes no (alcances independientes) | P10A mensajes, FAM-SEC-006 | ✅ |
| Documento sin aprobación → denegado; aprobado → permitido; caducado o revocado → denegado | P10, FAM-SEC-004/005, P10C Storage, P10D | ✅ |
| Universidad A ↔ B sobre el mismo documento | P10D (Club A sí, Club B no), P10C Storage | ✅ |
| Transición a la mayoría de edad | P10 «mayoría de edad» (suspensión al vencer la revisión) | ✅ |
| **En un Supabase real (staging)** | — | ⛔ El proyecto remoto no tiene ninguna migración de Familia (va por la 40 de 77). Ver [`supabase/README.md`](supabase/README.md) |

Todas las pruebas se hacen sobre PostgreSQL con los roles reales `anon` y `authenticated` y con `auth.uid()`, no sobre la interfaz. Lo que falta es repetirlas en un proyecto Supabase real.

## 2. Entregables de base de datos (§76)

| Entregable | Estado | Dónde |
|---|---|---|
| Guardian Relationship, estados y verificación | ✅ | `parent_athlete_links` (pending/approved/restricted/revoked/expired; relación; `verification_status`) |
| Consentimientos con alcance, versión, caducidad y revocación | ✅ | `consents` (inmutables, con `expires_at`; revocar cascada a concesiones) |
| Permisos familiares y funciones de autorización | ✅ | `has_family_link`, `is_active_guardian`, `guardian_has_scope`, `guardian_can_view_resource`, `requires_guardian_consent` |
| Concesiones de documentos | ✅ | `document_access_grants` + `document_open` auditado |
| Tareas familiares en el motor central | ✅ | `pipeline_tasks.owner` (atleta / familia / ambos) |
| **Avisos familiares** | ✅ **hoy** | Ver §4 |
| Modelo de costes (4 conceptos separados) y presupuesto privado | ✅ | `institutions`/`opportunities`, `aid_kind`, `athlete_offers`, `family_cost_scenarios`; `athlete_finances` con su propio permiso |
| Auditoría | ✅ | `audit_logs` (vínculo, permisos, revisión de mayoría, consentimientos, aperturas) |
| Pruebas RLS, entre familias, entre organizaciones y de mayoría de edad | ✅ | 409 pruebas en total |
| Tipos TypeScript regenerados | ⛔ | Hasta aplicar las migraciones en el remoto |

## 3. Entregables de producto (§77)

| Entregable | Estado |
|---|---|
| Onboarding, invitación y verificación del tutor | ✅ Enlace de un solo uso (14 días), aceptación con cuenta propia, verificación por admin |
| Panel familiar, selector de hijos, siguiente acción, plazos, proceso, costes, documentos y «Quién contacta» | ✅ `/app/family` |
| Cost Center y comparación sin inventar | ✅ `/app/family/costs` («desconocido» nunca es 0) |
| Centro de documentos y consentimientos (aprobar o retirar con contexto) | ✅ `/app/requests` + Centro de seguridad |
| Centro de seguridad, bloqueo y denuncias | ✅ `/app/family/safety`, `user_blocks`, `content_reports` |
| Gala AI para familias | ✅ `get_family_overview` |
| Móvil, estados vacíos y accesibilidad | ✅ e2e en 375 y 1280 px; objetivos táctiles de 44 px; estados con texto |
| Preferencias de aviso de la familia | ✅ **hoy** |
| Correos familiares (outbox → email) | 🟡 Los avisos se guardan primero en la base de datos (outbox), pero **no se envían por correo**: falta configurar Resend (`RESEND_API_KEY`, dominio verificado) y una tarea que los mande con asunto neutro |
| Conversión de moneda con tipo documentado | 🟡 Se muestra la moneda original. Falta elegir la fuente de tipos (por ejemplo, el tipo de referencia del BCE) y guardar proveedor, fecha y tipo |
| Modos de comunicación con menores (no requerido / visible / participa / aprobación / bloqueado) | 🟡 Funcionan «visible», «aprobación del tutor» y «bloqueado» (`minor_contact_mode`, `user_blocks`). «Participa en la conversación» no existe. Una política por jurisdicción configurable (§7) solo existe en parte: `family_policies` (ventana de revisión) |
| Categorías de denuncia del prompt | 🟡 Hay `child_safety`, `harassment`, `fake_or_misleading`, `spam`, `privacy` y `other`. «Beca fraudulenta» y «suplantación» entran hoy en `fake_or_misleading`, sin categoría propia |
| Plazos de la familia (oficial / personal / recomendado) | 🟡 Los oficiales salen del pipeline y las tareas familiares tienen fecha. La etiqueta «recomendado por Gala» no existe |

## 4. Cambio de hoy: avisos familiares (§34, §60, §61)

Antes, todo aviso de familia era «esencial» (no se podía silenciar) y la familia **no recibía** las ofertas nuevas ni los cambios de estado de las candidaturas, aunque tuviera permiso para verlos.

Ahora, con `20261209000300_10r_family_notifications.sql`:
- **Esenciales** (no se pueden silenciar): aprobaciones, solicitudes de documentos y seguridad.
- **Nuevas categorías** que la familia puede silenciar en `/app/notifications`: «Familia · proceso» y «Familia · ofertas». Hay dos más reservadas para plazos y costes.
- **Destinatarios:** solo tutores activos con el permiso correspondiente. Se aplica la misma regla que a la lectura, incluida la suspensión por mayoría de edad. Nunca se avisa al tutor que hizo el cambio.
- **Texto neutro:** el aviso no lleva el nombre de la universidad ni importes; se ven dentro, con sesión.
- **Prueba:** «P10 revisión · avisos familiares». Comprueba otra familia, el vínculo caducado, el silenciado, que no haya datos sensibles, el tutor revocado y que la función de destinatarios no se pueda llamar desde la API.

## 5. Siguiente, por orden

1. Aplicar las migraciones en el remoto y repetir allí las pruebas de familia (bloquea el cierre formal).
2. Correos familiares cuando Resend esté configurado.
3. Conversión de moneda con una fuente oficial y fechada.
4. Categorías de denuncia propias: beca fraudulenta y suplantación.
