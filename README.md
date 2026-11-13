# The Gala Alliance

La plataforma de confianza para el reclutamiento deportivo internacional (España → universidades de EE. UU.).
Conecta a **atletas, familias, universidades, coaches, agentes y marcas** con información verificable, para que
ningún atleta con nivel dependa de su visibilidad, de su liga o de los contactos de su agente.

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Netlify · Claude API (Gala IA).

## Qué incluye

| Para todos | Atleta | Familia | Universidad | Coach | Agente | Marca |
|---|---|---|---|---|---|---|
| Escaparate con filtros · Becas y oportunidades · Directorio de universidades con datos oficiales · Centro de información · Calculadora de becas · Mensajes seguros · Actualidad · Gala IA | Mi camino (readiness + roadmap) · Passport · Candidaturas · Ofertas de marcas (18+) · Agentes · Sports CV · Calendario .ics | Panel familiar con coste neto · Vínculo con permisos | Becas publicadas · Talento compatible por beca · Pipeline con notas privadas · Equipo de coaches · Enlaces oficiales | Búsqueda avanzada + IA · Shortlists · Pipeline | Cartera con consentimiento · Prospectos | Ofertas · Candidatos · Atletas 18+ |

Admin (Trust & Safety): verificación de organizaciones, revisión de becas y ofertas, cola de denuncias DSA,
solicitudes RGPD, verificación de enlaces e importación de universidades desde College Scorecard.

Además:
- **Academia SAT/TOEFL** (SAT digital y TOEFL 2026, práctica con explicación, calendario oficial).
- **Búsquedas guardadas con alertas** respetando la RLS, **novedades del atleta**, **notificaciones internas** y **bloqueo efectivo**.
- Tema oscuro, claro y de alto contraste.
- Negocio: **/precios** (gratis para atletas; Core 247 € y Elite 497 € para familias; planes para organizaciones), con pipeline comercial concierge.
- **Panel de mando** del admin (North Star, embudo, colas, liquidez por posición y feedback del piloto).

Documentación: [modelo de negocio](docs/BUSINESS_MODEL.md) · [qué se portó de Lovable y por qué](docs/LOVABLE_PORT.md) · [despliegue](docs/DEPLOYMENT.md).

## Seguridad y legal (resumen)

- **RLS en todas las tablas**, probada con 84 casos por rol (`npm run test:rls`).
- Menores: privados por defecto; nunca visibles para anónimos, marcas ni agentes; contacto solo de organizaciones
  verificadas con aprobación y lectura de la familia; sin emails ni teléfonos en mensajes; sin etiquetas en Actualidad.
- COPPA: no se crean cuentas de menores de 13 (se comprueba en el formulario y en la base de datos).
- Datos sensibles separados (fecha de nacimiento, presupuesto familiar) y descarga/solicitudes RGPD.
- Historiales inmutables (estado de candidaturas, consentimientos, auditoría, mensajes).
- Cookies opcionales bloqueadas hasta consentimiento, con registro de prueba. CSP y cabeceras de seguridad.
- Textos legales en `src/content/legal.ts`: **borradores, requieren revisión jurídica antes de abrir el registro**.

## Puesta en marcha

1. **Supabase**: crea un proyecto (región UE) y aplica las migraciones de `supabase/migrations/` en orden
   (`supabase link --project-ref <ref>` y `supabase db push`, o pegándolas en el SQL Editor).
2. En Supabase → Authentication → URL Configuration, añade `https://TU-DOMINIO/auth/callback` como redirect.
3. Variables de entorno: copia `.env.example` a `.env.local` y rellénalas (las mismas en Netlify).
4. Crea tu usuario admin: regístrate en la web y después, en el SQL Editor:
   ```sql
   insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = 'TU_EMAIL';
   ```
5. `npm install` · `npm run dev` → http://localhost:3000
6. Importa universidades desde **Revisión → Importar universidad** (necesita `COLLEGE_SCORECARD_API_KEY`, gratuita en api.data.gov).

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run test:unit  # lógica de dominio (matching, coste neto, edad, roadmap…)
npm run test:rls   # seguridad de la base de datos (requiere DATABASE_URL a un Postgres vacío)
```

## Estructura

```
supabase/migrations/   esquema, RLS, triggers y funciones (fuente de verdad de la seguridad)
supabase/tests/        pruebas de RLS por actor
src/app/               rutas (pública, /app privada, /athletes perfiles, /api/gala-ia)
src/app/actions/       Server Actions (validación con zod en servidor)
src/lib/domain/        lógica pura y testeada (matching, readiness, roadmap, coste neto, edad)
src/content/           guía con fuentes oficiales y plantillas legales
```

## Pendiente antes de lanzar (decisiones de negocio y legales)

- Revisión jurídica de privacidad, términos, menores, NIL, agentes y transferencias internacionales; EIPD.
- Proyecto de Supabase de producción, dominio y claves (Anthropic, College Scorecard).
- Pagos (Stripe) y planes: no activados; los precios del blueprint son hipótesis a validar.
- Piloto cerrado: 1-3 deportes, academias/clubes socios y universidades verificadas.
