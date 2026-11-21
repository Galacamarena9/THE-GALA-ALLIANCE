# Dirección visual · «Matchday Ops» (Prompt 3)

21 nov 2026 · Basado en [`UX-AUDIT-AGENT-FIRST.md`](../UX-AUDIT-AGENT-FIRST.md) y [`design-audit/`](../design-audit/README.md).
**Canvas de diseño con las 8 pantallas y el antes/después:** https://claude.ai/artifact/Cabfy7WqagWxkuKjb8xuqr (privado; artboards generados con `to_canvas.py`).

**No se ha aplicado nada a la app:** los prototipos son HTML estático con datos ficticios, en [`prototypes/`](prototypes/), y se regeneran con `python3 build.py`.

## A. Matriz de decisión ponderada

Puntuación de 1 a 10 por juicio experto sobre la auditoría. **No está validada todavía con agentes reales** (ver K).

| Criterio | Peso | 1 · Vestuario de élite | 2 · Mesa de operaciones | 3 · Cromo editorial |
|---|---|---|---|---|
| Conversión del agente | 25 % | 7 | **9** | 5 |
| Claridad / tiempo hasta el valor | 20 % | 5 | **9** | 5 |
| Confianza / credibilidad | 15 % | 6 | **8** | **8** |
| Diferenciación | 15 % | **9** | 7 | 8 |
| Escalabilidad entre actores | 10 % | 5 | **9** | 6 |
| Accesibilidad | 5 % | 6 | **9** | 7 |
| Usabilidad móvil | 5 % | 6 | **8** | 6 |
| Riesgo de implementación (10 = bajo) | 5 % | 6 | **7** | 5 |
| **Total ponderado** | 100 % | **6,40** | **8,40** | **6,15** |

**Gana la 2, «Mesa de operaciones».** Lleva una capa de marca tomada de la 1 (raíl y héroes nocturnos con lima) para no perder espectáculo ni continuidad con la portada. El resultado es **Matchday Ops**.

## B. Dirección ganadora y motivos

**Matchday Ops: el centro de operaciones de una agencia deportiva en día de partido.**
- **Lienzo de trabajo:** claro, denso y calmado, porque el agente pasa horas en él.
- **Marco de marca:** noche y lima. Aparece en el raíl, en un héroe por pantalla y en la portada, porque es lo que la gente recuerda.

Por qué vende:
1. **Lo urgente arriba.** El inicio del agente abre con «Hoy necesita tu atención»: una lista con la acción en cada fila. Es el valor por el que se paga, visible sin hacer scroll.
2. **Densidad de CRM sin ruido.** Filas, tablas y separadores finos en lugar de tarjetas. Doce atletas caben en una pantalla.
3. **Firma propia: la procedencia del dato.** Cada cifra lleva su marca (● Validado, ◐ Documentado, ○ Declarado). Ningún competidor lo tiene y es lo que da credibilidad ante las universidades.
4. **Escala sin rehacerse.** El mismo sistema sirve al agente (Mis atletas), a la universidad (Candidatos), al atleta (Inicio) y a la familia.
5. **Barato de migrar.** Conserva las familias tipográficas (Inter + Barlow Condensed), el índigo de acción `#3d2fd1` y el lima. Cambia la estructura, no la identidad.

## C. Principios de marca y diseño

1. **Primero lo que hay que hacer.** Cada pantalla abre con la siguiente acción y su plazo.
2. **Un héroe por pantalla, como mucho.** La marca nocturna enmarca y nunca compite con los datos.
3. **Espacio antes que cajas.** La tarjeta es la excepción (kanban, ofertas); la regla son la fila y el separador fino.
4. **Las cifras mandan.** Números en condensada grande, siempre con contexto y procedencia.
5. **Un color para la urgencia.** El rojo `urgent` solo para lo vencido o lo que caduca en 3 días o menos. Nada de semáforos decorativos.
6. **Forma más texto, nunca solo color.** La procedencia y el estado se leen sin color.
7. **Castellano y un nombre por concepto:** Mis atletas, Procesos, Oportunidades, Listas, Candidatos.
8. **La seguridad se ve.** Permisos, menores y privacidad aparecen como hechos breves junto a la acción, no como avisos.

## D. Propuesta completa de tokens

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| Marca | `night` / `night-2` / `night-line` | `#0e0c24` / `#1b1650` / `#2c2860` | Raíl, héroe, barra inferior móvil |
| | `on-night` / `on-night-2` | `#f4f4f8` / `#b9b6d8` | Texto sobre noche (17,4:1 / 9,8:1) |
| | `lime` / `lime-ink` | `#c8f03c` / `#0e0c24` | CTA de marca y estado activo; **nunca texto sobre claro** |
| Trabajo | `canvas` / `surface` / `sunken` | `#f6f6f3` / `#ffffff` / `#efefeb` | Fondo, paneles, columnas y chips |
| | `hairline` / `control` | `#e4e4de` / `#858a9e` | Separadores (decorativo) / borde de controles (3,2–3,4:1 ✓ 1.4.11) |
| | `text` / `text-2` / `text-3` | `#111318` / `#4b5063` / `#5f6578` | 17,2:1 / 7,4:1 / 5,4:1 sobre canvas |
| Acción | `action` / `action-hover` / `action-tint` | `#3d2fd1` / `#2f23b3` / `#ecebfb` | Botón primario (blanco 8,3:1), enlaces, pestaña activa |
| Estado | `urgent` · `warn` · `ok` (+ `-tint`) | `#c2361b` · `#8a5300` · `#0b6f5b` | Chips (4,7–5,7:1 sobre su tint) |
| Procedencia | `verified` · `documented` · `declared` | `#0b6f5b` ● · `#3d2fd1` ◐ · `#5f6578` ○ | Firma de dato |
| Deporte | `basket` … `swim` (7) | Actuales | Escudo de iniciales (blanco ≥ 5:1) y banda; nunca fondo de texto largo |
| Tipografía | `display` | Barlow Condensed 700, mayúsculas | Título de página (40), héroe (56–72), cifras (28–56) |
| | `font` | Inter variable, números tabulares | Texto 14/13/12; móvil 15 |
| | Escala | 12 · 13 · 14 · 16 · 20 · 28 · 40 · 56 · 72 | **Ningún tamaño fuera de la escala** (hoy hay 151 arbitrarios) |
| Forma | `r-control` / `r-card` / `r-hero` | 8 / 12 / 20 px | Sustituye 6 radios y 3 valores arbitrarios |
| Espacio | Base 4 | 4·8·12·16·20·24·28·40·56 | Fila densa de 56 px; móvil, objetivos de 44 px |
| Sombra | `shadow-1` / `shadow-pop` | Tarjeta flotante / captura de producto | Sustituye 21 sombras arbitrarias |
| Movimiento | 150 ms (hover), 220 ms (paneles), `cubic-bezier(.22,1,.36,1)` | Sin animación decorativa en vistas de trabajo; `prefers-reduced-motion` respetado | |

Contraste: los pares de texto y de control **pasan AA** (calculado con [`../design-audit/contrast.py`](../design-audit/contrast.py)). El borde del botón fantasma sobre noche se corrigió de 2,9:1 a 3,9:1 (`#6e6aa8`) durante el prototipo.

### Reglas por elemento

- **Navegación:**
  - Raíl oscuro de 232 px (escritorio), compacto de 72 px (1024–1100 px) y barra inferior oscura de 4 accesos (móvil).
  - Máximo 7 entradas por actor, más Gala IA.
  - Contadores en lima solo para lo que exige acción.
- **Tablas:**
  - Cabecera de 12 px en `text-3`, filas de 56 px, números tabulares y una acción por fila.
  - En móvil cada fila pasa a una lista de dos líneas (`.table-m`). Nunca hay columnas recortadas.
- **Filas de acción (patrón principal):** barra de estado de 4 px, escudo, título y contexto, plazo, y botón con verbo concreto («Enviar vídeo», no «Ver»).
- **Tarjetas:** solo en el kanban, en elementos comparables (ofertas) y en el producto de la portada.
- **Iconos:** lucide con trazo de 1,8 a 18 px. Un icono solo cuando acompaña a la navegación o a la acción; fuera los iconos en cuadrado lavanda de los KPI.
- **Fotografía:** solo en marketing y en el perfil público, siempre marcada como ilustrativa si no es del atleta. Nunca como mosaico de navegación.
- **Ilustración:** ninguna. La «ilustración» es el propio producto: capturas y el Passport.
- **Gráficos:**
  - una métrica por gráfico;
  - índigo para la serie principal y gris para la comparación;
  - etiqueta directa sobre la línea, sin leyenda;
  - procedencia en el pie.
- **Estados vacíos:**
  - frase de una línea que explique qué aparecerá y una acción;
  - nunca como primera impresión pública (`/oportunidades` debe mostrar ejemplos marcados o un formulario de alerta).
- **Héroe de marketing:**
  - noche con foto en `soft-light`;
  - titular condensado de 72 px con la promesa al agente;
  - captura real del producto;
  - CTA lima y una línea de precio.
- **Autenticación:**
  - panel blanco centrado sobre noche, con la promesa de marca en una línea;
  - formularios con borde `control`;
  - la verificación de agencia se explica en el registro.
- **Responsive:**
  - de 1440 a 1101 px: raíl completo, cuadrículas de 2 a 4 columnas;
  - de 1100 a 721 px: raíl compacto, una columna y KPIs de 2 en 2;
  - 720 px o menos: barra inferior, botones de 44 px, tablas convertidas en listas, kanban convertido en lista por fase.
- **Accesibilidad:**
  - AA en texto y controles;
  - foco visible de 2 px en `action`;
  - forma y texto en estados;
  - `aria-current` en la navegación;
  - textos de lectura en las tablas;
  - movimiento reducido respetado.

### Qué hacer y qué no

| ✓ Hacer | ✗ No hacer |
|---|---|
| «Enviar vídeo» en la fila de la tarea | Un botón «Ver» que lleva a otra pantalla donde está la acción |
| 18.000 $/año · ◐ Documentada | «18k» sin moneda ni procedencia |
| Un héroe nocturno por pantalla | Héroe más mosaicos de fotos más tarjetas de colores |
| Rojo solo para «vencido» o «≤ 3 días» | Rojo, ámbar y verde como decoración |
| Lista de una columna en móvil | Tabla con desplazamiento horizontal oculto |
| Lima sobre noche | Lima como texto sobre blanco (1,3:1) |

## E. Prototipos de alta fidelidad (8 pantallas)

| # | Pantalla | Archivo | Patrones que cubre |
|---|---|---|---|
| 1 | Portada pública (agent-first) | [index.html](prototypes/index.html) | Héroe de marketing, captura de producto, prueba, actores, CTA y precio |
| 2 | Inicio del agente | [agent-home.html](prototypes/agent-home.html) | Lista de acción priorizada, KPIs con contexto, tabla resumen, sugerencias |
| 3 | Mis atletas | [my-athletes.html](prototypes/my-athletes.html) | Pestañas con contador, filtros en chips, tabla densa, procedencia |
| 4 | Ficha 360 del atleta | [athlete-360.html](prototypes/athlete-360.html) | Héroe de registro (estilo CRM), permisos visibles, cifras con procedencia, pestañas Ofertas/Documentos/Mensajes, comparación de ofertas |
| 5 | Oportunidades (para un atleta) | [opportunities.html](prototypes/opportunities.html) | Panel de filtros, encaje y confianza separados, fuente, acción «Añadir a procesos» |
| 6 | Procesos | [pipeline.html](prototypes/pipeline.html) | Kanban por fase con plazos; en móvil, lista por fase |
| 7 | Inicio del atleta | [athlete-home.html](prototypes/athlete-home.html) | Siguiente paso, progreso del Passport, «te vieron», encaje explicado, privacidad |
| 8 | Inicio de la universidad | [university-home.html](prototypes/university-home.html) | Plazas por posición, candidatos a revisar, agenda de la semana, privacidad del presupuesto |

Patrones especificados pero **no prototipados**: formularios largos, diálogos, autenticación, gráficos y estados vacíos (definidos en D). Se prototiparán en el Prompt 11 (design system).

## F. Escritorio, tablet y móvil

- Escritorio 1440: [`screens/*-1440.jpg`](screens/) (un archivo por pantalla).
- Tablet 768: [`screens/tablet-768.jpg`](screens/tablet-768.jpg).
- Móvil 360: [`screens/mobile-360.jpg`](screens/mobile-360.jpg).
- **Desbordamiento horizontal medido: 0 px** en las 8 pantallas a 1440, 768 y 360. Antes de los ajustes hubo 9 casos, todos corregidos en el prototipo.

## G. Jerarquía del mensaje comercial

1. **Para quién:** «Para agencias deportivas» (kicker lima).
2. **Promesa:** «Todos tus atletas. Cada universidad. Ningún plazo perdido.»
3. **Cómo:** «Cartera, procesos, ofertas y documentos de toda tu agencia en un solo tablero. Datos verificados y siempre con el permiso del atleta.»
4. **Prueba visual:** la lista «Hoy · 3 urgentes» del producto real.
5. **Acción:** «Crear cuenta de agencia» + «Ver demo de 3 min».
6. **Fricción cero:** «Gratis hasta el 31 de marzo de 2027 · sin comisión por atleta», tomado de `/precios`.
7. **Diferencial:** tablero único · cada plazo avisado · datos con origen.
8. **El resto de actores:** universidades, atletas y familias, en ese orden de valor comercial.

**Revisión de los 10 segundos (autoevaluada, no medida con usuarios):**
- Un agente lee quién (1), qué gana (2) y lo ve funcionando (4) sin desplazarse en 1440 y en 360.
- Cada actor tiene una pantalla que habla su idioma: Hoy y Mis atletas para el agente, Recruiting y Candidatos para la universidad, «Tu siguiente paso» para el atleta.

## H. Plan de migración de componentes

| Fase | Cambio | Componentes |
|---|---|---|
| 1 · Tokens | Nuevos valores en `globals.css` con alias de los actuales (`brass` → `action`, `ink` → `canvas`, `line-strong` → `control`) para no romper nada | `globals.css` |
| 2 · Primitivas | `Button` (3 variantes × 2 tamaños, 44 px en móvil), `Chip` (sustituye `Badge`/`StatusPill`), `ProvenanceMark` (sustituye `Prov`/`ProvenanceMark` duplicados), `Kpi`/`KpiStrip`, `Tabs`, `Dialog` único (sustituye 5 a mano) | `ui.tsx` |
| 3 · Patrones | `ActionRow`/`ActionList`, `DataTable` con colapso móvil, `Board` con apilado móvil, `RecordHeader` (héroe de ficha), `Progress` único (sustituye 4 anillos y barras) | nuevos en `src/components/` |
| 4 · Shell | Raíl oscuro, barra superior con ⌘K y barra inferior oscura; navegación de `navigation.ts` sin cambios de rutas | `layout.tsx`, `Sidebar.tsx`, `MobileNav.tsx` |
| 5 · Pantallas | Por orden de ingresos: inicio del agente → Mis atletas → ficha 360 (+ ofertas, documentos y mensajes, Prompts 6–7) → Procesos → Oportunidades → inicios de atleta y universidad → portada y `/para/agentes` | Prompts 4–10 |
| 6 · Limpieza | Quitar tamaños, radios, sombras y hex arbitrarios; borrar componentes sin uso | Prompt 11 |

Los datos y la seguridad no cambian: cada pantalla sigue leyendo de las mismas proyecciones del servidor y de la RLS.

## I. Riesgo y coste

| Bloque | Estimación | Riesgo | Mitigación |
|---|---|---|---|
| Tokens + primitivas + shell | 2–3 días | Medio: el cambio visual afecta a todo | Alias de tokens; capturas antes/después en CI (las pruebas e2e de desbordamiento ya existen) |
| Agente (inicio, Mis atletas, ficha 360, procesos, oportunidades) | 5–7 días | Alto en la ficha 360: necesita interfaz para ofertas, documentos y mensajes (los datos y la RLS ya existen) | Reutilizar `agent_can`, `offers_select_agent` y `document_access_grants`; nuevas pruebas RLS por pestaña |
| Atleta, familia, universidad | 3–4 días | Bajo | Mismos patrones |
| Portada, `/para/agentes`, `/precios` | 2 días | Bajo | Solo contenido y composición |
| Limpieza y accesibilidad | 1–2 días | Bajo | Lint de clases arbitrarias + axe en CI |
| **Total** | **13–18 días de desarrollo** | | Sin migraciones de datos destructivas |

## J. Paquete de aprobación: antes y después

En el «antes», las capturas del preview no muestran la barra lateral (el preview solo pinta el contenido).

| Pantalla | Comparación |
|---|---|
| Portada | [antes-despues-portada.jpg](screens/antes-despues-portada.jpg) |
| Página de agentes → portada agent-first | [antes-despues-pagina-agentes.jpg](screens/antes-despues-pagina-agentes.jpg) |
| Inicio del agente | [antes-despues-inicio-agente.jpg](screens/antes-despues-inicio-agente.jpg) |
| Mis atletas | [antes-despues-mis-atletas.jpg](screens/antes-despues-mis-atletas.jpg) |
| Procesos | [antes-despues-procesos.jpg](screens/antes-despues-procesos.jpg) |
| Oportunidades | [antes-despues-oportunidades.jpg](screens/antes-despues-oportunidades.jpg) |
| Inicio del atleta | [antes-despues-inicio-atleta.jpg](screens/antes-despues-inicio-atleta.jpg) |
| Inicio de la universidad | [antes-despues-inicio-universidad.jpg](screens/antes-despues-inicio-universidad.jpg) |
| Ficha 360 | Sin «antes» capturable (requiere base de datos); hoy no tiene ofertas, documentos ni mensajes |

## K. Criterios de aceptación

| Criterio | Estado |
|---|---|
| La dirección ganadora puntúa más alto | **PASS** (8,40 frente a 6,40 y 6,15) |
| Propuesta de valor al agente en 10 segundos | **PASS (autoevaluado)**: falta una prueba de 5 segundos con 5 agentes |
| Siguiente acción crítica sobre la línea de pliegue en el inicio del agente | **PASS** (5 acciones visibles a 1440×900; 3 a 360) |
| Creíble para universidades y seguro para atletas | **PASS**: procedencia visible, privacidad del presupuesto, menores y permisos explícitos |
| Ocho prototipos cubren los patrones principales | **PARCIAL**: cubren navegación, listas, tablas, kanban, filtros, KPIs, héroes, pestañas y procedencia; formularios, diálogos, autenticación, gráficos y vacíos solo están especificados |
| WCAG 2.2 AA alcanzable | **PASS** (calculado; axe sobre los prototipos no ejecutado) |
| Distintivo sin exceso decorativo | **PASS**: un héroe por pantalla, sin mosaicos de foto |
| Sin implementación global antes de aprobar | **PASS**: la app no se ha tocado |

**Paro aquí. El Prompt 4 (arquitectura global por actor) espera tu aprobación de esta dirección.**
