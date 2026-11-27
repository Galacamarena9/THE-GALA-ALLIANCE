import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { OrganizationPublicView } from '@/components/OrganizationPublicView';
import { publicOrganization } from '@/lib/data/public-seo';
import { ORG_TYPE_LABEL, ORG_TYPE_LABEL_EN } from '@/lib/domain/labels';
import { getT } from '@/lib/i18n/server-t';
import { siteUrl } from '@/lib/env';
import type { OrgType } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

/** 20 · Página pública de una organización verificada. Solo se indexa si tiene oportunidades publicadas (contenido real). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tx = await getT();
  const r = await publicOrganization(id, tx.locale);
  if (!r) return { title: tx('Organización'), robots: { index: false, follow: false } };
  const type = (tx.locale === 'en' ? ORG_TYPE_LABEL_EN : ORG_TYPE_LABEL)[r.org.type as OrgType] ?? tx('Organización');
  const title = `${r.org.name} · ${tx('oportunidades verificadas')}`;
  const n = r.opportunities.length;
  const description = tx.locale === 'en'
    ? `Verified ${type.toLowerCase()}${r.org.city ? ` in ${r.org.city}` : ''}. ${n} open ${n === 1 ? 'opportunity' : 'opportunities'} on The Gala Alliance.`
    : `${type} verificada${r.org.city ? ` en ${r.org.city}` : ''}. ${n} oportunidad${n === 1 ? '' : 'es'} abierta${n === 1 ? '' : 's'} en The Gala Alliance.`;
  return {
    title, description,
    alternates: { canonical: `/organizaciones/${id}` },
    robots: n ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: 'website', title, description },
  };
}

export default async function PublicOrganizationPage({ params }: Props) {
  const { id } = await params;
  const tx = await getT();
  const r = await publicOrganization(id, tx.locale);
  if (!r) notFound();
  const { org, opportunities } = r;
  const base = siteUrl();
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <JsonLd data={{
          '@context': 'https://schema.org', '@type': ['university', 'college'].includes(org.type) ? 'CollegeOrUniversity' : 'SportsOrganization', name: org.name, url: `${base}/organizaciones/${org.id}`,
          ...(org.description ? { description: org.description.slice(0, 300) } : {}),
          ...(org.website ? { sameAs: [org.website] } : {}),
          ...(org.city || org.country ? { address: { '@type': 'PostalAddress', ...(org.city ? { addressLocality: org.city } : {}), ...(org.country ? { addressCountry: org.country } : {}) } } : {}),
        }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: tx('Oportunidades'), item: `${base}/oportunidades` },
          { '@type': 'ListItem', position: 2, name: org.name, item: `${base}/organizaciones/${org.id}` },
        ] }} />
        <OrganizationPublicView org={org} opportunities={opportunities} tx={tx} locale={tx.locale} />
      </main>
      <PublicFooter />
    </>
  );
}
