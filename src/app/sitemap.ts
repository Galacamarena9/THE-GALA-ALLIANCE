import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';
import { ACTORS } from '@/lib/domain/roles';
import { LEGAL } from '@/content/legal';

/** Mapa del sitio: solo páginas públicas de marketing, guía y legales. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const main = ['', '/oportunidades', '/herramientas', '/seguridad', '/precios', '/guia', '/calculadora', '/inversores', '/signup'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.8 }));
  const roles = ACTORS.map((a) => ({ url: `${base}/para/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 }));
  const legal = LEGAL.map((d) => ({ url: `${base}/legal/${d.slug}`, changeFrequency: 'yearly' as const, priority: 0.3 }));
  return [...main, ...roles, ...legal];
}
