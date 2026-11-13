import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { myOrganizations } from '@/lib/data/orgs';
import { loadCatalog } from '@/lib/data/athlete';
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { CampaignForm } from './CampaignForm';

export const metadata: Metadata = { title: 'Nueva oferta' };

export default async function NewCampaignPage() {
  const session = await requireSession(['brand']);
  const [orgs, catalog] = await Promise.all([myOrganizations(session.userId), loadCatalog()]);
  const brands = orgs.filter((o) => o.type === 'brand');
  return (
    <>
      <PageHeader kicker="Marcas" title="Nueva oferta" description="Entregables, compensación y derechos de uso claros: así los atletas pueden decidir con información." />
      {brands.length ? <CampaignForm brands={brands} sports={catalog.sports} /> : <EmptyState title="Primero da de alta tu marca" action={<ButtonLink href="/onboarding?add=1&role=brand">Dar de alta</ButtonLink>} />}
    </>
  );
}
