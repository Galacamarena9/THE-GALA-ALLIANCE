# Family Experience (Prompt 10)

Supervisión + seguridad + costes + plazos + documentos + consentimiento + decisiones. No es el panel del atleta en pequeño.

## AS-IS → TO-BE

| Antes | Ahora | Migración |
|---|---|---|
| `parent_athlete_links` con `pending/approved/revoked` y 4 permisos | La misma tabla es la **Guardian Relationship**: estados `pending` (invitado), `approved` (activo), `restricted` (pausado), `revoked`, `expired`; `relationship` (madre, padre, tutor legal, tutor autorizado…); `verification_status` (sin confirmar / confirmado por el atleta / verificado por admin); 8 permisos por recurso | Expand: columnas nuevas con valores por defecto que no cambian el acceso existente; los vínculos aprobados pasan a «confirmado por el atleta» |
| `consents` inmutables | + `expires_at`; revocar el consentimiento de compartir un documento revoca sus concesiones; todo consentimiento queda auditado | Columna nueva |
| `athlete_finances.annual_budget_usd` | + `budget_mode` (preferencia / límite estricto). Privado | Columna nueva |
| — | `family_cost_scenarios`, `family_notes`, `family_policies` | Tablas nuevas |
| `pipeline_tasks` del atleta | El mismo motor con `owner` (atleta / familia / ambos) y `source` | Columnas nuevas |

**Household:** no hace falta. Las relaciones ya cubren varios tutores por atleta y varios atletas por tutor, cada relación con sus propios permisos.
No había campos de padres sueltos en el perfil del atleta (nombre, email, contacto de emergencia) que migrar.

## Identidad y verificación

Cada persona tiene su propia cuenta (sin contraseñas ni sesiones compartidas). El vínculo nace de un enlace de un solo uso, aleatorio de 244 bits, que caduca en 14 días (y pasa a `expired` cada noche si hay pg_cron). Nunca se concede por conocer el email del atleta: la otra parte tiene que aceptar con su cuenta.

- Opción A: el atleta invita a su familia. Opción B: la familia invita y el atleta acepta. En ambas el atleta participa → `athlete_confirmed`.
- Opción D: verificación administrativa (`family_link_admin_verify`), auditada como evento de seguridad.
- Opción C (onboarding del menor): el menor ve el mensaje «recomendamos vincular a tu familia» en Ajustes.

## Permisos por recurso

| Recurso | Permiso | Por defecto |
|---|---|---|
| Passport y shortlist | `can_view_profile` | Sí |
| Candidaturas, proceso, trials | `can_view_applications` | Sí |
| Académico | `can_view_academics` | Sí |
| Costes y presupuesto | `can_view_costs` | Sí |
| Documentos y solicitudes | `can_view_documents` | Sí |
| Quién contacta | `can_view_contacts` | Sí |
| Mensajes | `can_view_messages` | No |
| Editar perfil | `can_edit_profile` | No |
| Notas privadas del atleta | — | Nunca |

Los decide el atleta (la base de datos lo exige). Funciones: `has_family_link`, `is_active_guardian`, `guardian_can_view_resource`, `requires_guardian_consent`.

## Mayoría de edad (GUARDIAN ACCESS REVIEW)

Si el vínculo se creó siendo menor el atleta, al cumplir 18 se abre una ventana (`family_policies.review_window_days`, hoy 30 días). El atleta confirma o retira el acceso desde Ajustes. Si no responde, el acceso se **suspende solo** al vencer la ventana (`family_link_lapsed`, sin depender de un cron) hasta que lo confirme. Todo queda auditado.

## Costes sin inventar

Los cuatro conceptos están separados: coste institucional (`institutions`, `opportunities`), tipo de ayuda (`opportunities.aid_kind`), componente de oferta (`athlete_offers`) y escenario privado de la familia (`family_cost_scenarios`). Un hueco es **desconocido**, nunca 0.

- Sin matrícula → «Información insuficiente».
- Falta alojamiento o comidas → «Coste conocido hasta ahora: X + alojamiento sin conocer».
- Solo con lo esencial → «Coste estimado para la familia».
- Frente al presupuesto: «dentro» solo con datos completos y en la misma moneda; si no, «aún no se puede saber» (nunca descarta una opción).
- Sin conversión de moneda: no hay un tipo de cambio documentado (proveedor, fecha) todavía, así que se muestra la moneda de la fuente.

## Notas, tareas y actividad

- Notas: `guardians` (solo tutores) o `family` (también el atleta). Ninguna organización las ve. El atleta solo puede escribir notas compartidas.
- Tareas: la familia crea tareas `guardian` o `both` en el mismo plan que el atleta; no puede asignar tareas «del atleta».

## Seguridad y auditoría

Eventos en `audit_logs`: vínculo aprobado, revocado, pausado/reanudado, permisos cambiados, revisión de mayoría, verificación admin, consentimiento concedido/revocado, documento abierto por terceros.

## Gala AI para familias

Herramienta `get_family_overview`: por cada hijo/a, la acción pendiente, plazos, ofertas y el coste de cada opción frente al presupuesto, con la misma RLS que la pantalla. Reglas: separa «dentro del presupuesto con los datos actuales» de «información incompleta», no descarta opciones por falta de datos y nunca decide por la familia.

## Pruebas

RLS (P10): otras familias (incluido cambiar el `athlete_id`), varios tutores con permisos distintos, presupuesto privado frente a cualquier organización/agente/anónimo, relación no manipulable desde el cliente, mayoría de edad, pausa/revocación, notas, tareas compartidas, revocación de consentimiento en cascada y consentimiento caducado, e invitaciones caducadas o reutilizadas. Unitarias: coste real, presupuesto, siguiente acción y revisión de mayoría. e2e: panel y comparación en 375 px y 1280 px.

## Pendiente (siguientes prompts)

- 10A/10B/10C: matriz RLS completa de familia, políticas y pentest (incluye `contact_requests`, que todavía no aplica el permiso «quién contacta»).
- ~~Preferencias de notificación por categoría familiar~~: hechas el 22-11 (ver [FAMILY-REVIEW.md](FAMILY-REVIEW.md)). Correos familiares: pendientes de Resend.
- Conversión de moneda con tipo documentado.
- Centro de seguridad propio (hoy: bloque «Quién contacta» + bandeja + bloqueos en Ajustes).
