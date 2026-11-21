# Prompt 7 · Ficha 360 del atleta para el agente

**Ruta:** `/app/portfolio/[athleteId]`. Solo para agentes y solo si el atleta está, o estuvo, en la cartera de su agencia. Un atleta de otra agencia y un UUID inexistente dan el mismo mensaje, «Atleta no disponible», así que no se revela si el atleta existe.

**Código principal:**

| Pieza | Archivo |
|---|---|
| Lógica pura | `src/lib/domain/athlete-360.ts` (+ `athlete-360.test.ts`, 7 pruebas) |
| Contrato de datos | `src/lib/data/athlete-360.ts` (`loadAthlete360`) |
| Vista | `src/app/app/portfolio/[athleteId]/Athlete360View.tsx` (sustituye a `AthleteWorkspaceView`) |
| Vista previa ficticia | `/preview/athlete-360`, `-empty`, `-viewer`, `-locked` (solo con `ENABLE_PREVIEW=1`) |

Capturas en `docs/athlete-360/`.

## A. Ruta y diseño adaptable

La ficha tiene tres bloques, de arriba abajo:

1. **Cabecera.** Muestra la identidad pública: avatar, nombre, estado de representación, deporte · posición · país · promoción, el resumen de verificación (el mismo texto que en «Mis atletas»), los **datos clave visibles (n de 8)**, la ciudad y tu papel.
   - Las acciones son **Mensaje**, **Buscar oportunidades** y **Más**.
   - **Más** reúne: perfil público, vídeo, añadir nota, abrir un proceso y finalizar la representación.
2. **Recorrido actual** (bloque principal, ver C).
3. **Pestañas.**

**Tamaños de pantalla:**
- **Escritorio:** el recorrido completo cabe en la primera pantalla a 1280×720 (lo comprueba una prueba e2e).
- **Móvil:** la cabecera se apila, «Resolver ahora» ocupa todo el ancho y las pestañas se desplazan en horizontal.

## B. Contratos de las pestañas

| Pestaña (`?tab=`) | Fuente canónica | Contenido | Vacío → siguiente acción útil |
|---|---|---|---|
| *(ninguno)* · Resumen | `loadAthleteWorkspace` | Perfil deportivo, académico, representación, permisos concedidos, seguimientos | «Pídeselo por mensaje» / «Programa uno desde Actividad» |
| `oportunidades` | `loadOffers` (ofertas, requiere `offers.view`) + `matchingOpportunities` del Inicio | Ofertas con coste neto y señales de alarma; oportunidades verificadas que encajan | «Buscar oportunidades»; sin permiso, explica que lo decide el atleta |
| `recruiting` | `loadAgencyCases` | Procesos ordenados por fase, siguiente paso, plazo, responsable, «parado» | «Abrir el primer proceso» |
| `documentos` | `DOC_CHECKLIST` + concesiones vigentes (`athlete_documents` vía `org_has_document_grant`) + `info_requests` de la agencia + señales de Evidence & Trust | Lista de comprobación humana (ver D) | «Pídele lo que necesites por mensaje» |
| `actividad` | `buildTimeline` + `recruiting_case_activities` | Línea de tiempo según el rol (ver E), nueva nota, seguimientos, mis notas | «Añade una nota o programa un seguimiento» |

**Enlaces de pestaña:**
- La URL es canónica: la pestaña por defecto no lleva parámetro.
- Los enlaces antiguos `?tab=notas`, `?tab=pasos` y `?tab=procesos` redirigen a `actividad`, `actividad` y `recruiting`.
- Un valor desconocido abre Resumen.

**Accesibilidad:** `<nav aria-label="Secciones de la ficha">` con enlaces y `aria-current="page"`. El panel es una `<section aria-labelledby>` ligada a la pestaña activa, y se navega con Tab.

## C. Componente «Recorrido actual» (`currentJourney`)

Responde a seis preguntas en una sola tarjeta: **con quién** (organización y oportunidad), **en qué fase**, **qué toca**, **para cuándo**, **de quién depende** y **un único botón «Resolver ahora»**.

Elige el asunto principal así:
1. Lo urgente, con la **misma regla del Inicio y de «Mis atletas»** (`buildAttention`, rangos 1–4): oferta que caduca → vencido → respuesta de universidad → visita.
2. Si no hay nada urgente, el proceso más avanzado.
3. Si no hay procesos, la oferta viva más próxima.
4. Si está colocado, preparar la llegada.
5. Si no hay nada, «Buscar oportunidades».

**De quién depende:**
- **El atleta:** ofertas y fases «Oferta o ayuda» / «Decisión pendiente».
- **La organización:** «Contactado» y «Revisión académica».
- **Tu agencia:** el resto.

**Casos especiales:**
- Una propuesta pendiente muestra «Esperar a que el atleta acepte».
- Una representación terminada no tiene botón de acción.

## D. Lista de documentos (`documentChecklist`)

Parte de los 12 documentos estándar del proceso (`DOC_CHECKLIST`), agrupados en «Para el proceso» y «Visado y llegada». Cada documento tiene un estado:

| Estado | Cuándo |
|---|---|
| Compartido contigo | Hay un documento con archivo que la RLS deja leer (concesión vigente) |
| Pedido · lo decide el atleta | Petición de la agencia `pending` o `pending_guardian` |
| No lo ha compartido | Petición rechazada |
| No compartido con tu agencia | Sin concesión ni petición. **Nunca se afirma que «falta»**: la agencia no puede saberlo |
| Sin permiso para ver documentos | El atleta no concedió `documents.view`. Ni siquiera se consulta la tabla |

Al lado se muestran las **evidencias** (Evidence & Trust):
- estadísticas validadas por el club o declaradas;
- vídeo;
- nota media e inglés respaldados por documento o declarados.

Si el atleta no comparte un dato, se indica: «No lo comparte contigo».

## E. Actividad (`activityProjection`)

Junta representación, notas internas de la agencia, cambios de fase y contactos de los procesos.

**Según el rol** (decidido en el servidor):
- Quien no puede leer notas internas recibe «Nota interna añadida» **sin texto**.
- Esto aplica a agencia en solo lectura y a scouts no asignados al atleta.
- En esos casos, `loadAthlete360` vacía el cuerpo de las notas y **ni siquiera pide la columna `body`** de las actividades. El texto nunca llega al HTML: lo comprueba una prueba e2e que descarga la página y busca el texto.
- Las notas de la agencia no llegan nunca al atleta, a universidades ni a otras agencias. Lo garantiza la RLS y hay una prueba nueva.

## F. Mapa de permisos (`a360Access`)

| Sección | Puerta en la base de datos (manda siempre) | Permiso que concede el atleta | Si falta |
|---|---|---|---|
| Ficha / cartera | `agent_representations` + `is_org_member` | — | «Atleta no disponible» |
| Perfil y académico | `athlete_profiles`, `athlete_academics` (visibilidad del atleta) | `passport.view` | Campos vacíos con explicación |
| Ofertas | `offers_select_agent` → `agent_can(…, 'offers.view')` | `offers.view` | No se consulta; mensaje «Sin permiso» |
| Procesos | `case_access` | representación activa | «Sin representación activa» |
| Documentos | `org_has_document_grant` + `agent_can_via(…, 'documents.view')` | `documents.view` | No se consulta; estado «bloqueado» |
| Mensajes | `contact_requests` (`org_can(…,'contact')`, regla de menores y tutor) | `messages.participate` | Botón oculto y explicación en «Más» |
| Notas internas | `agency_notes_select` → `is_org_member` | — (dato de la agencia) | Con texto: owner, admin, manager, recruiter, athlete_manager, operations, compliance o asignado como agente principal, de apoyo u operaciones. Sin texto: solo lectura y scout no asignado |
| Escribir notas | `agency_notes_insert` | — | Rol de solo lectura o propuesta rechazada → sin formulario |

**Reglas generales:**
- Sin representación activa no se piden ofertas, documentos ni mensajes, aunque haya permisos guardados.
- Aceptar ofertas, el presupuesto familiar y las notas de la familia quedan siempre fuera del agente.
- No se ha cambiado ninguna política RLS ni ningún esquema.

## G. Enlaces directos

| Enlace | Destino |
|---|---|
| `/app/portfolio/{id}` | Resumen |
| `/app/portfolio/{id}?tab=oportunidades\|recruiting\|documentos\|actividad` | Cada pestaña |
| `/app/portfolio/{id}?tab=actividad#nota` | Formulario de nota |
| Seguimiento vencido en el Inicio | `?tab=actividad` |
| «Añadir nota» / «Ver procesos» en «Mis atletas» | `?tab=actividad#nota` / `?tab=recruiting` |
| «Cambiar de atleta» | Conserva la pestaña |
| «Resolver ahora» | El proceso (`/app/pipeline/{caseId}`) o la pestaña que corresponda |
| «Mensaje» | La conversación existente (`/app/inbox/{id}`). Si no la hay y el permiso existe, el flujo de solicitud de contacto del perfil, que respeta el consentimiento del tutor |

## H. Pruebas

**Unitarias** (`athlete-360.test.ts`, 7):
- pestañas y redirecciones antiguas;
- mapa de permisos por estado y rol;
- recorrido: oferta, tarea vencida, proceso avanzado, propuesta pendiente, sin procesos y terminada;
- estados de documentos;
- actividad sin texto interno cuando el rol no lo permite.

**E2E** (`e2e/athlete-360.spec.ts`, 10):
- estado y siguiente acción en la primera pantalla con un único botón principal;
- cabecera y acciones;
- pestañas accesibles con URL propia y axe;
- documentos y evidencias;
- sin permisos;
- actividad según el rol, comprobando el HTML;
- vacíos con siguiente acción;
- 360, 768 y 1440 px sin desbordamiento y sin errores graves de axe.

**RLS:** «Ficha 360: las notas internas de la agencia no llegan al atleta, a una universidad ni a otra agencia» (403/403 OK).

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Estado y siguiente acción en ≤ 10 s | PASS (aproximado) | El recorrido completo está en la primera pantalla a 1280×720 y la página carga en ~1,1 s en local. No es una prueba con usuarios: la medición real de tiempo de comprensión necesita sesiones con agentes |
| Sin registros duplicados de la fuente de verdad | PASS | Sin migraciones ni tablas nuevas. Todo se compone desde `loadAthleteWorkspace`, `loadAgentSources`, `loadAgencyCases`, `loadOffers`, `DOC_CHECKLIST` y `buildTimeline` |
| Notas privadas fuera de payloads no autorizados | PASS | Prueba RLS, prueba unitaria (JSON sin el texto) y prueba e2e (HTML sin el texto) |
| Pestañas accesibles y con URL propia | PASS | e2e con axe, `aria-current`, `aria-labelledby` y Tab |
| Vacíos con siguiente acción útil | PASS | e2e |
| Responsive y E2E | PASS | 10/10 en local. Las pruebas «sin sesión → login/401» del smoke fallan solo en local por falta de variables de Supabase; CI decide |
