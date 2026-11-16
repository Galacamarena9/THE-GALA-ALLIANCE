# Auditoría y plan de evolución: The Global Sports Opportunity Network

Fecha: 16 nov 2026. Referencia: "Prompt maestro para elevar The Gala Alliance a una plataforma deportiva top tier".

## Fase 0: estado del repositorio

**Stack real:** Next.js 16.4 (App Router, Server Actions, Proxy), React 19.3, TypeScript, Tailwind 4.3, Supabase
(Postgres, Auth, RLS, Realtime), Stripe Checkout, Claude API (Gala IA), Netlify. Validación con zod en servidor.

**Estado al empezar:** `lint` ✓ · `typecheck` ✓ · `test:unit` 82/82 ✓ · `build` ✓. CI con E2E de pantallas, enlaces y accesibilidad (axe).

**Lo que ya existe** (comparado con las secciones del documento):

| Documento | Estado en el código |
|---|---|
| §6 Navegación por rol, Ctrl/Cmd+K, notificaciones | Hecho: `src/lib/domain/navigation.ts` (probado), `CommandPalette`, campana |
| §7.1 Dashboard atleta (readiness, siguientes pasos) | Hecho en gran parte: `/app`, `/app/athlete` |
| §7.2-7.5 Universidad, club, agencia (CRM), marca | Parcial-alto: candidatos, pipeline, cartera, contactos, portal de club, campañas |
| §8 Sports Passport (procedencia por dato, vídeo, privacidad) | Hecho: `/app/athlete/passport`, `data_source` declarado/documentado/club |
| §9 Discover | Escaparate con filtros y búsquedas guardadas con alertas |
| §10 Marketplace | Becas/oportunidades con sello de confianza de 5 niveles, coste neto, preguntas |
| §11 Gala Match explicable | Hecho: motor de reglas `rules-1.0` (`match.ts`) con cumple / no cumple / falta |
| §12 Readiness Score | Hecho: `readiness.ts` (solo datos reales) |
| §13 Pipeline | Hecho: tablero + tabla, equipo, historial (`pipeline-board.ts`) |
| §14-15 Mensajes, notificaciones | Mensajes en tiempo real, notificaciones internas, bloqueo |
| §17 Gala IA | Servicio en servidor (`/api/gala-ia`), prompts fuera del cliente |
| §18 Verificación y confianza | Verificación por dominio, cola admin, denuncias DSA, auditoría |
| §22 Roles y permisos | RLS en todas las tablas, 84 pruebas por actor |
| §26 Seguridad y privacidad | Menores, COPPA, RGPD, consentimiento de cookies, CSP |
| §27-28 Eventos y métricas | Catálogo de eventos y panel de mando del admin |
| §29 Monetización | Stripe (Core / Elite / Signature), sin pago por posicionarse |

**Brechas detectadas (por prioridad):**

1. **Posicionamiento**: metadatos, home y textos vendían "becas en EE. UU." como único producto. → *resuelto en esta fase*.
2. **Home** con 12 secciones y mucho texto explicativo. → *resuelto en esta fase*.
3. **Open Graph / Twitter cards** inexistentes. → *resuelto (raíz)*; falta Open Graph por Passport público.
4. **Discover** solo de atletas: faltan pestañas Universities / Clubs / Opportunities / Events en una pantalla.
5. **Gala Match en la tarjeta**: el motor ya separa cumple/falta; falta mostrar subcategorías (athletic, academic, financial…) y nivel de confianza cuando faltan datos.
6. **Network**: no existen follow / connection como entidades separadas de shortlist y saved.
7. **Verticales clubes y eventos**: los tipos existen en BD (`tryout`, `club_recruitment`, `academy`, `camp_showcase`), pero el flujo de club es piloto.
8. **i18n**: textos en castellano repartidos por componentes; falta capa de traducción (inglés).
9. **Calendario** unificado (hay .ics y plazos, no vista calendario).

## Plan de fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Marca global (fuente única `src/content/brand.ts`), home nueva, Open Graph, navegación pública | **Hecho** |
| 2 | Passport: página pública con OG propio y QR; subpuntuaciones de Gala Match con confianza | Siguiente |
| 3 | Discover con pestañas (atletas, universidades, oportunidades por vertical, eventos) y URL con filtros | Pendiente |
| 4 | Calendario unificado y tareas en pipeline | Pendiente |
| 5 | Follow / Connection, página Network, feed profesional | Pendiente (requiere migración nueva, no destructiva) |
| 6 | Portales B2B: club (trials publicados) y marca (brand fit) | Pendiente |
| 7 | i18n (es/en), métricas de liquidez ampliadas, feature flags | Pendiente |

## Decisiones de la Fase 1

- **Idioma**: la interfaz sigue en castellano. "The Global Sports Opportunity Network" y "One profile. Every opportunity."
  se quedan en inglés como activos de marca internacionales; el resto de la propuesta del documento se ha traducido.
- **Sin cifras inventadas**: la home ya no muestra estadísticas; las vistas previas de producto están marcadas como ejemplo,
  usan personas ficticias y los mismos criterios que el motor real.
- **Verticales honestas**: solo se listan las que existen en la base de datos; clubes y academias aparece como **Piloto**.
- Se retiraron de la home la comparativa con agencias, los precios y el calendario por curso (siguen en `/precios`,
  `/inversores` y dentro de la app) para reducir texto. El test de opciones se mantiene como captación.
