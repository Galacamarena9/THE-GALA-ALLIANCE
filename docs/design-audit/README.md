# Auditoría integral del diseño (Prompt 2)

21 nov 2026 · `main` @ PR #66 · **Sin cambios de diseño ni de código.**

**Cómo se ha hecho.** Build de producción local (`next start`). Capturas con Playwright y Chrome ([`shoot.mjs`](shoot.mjs)) a **1440 y 360 px en todas las rutas**, y a **1280 y 768 px en las 11 pantallas clave**: 86 capturas a página completa, con desplazamiento previo para cargar las imágenes diferidas y midiendo el desbordamiento horizontal. Contraste calculado con la fórmula WCAG 2.x a partir de los tokens reales ([`contrast.py`](contrast.py)).

**Limitaciones (BLOCKED):**
- Sin URL desplegada ni cuentas de prueba, las pantallas autenticadas se han capturado con el preview de datos de ejemplo del proyecto (`/preview/*`, 20 pantallas). Las que necesitan base de datos real no tienen captura: buscador de talento, ficha 360 del agente, mensajes, universidades, admin/ops y facturación. Para ellas solo hay revisión de código.
- Universidad y operaciones solo están cubiertas en parte: `coach-home`, `club-trials`, `trial-club`, `pipeline-table` y revisión de código de `/app/recruit/*` y `/app/admin/*`.

## A. Catálogo visual (hojas de contactos)

| Hoja | Contenido |
|---|---|
| [01-publicas-desktop.jpg](01-publicas-desktop.jpg) | `/`, `/precios`, `/para/agentes`, `/para/atletas`, `/guia`, `/calculadora`, `/herramientas`, `/seguridad`, `/oportunidades`, `/login`, `/signup`, `/inversores` · 1440 |
| [06-publicas-mobile.jpg](06-publicas-mobile.jpg) + [04-app-mobile-a.jpg](04-app-mobile-a.jpg) | Las mismas a 360 (portada, agentes y precios en la hoja 04) |
| [02-app-desktop-a.jpg](02-app-desktop-a.jpg) | Agente (inicio, cartera, procesos tablero/tabla), coach, atleta (Command Center, Passport, Gala Match, Match), oportunidad, familia (panel, costes) · 1440 |
| [03-app-desktop-b.jpg](03-app-desktop-b.jpg) | Procesos del atleta, bienvenida familiar, trials (familia, club, atleta), programa de academia, inicio genérico · 1440 |
| [04-app-mobile-a.jpg](04-app-mobile-a.jpg), [07-app-mobile-b.jpg](07-app-mobile-b.jpg) | Todas las pantallas de la app a 360 |
| [08-laptop-1280.jpg](08-laptop-1280.jpg), [05-tablet-768.jpg](05-tablet-768.jpg) | Pantallas clave a 1280 y 768 |

Las capturas originales a tamaño completo no se suben al repositorio (unos 40 MB): se regeneran con `node docs/design-audit/shoot.mjs 1440,360 <rutas…>`.

## B. Puntuación por pantalla

Escala de 1 a 5. **J** = jerarquía, **D** = densidad, **C** = coherencia con el sistema, **S** = carácter sports-tech premium, **M** = móvil, **A** = claridad de la acción principal.

| Pantalla | J | D | C | S | M | A | Nota clave |
|---|---|---|---|---|---|---|---|
| `/` portada | 5 | 3 | 3 | **5** | 4 | 4 | La pieza más fuerte (negro, lima, Passport holográfico), pero vende al atleta; 3 px de desbordamiento a 768 |
| `/para/agentes` | 3 | 4 | 3 | **1** | 4 | 3 | Plantilla SaaS genérica: sin producto, sin prueba social, sin cifras; la cabecera dice «Crear Passport» |
| `/precios` | 3 | **1** | 3 | 2 | 2 | 3 | 11 planes en columnas muy densas; en móvil es una pared de texto; las agencias están al final |
| `/guia`, `/herramientas`, `/seguridad` | 3 | 3 | **2** | 2 | 4 | 3 | Tres cabeceras distintas (blanca, banda índigo, banda índigo con rejilla) |
| `/oportunidades` | 3 | 4 | 3 | 2 | 4 | 2 | El estado vacío es lo primero que ve un visitante («Todavía no hay oportunidades…») |
| `/login`, `/signup` | 4 | 5 | 4 | 2 | 5 | 5 | Correctos, pero planos: no hay ninguna marca deportiva |
| `/inversores` | 4 | 3 | **2** | 3 | 4 | 3 | Cuarto lenguaje visual (degradado claro con titulares índigo) |
| Inicio del agente | 4 | 3 | 4 | 4 | 3 | 4 | Héroe con foto y KPIs claros; en móvil el carrusel de cartera se corta y la página es muy larga |
| Cartera | 4 | 4 | 4 | 3 | 4 | 4 | Tabla limpia; kicker en inglés «Agent Workspace» |
| Procesos (tablero) | 3 | 3 | 3 | 2 | **1** | 3 | En móvil y tablet las columnas quedan cortadas dentro del contenedor; tarjetas de 11–12 px |
| Procesos (tabla) | 3 | 2 | 3 | 2 | **1** | 2 | A 360 solo caben 3 columnas; «Próxima acción» parte las filas en 6 líneas a 768 |
| Command Center (atleta) | 4 | 3 | 4 | 4 | 4 | 5 | Buena acción principal; tarjeta Passport fuerte |
| Passport | 5 | 4 | 4 | **5** | 4 | 4 | Referencia de marca: editorial oscuro, procedencia de cada dato |
| Gala Match / Match | 4 | 3 | 4 | 3 | 4 | 4 | Explicación excelente; anillos duplicados con estilos distintos |
| Oportunidad | 4 | 3 | 4 | 3 | 4 | 4 | Coste real bien presentado |
| Familia (panel, costes) | 4 | 4 | 4 | 3 | 4 | 4 | Calmado y claro tras el plegado (PR #62) |
| Trials (club, atleta, programa) | 4 | 4 | 3 | 2 | 4 | 4 | En escritorio es una columna estrecha (unos 400 px) con un 70 % del ancho vacío |
| Inicio del coach | 4 | 3 | 4 | 4 | 4 | 4 | Fotos de stock como mosaicos de navegación |
| Inicio genérico (preview antiguo) | 3 | 2 | 3 | 3 | 3 | 3 | Venta bloqueada con contenido difuminado: parece un muro de pago |

## C. Inventario de componentes (170 exportados, todos inventariados)

Listado completo con número de usos generado con un script sobre `src/components/**` (resumen de los más relevantes):

| Familia | Canónico | Variantes o duplicados detectados |
|---|---|---|
| Botón | `Button`, `ButtonLink`, `buttonClass` (`ui.tsx`) | Botones a mano en formularios (`rounded-lg bg-brass px-4 py-2.5`) en unas 30 pantallas; `SubmitButton` aparte; botones de «Mover» en el tablero con estilo propio |
| Contenedor | `Card` (73 archivos) | `Panel` (`portfolio.tsx`), `section … rounded-[var(--radius-card)] border` a mano (62), `rounded-[28px]` y `rounded-[24px]` en los héroes |
| Etiqueta | `Badge` (5 tonos) | `StatusPill` (`portfolio.tsx`), chips de filtro a mano, pastillas «Oficial/Vuestra» en familia |
| Título de bloque | `CardTitle`, `PageHeader` | Títulos `font-display uppercase` a mano en héroes y landing (121 `uppercase`) |
| Progreso | `Meter`, `ProgressRing` | Anillo de `MatchScore` (`MatchParts.tsx`), barra de Readiness del Passport, anillo de la landing (`GalaPassport.tsx`): **4 implementaciones** |
| Avatar | `AthleteAvatar` (`portfolio.tsx`) | Iniciales en `AthleteCard`, `RoleHero` e inicio genérico: **4 estilos** |
| Iconos | `Icon` (14) y `NavIcon` (3) | Dos sistemas de iconos sobre lucide |
| Modal / diálogo | — (sin componente) | 5 implementaciones a mano (`CookieBanner`, `QuickView`, `CommandPalette`, `MobileNav`, `RecruitForms`) |
| Formularios | `Field`, `inputClass`, `ActionForm` | `TaskForm` ×2 (pipeline y agencia), `ProgramForm` ×2, `OpenCaseForm` ×2 (mismo nombre, dominios distintos) |
| Estado vacío | `EmptyState` (52) | Textos sueltos «Aquí verás…» dentro de tarjetas |
| Héroe | `RoleHero`, héroe de `AgentHome` | Héroe del Command Center (claro), héroe de la portada (negro): **3 estilos de héroe** |
| Sin uso | — | `Timeline`, `StartRecruitingForm`, `ProvenanceMark`, `Prov`, `ConfirmSubmit` (0 importaciones fuera de su archivo) |

## D. Tipografía, color y espaciado

- **Tipografía:**
  - 2 familias: Inter (texto) y Barlow Condensed (display, en mayúsculas). Coherente y con carácter deportivo.
  - **Escala rota:** 151 tamaños arbitrarios (`text-[Npx]`): 82 de 11 px, 14 de 10 px, 32 de 13 px y 9 de 15 px, más titulares de 22, 28, 34, 40, 52 y 78 px fuera de cualquier escala.
- **Color:**
  - Tokens sólidos: índigo `brass #3d2fd1` (acción), lima `#c8f03c` (acento), `night #1b1650`, más los estados `ok`, `warn` y `danger`, 7 colores de deporte y temas claro, oscuro y de alto contraste.
  - **Fuera de tokens:** `#0a0a0c` ×25 y `#121216` ×8 en la portada; 39 usos de la paleta `neutral-*` de Tailwind, sobre todo en páginas de impresión.
- **Radios:** 6 radios Tailwind en uso (`lg`, `xl`, `2xl`, `3xl`, `md`, `full`), `--radius-card` de 14 px y 3 valores arbitrarios (28 px, 24 px y 2rem).
- **Espaciado:** paddings dispersos: `px-3` ×211, `px-4` ×130 y `px-5` ×74 conviven en el mismo tipo de elemento. Falta una escala de densidad (compacta para tablas, cómoda para fichas).
- **Sombras:** 3 tokens más 21 sombras arbitrarias.

## E. Las 20 inconsistencias visuales principales

1. **Cuatro lenguajes visuales:**
   - portada negra y lima;
   - app clara con índigo;
   - páginas públicas con banda índigo;
   - inversores con degradado claro.

   El salto entre la portada y la primera pantalla de la app rompe la promesa premium.
2. Tres estilos de héroe dentro de la app (foto con overlay índigo, tarjeta clara con el Passport negro, cabecera simple).
3. La página que vende al agente (`/para/agentes`) es la menos trabajada de la web.
4. La cabecera pública muestra «Crear Passport» en todas las páginas, incluida la de agentes.
5. Cuatro anillos o barras de progreso con estilos distintos.
6. Cuatro estilos de avatar o iniciales.
7. Botones primarios a mano además de `Button`.
8. Escala tipográfica arbitraria (151 tamaños).
9. Mayúsculas display usadas también en títulos de tarjetas pequeñas: pierden jerarquía frente al héroe.
10. Kickers mezclados: «Agent Workspace», «Gala Match» y «Plan» en índigo frente a «ETAPA · DESCUBRIMIENTO» con espaciado ancho.
11. Fotos de stock como mosaicos de navegación (inicio del coach y del atleta): decoran pero no informan.
12. Venta con contenido difuminado (inicio genérico) frente al resto de la app, que no usa muros de pago.
13. Pantallas de trials en columna estrecha en escritorio, frente al resto a ancho completo.
14. Tablero de procesos con tarjetas de 11 px y botones «Mover» a mano.
15. Chips de filtro con tres estilos (buscador de talento, cartera, procesos).
16. Estados vacíos como primera impresión en público (`/oportunidades`) y dentro de tarjetas.
17. `/precios` mezcla 4 audiencias con la misma densidad.
18. Modales sin componente común (5 implementaciones).
19. Iconos de KPI en cuadrados lavanda en el inicio del agente frente a KPIs sin icono en la cartera.
20. Bordes en todo (274 `border border-line`): la estructura se expresa con líneas y no con espacio.

## F. Defectos responsive

| Ruta | Ancho | Defecto |
|---|---|---|
| `/` | 768 | 3 px de desbordamiento horizontal; el enlace «Para quién» parte en 2 líneas en la cabecera |
| Procesos (tablero) | 360, 768 | Las columnas no caben y quedan recortadas dentro del contenedor (desplazamiento horizontal oculto) |
| Procesos (tabla) | 360 | Solo se ven 3 columnas; la acción, que es lo importante, queda fuera |
| Procesos (tabla) | 768 | La columna «Próxima acción» parte las filas en hasta 6 líneas |
| Inicio del agente | 360 | Carrusel de cartera cortado sin pista de desplazamiento; página de unos 2.800 px |
| `/precios` | 360 | 11 planes apilados: unos 9.000 px de lista sin índice ni pestañas por audiencia |
| Trials | 1440 | Columna de unos 400 px con un 70 % de espacio vacío |
| Todas | 360 | Botones `sm` y chips de unos 28–32 px de alto, por debajo de los 44 px recomendados para el tacto |

En todas las demás rutas capturadas, el desbordamiento medido es de 0 px a 360 y 1440.

## G. Accesibilidad y contraste (WCAG 2.2 AA)

Resultado del cálculo sobre los tokens: **57 pares medidos**.
- **Texto (4,5:1):** todos los pares de texto de los temas claro y oscuro pasan. `paper` 17–18:1, `muted` 5,6–6,3:1, `faint` 4,8–5,4:1, `brass` 7,4–8,3:1, `ok`/`warn`/`danger` 5,4–6,6:1. El texto de los botones primarios (blanco sobre índigo) da 8,3:1, y negro sobre lima 14,1:1.
- **Fallos (FAIL):**
  - **Borde de campos de formulario** (`line-strong` sobre blanco): **1,44:1**, frente a 3:1 exigido para el límite de un control (1.4.11 Contraste no textual). Es el fallo real más extendido.
  - **Lima como texto sobre blanco**: **1,31:1**. Hoy solo se usa sobre fondos oscuros, pero conviene prohibirlo en el sistema.
  - Bordes de tarjeta (1,14:1) y dorsales decorativos (1,51:1): son decorativos y están exentos, pero no deben ser el único indicador de estado.
- **Tamaño:** 96 textos de 10–11 px. No es un fallo AA en sí mismo, pero empeora la legibilidad en metadatos con `faint` a 4,8:1.
- **Área táctil:** objetivos de 28–32 px en chips y botones `sm`. Pasa el 2.5.8 de WCAG 2.2 (mínimo 24 px), pero queda por debajo de lo recomendable en móvil.
- **Bien resuelto:** tema de alto contraste, `aria-current`, `role="search"`, texto para lectores de pantalla en tablas, y foco visible en los botones de `ui.tsx`.
- **BLOCKED:** axe y Lighthouse sobre la versión desplegada; el foco por teclado se ha revisado solo en el código.

## H. Avisos de «SaaS genérico»

- `/para/agentes`, `/guia`, `/herramientas` y `/seguridad`: rejillas de tarjetas blancas con icono, título y dos líneas. Es el patrón de cualquier plantilla.
- KPIs con icono lavanda en cuadrado redondeado (inicio del agente y cartera).
- Botón índigo con sombra difusa (`shadow-gold`) como único énfasis.
- Fotos de stock de grupos de deportistas sonriendo como decoración de navegación.
- Muro de pago con contenido difuminado.
- Indicador «Paso 1 de N» con círculos y línea (recorrido del atleta), visto en mil onboardings.

**Dónde está el valor que esto esconde:**
- la procedencia del dato (declarado, documentado o validado);
- el encaje explicado;
- el coste real con lo que falta;
- la tarjeta Passport.

Son activos únicos que hoy aparecen dentro de tarjetas genéricas en lugar de ser la firma visual.

## I. Matriz de principios (referencias traducidas a Gala, no copiadas)

| Referencia | Principio | Qué encaja en Gala | Qué no encaja |
|---|---|---|---|
| Linear | Jerarquía por tipografía y espacio, lista densa, acciones por teclado (⌘K) | Cartera y Procesos como listas densas con acción en línea; el ⌘K ya existe | La estética monocroma fría: Gala necesita energía deportiva |
| Stripe | Claridad de cifras, un dato y su contexto, documentación impecable | Coste real, ayudas y ofertas con moneda explícita y «lo que falta» | Los degradados de marketing: competirían con la foto deportiva |
| Notion | Calma: pocos contenedores, bloques plegables | Ficha 360 con secciones plegadas (ya aplicado en familia) | La neutralidad total: el agente necesita ver la urgencia |
| HubSpot CRM | Registro de cliente: cabecera con estado, línea de tiempo, asociaciones | Ficha del atleta con cabecera de estado, timeline y entidades asociadas (universidades, ofertas, documentos) | La densidad de paneles laterales y la jerga de ventas |
| Teamworks / INFLCR | Flujos de equipo deportivo, roles, contenido del atleta | Roles de agencia, tareas por responsable, contenido verificado del atleta | Interfaces institucionales y burocráticas |
| Editorial deportivo premium (prensa deportiva de largo formato) | Tipografía condensada grande, foto de acción, cifras protagonistas | Passport y portada como «cromo» editorial; cifras grandes con procedencia | Fotos que no son del atleta real (riesgo de engaño y de privacidad) |

## J. Tres direcciones visuales

### 1. «Vestuario de élite» (Pro Locker)
- **Mood:** el lenguaje de la portada llevado a toda la app. Fondo casi negro, lima como acción, condensada grande, fotografía de acción en negativo y cifras gigantes.
- **Tokens:**
  - `bg #0b0b0e`, `surface #15151b`, `line #26262f`;
  - texto `#f4f4f6`/`#a3a3b2`;
  - acción `lime #c8f03c` con texto negro;
  - display Barlow Condensed 700 en 56/40/28;
  - radio 12;
  - densidad compacta.
- **Fortalezas:** máxima diferenciación y continuidad con la landing; el Passport ya vive aquí.
- **Riesgos:** fatiga en sesiones largas de CRM; las tablas densas en oscuro cuestan más; las familias pueden sentirlo agresivo.
- **Uso ideal:** marketing, Passport, perfiles públicos y demos a agencias.

### 2. «Mesa de operaciones» (Agent Desk)
- **Mood:** CRM deportivo sobrio y rapidísimo. Blanco cálido, sin tarjetas por defecto, listas y tablas densas con hairlines, un único acento de color para la urgencia y el deporte como etiqueta de color.
- **Tokens:**
  - `bg #fbfbfa`, `surface #ffffff`;
  - divisores `#ececf0` y bordes de control `#8a8fa3` (3:1);
  - texto `#111318`/`#5a5f73`;
  - acción `#3d2fd1`;
  - urgencia `#d1411f`;
  - Inter 14/13 con números tabulares;
  - display solo en el título de página;
  - radio 8;
  - densidad compacta y cómoda conmutables.
- **Fortalezas:** el agente procesa 50 atletas sin ruido; es la mejor accesibilidad y escala a universidades.
- **Riesgos:** puede verse «otro SaaS» si se pierde la firma deportiva; necesita la tarjeta Passport y las cifras como contrapeso.
- **Uso ideal:** Cartera, Procesos, Buscar talento, bandeja, ofertas y documentos.

### 3. «Cromo editorial» (Matchday Editorial)
- **Mood:** revista deportiva. Papel claro, columnas tipográficas, cifras protagonistas con su sello de procedencia, color del deporte como banda, foto solo cuando es del atleta y titulares que cuentan su historia.
- **Tokens:**
  - `paper #f6f3ec`, `ink #14110f`;
  - `rule #d9d2c3`;
  - acento por deporte (los 7 actuales) y acción `#14110f` con hover del color del deporte;
  - display condensada 64/44 y texto serif para la narrativa;
  - radio 2 (casi recto);
  - densidad cómoda.
- **Fortalezas:** «premium» de verdad, ideal para perfiles de atleta y para vender a familias y universidades; muy compartible.
- **Riesgos:** lenta para el trabajo diario del agente; el serif y el papel pueden parecer menos «tecnológicos».
- **Uso ideal:** perfil público, Passport, informes y memos PDF, portada para familias.

## K. Criterios para elegir la dirección ganadora

Ponderados por el cliente que paga, el agente:

| Criterio | Peso | Cómo se mide |
|---|---|---|
| Velocidad del agente en sus 10 tareas | 30 % | Clics y segundos (Prompt 1 §D) en un prototipo de Cartera, Ficha 360 y Procesos |
| Diferenciación comercial en una demo de 3 minutos | 20 % | Test con 5 agentes: «¿lo recordarías mañana?», «¿parece una herramienta seria?» |
| Accesibilidad AA y legibilidad en sesiones largas | 15 % | Contraste ≥ 4,5/3:1, texto ≥ 12 px y uso de 60 min sin fatiga |
| Continuidad con la marca actual (portada y Passport) | 15 % | Coste de migración y coherencia de la primera impresión con la app |
| Escalabilidad a universidades, clubes y familias | 10 % | ¿Funciona para la tabla de candidatos y para el panel familiar? |
| Coste de implementación | 10 % | Componentes nuevos frente a reutilizados |

**Hipótesis para el Prompt 3** (no es una decisión): la combinación de mayor puntuación probable es **2 como sistema de trabajo, con 1 en marketing, Passport y momentos de marca**, y la 3 reservada para perfiles públicos e informes. Hay que validarla en el Prompt 3 con los criterios anteriores.

## Cumplimiento del Prompt 2

| Criterio | Estado |
|---|---|
| Captura de escritorio y móvil de cada ruta principal | **PASS** para las 12 públicas y las 20 del preview; **BLOCKED** para las pantallas que necesitan base de datos (sin despliegue ni cuentas de prueba) |
| ≥ 90 % de componentes reutilizables inventariados | **PASS** (170/170 exportados) |
| Contraste contra WCAG 2.2 AA | **PASS** (calculado: 57 pares; 2 fallos reales señalados) · axe y Lighthouse **BLOCKED** |
| Tres direcciones materialmente distintas | **PASS** (oscuro de alto impacto / CRM claro y denso / editorial de papel) |
| Referencias traducidas a principios propios | **PASS** |
| Sin implementación de diseño | **PASS** |

**Paro aquí. El Prompt 3 (selección de la dirección visual) queda pendiente de tu aprobación.**
