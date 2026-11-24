'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Error inesperado en cualquier pantalla: mensaje humano, reintentar y salida clara. Sin detalles técnicos al usuario. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center bg-ink px-6 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-night font-display text-2xl font-bold text-lime" aria-hidden>G</span>
        <h1 className="mt-6 font-display text-4xl font-bold uppercase text-paper">Algo no ha ido bien</h1>
        <p className="mt-3 text-muted">No es culpa tuya. Si estabas guardando algo, no se ha guardado: vuelve a intentarlo. Si se repite, escríbenos y lo arreglamos.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-xl bg-brass px-6 text-sm font-semibold text-ink hover:bg-brass-soft">Reintentar</button>
          <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-6 text-sm font-semibold text-paper hover:border-brass/40">Ir al inicio</Link>
        </div>
        {error.digest && <p className="mt-8 text-xs text-faint">Código para soporte: {error.digest}</p>}
      </div>
    </main>
  );
}
