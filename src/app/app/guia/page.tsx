import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { GuideIndex } from '@/components/GuideView';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Centro de información' };

export default async function AppGuidePage() {
  await requireSession();
  return (
    <>
      <PageHeader kicker="Centro de información" title="Todo lo que necesitas saber" description="Becas, documentos, el proceso, el visado, el coste real y lo que te vas a encontrar. Con fuentes oficiales en cada capítulo." />
      <GuideIndex base="/app/guia" />
    </>
  );
}
