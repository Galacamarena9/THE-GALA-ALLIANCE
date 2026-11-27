import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';
import { AUDIENCES } from '@/content/audiences';
import { LEGAL } from '@/content/legal';
import { GUIDE } from '@/content/guide';
import { publishedOpportunities } from '@/lib/data/public-seo';

/**
 * Mapa del sitio: marketing, guía, legales y — Prompt 20 — contenido real y vivo: oportunidades publicadas de
 * organizaciones verificadas, sus organizaciones y los deportes con oportunidades. Nunca atletas ni enlaces privados.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const main = ['', '/oportunidades', '/herramientas', '/test-opciones', '/seguridad', '/precios', '/guia', '/calculadora', '/inversores', '/signup'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.8 }));
  const roles = AUDIENCES.map((a) => ({ url: `${base}/para/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 }));
  const guide = GUIDE.map((c) => ({ url: `${base}/guia/${c.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 }));
  const legal = LEGAL.map((d) => ({ url: `${base}/legal/${d.slug}`, changeFrequency: 'yearly' as const, priority: 0.3 }));
  const opps = await publishedOpportunities();
  const oppUrls = opps.map((o) => ({ url: `${base}/oportunidades/${o.id}`, lastModified: o.updated_at ?? undefined, changeFrequency: 'weekly' as const, priority: 0.6 }));
  const orgUrls = [...new Set(opps.map((o) => o.organization_id))].map((id) => ({ url: `${base}/organizaciones/${id}`, changeFrequency: 'weekly' as const, priority: 0.5 }));
  const sportUrls = [...new Set(opps.map((o) => o.sport_id).filter((s): s is string => Boolean(s)))].map((s) => ({ url: `${base}/deportes/${s}`, changeFrequency: 'daily' as const, priority: 0.6 }));
  return [...main, ...roles, ...guide, ...oppUrls, ...orgUrls, ...sportUrls, ...legal];
}
