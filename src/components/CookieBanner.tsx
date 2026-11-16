'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { anonymousId, installScriptGuard, readConsent, writeConsent } from '@/lib/consent';
import { logCookieConsent } from '@/app/actions/consent';
import { Button } from '@/components/ui';

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [prefs, setPrefs] = useState({ analytics: false, functional: true, third_party: false });

  useEffect(() => {
    installScriptGuard();
    const show = () => setOpen(true);
    if (!readConsent()) show();
    window.addEventListener('tga:open-cookies', show);
    return () => window.removeEventListener('tga:open-cookies', show);
  }, []);

  if (!open) return null;

  const save = (state: typeof prefs) => {
    writeConsent(state);
    void logCookieConsent({ anonymousId: anonymousId(), ...state });
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-[var(--radius-card)] border border-line-strong bg-surface p-5 shadow-2xl shadow-black/60 sm:inset-x-6 sm:bottom-6">
      <p id="cookie-title" className="font-display text-lg text-paper">Tu privacidad, tus reglas</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Usamos cookies esenciales para que la plataforma funcione. Las de analítica y de terceros solo se activan si las aceptas. Puedes
        cambiarlo cuando quieras. <Link className="text-brass underline underline-offset-2" href="/legal/cookies">Más información</Link>
      </p>

      {custom && (
        <fieldset className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
          <legend className="sr-only">Categorías de cookies</legend>
          <label className="flex items-center justify-between gap-4 text-faint">
            <span>Esenciales (sesión, seguridad, esta preferencia)</span>
            <input type="checkbox" checked disabled className="accent-[var(--color-brass)]" />
          </label>
          {([
            ['functional', 'Funcionales (recordar filtros y ajustes)'],
            ['analytics', 'Analítica (medir uso de forma agregada)'],
            ['third_party', 'Terceros (vídeo incrustado, píxeles)'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 text-paper">
              <span>{label}</span>
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

      <div className="mt-5 flex flex-wrap gap-2">
        {/* Rechazar tiene el mismo peso visual que aceptar: sin patrones oscuros. */}
        <Button variant="secondary" onClick={() => save({ analytics: false, functional: false, third_party: false })}>Rechazar opcionales</Button>
        <Button variant="secondary" onClick={() => save({ analytics: true, functional: true, third_party: true })}>Aceptar todas</Button>
        {custom ? (
          <Button onClick={() => save(prefs)}>Guardar selección</Button>
        ) : (
          <Button variant="ghost" onClick={() => setCustom(true)}>Configurar</Button>
        )}
      </div>
    </div>
  );
}
