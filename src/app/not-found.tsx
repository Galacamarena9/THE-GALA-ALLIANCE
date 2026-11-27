import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Página no encontrada', robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main id="main-content" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-night px-6 py-16 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- fondo decorativo local */}
      <img src="/media/arena-bg.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="relative max-w-md text-center">
        <p className="font-display text-8xl font-bold leading-none text-lime">404</p>
        <h1 className="mt-4 font-display text-4xl font-bold uppercase">Fuera de banda</h1>
        <p className="mt-3 text-lavender">Esta página no existe o ya no está disponible.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-lime px-6 text-sm font-bold text-night">Ir al inicio</Link>
          <Link href="/app" className="inline-flex h-11 items-center rounded-xl border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10">Mi espacio</Link>
        </div>
      </div>
    </main>
  );
}
