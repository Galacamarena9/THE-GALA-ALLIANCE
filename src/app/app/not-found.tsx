import Link from 'next/link';
import { getT } from '@/lib/i18n/server-t';

/** No encontrado dentro de la app (fase 7, U4): sin salir del espacio de trabajo. */
export default async function AppNotFound() {
  const tx = await getT();
  return (
    <section aria-labelledby="app-404-title" className="mx-auto max-w-lg py-16 text-center">
      <p className="font-display text-6xl font-bold leading-none text-brass" aria-hidden>404</p>
      <h1 id="app-404-title" className="mt-4 font-display text-3xl font-bold uppercase text-paper">{tx('No lo encontramos')}</h1>
      <p className="mt-3 text-muted">{tx('Puede que se haya borrado, que el enlace esté mal o que ya no tengas acceso.')}</p>
      <div className="mt-8 flex justify-center">
        <Link href="/app" className="inline-flex h-11 items-center rounded-xl bg-brass px-6 text-sm font-semibold text-ink hover:bg-brass-soft">{tx('Ir a mi inicio')}</Link>
      </div>
    </section>
  );
}
