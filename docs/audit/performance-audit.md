# Auditoría de rendimiento

**Importante:** medido **en local** (`next start`, Chrome sin limitar red ni CPU, Supabase apuntando a un servidor inexistente).
No sustituye a los datos de campo (p75 de usuarios reales con Core Web Vitals). Objetivos del prompt: LCP < 2,5 s, INP < 200 ms y CLS < 0,1 en el p75.

## Hallazgos

| ID | Hallazgo | Evidencia | Prioridad |
|---|---|---|---|
| PERF-01 | Páginas que consultan Supabase sin límite de tiempo | `/oportunidades` y `/oportunidades/[id]`: LCP de unos 7,2 s cuando la base de datos no responde (aquí la URL es falsa a propósito). Con la BD real será mucho menor, pero una BD lenta bloquearía la página igual | P2 |
| PERF-02 | CLS máximo de 0,072 (`/guia` a 320 px) | Por debajo de 0,1, pero cerca; viene de las animaciones de aparición (`Reveal`) | P2 |
| PERF-03 | Sin medición de campo | No hay RUM ni Web Vitals reportados | P1 (junto con la analítica) |
| PERF-04 | JavaScript del cliente | 1,5 MB de chunks sin comprimir en total; el mayor pesa unos 70 KB con gzip. Vídeo del hero de 0,45 MB con póster y `preload="metadata"` | P2 |

## Resultados literales (1440 px, LCP en ms)

| Ruta | LCP (ms) | CLS |
|---|---|---|
| `/` | 372 | 0 |
| `/oportunidades` | 7220 | 0.044 |
| `/oportunidades?v=college` | 7192 | 0 |
| `/oportunidades/11111111-1111-1111-1111-111111111111` | 7188 | 0.002 |
| `/seguridad` | 172 | 0.033 |
| `/precios` | 224 | 0 |
| `/inversores` | 336 | 0.015 |
| `/calculadora` | 176 | 0 |
| `/guia` | 188 | 0.016 |
| `/guia/divisiones-y-becas` | 172 | 0.001 |
| `/login` | 156 | 0 |
| `/signup` | 140 | 0.004 |
| `/forgot-password` | 136 | 0 |
| `/legal/privacidad` | 132 | 0 |
| `/legal/proteccion-menores` | 172 | 0 |
| `/para/atletas` | 152 | 0.018 |
| `/para/familias` | 152 | 0.02 |
| `/para/universidades` | 184 | 0.018 |
| `/para/coaches` | 160 | 0.001 |
| `/para/agentes` | 116 | 0.001 |
| `/para/marcas` | 128 | 0.02 |
| `/preview/agent-home` | 384 | 0 |
| `/preview/portfolio` | 168 | 0 |
| `/preview/athlete-home` | 264 | 0 |
| `/preview/coach-home` | 312 | 0.001 |
| `/preview/pipeline` | 160 | 0 |
| `/preview/pipeline-table` | 140 | 0 |
| `/preview/match` | 128 | 0 |
| `/preview/opportunity` | 124 | 0 |
