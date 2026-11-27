import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
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
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <PageHeader kicker="Centro de información · gratis" title={<>Todo lo que una familia necesita saber, <em>sin letra pequeña</em></>} photo="/media/university-campus-sm.webp"
          description="Cada capítulo enlaza a su fuente oficial (NCAA, NAIA, Departamento de Estado de EE. UU.) y se revisa cada temporada." />
        <GuideIndex base="/guia" />
      </main>
      <PublicFooter />
    </>
  );
}
