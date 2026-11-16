import type { Metadata } from 'next';
import { GuideIndex } from '@/components/GuideView';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';

export const metadata: Metadata = {
  title: 'Guía: becas deportivas en EE. UU.',
  description: 'Divisiones, requisitos académicos, documentos, visado, coste real y lo que te vas a encontrar. Con fuentes oficiales.',
};

export default function PublicGuide() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[13px] font-semibold text-brass">Centro de información · gratis</p>
        <h1 className="mt-3 max-w-3xl text-5xl text-paper">Todo lo que una familia necesita saber, sin letra pequeña</h1>
        <p className="mb-10 mt-4 max-w-2xl text-muted">Cada capítulo enlaza a su fuente oficial (NCAA, NAIA, Departamento de Estado de EE. UU.) y se revisa cada temporada.</p>
        <GuideIndex base="/guia" />
      </main>
      <PublicFooter />
    </>
  );
}
