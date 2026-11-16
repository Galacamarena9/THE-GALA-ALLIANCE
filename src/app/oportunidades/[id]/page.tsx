import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { ButtonLink, EmptyState } from '@/components/ui';
import { loadCatalog } from '@/lib/data/athlete';
import { loadPublicOpportunity } from '@/lib/data/public-opportunity';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL } from '@/lib/domain/labels';
import { BRAND } from '@/content/brand';
import { PublicOpportunityView } from './View';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await loadPublicOpportunity(id);
  if (!r.ok || !r.opp) return { title: 'Oportunidad', robots: { index: false, follow: false } };
  const o = r.opp;
  const title = `${o.title} · ${o.organizations.name}`;
  const description = [OPPORTUNITY_TYPE_LABEL[o.type], o.division ? DIVISION_LABEL[o.division] : null, o.location, o.deadline ? `Plazo: ${o.deadline}` : null].filter(Boolean).join(' · ');
  return {
    title,
    description,
    alternates: { canonical: `/oportunidades/${o.id}` },
    openGraph: { type: 'website', title, description, siteName: BRAND.name, images: [{ url: '/media/hero-bg-poster.jpg', alt: BRAND.network }] },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PublicOpportunityPage({ params }: Props) {
  const { id } = await params;
  const r = await loadPublicOpportunity(id);

  if (!r.ok) {
    return (
      <Shell>
        <h1 className="sr-only">Oportunidad</h1>
        <EmptyState title="No hemos podido cargar esta oportunidad" action={<ButtonLink href={`/oportunidades/${id}`} variant="secondary">Reintentar</ButtonLink>}>
          Es un problema temporal de nuestra parte. Vuelve a intentarlo en unos minutos.
        </EmptyState>
      </Shell>
    );
  }
  if (!r.opp) notFound();
  const o = r.opp;

  const catalog = await loadCatalog();
  const sport = catalog.sports.find((s) => s.id === o.sport_id)?.name_es ?? 'No indicado';
  const positions = catalog.positions.filter((p) => o.position_ids.includes(p.id)).map((p) => p.name_es);
  return <Shell><PublicOpportunityView o={o} sport={sport} positions={positions} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <PublicHeader />
      <main id="main-content" className="px-6 pb-24 pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

