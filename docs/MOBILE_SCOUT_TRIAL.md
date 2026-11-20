# Experiencia móvil · Scout & Trial (Prompt 11C)

Objetivo: un scout en un pabellón descubre a una atleta, ve su Passport y su vídeo, la guarda, toma una nota y la
asigna en menos de un minuto. La atleta y su familia entienden la invitación (quién, cuándo, cuánto, qué se comparte)
y la gestionan desde el móvil.

Es web mobile-first sobre el mismo producto (sin app separada) y no relaja la RLS: todo pasa por las mismas tablas,
RPC y políticas de 11A/11B.

## 1. Arquitectura de información

| Actor | Barra inferior (≤5) | Notas |
|---|---|---|
| Staff de club o academia | Inicio · Descubrir · Shortlists · **Trials** · Más | El pipeline sigue en «Más» y en las pestañas del portal. |
| Staff de universidad | Inicio · Descubrir · Shortlists · Pipeline · Más | Sin trials en primer plano. |
| Atleta | Inicio · Escaparate · Becas · Mensajes · Todo | En Oportunidades: atajos **Trials / Academias / Becas**. |
| Familia | (navegación general) | **Centro de trials** al principio del panel familiar. |

`app/app/layout.tsx` decide si el staff es de club mirando el tipo de sus organizaciones (una consulta, solo para staff).

## 2. Scout (Parte A)

- **Discovery** (`/app/recruit/discover`):
  - buscador y filtros plegables con botón fijo «Aplicar filtros» y «Borrar todo»;
  - chips para quitar cada filtro; posiciones del deporte elegido, desde la taxonomía;
  - paginación en el servidor (máx. 20 páginas).
- **Vista rápida** (hoja inferior):
  - vídeo a un toque, sin reproducción automática (`MediaSwitcher` separa highlight, partido completo y clips);
  - 3–5 datos y encaje explicado («¿Por qué?»), siempre como compatibilidad, nunca como valoración del talento;
  - «+ Shortlist» y anterior/siguiente con botones. **Sin gestos de descartar o elegir.**
  - **Nuevo:**
    - **Nota** interna con atajos (Revisar partido completo, Comentar con el entrenador…), compatible con el dictado del teclado;
    - **Asignar** a una persona del staff con tarea y fecha (`quickNote` / `quickAssign`).
- **Contexto:** los filtros viven en la URL y la posición de scroll se guarda en `sessionStorage`. Al volver de la
  ficha, la búsqueda sigue igual.
- **Privacidad:** las tarjetas solo muestran lo que el atleta comparte (`athlete_directory` + RLS). Nunca muestran
  contacto, fecha de nacimiento, familia, documentos ni presupuesto.

## 3. Club · Trials (Parte B)

- **`/app/recruit/trials`** con pestañas Próximos, Candidaturas y Pasados:
  - tarjetas con confirmados, pendientes y documentos pendientes (o lista de espera en los pasados) y una sola acción
    principal: «Revisar candidaturas» o «Abrir trial»;
  - 3 consultas agregadas en total, no una por trial.
- **Panel del trial** (`/app/opportunities/[id]`):
  - **Candidaturas** con indicador de familia y de documentos. «Aceptar» pide confirmación mostrando el estado de la
    familia y de los documentos;
  - **Participantes** con filtros Todos, Confirmados, Pendientes, Docs. pendientes, Espera y Cancelados (`?pf=` +
    ancla `#participantes`: tras actuar vuelves al mismo filtro);
  - check-in con hora y «No se presentó» con confirmación, solo con el trial ya empezado (lo garantiza la RPC);
  - seguimiento (Iniciar recruiting, Seguimiento, Volver a invitar, Cerrar). Nunca crea una oferta.
- La lista de espera **no** muestra posición, porque no existe un orden real.

## 4. Atleta y familia (Partes C y D)

- **Atleta:**
  - en Oportunidades, los atajos Trials y Academias agrupan los tipos y se ordenan por encaje;
  - el detalle del trial muestra qué, quién (verificado), dónde, cuándo, coste obligatorio vs opcional (con
    «Incluido» y «No incluido»), requisitos y materiales;
  - el total obligatorio solo aparece si se puede calcular.
- **Invitación:** «Me interesa» **no** inscribe. El siguiente paso (requisitos, familia, inscripción) es explícito.
  El texto nunca dice que el club quiera ficharte.
- **Familia** (`/app/family`, **Centro de trials**):
  - primero «Tu revisión es necesaria» (invitaciones y plazas que esperan al tutor), después el seguimiento;
  - al abrir ve el contexto completo antes de aprobar;
  - nunca ve datos internos del club (notas, resultados internos ni otros candidatos).

## 5. Estados, errores y red

- **Carga:** esqueletos o «Guardando…». **Nunca** se muestra «✓ Guardado» antes de la respuesta del servidor.
- **Sin conexión:** las acciones (aceptar, rechazar, check-in, iniciar recruiting, invitar, notas, asignaciones)
  dicen «Necesitas conexión…» y no fingen éxito. No hay cola offline: no existe sincronización idempotente
  garantizada para esas acciones.
- **Doble toque:** los botones se desactivan mientras esperan y las RPC son idempotentes en el servidor.
- **Errores en lenguaje humano** (`trialErrorMessage`): los mensajes de RLS o de permisos llegan como «No tienes
  permiso…»; `use_application_org_decide` se explica; nunca se muestra el código técnico.
- **Caché:** no se cachean documentos, URL firmadas, datos del tutor ni notas. La Vista rápida guarda en memoria lo
  ya cargado solo mientras la página está abierta.

## 6. Enlaces profundos y notificaciones

Las notificaciones llevan a `/app/opportunities/[id]` (trial, invitación o candidatura) y a la ficha del candidato.
Cada página revalida sesión, membresía, RLS y estado del recurso: un enlace antiguo no autoriza nada.
**Push:** no implementado (la plataforma es web). Los eventos ya están estructurados (`notifications.kind` + enlace)
para conectarlo después.

## 7. Analítica (sin datos personales)

`mobile_discovery_search` (solo con user-agent móvil), `athlete_quick_view`, `highlight_played`, `athlete_shortlisted`,
`scout_note_added`, `candidate_assigned`, `trial_viewed` / `trial_mobile_viewed`, `trial_applied`,
`trial_invitation_opened`, `trial_registered`, `trial_checked_in`, `trial_consent_approved`.

## 8. Rendimiento

Discovery pagina en el servidor. La Vista rápida carga un solo atleta y bajo demanda. Las tarjetas de trials usan 3
consultas agregadas. Las listas de participantes tienen un tope de 300, así que no hace falta virtualizar a ese tamaño;
si un trial supera esa cifra, se pagina. Los vídeos se cargan solo al pulsar.

## 9. QA

- `e2e/mobile-trials.spec.ts`, en 320, 375, 390 y 430 px y en escritorio, con datos ficticios del probador:
  - sin scroll horizontal y objetivos táctiles de 44 px o más;
  - filtros de participantes; «Aceptar» exige confirmación con contexto y «Cancelar» no decide nada;
  - costes obligatorio y opcional visibles antes de inscribirse;
  - la familia ve primero lo que necesita su decisión.
- `e2e/smoke.spec.ts`: las 4 pantallas nuevas sin errores de JavaScript y sin fallos graves de WCAG 2.2 AA.
  `/app/recruit/trials` y `/app/family` redirigen a login sin sesión.
- **Regresión de seguridad:** la suite RLS completa (11A + 11B) sigue en verde. 11C no cambia políticas.

**Pendiente (honesto):**
- notificaciones push nativas;
- pruebas E2E autenticadas contra staging con usuarios sintéticos (requieren un entorno de staging con datos de
  prueba, que aún no existe).
