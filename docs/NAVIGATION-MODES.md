# Prompt 4 · Una plataforma, cuatro modos de navegación

Fuente única: `src/lib/domain/navigation.ts` (`navModeFor`). El modo lo decide el **rol principal del perfil**. Con varios roles, los demás espacios quedan en «Más» (ninguno inaccesible).

**Las rutas físicas no cambian.** Así siguen funcionando los enlaces profundos, las server actions, las revalidaciones y los permisos. Lo que cambia es cómo se agrupan y nombran. Los nombres nuevos tienen alias que redirigen a la ruta canónica (sección C).

## A. Árbol de rutas por modo

### Agent OS (6 destinos)
- **Inicio** `/app`
- **Atletas** `/app/portfolio` → Mis atletas · Buscar talento `/app/discover` · Listas `/app/lists` · Trials y programas `/app/portfolio/trials`
  - Ficha `/app/portfolio/[athleteId]`
- **Oportunidades** `/app/opportunities` → Becas · Universidades `/app/universities` · Comparar `/app/universities/compare` · Showcase `/app/showcase`
- **Recruiting** `/app/pipeline` → Procesos · Universidades y coaches `/app/contacts` · Equipo `/app/pipeline/team`
  - Proceso `/app/pipeline/[id]`
- **Mensajes** `/app/inbox`
- **Más:** Agencia, Gala IA, Calculadora, Centro de información, Actualidad, Plan y facturación, Privacidad, Confianza, Ayuda, Invitar

### Athlete OS (exactamente 5)
- **Inicio** `/app`
- **Oportunidades** `/app/opportunities` → Gala Match `/app/match` · Becas · Universidades · Mi shortlist `/app/shortlist` · Comparar · Showcase · Marcas (solo adultos)
- **Mi camino** `/app/process` → Mis procesos · Candidaturas · Ofertas · Documentos · Solicitudes · Mi plan · Plazos por curso `/app/athlete` · Academia
- **Mensajes** `/app/inbox`
- **Perfil** `/app/athlete/passport` → Mi Passport · Compartir · Agentes · Colaboraciones (adultos) · Privacidad
- Herramientas y cuenta: solo en el buscador ⌘K y en el menú de usuario.

### University OS (6, también coaches, clubes y academias)
- **Inicio** `/app` (= `/app/recruit`)
- **Descubrir** `/app/recruit/discover` → Comparar
- **Candidatos** `/app/recruit/candidates` → Listas de seguimiento · Candidaturas recibidas
- **Oportunidades** `/app/opportunities?view=mine` → Publicar · Trials
- **Recruiting** `/app/recruit/needs` → Tareas · Showcase
- **Más:** Mensajes, organización, verificación y portal de club (coach), listas personales, herramientas y cuenta

### Operaciones Gala (5 + Más)
- **Verificación** `/app/admin`
- **Cumplimiento** `/app/admin/ops`
- **Confianza** `/app/admin/safety`
- **Moderación** `/app/admin?view=moderation`
- **Soporte** `/app/admin/ops?view=support`
- **Más:** Panel de mando, Analítica

### Otros modos
- **Familia:** Inicio (= panel familiar) · Coste real · Su camino (procesos, ofertas, documentos, solicitudes, plan) · Mensajes · Más.
- **Marca:** Inicio (= campañas) · Talento · Listas · Mensajes · Más.

**Fuera del primer nivel, como vistas contextuales:** Match, ofertas, documentos, solicitudes, tareas, trials, analítica y contactos. Siguen en el buscador. Las visitas no existen todavía como entidad (Prompt 1, §C7).

## B. Matriz rol / navegación

| Destino | Agente | Atleta | Familia | Universidad / coach | Marca | Admin |
|---|---|---|---|---|---|---|
| Inicio | ● | ● | ● | ● | ● | — (Verificación) |
| Atletas / cartera | ● | — | — | — | — | — |
| Buscar talento | ◐ (Atletas) | — | — | ● (Descubrir) | ● (Talento) | — |
| Oportunidades | ● | ● | Más | ● (las suyas) | — | — |
| Recruiting / procesos | ● | ● (Mi camino) | ● (Su camino) | ● | — | — |
| Candidatos | — | — | — | ● | — | — |
| Ofertas, documentos, solicitudes | — (pendiente: ficha 360, Prompts 6–7) | ◐ | ◐ | — | — | — |
| Mensajes | ● | ● | ● | Más | ● | Más |
| Perfil / Passport | — | ● | — | — | — | — |
| Operaciones Gala | — | — | — | — | — | ● |

● = primer nivel · ◐ = vista contextual · Más = menú «Más».

**Cada enlace pasa el guard real de su página:** una prueba unitaria lee el `requireSession([...])` de cada `page.tsx`. Así detectó y corrigió `/app/collaborations` (solo atleta) en el modo marca.

## C. Mapa de redirecciones

En `src/lib/domain/legacy-routes.ts`, aplicado en `next.config.ts`.

| Origen | Destino | Tipo | Motivo |
|---|---|---|---|
| `/app/athletes`, `/app/athletes/:id` | `/app/portfolio`, `/app/portfolio/:id` | 307 | Agent OS · «Atletas» |
| `/app/recruiting` | `/app/pipeline` | 307 | Agent OS · «Recruiting» |
| `/app/journey` | `/app/process` | 307 | Athlete OS · «Mi camino» |
| `/app/profile` | `/app/athlete/passport` | 307 | Athlete OS · «Perfil» |
| `/app/candidates` | `/app/recruit/candidates` | 307 | University OS |
| `/app/admin/verification` · `moderation` · `compliance` · `trust` · `support` | `/app/admin` · `?view=moderation` · `/app/admin/ops` · `/app/admin/safety` · `/app/admin/ops?view=support` | 307 | Operaciones |
| `/app/portal/:slug` | `/para/:slug` | 308 | Pantalla duplicada retirada |

Las pruebas comprueban tres cosas:
- ningún destino es a su vez origen (sin bucles);
- el destino existe;
- ningún origen tapa una página real.

La prueba e2e verifica el código de estado y la cabecera `Location` de cada redirección.

## D. Shell común y por actor

`src/app/app/layout.tsx` construye el modo y lo pasa a:
- `Sidebar` (escritorio, con vistas contextuales bajo el destino activo y «Más» plegado);
- `Sidebar compact` (raíl de tablet, 768–1023 px, con «Más» desplegable);
- `MobileNav` (móvil);
- `CommandPalette`;
- `Breadcrumbs`.

`/preview/shell-agent|athlete|university|operations` renderiza el shell con datos ficticios para las pruebas.

## E. Navegación móvil

Barra inferior de 4 accesos del modo más «Menú» (panel con la navegación completa del modo). Altura mínima de 52 px.

| Modo | Accesos |
|---|---|
| Agente | Inicio · Atletas · Procesos · Mensajes |
| Atleta | Inicio · Oportunidades · Mi camino · Mensajes |
| Familia | Hoy · Costes · Su camino · Mensajes |
| Universidad | Inicio · Descubrir · Candidatos · Oportunidades |
| Club / academia | Inicio · Descubrir · Listas · Trials |
| Marca | Inicio · Talento · Listas · Mensajes |
| Operaciones | Verificación · Moderación · Confianza · Soporte |

## F. Búsqueda global / paleta de comandos

⌘K o Ctrl+K:
- Busca en todos los destinos del modo: primer nivel, vistas contextuales, «Más» y herramientas.
- Para el agente, también busca **sus atletas por nombre**, desde la misma proyección y RLS que la cartera (`loadPortfolio`).
- Teclado: flechas, Enter y Escape. Usa `combobox` + `listbox` con `aria-activedescendant`. El foco vuelve a donde estaba al cerrar.
- Si no encuentra nada, ofrece preguntar a Gala IA.

## G. Archivos cambiados

| Archivo | Cambio |
|---|---|
| `src/lib/domain/navigation.ts` | Modos `navModeFor`, `flattenMode`, `topLevelCount`, `breadcrumbsFor`; compatibilidad con `sidebarFor` |
| `src/lib/domain/legacy-routes.ts` | Nuevo |
| `next.config.ts` | `redirects()` |
| `src/app/app/layout.tsx` | Shell por modo, raíl de tablet, migas, atletas en el buscador |
| `src/app/app/Sidebar.tsx` | Reescrito por modo; versión compacta |
| `src/app/app/MobileNav.tsx` | Pestañas del modo |
| `src/app/app/CommandPalette.tsx` | Búsqueda global, entidades, ARIA y foco |
| `src/app/app/Breadcrumbs.tsx` | Nuevo |
| `src/app/app/admin/page.tsx`, `src/app/app/admin/ops/page.tsx` | Vistas Verificación/Moderación y Cumplimiento/Soporte sobre las mismas páginas, permisos y datos |
| `src/components/NavIcon.tsx`, `src/components/Icon.tsx` | Iconos `search` y `more` |
| `src/app/preview/ShellPreview.tsx`, `src/app/preview/[screen]/page.tsx` | Shell de prueba |
| `src/app/app/portal/` | Retirado (redirige a `/para/:slug`) |
| `src/lib/domain/navigation.test.ts`, `e2e/navigation.spec.ts`, `e2e/smoke.spec.ts` | Pruebas |

## H. Pruebas

- **Unitarias** (`navigation.test.ts`, 14): número de destinos por modo; nada contextual en primer nivel; guard real de cada enlace; menores sin marcas; varios roles; barra móvil; nombres en castellano; migas; redirecciones sin bucles ni destinos rotos.
- **E2E** (`navigation.spec.ts`, 6):
  - Agent OS y atleta en ⌘K;
  - Athlete OS con 5 destinos exactos;
  - orden de foco con Tab y apertura de «Más» por teclado;
  - Operaciones;
  - tablet y móvil sin desbordamiento y sin violaciones axe graves.
- **E2E** (`smoke.spec.ts`): 12 redirecciones, con su estado y `Location`.

## I. Antes y después

| Rol | Antes: visibles / secciones / total | Después: primer nivel / total accesible |
|---|---|---|
| Agente | 8 / 6 / 21 | **6** / 23 |
| Atleta | 7 / 6 / 31 | **5** / 30 |
| Familia | 7 / 6 / 25 | **5** / 22 |
| Universidad | 7 / 5 / 22 | **6** / 24 |
| Coach | 6 / 5 / 22 | **6** / 26 |
| Marca | 6 / 6 / 17 | **5** / 15 |
| Admin | 7 / 5 / 18 | **6** / 12 (el resto vive dentro de cada página) |

Antes, cada rol veía 5–6 cabeceras de sección más sus entradas. Después ve un único nivel de destinos, y las vistas contextuales solo aparecen dentro del destino activo.
