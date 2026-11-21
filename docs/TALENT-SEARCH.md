# Búsqueda de talento (agentes, clubes, coaches, marcas)

Objetivo: que un agente encuentre en segundos al atleta que necesita y pase a la acción sin pasos de más.

## Filtros

| Grupo | Filtros | Columna (`athlete_directory`) | Bloque de visibilidad |
|---|---|---|---|
| Deporte | deporte, posición (principal o secundaria), lateralidad | `sport_id`, `*_position_id`, `dominant_side` | sport |
| Físico | altura mín./máx., peso mín./máx. | `height_cm`, `weight_kg` | sport |
| Origen y edad | nacionalidad, país de residencia, promoción desde/hasta | `nationality`, `country`, `graduation_year` | profile |
| Nivel | liga, años compitiendo, división objetivo EE. UU. | `league`, `years_experience`, `target_divisions` | sport / goals |
| Académico | inglés mínimo, GPA mínimo | `english_level`, `athlete_academics.gpa_4` | profile / academics |
| Confianza | con vídeo, estadísticas validadas por club | `has_video`, `has_verified_stats` | videos / stats |

- La edad se aproxima con la promoción: la fecha de nacimiento nunca sale del bloque privado.
- Un dato que el atleta no comparte con quien busca sale `NULL`: no se ve ni se puede filtrar (no es un oráculo).
- Las filas las decide la RLS: marcas y organizaciones sin verificar nunca ven menores.

## Experiencia

- Panel de filtros fijo en escritorio y plegado en móvil; filtros activos como etiquetas que se quitan con un clic.
- Orden: recientes, más altos, promoción más próxima, más experiencia.
- Vista en tarjetas o en tabla comparativa (altura, peso, lateralidad, inglés, equipo/liga, señales).
- Todo vive en la URL: se comparte, y se guarda como búsqueda con alertas de perfiles nuevos (mismas claves, validadas en la app y en la base de datos).

Código: `src/lib/domain/talent-search.ts` (validación, etiquetas, enlaces), `src/lib/data/directory.ts` (consulta única para búsqueda y alertas),
`supabase/migrations/20261206000100_talent_search.sql` (vista e índices), pruebas en `talent-search.test.ts` y `rls.test.mjs`.
