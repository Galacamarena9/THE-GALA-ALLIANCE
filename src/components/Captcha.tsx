'use client';

import Script from 'next/script';

/**
 * Captcha invisible de Cloudflare Turnstile. Solo aparece si existe NEXT_PUBLIC_TURNSTILE_SITE_KEY;
 * añade al formulario el campo "cf-turnstile-response", que la acción envía a Supabase.
 */
export function Captcha() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="es" data-appearance="interaction-only" />
    </>
  );
}
