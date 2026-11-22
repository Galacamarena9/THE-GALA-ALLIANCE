# Entornos

## Estado real (22-11)

| Entorno | Existe | Qué es |
|---|---|---|
| Local | Sí | Postgres 16 + stub; base desechable por ejecución |
| CI | Sí | Mismo arnés en GitHub Actions (`rls`, `app`, `e2e`) |
| Staging | **No** | — |
| Producción | **No** como tal | Hay un único proyecto Supabase (`the-gala-alliance`, plan Free) con 1 usuario y sin datos de negocio. Hoy hace de entorno de pruebas |

Netlify despliega `main` y las *deploy previews* de cada PR. Si las dos tienen las mismas variables, las dos apuntan al único proyecto. Mientras no haya datos reales no hay riesgo, pero **el día que haya usuarios reales una preview podría escribir en producción**. No he podido revisar las variables de Netlify; la comprobación queda pendiente.

## Propuesta para introducir staging (antes del primer usuario real)

1. **Convertir el proyecto actual en staging.** Ya tiene los datos de prueba y el historial; se pone al día con [migrations.md §3](migrations.md).
2. **Crear un proyecto nuevo de producción** en eu-west-1 y en plan Pro (backups diarios), y aplicarle las 77 migraciones desde cero con `supabase db push`, ya con un historial limpio.
3. **Separar las variables en Netlify por contexto de despliegue:**
   - *Production* → proyecto de producción;
   - *Deploy previews* y *Branch deploys* → proyecto de staging.
4. **Auth de cada proyecto:**
   - producción solo admite redirects al dominio real;
   - staging admite las URLs de preview.
5. **Flujo:** local → CI → staging (migración, advisors, e2e) → producción, con backup previo y tu aprobación.

Alternativa más barata: Supabase Branching, que crea una rama de base de datos por PR. Requiere plan de pago y que el historial de migraciones esté reparado.
