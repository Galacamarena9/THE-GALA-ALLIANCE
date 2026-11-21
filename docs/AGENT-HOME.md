# Prompt 5 · Inicio del agente (Command Center)

Pantalla de más valor comercial: abre con lo que el agente tiene que hacer **hoy** y le lleva a hacerlo en un clic.

## A. Pantalla

Estructura en escritorio, tablet y móvil:

| Bloque | Escritorio (≥1024) | Tablet (768) | Móvil (360) |
|---|---|---|---|
| Cabecera: fecha · agencia ✓, «Hola, X», «Buscar talento» | arriba | arriba | arriba |
| Resumen (5 cifras) | debajo de la cabecera | debajo de la cabecera | **al final** |
| Hoy necesita tu atención | columna izquierda | ancho completo | 1.º |
| Mis atletas | columna izquierda, debajo | ancho completo (filas compactas) | 2.º |
| Mensajes | columna derecha | ancho completo | 3.º |
| Pipeline (6 fases) | columna derecha | ancho completo | 4.º |

Código:
- `src/app/app/AgentHome.tsx` (`AgentHome` con Suspense y `AgentHomeView`);
- `src/components/agent/HomeParts.tsx`;
- capturas en `docs/agent-home/`.

A 1280×720, contando la cabecera de 64 px de la app, se ven el resumen y las 5 primeras acciones con su botón (prueba e2e).

## B. Prioridades de «Necesita atención»

Lógica en `buildAttention()` (`src/lib/domain/agent-home.ts`). Es pura y determinista: la misma entrada produce el mismo orden, aunque las fuentes lleguen desordenadas (prueba unitaria).

| Rango | Tipo | Regla | Acción única |
|---|---|---|---|
| 1 | Oferta que caduca | `athlete_offers.deadline` entre hoy y +7 días | Revisar oferta → ficha del atleta |
| 2 | Vencido | Próxima acción de un proceso abierto vencida · tarea abierta vencida · seguimiento vencido (sin su texto) · representación que vence en ≤ 7 días o suspendida | Abrir proceso / Hacer tarea / Ver seguimiento / Revisar representación |
| 3 | Respuesta de universidad | Proceso en fase «Respuesta recibida» actualizado en ≤ 7 días | Responder → proceso |
| 4 | Visita o entrevista | Proceso en «Evaluación o visita» con fecha entre hoy y +14 días | Preparar visita → proceso |
| 5 | Oportunidad nueva | Publicada en ≤ 7 días por una organización **verificada**, abierta, mismo deporte y promoción de un atleta activo | Ver oportunidad |

Desempate dentro de cada rango, en este orden: fecha más próxima, nombre del atleta y clave.

- Los procesos comprometidos o cerrados no generan avisos.
- Los rangos 1–2 llevan botón sólido; los rangos 3–5, botón con borde.
- Siempre hay **un único** botón por fila (pruebas unitaria y e2e).

**Limitaciones conocidas:**
- No existe la entidad «visita»: se deriva de la fase del proceso (ver NCAA-1 §C).
- El agente no ve la lista de documentos del atleta (la RLS solo le da los documentos compartidos con concesión). Los documentos que faltan aparecen cuando la agencia los registra como tarea. Prompts 6–7 añadirán documentos a la ficha 360.

## C. Contrato de datos

`loadAgentHome()` en `src/lib/data/agent-home.ts` devuelve `AgentHomeData`:

```
state: 'ok' | 'no_agency' | 'error'
agency: { name, verified } | null
summary: { athletes, needAttention, activeOpportunities, offers, deadlinesToday }
attention: [{ key, kind, rank, athleteId, athleteName, title, context, due, dueState, cta: { label, href } }]
athletes: [{ id, name, meta, status, nextAction, nextDue, processes, lastActivityAt, needsAttention }]
pipeline: [{ id, label, count }]   // Descubrimiento, Introducción, Evaluación, Visita, Oferta, Colocado
partial: ('ofertas' | 'tareas' | 'oportunidades' | 'procesos')[]
pendingProposals: number
```

- **Fuentes:** todas con la sesión del agente, así que la RLS limita cada una a su agencia y a sus permisos de representación.
  - `loadPortfolio` (cartera y fechas de seguimiento);
  - `loadAgencyCases` (procesos);
  - `athlete_offers` (`id, athlete_id, university_name, aid_amount_usd, deadline`; permiso `offers.view`);
  - `recruiting_case_tasks` (`id, case_id, title, due_date`);
  - `opportunities` publicadas de organizaciones verificadas.
- **Nunca entran:**
  - texto de notas internas o seguimientos;
  - `source_text` de ofertas;
  - documentos;
  - datos de cumplimiento o conflictos;
  - contacto, fecha de nacimiento ni presupuesto.

  Lo comprueba una prueba que serializa la salida y además revisa el código del cargador.
- **El resumen cuadra con las fuentes:**
  - Atletas = representaciones activas distintas.
  - Necesitan atención = elementos de rango 1–4.
  - Oportunidades = abiertas que encajan con algún atleta activo.
  - Ofertas = ofertas no caducadas de atletas activos.
  - Plazos hoy = elementos con fecha de hoy.

  Una prueba lo recalcula por separado y otra e2e compara la cifra mostrada con la lista.

## D. Componentes compartidos

En `src/components/agent/HomeParts.tsx`:
- `SummaryStrip`;
- `AttentionList` / `AttentionRow`, con barra de estado, contexto, plazo y un solo botón;
- `PipelineStrip`;
- `AthletesPreview` (tabla accesible; la fila entera abre la ficha);
- `AgentHomeSkeleton`;
- `tracked()`.

## E. Estados

| Estado | Qué ve el agente |
|---|---|
| Cargando | `AgentHomeSkeleton` (Suspense) con la misma silueta y `aria-busy` |
| Parcial | Aviso «No hemos podido cargar ofertas…» y el resto de la página funcionando |
| Sin permiso / sin agencia | «Aún no tienes agencia» y «Registrar mi agencia» |
| Agencia sin verificar | Aviso con enlace al estado |
| Vacío (sin atletas) | «Tu cartera está vacía», con «Buscar talento» y las propuestas pendientes |
| Todo al día | «Todo al día: no hay ofertas que caduquen, vencidos, respuestas ni visitas» |
| Error | Alerta con «Reintentar» (sin datos técnicos) |

Todos los estados se pueden ver en `/preview/agent-home`, `-empty`, `-partial`, `-no-agency` y `-error`.

## F. Eventos de analítica

Migración `20261207000100_agent_home_events.sql`:

| Evento | Cuándo | Propiedades |
|---|---|---|
| `agent_home_viewed` | Abre su inicio (dedupe por hora) | `attention`, `partial`, `state` |
| `agent_attention_opened` | Pulsa la acción de un elemento | `kind` |

La acción pasa por `/app/go`, que registra el evento y redirige con un 303. Solo acepta rutas internas de `/app` (`safeInternalPath`, probada contra `//`, `https:`, `..`, `\` y `javascript:`), así que no puede usarse para redirigir fuera de la plataforma. Los eventos de menores se guardan sin propiedades.

## G. Pruebas

- **Unitarias** (`agent-home.test.ts`, 10):
  - orden determinista y estable;
  - ventanas y exclusiones;
  - una sola acción por elemento;
  - seguimiento sin texto;
  - resumen recalculado;
  - pipeline;
  - vista previa de atletas;
  - estados de plazo;
  - `/app/go`;
  - contrato sin campos privados.
- **E2E** (`e2e/agent-home.spec.ts`, 10):
  - acción visible a 1280×720;
  - un botón por fila con destino interno;
  - resumen igual a la lista;
  - atleta a un clic;
  - los cuatro estados;
  - 360, 768 y 1440 sin desbordamiento y sin violaciones axe graves;
  - orden móvil.
- **RLS:** 401 OK con la migración nueva.

## H. Capturas

En `docs/agent-home/`:
- `agent-home-1280x720.jpg` (primer pantallazo);
- `agent-home-1440.jpg`;
- `agent-home-768.jpg`;
- `agent-home-360.jpg`;
- `agent-home-empty-1440.jpg`.
