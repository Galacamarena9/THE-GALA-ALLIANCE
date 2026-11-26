import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { OptionsQuiz } from '@/components/landing/OptionsQuiz';

export const metadata: Metadata = {
  title: 'Test de opciones: ¿tengo opciones de beca en EE. UU.?',
  description: 'Cuatro preguntas para ver dónde encajarías (NCAA, NAIA, JUCO), qué te haría subir de nivel y tu roadmap. Gratis y sin registro.',
  alternates: { canonical: '/test-opciones' },
};

/** Test de opciones (herramienta gratuita sin registro). Antes el enlace apuntaba a `/#test`, que no existía. */
export default function OptionsTestPage() {
  return (
    <div className="relative">
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <p className="text-sm font-semibold text-brass"><Link href="/herramientas" className="hover:underline">Herramientas</Link> · Test de opciones</p>
        <h1 className="mt-3 text-4xl text-paper sm:text-5xl">¿Tengo opciones de beca en EE. UU.?</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">Cuatro preguntas. Te decimos dónde encajarías, qué te haría subir de nivel y por dónde empezar. No guardamos tus respuestas.</p>
        <div className="mt-10"><OptionsQuiz /></div>
      </main>
      <PublicFooter />
    </div>
  );
}
