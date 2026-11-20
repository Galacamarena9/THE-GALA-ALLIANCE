# Coach & University Portal (Fase 07)

**Principio:** un único ecosistema. El portal reutiliza `organizations`, `organization_members`, `opportunities`, `applications`, `athlete_offers`, `contact_requests` y `athlete_documents`; solo añade lo que es propio de la organización.

## Entidades nuevas (todas con `organization_id` y RLS por `org_can`)
| Tabla | Para qué | Quién la ve |
|---|---|---|
| `org_programs` | Programas deportivos (Women's Basketball…) | Miembros |
| `recruiting_needs` | Necesidad **interna** (no pública salvo que se publique una oportunidad) | Staff con `needs`/`candidates` |
| `org_candidates` | Pipeline interno (etapa interna ≠ estado que ve el atleta) | Staff con `candidates` |
| `org_shortlists` / `org_shortlist_members` | Listas privadas o de equipo; un atleta una vez por lista | Staff con `shortlist` (privadas: dueño y admins) |
| `org_notes` | Notas internas — **nunca** visibles para el atleta ni otras organizaciones | Staff con `notes` |
| `org_tasks` | Tareas del equipo con asignado, fecha y prioridad | Staff con `tasks` |
| `org_activity` | Línea de tiempo + auditoría (inmutable) | Staff con `candidates` o `audit` |
| `info_requests` | Solicitud de información; el atleta (o su familia si es menor) comparte con fecha límite | Atleta, familia y la organización |

## Permisos
`org_role_caps(role)` (SQL, versión `org_policy_version()`) y su espejo en `src/lib/domain/recruit.ts` (solo para la interfaz). Sin verificar, una organización puede configurar programas, necesidades y oportunidades, pero **no** descubrir atletas, ver datos restringidos, contactar ni pedir documentos. `program_ids` limita el acceso de un miembro a programas concretos.

## Privacidad
- `athlete_directory` devuelve `NULL` en los campos de bloques que el visitante no puede ver: no se pueden ni ver ni deducir filtrando.
- «Disponible en el Passport» ≠ «Compartido con esta universidad»: un documento solo se lee con una concesión vigente (`org_has_document_grant`), cada apertura se registra (`log_document_access`) y el enlace dura 5 minutos.
- Menores: las solicitudes van a la familia (`pending_guardian`); el menor no puede compartir solo; el contacto usa el flujo existente con aprobación familiar y la ventana NCAA.
- Becas en oportunidades: `scholarship_status` impide anunciar ayuda sin información y reserva «confirmada» para las ofertas reales.

## Salida de staff
Al dar de baja a un miembro pierde el acceso al instante (RLS por membresía); sus asignaciones se liberan, sus listas privadas pasan al equipo y queda en `org_activity`. Siempre debe quedar un propietario o administrador.

## Encaje inverso
`needFit()` mide compatibilidad con los criterios de una necesidad usando solo datos visibles. Datos no compartidos bajan la confianza, no penalizan. No es una valoración del talento ni un ranking.

## Publicar una oportunidad (formulario y vista previa)
- El formulario recoge ya los campos de la Fase 07: estado de beca (`scholarship_status`), materiales que se pedirán (`required_materials`), atletas internacionales, método de contacto, caducidad y necesidad interna vinculada (solo visible para el staff).
- `validatePublish()` (`src/lib/domain/recruit.ts`) aplica antes de guardar las mismas reglas que la base de datos: sin estado de beca no se anuncia ayuda, «importe indicado» exige importe, y la caducidad no puede ser pasada ni anterior al plazo.
- **Ver como atleta** (`/app/opportunities/[id]?view=athlete`): el staff ve la ficha exactamente como un atleta, con aviso de qué roles verán las candidaturas. Nunca muestra notas internas ni la necesidad vinculada.
- La ficha pública muestra al atleta «Requisitos y proceso» antes de aplicar y recuerda que aplicar no comparte documentos privados.

## Revisión de vídeo
`MediaSwitcher`: highlight, partido completo y clips en la misma ficha del candidato (pestañas accesibles, carga bajo demanda). Velocidad y calidad desde el reproductor de YouTube/Vimeo.
