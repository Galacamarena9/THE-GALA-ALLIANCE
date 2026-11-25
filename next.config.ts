import type { NextConfig } from 'next';
import { LEGACY_REDIRECTS } from './src/lib/domain/legacy-routes';

const isDev = process.env.NODE_ENV !== 'production';
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';
/** Captcha (Cloudflare Turnstile): solo se permite su dominio si hay clave configurada. */
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? ' https://challenges.cloudflare.com' : '';

/**
 * Cabeceras de seguridad para toda la app.
 * CSP: solo nuestro dominio y Supabase. Los vídeos de YouTube (dominio sin cookies) y Vimeo (dnt=1)
 * se incrustan solo cuando la persona pulsa «reproducir» (VideoFacade); el resto se abre en pestaña nueva.
 * 'unsafe-inline' en scripts: riesgo aceptado (fase 6, S10). Quitarlo exige nonces y renderizado dinámico de
 * todas las páginas; se revisará antes del lanzamiento público.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace('https://', 'wss://')}${turnstile}`,
  "frame-ancestors 'none'",
  `frame-src https://www.youtube-nocookie.com https://player.vimeo.com${turnstile}`,
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // Prompt 4: alias de los modos por actor y pantallas fusionadas (ver src/lib/domain/legacy-routes.ts).
  async redirects() {
    return LEGACY_REDIRECTS.map(({ source, destination, permanent }) => ({ source, destination, permanent }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      // Zonas privadas: nunca en buscadores ni en caché compartida.
      { source: '/app/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/athletes/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
