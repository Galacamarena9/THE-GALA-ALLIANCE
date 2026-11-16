# Modelo de amenazas (STRIDE resumido)

Superficie: Next.js 16 en Netlify (Server Components, Server Actions, 8 rutas API), Supabase (Postgres + RLS, Auth,
Storage, Realtime), Stripe (webhook), Anthropic (Gala IA en servidor), College Scorecard. Claves privadas solo en el
servidor; la clave publicable es pública por diseño, así que **la RLS es la frontera de seguridad real**.

| ID | Amenaza | Activo | Control actual | Hueco | Prioridad |
|---|---|---|---|---|---|
| T-01 | Lectura directa por la API REST con la clave pública | Tablas | RLS en las 60 tablas, 161 políticas, 84 pruebas | Columnas internas de oportunidades publicadas legibles: `review_note`, `created_by`, `reviewed_by` (`opps_select`, `foundation.sql:991`) | **P1** |
| T-02 | Acceso de un adulto a un menor | Perfiles | `can_view_athlete`, aprobación familiar, ventana NCAA | Sin verificación de la persona dentro de la organización (solo el dominio) | P1 |
| T-03 | Suplantación de una organización (dominio parecido) | Confianza | Verificación por dominio oficial | Sin detección de dominios similares ni emails desechables | P1 |
| T-04 | Spam o acoso por contacto | Mensajes | Límites de 20 contactos y 60 mensajes al día; bloqueo y denuncia | Sin detección de patrones de riesgo en el contenido | P1 |
| T-05 | Mensaje o webhook falsificado de Stripe | Planes | Firma verificada (`src/app/api/stripe/webhook/route.ts:39`); concesión idempotente (`upsert … ignoreDuplicates`) | Un reintento de Stripe duplica la notificación y la entrada de auditoría | P2 |
| T-06 | Abuso de Gala IA (coste o inyección de prompts) | Presupuesto y datos | Solo en servidor; límite diario con 429 (`src/app/api/gala-ia/route.ts:39`); registro en `ai_usage` | Revisar que el contexto solo use datos autorizados del propio usuario y registrar los intentos de inyección | P2 |
| T-07 | Subida de archivo malicioso | Storage | Tipo y tamaño limitados; bucket privado; URL firmada de 60 s | Sin análisis antivirus | P2 |
| T-08 | Escalada de un administrador | Todo | MFA obligatorio en `/app/admin` (`src/lib/mfa.ts:18-21`); auditoría inmutable | Sin cuatro ojos; sin cuentas de emergencia documentadas | P2 |
| T-09 | Denegación por lentitud de la base de datos | Páginas públicas | Estados de error | Sin límite de tiempo en las consultas públicas (localmente, el LCP de `/oportunidades` llega a 7,2 s cuando la BD no responde) | P2 |
| T-10 | Enumeración de tokens (`/r`, `/roster`, `/invite`, `/join`) | Enlaces privados | Tokens aleatorios, `noindex`, `robots` | Revisar caducidad y revocación de todos los tipos | P2 |
| T-11 | Observabilidad: incidentes sin detectar | Operación | Logs de Netlify y Supabase | Sin Sentry ni OpenTelemetry; sin alertas | P1 |
| T-12 | Divulgación responsable | Reputación | — | Sin `security.txt` ni política de divulgación | P2 |

**CI actual** (`.github/workflows/ci.yml`): lint, typecheck, test:unit, build, test:rls (Postgres) y E2E con axe.
**Faltan:** análisis de dependencias y secretos en CI (SAST/SCA) y un escaneo dinámico (DAST) antes de producción (HawkScan está disponible, pero sin `HAWK_API_KEY`).
