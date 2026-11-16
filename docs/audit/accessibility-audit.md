# Auditoría de accesibilidad (WCAG 2.2 AA)

**Método:** axe-core 4 con Playwright y Chrome, etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `wcag22aa`, a **1440 px y 320 px**.
Cubre 21 rutas públicas y 8 pantallas internas con datos ficticios (`/preview/*`, solo con `ENABLE_PREVIEW=1`).
Las rutas privadas reales necesitan una sesión y una base de datos con datos; se revisan a través de sus vistas en `/preview` y
del E2E del CI (`e2e/smoke.spec.ts`), que ya ejecuta axe sobre WCAG 2.0 A/AA.

## Hallazgos

| ID | Criterio | Gravedad | Dónde | Evidencia | Arreglo |
|---|---|---|---|---|---|
| A11Y-01 | 2.5.3 Etiqueta en el nombre (`label-content-name-mismatch`) | Grave | Logo de la cabecera y del pie en **todas** las páginas públicas | `src/components/Logo.tsx:6`: `aria-label="The Gala Alliance, inicio"` sustituye al texto visible | Quitar `aria-label` y dejar el texto visible como nombre (o que el nombre empiece exactamente por el texto visible) |
| A11Y-02 | 1.4.10 Reflow | Grave | `/app/portfolio` (vista `PortfolioView`) a 320 px | Desborde horizontal de 38 px: la fila de pestañas no hace scroll | `overflow-x-auto` en el contenedor de pestañas |
| A11Y-03 | Cobertura del CI | Media | `e2e/smoke.spec.ts` | Solo etiquetas WCAG 2.0, por eso no detectó A11Y-01 | Añadir las etiquetas 2.1/2.2 al E2E |

El resto de criterios automatizables pasa: sin errores de JavaScript ni desbordes en las rutas públicas a 320 px, foco visible,
formularios etiquetados, `prefers-reduced-motion` respetado en el vídeo del hero y tema de alto contraste disponible.
**Pendiente de revisión manual:** zoom al 200 %, lector de pantalla (NVDA/VoiceOver) en los formularios largos (`PassportEditor`, `OnboardingForm`) y subtítulos en los vídeos subidos por usuarios.

## Resultados literales

| Ruta | Viewport | HTTP | Desborde (px) | Errores JS | Infracciones axe (impacto, nodos) |
|---|---|---|---|---|---|
| `/` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/oportunidades` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/oportunidades?v=college` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/oportunidades/11111111-1111-1111-1111-111111111111` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/seguridad` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/precios` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/inversores` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/calculadora` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/guia` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/guia/divisiones-y-becas` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/login` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 1) |
| `/signup` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 1) |
| `/forgot-password` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 1) |
| `/legal/privacidad` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/legal/proteccion-menores` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/atletas` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/familias` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/universidades` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/coaches` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/agentes` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/marcas` | 1440 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/preview/agent-home` | 1440 | 200 | 0 | 0 | — |
| `/preview/portfolio` | 1440 | 200 | 0 | 0 | — |
| `/preview/athlete-home` | 1440 | 200 | 0 | 0 | — |
| `/preview/coach-home` | 1440 | 200 | 0 | 0 | — |
| `/preview/pipeline` | 1440 | 200 | 0 | 0 | — |
| `/preview/pipeline-table` | 1440 | 200 | 0 | 0 | — |
| `/preview/match` | 1440 | 200 | 0 | 0 | — |
| `/preview/opportunity` | 1440 | 200 | 0 | 0 | — |
| `/` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/oportunidades` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/oportunidades?v=college` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/oportunidades/11111111-1111-1111-1111-111111111111` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/seguridad` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/precios` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/inversores` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/calculadora` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/guia` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/guia/divisiones-y-becas` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/login` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 1) |
| `/signup` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 1) |
| `/forgot-password` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 1) |
| `/legal/privacidad` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/legal/proteccion-menores` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/atletas` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/familias` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/universidades` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/coaches` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/agentes` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/para/marcas` | 320 | 200 | 0 | 0 | label-content-name-mismatch (serious, 2) |
| `/preview/agent-home` | 320 | 200 | 0 | 0 | — |
| `/preview/portfolio` | 320 | 200 | 38 | 0 | — |
| `/preview/athlete-home` | 320 | 200 | 0 | 0 | — |
| `/preview/coach-home` | 320 | 200 | 0 | 0 | — |
| `/preview/pipeline` | 320 | 200 | 0 | 0 | — |
| `/preview/pipeline-table` | 320 | 200 | 0 | 0 | — |
| `/preview/match` | 320 | 200 | 0 | 0 | — |
| `/preview/opportunity` | 320 | 200 | 0 | 0 | — |
