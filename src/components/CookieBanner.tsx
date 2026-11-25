'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { anonymousId, installScriptGuard, readConsent, writeConsent } from '@/lib/consent';
import { logCookieConsent } from '@/app/actions/consent';
import { Button } from '@/components/ui';
import { LOCALE_COOKIE, pickLocale, type Locale } from '@/lib/i18n/locale';

const T = {
  es: {
    title: 'Tu privacidad, tus reglas',
    body: 'Usamos cookies esenciales para que la plataforma funcione. Las de analítica y de terceros solo se activan si las aceptas. Puedes cambiarlo cuando quieras.',
    more: 'Más información',
    legend: 'Categorías de cookies',
    essential: 'Esenciales (sesión, seguridad, idioma y esta preferencia)',
    functional: 'Funcionales (recordar filtros y ajustes)',
    analytics: 'Analítica (medir uso de forma agregada)',
    third_party: 'Terceros (vídeo incrustado, píxeles)',
    reject: 'Rechazar opcionales',
    accept: 'Aceptar todas',
    save: 'Guardar selección',
    configure: 'Configurar',
  },
  en: {
    title: 'Your privacy, your call',
    body: 'We use essential cookies so the platform works. Analytics and third-party cookies only turn on if you accept them. You can change this at any time.',
    more: 'Learn more',
    legend: 'Cookie categories',
    essential: 'Essential (session, security, language and this choice)',
    functional: 'Functional (remember filters and settings)',
    analytics: 'Analytics (aggregated usage measurement)',
    third_party: 'Third parties (embedded video, pixels)',
    reject: 'Reject optional',
    accept: 'Accept all',
    save: 'Save selection',
    configure: 'Customize',
  },
} as const;

/** Idioma del aviso: la ficha del coach (/r/…) siempre en inglés; si no, la preferencia guardada o el navegador. */
function bannerLocale(path: string | null): Locale {
  if (path?.startsWith('/r/')) return 'en';
  const cookie = document.cookie.split('; ').find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.split('=')[1];
  return pickLocale(cookie, navigator.languages?.join(',') ?? navigator.language);
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function CookieBanner() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [locale, setLocale] = useState<Locale>('es');
  const [prefs, setPrefs] = useState({ analytics: false, functional: true, third_party: false });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    installScriptGuard();
    const show = () => { setLocale(bannerLocale(window.location.pathname)); setOpen(true); };
    if (!readConsent()) show();
    window.addEventListener('tga:open-cookies', show);
    return () => window.removeEventListener('tga:open-cookies', show);
  }, []);

  // U1: reserva al final de la página la altura del aviso (más su margen), para que no tape el botón principal.
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    if (!open || !ref.current) { root.style.removeProperty('--cookie-banner-space'); return; }
    const el = ref.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      root.style.setProperty('--cookie-banner-space', `${Math.ceil(window.innerHeight - r.top) + 12}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); root.style.removeProperty('--cookie-banner-space'); };
  }, [open, custom]);

  if (!open) return null;
  // Si se navega a la ficha del coach con el aviso abierto, pasa a inglés.
  const lang: Locale = path?.startsWith('/r/') ? 'en' : locale;
  const t = T[lang];
  // Dentro de la app, en móvil hay barra inferior: el aviso se coloca encima, nunca sobre ella.
  const inApp = path?.startsWith('/app');

  const save = (state: typeof prefs) => {
    writeConsent(state);
    void logCookieConsent({ anonymousId: anonymousId(), ...state });
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      lang={lang}
      data-testid="cookie-banner"
      className={`fixed inset-x-3 z-50 mx-auto max-h-[70dvh] max-w-2xl overflow-y-auto rounded-[var(--radius-card)] border border-line-strong bg-surface p-4 shadow-2xl shadow-black/60 sm:inset-x-6 sm:bottom-6 sm:p-5 ${inApp ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6' : 'bottom-3'}`}
    >
      <p id="cookie-title" className="font-display text-base text-paper sm:text-lg">{t.title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted sm:mt-2 sm:text-sm">
        {t.body} <Link className="text-brass underline underline-offset-2" href="/legal/cookies">{t.more}</Link>
      </p>

      {custom && (
        <fieldset className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
          <legend className="sr-only">{t.legend}</legend>
          <label className="flex items-center justify-between gap-4 text-faint">
            <span>{t.essential}</span>
            <input type="checkbox" checked disabled className="accent-[var(--color-brass)]" />
          </label>
          {(['functional', 'analytics', 'third_party'] as const).map((key) => (
            <label key={key} className="flex items-center justify-between gap-4 text-paper">
              <span>{t[key]}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                className="h-4 w-4 accent-[var(--color-brass)]"
              />
            </label>
          ))}
        </fieldset>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:flex sm:flex-wrap">
        {/* Rechazar tiene el mismo peso visual que aceptar: sin patrones oscuros. */}
        <Button variant="secondary" onClick={() => save({ analytics: false, functional: false, third_party: false })}>{t.reject}</Button>
        <Button variant="secondary" onClick={() => save({ analytics: true, functional: true, third_party: true })}>{t.accept}</Button>
        {custom ? (
          <Button className="col-span-2 sm:col-span-1" onClick={() => save(prefs)}>{t.save}</Button>
        ) : (
          <Button variant="ghost" className="col-span-2 sm:col-span-1" onClick={() => setCustom(true)}>{t.configure}</Button>
        )}
      </div>
    </div>
  );
}
