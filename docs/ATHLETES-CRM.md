# Prompt 6 · «Mis atletas»: el CRM del agente

Ruta: `/app/portfolio`. Código principal:
- `src/app/app/portfolio/page.tsx` (servidor);
- `src/app/app/portfolio/AthletesCrm.tsx` (cliente);
- `src/lib/domain/athletes-crm.ts` (lógica pura).

Capturas en `docs/athletes-crm/`.

## A. Tabla en escritorio y tarjetas en móvil

**Tabla (≥ 1024 px):**

| Columna | Contenido |
|---|---|
| Atleta | Identidad pública: avatar, nombre y marca de «necesita atención». Debajo, deporte · posición · país · promoción, y el resumen de verificación en texto: «Stats validadas · vídeo», «Datos declarados» o «Sin datos compartidos» |
| Recorrido | Fase actual (Descubrimiento → Colocado), «Propuesta pendiente» o «Sin representación activa» |
| Siguiente acción | Lo primero que marca «necesita atención»; si no hay nada, la próxima fecha de sus procesos. Incluye el estado del plazo |
| Oportunidades | Procesos abiertos y ofertas vivas |
| Última actividad | Cuándo y qué: proceso, nota, respuesta o propuesta |
| Acciones | **Un** botón «Abrir atleta» y un menú «⋯» (añadir nota, ver procesos, buscar oportunidades, perfil público) |

**Tarjetas (< 1024 px):** la misma información, en tres líneas y con el mismo botón único.

**Sin rankings ni puntuaciones universales.** Una sola marca de atención y el resto en texto. Fuera las filas de etiquetas.

## B. Filtros, búsqueda y orden

| Parámetro de URL | Valores canónicos | Por defecto |
|---|---|---|
| `view` | `all` · `attention` · `recruiting` · `offers` · `placed` | `all` |
| `rep` | `active` · `requested` · `closed` (rechazadas o finalizadas) · `any` | `active` |
| `q` | Texto (nombre, deporte, posición, país, siguiente acción, recorrido); sin distinguir acentos | — |
| `sport`, `grad`, `country` | id de deporte · año AAAA · ISO-2 | — |
| `sort`, `dir` | `attention` · `next` · `activity` · `name` · `grad`; `asc` · `desc` | `attention`, `asc` |
| `page` | Entero ≥ 1 | 1 |

- `parseCrmFilters` descarta cualquier valor no canónico.
- `crmQuery` escribe solo lo que no es por defecto, siempre en el mismo orden. Así la URL es estable, compartible y sobrevive a una recarga (prueba de ida y vuelta).
- Cambiar un filtro devuelve a la página 1.
- Los contadores de cada pestaña aplican la búsqueda y los «Más filtros», pero no la propia vista.

## C. Qué significa «necesita atención»

Es exactamente la regla del Inicio (`buildAttention`, rangos 1–4):
- una oferta que caduca en 7 días o menos;
- una próxima acción, tarea o seguimiento vencido, o una representación que vence en 7 días o menos o está suspendida;
- una respuesta de universidad en los últimos 7 días;
- una visita o entrevista en los próximos 14 días.

Las oportunidades nuevas (rango 5) **no** cuentan. Las dos pantallas dan siempre la misma cifra (prueba unitaria).

**Segmentos:**
- En recruiting: procesos abiertos antes de la fase de oferta.
- Con ofertas: ofertas vivas o un proceso en «Oferta o ayuda» o «Decisión pendiente».
- Colocados: algún proceso comprometido.

## D. Paginación y virtualización

- **Paginación de 25 filas en el cliente, sobre la proyección completa de la agencia.** El servidor calcula las filas una vez, con la sesión del agente; filtrar, buscar, ordenar y paginar ocurre en memoria, sin volver al servidor.
- **No hace falta virtualizar.** Con 25 filas en el DOM el coste de pintar es constante, sea cual sea el tamaño de la cartera.
- **Límites:** la consulta de procesos carga hasta 2.000 y el directorio, hasta 1.000 atletas. Para agencias de más de 1.000 atletas, el siguiente paso sería paginar en el servidor, con los mismos parámetros de URL.

## E. Estados

| Estado | Pantalla |
|---|---|
| Cargando | `loading.tsx`: silueta de filtros y 8 filas, con `aria-busy` |
| Sin agencia | «Primero, registra tu agencia» |
| Agencia sin verificar | Aviso |
| Datos parciales | Aviso («algunos recuentos pueden estar incompletos») |
| Vacío | «Tu cartera está vacía», con «Buscar talento» |
| Sin coincidencias | Mensaje y «Quitar búsqueda y filtros» |
| Error | Alerta con «Reintentar» |

## F. Pruebas

- **Unitarias** (`athletes-crm.test.ts`, 6):
  - una fila por atleta;
  - atención igual que en el Inicio y segmentos coherentes;
  - siguiente acción;
  - URL canónica y estable;
  - filtros y búsqueda sin acentos;
  - orden estable y paginación de 25 (101 atletas → 5 páginas).
- **E2E** (`e2e/athletes-crm.spec.ts`, 9):
  - búsqueda en ≤ 300 ms;
  - vistas, contadores y URL;
  - siguiente acción y un botón por fila;
  - 100 atletas con paginación y orden por columna (`aria-sort`);
  - semántica de tabla (`caption`, `columnheader`, `rowheader`) y Tab hasta la acción, con axe;
  - 360, 768 y 1440 sin desbordamiento y sin violaciones graves de axe;
  - estado vacío.
- **RLS:** «el UUID de un atleta ajeno no devuelve ningún registro a otra agencia». Cubre representaciones, procesos, ofertas y notas; total 402 OK. Además, la ficha `/app/portfolio/[id]` de un atleta ajeno muestra «Atleta no disponible», porque solo se construye desde la cartera de la propia agencia.

## G. Rendimiento medido

| Medida | Resultado |
|---|---|
| Búsqueda en memoria con 100 atletas, desde que se escribe hasta que aparece la fila (navegador, e2e) | **8,8–13,7 ms** (objetivo ≤ 300 ms) |
| Carga de la vista con 100 atletas (preview local, red incluida) | ~1,3–1,4 s |
| Proyección en el servidor (`buildAttention` + `crmRows`): 100 / 500 / 1.000 atletas con 3 procesos cada uno | 19,7 / 32,7 / 58,2 ms |
| Filtro, orden y página en memoria: 100 / 500 / 1.000 atletas | 0,14 / 1,10 / 1,08 ms |
