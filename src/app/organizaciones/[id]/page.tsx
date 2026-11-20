import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { Badge, ButtonLink, Card } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { publicOrganization } from '@/lib/data/public-seo';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL, ORG_TYPE_LABEL, domainOf } from '@/lib/domain/labels';
import { siteUrl } from '@/lib/env';
import type { Division, OpportunityType, OrgType } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

/** 20 · Página pública de una organización verificada. Solo se indexa si tiene oportunidades publicadas (contenido real). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await publicOrganization(id);
  if (!r) return { title: 'Organización', robots: { index: false, follow: false } };
  const title = `${r.org.name} · oportunidades verificadas`;
  const description = `${ORG_TYPE_LABEL[r.org.type as OrgType] ?? 'Organización'} verificada${r.org.city ? ` en ${r.org.city}` : ''}. ${r.opportunities.length} oportunidad${r.opportunities.length === 1 ? '' : 'es'} abierta${r.opportunities.length === 1 ? '' : 's'} en The Gala Alliance.`;
  return {
    title, description,
    alternates: { canonical: `/organizaciones/${id}` },
    robots: r.opportunities.length ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: 'website', title, description },
  };
}

export default async function PublicOrganizationPage({ params }: Props) {
  const { id } = await params;
  const r = await publicOrganization(id);
  if (!r) notFound();
  const { org, opportunities } = r;
  const base = siteUrl();
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <JsonLd data={{
          '@context': 'https://schema.org', '@type': 'Organization', name: org.name, url: `${base}/organizaciones/${org.id}`,
          ...(org.website ? { sameAs: [org.website] } : {}),
          ...(org.city || org.country ? { address: { '@type': 'PostalAddress', ...(org.city ? { addressLocality: org.city } : {}), ...(org.country ? { addressCountry: org.country } : {}) } } : {}),
        }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Oportunidades', item: `${base}/oportunidades` },
          { '@type': 'ListItem', position: 2, name: org.name, item: `${base}/organizaciones/${org.id}` },
        ] }} />
        <Link href="/oportunidades" className="text-sm text-muted hover:text-paper">← Todas las oportunidades</Link>
        <header className="mt-6">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{ORG_TYPE_LABEL[org.type as OrgType] ?? 'Organización'}</span>
            {org.division && <span>· {DIVISION_LABEL[org.division as Division] ?? org.division}</span>}
            {(org.city || org.country) && <span>· {[org.city, org.country].filter(Boolean).join(', ')}</span>}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase text-paper sm:text-5xl">{org.name}</h1>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ok"><BadgeCheck className="h-4 w-4" aria-hidden /> Organización verificada por The Gala Alliance</p>
          {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer nofollow" className="ml-4 inline-flex items-center gap-1 text-sm text-brass hover:underline">{domainOf(org.website)} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
        </header>
        <section className="mt-10" aria-labelledby="opps">
          <h2 id="opps" className="font-display text-2xl font-bold uppercase text-paper">Oportunidades abiertas</h2>
          {opportunities.length ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {opportunities.map((o) => (
                <li key={o.id}>
                  <Link href={`/oportunidades/${o.id}`} className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/50">
                    <Badge>{OPPORTUNITY_TYPE_LABEL[o.type as OpportunityType] ?? o.type}</Badge>
                    <p className="mt-2 font-semibold text-paper">{o.title}</p>
                    <p className="mt-1 text-xs text-faint">{[o.location, o.deadline ? `Plazo: ${o.deadline}` : null].filter(Boolean).join(' · ')}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Ahora mismo no tiene oportunidades abiertas.</p>}
        </section>
        <Card className="mt-10">
          <p className="font-display text-xl text-paper">¿Eres atleta?</p>
          <p className="mt-2 text-sm text-muted">Crea tu Passport gratis: las organizaciones verificadas te encuentran y tú decides quién ve qué.</p>
          <ButtonLink href="/signup?role=athlete" className="mt-4">Crear mi Passport</ButtonLink>
        </Card>
      </main>
      <PublicFooter />
    </>
  );
}
