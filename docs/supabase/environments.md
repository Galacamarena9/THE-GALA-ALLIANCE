# Entornos

## Estado real (22-11)

| Entorno | Existe | Qué es |
|---|---|---|
| Local | Sí | Postgres 16 + stub; base desechable por ejecución |
| CI | Sí | Mismo arnés en GitHub Actions (`rls`, `app`, `e2e`) |
| Staging | **Sí (desde el 22-11)** | `the-gala-alliance` (`fkbnznccsoqdniaqviev`, eu-west-1). Al día con las 80 migraciones y sin deriva |
| Producción | **Pendiente** | Se crea cuando la organización pase a plan Pro (ver abajo) |

Netlify despliega `main` y las *deploy previews* de cada PR. Si las dos tienen las mismas variables, las dos apuntan al único proyecto. Mientras no haya datos reales no hay riesgo, pero **el día que haya usuarios reales una preview podría escribir en producción**. No he podido revisar las variables de Netlify; la comprobación queda pendiente.

## Pasos para tener producción (decididos el 22-11)

1. ✅ **El proyecto actual es staging** y está al día.
0. **Tú:** pasar la organización de Supabase a **Pro** desde el panel (Organization → Billing → Change plan). Necesita tu tarjeta; yo no puedo hacerlo.
2. **Crear un proyecto nuevo de producción** en eu-west-1 y en plan Pro (backups diarios), y aplicarle las 79 migraciones desde cero con `supabase db push`, ya con un historial limpio.
3. **Separar las variables en Netlify por contexto de despliegue:**
   - *Production* → proyecto de producción;
   - *Deploy previews* y *Branch deploys* → proyecto de staging.
4. **Auth de cada proyecto:**
   - producción solo admite redirects al dominio real;
   - staging admite las URLs de preview.
5. **Flujo:** local → CI → staging (migración, advisors, e2e) → producción, con backup previo y tu aprobación.

Alternativa más barata: Supabase Branching, que crea una rama de base de datos por PR. Requiere plan de pago y que el historial de migraciones esté reparado.
