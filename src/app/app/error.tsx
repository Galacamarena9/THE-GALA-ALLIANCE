'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * Error dentro de la app (fase 7, U4): se pinta dentro del layout de /app, así que la barra lateral,
 * la navegación móvil y la sesión siguen ahí. Sin detalles técnicos; código para soporte si lo hay.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tx = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section role="alert" aria-labelledby="app-error-title" className="mx-auto max-w-lg py-16 text-center">
      <h1 id="app-error-title" className="font-display text-3xl font-bold uppercase text-paper">{tx('Algo no ha ido bien')}</h1>
      <p className="mt-3 text-muted">{tx('No es culpa tuya. Si estabas guardando algo, no se ha guardado: vuelve a intentarlo. Si se repite, escríbenos y lo arreglamos.')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-xl bg-brass px-6 text-sm font-semibold text-ink hover:bg-brass-soft">{tx('Reintentar')}</button>
        <Link href="/app" className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-6 text-sm font-semibold text-paper hover:border-brass/40">{tx('Ir a mi inicio')}</Link>
        <Link href="/app/support" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-muted underline-offset-4 hover:text-paper hover:underline">{tx('Escribir a soporte')}</Link>
      </div>
      {error.digest && <p className="mt-8 text-xs text-faint">{tx('Código para soporte:')} {error.digest}</p>}
    </section>
  );
}
