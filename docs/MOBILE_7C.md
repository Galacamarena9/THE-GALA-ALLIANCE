# Prompt 7C · Experiencia móvil del coach (verificación, Discovery, shortlists)

Web mobile-first sobre la misma app (sin app separada). Reutiliza permisos, modelo de 7B, Gala Match, Passport, shortlists y pipeline.

## Navegación
Barra inferior específica para el staff (coach / universidad): **Inicio · Descubrir · Shortlists · Pipeline · Más**. El resto vive en «Más». Atletas, familias y agentes conservan su barra.

## Verificación desde el teléfono (`/app/verify/start`, `/app/verify`)
1. Quién eres (nombre, apellidos, cargo) → 2. Institución (busca primero organizaciones existentes, después universidades importadas) → 3. Programa y rol → 4. Correo institucional → 5. Listo.
- Nada se guarda hasta el final (una sola operación). Correos personales se rechazan con explicación.
- Con organización: `verification_submit` (afiliación + programa). Sin organización: reclamación de la universidad (flujo existente).
- El enlace del correo lo emite solo el servidor (`email_verification_issue`) y se envía con Resend si existen `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` y `EMAIL_FROM`. Sin ellas no se finge el envío: queda en revisión manual y se dice así.
- `/app/verify/email` confirma el enlace con la sesión del usuario (un solo uso, 30 min, intentos limitados). Muestra «Correo institucional verificado ✓», **no** «Coach verificado».
- `/app/verify`: estado por partes (correo, afiliación, programa, cargo, organización), acceso actual (sin acceso / limitado / coach verificado) y qué se puede hacer mientras. Sin estados técnicos. Si está todo verificado: «¡Estás verificado!» y CTA «Descubrir atletas».
- Al aprobar una afiliación pedida para un programa, se concede solo ese programa (migración `20261120000600`).

## Discovery
- Chips de filtros activos con ×, contador de resultados, filtros por deporte (las posiciones dependen del deporte).
- **Vista rápida** (hoja inferior): vídeo a un toque (sin autoplay ni descarga previa), 3–5 datos con verificado/declarado, académico documentado/declarado/privado, encaje con «¿Por qué?», protecciones de menor, «Ver Passport» y «+ Shortlist». Anterior/siguiente con botones (no swipe sí/no). Datos con la sesión del coach (RLS) y sin recalcular Gala Match.
- La búsqueda vive en la URL y la posición de scroll se recuerda: al volver, todo está donde estaba.
- «+ Shortlist» solo confirma cuando el servidor guarda; si falla, «Reintentar».

## Shortlists
- Visibilidad: privada, personas concretas, staff del programa u organización. Compartir y quitar acceso desde la propia lista (solo miembros con acceso a shortlists; sin enlaces públicos).
- Por atleta: revisar, prioridad, nota interna (prompts rápidos y dictado del teclado del móvil, nunca micrófono propio), **asignar con tarea opcional** y **Iniciar recruiting** con confirmación explícita, estado de éxito real («Ver en el pipeline» / «Seguir en la lista») y sin duplicar procesos (`shortlist_promote`).
- Comparar 2–3 atletas por secciones con «Mostrar solo diferencias»; nunca declara una ganadora.

## Eventos de producto
`athlete_quick_view`, `athlete_shortlisted`, `note_added`, `candidate_assigned`, `athlete_promoted_to_pipeline`, `verification_requested`, `athlete_discovered`.

## Pendiente
Velocidad de reproducción y posición del vídeo dependen del reproductor externo (YouTube/Vimeo). Notificaciones push y deep links de email reutilizan las rutas actuales (`/app/recruit/candidates/[id]`, `/app/recruit/shortlists/[id]`, `/app/verify`), que validan sesión y permisos en cada carga.
