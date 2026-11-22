import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

/** Páginas públicas indexables; nada privado (app, enlaces con token, perfiles de atletas) entra en buscadores. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/app/', '/api/', '/athletes/', '/r/', '/print/', '/invite/', '/difusion/', '/join/', '/roster/', '/preview/', '/auth/', '/onboarding', '/mfa', '/reset-password'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
