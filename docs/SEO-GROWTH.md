# SEO y crecimiento (Prompt 20)

**Estado:** implementado y probado en local (bloque P20).

## SEO responsable

- **Indexable solo lo que tiene contenido real y público:**
  - marketing, guía, legales y oportunidades publicadas de organizaciones verificadas;
  - **páginas de organizaciones verificadas** (`/organizaciones/[id]`), que solo se indexan si tienen oportunidades abiertas;
  - **páginas por deporte** (`/deportes/[sport]`), que solo se indexan si hay oportunidades de ese deporte. Nada de páginas vacías generadas para Google.
- **Nunca indexable:** perfiles de atletas, enlaces con token, la app, la API, invitaciones, impresiones y vistas previas (`robots.ts`, más `noindex` en cada página privada).
- **Sitemap dinámico:** se revalida cada hora y añade los capítulos de la guía, las oportunidades (con `lastModified`), sus organizaciones y los deportes con oferta.
- **Datos estructurados (schema.org)** solo con hechos que aparecen en la página:
  - `Organization` y `WebSite` en la portada;
  - `Organization` y `BreadcrumbList` en organizaciones;
  - `BreadcrumbList` en deportes.
  - El JSON se escapa para que no pueda cerrar la etiqueta.
- **Enlazado interno:** de la oportunidad a su organización, de la organización a sus oportunidades, y de cada deporte a la guía y al alta.
- **Canónicas** en oportunidades, organizaciones y deportes. Open Graph y Twitter por página.

## Crecimiento sin trucos

- **Invitaciones** (`/app/invitar`): enlace propio `?ref=código` con botón de compartir (Web Share en móvil).
  - Se atribuye **una vez**, solo en los 7 días tras el alta y nunca a uno mismo.
  - Quien invita ve **cuántas** personas se unieron, no **quiénes**.
  - **Sin premios** que empujen al spam y **sin enlaces para menores**.
- **Bucles naturales que ya existían:**
  - el atleta comparte su Passport con un enlace revocable;
  - las familias se invitan entre sí;
  - las organizaciones invitan a su equipo;
  - la tarjeta de recruiting se comparte.

## Pendiente (requiere decisiones o cuentas de Gala)

- **Search Console y Bing Webmaster.** Hay que verificar el dominio con las cuentas de Gala y enviar el sitemap.
- **Versión en inglés y `hreflang`.** Las rutas en inglés exigen traducir el contenido (guía y páginas por perfil). No se publicará una traducción automática sin revisar.
- **Imagen de Open Graph por oportunidad.** Hoy se usa la imagen de marca.
