import type { Metadata } from 'next';
import { BRAND } from '@/content/brand';
import type { Locale } from '@/lib/i18n/locale';

/**
 * Metadatos de una página pública (QA web #17 y SEO): title, description, canonical y Open Graph / X únicos.
 * Next fusiona los metadatos de forma superficial: si una página define `title` pero no `openGraph`, al compartirla
 * saldría el título de la portada. Por eso cada página pública pasa por aquí.
 *
 * - `title` es el título corto de la página (la plantilla del layout añade « · The Gala Alliance» en <title>).
 * - Las URLs (canonical, og:url) son relativas: `metadataBase` del layout raíz las completa con NEXT_PUBLIC_SITE_URL.
 * - La imagen es local y con su texto alternativo.
 */
export const OG_IMAGE = { url: '/media/hero-bg-poster.jpg', alt: 'Deportistas entrenando de noche en una pista urbana iluminada · The Gala Alliance' } as const;

export function publicMeta(o: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
  /** Título exacto sin la plantilla (solo portada). */
  absolute?: boolean;
  image?: { url: string; alt: string };
  robots?: Metadata['robots'];
}): Metadata {
  const full = o.absolute ? o.title : `${o.title} · ${BRAND.name}`;
  const image = o.image ?? OG_IMAGE;
  return {
    title: o.absolute ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: {
      type: 'website',
      siteName: BRAND.name,
      locale: o.locale === 'en' ? 'en_US' : 'es_ES',
      url: o.path,
      title: full,
      description: o.description,
      images: [{ url: image.url, alt: image.alt }],
    },
    twitter: { card: 'summary_large_image', title: full, description: o.description, images: [{ url: image.url, alt: image.alt }] },
    ...(o.robots ? { robots: o.robots } : {}),
  };
}
