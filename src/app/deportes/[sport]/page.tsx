import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { Badge, ButtonLink, Card } from '@/components/ui';
import { JsonLd } from '@/components/seo/JsonLd';
import { loadCatalog } from '@/lib/data/athlete';
import { publishedOpportunities } from '@/lib/data/public-seo';
import { OPPORTUNITY_TYPE_LABEL } from '@/lib/domain/labels';
import { siteUrl } from '@/lib/env';
import type { OpportunityType } from '@/lib/types';

type Props = { params: Promise<{ sport: string }> };

/**
 * 20 · SEO programático responsable: una página por deporte SOLO con oportunidades reales publicadas.
 * Sin oportunidades, la página existe para el usuario pero no se indexa (nada de páginas vacías para Google).
 */
async function load(sport: string) {
  if (!/^[a-z_]{2,30}$/.test(sport)) return null;
  const [catalog, opps] = await Promise.all([loadCatalog(), publishedOpportunities()]);
  const s = catalog.sports.find((x) => x.id === sport);
  if (!s) return null;
  return { name: s.name_es, opps: opps.filter((o) => o.sport_id === sport) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport } = await params;
  const d = await load(sport);
  if (!d) return { title: 'Deporte', robots: { index: false, follow: false } };
  const title = `Becas y oportunidades de ${d.name.toLowerCase()} en EE. UU. y Europa`;
  const description = `${d.opps.length} oportunidad${d.opps.length === 1 ? '' : 'es'} de ${d.name.toLowerCase()} publicada${d.opps.length === 1 ? '' : 's'} por organizaciones verificadas: becas, pruebas, campus y academias.`;
  return { title, description, alternates: { canonical: `/deportes/${sport}` }, robots: d.opps.length ? { index: true, follow: true } : { index: false, follow: true } };
}

export default async function SportPage({ params }: Props) {
  const { sport } = await params;
  const d = await load(sport);
  if (!d) notFound();
  const base = siteUrl();
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Oportunidades', item: `${base}/oportunidades` },
          { '@type': 'ListItem', position: 2, name: d.name, item: `${base}/deportes/${sport}` },
        ] }} />
        <p className="text-sm text-muted">Deporte</p>
        <h1 className="mt-1 font-display text-4xl font-bold uppercase text-paper sm:text-5xl">{d.name}</h1>
        <p className="mt-3 max-w-2xl text-muted">Oportunidades publicadas por organizaciones verificadas. Ninguna se paga ni promete una beca: revisa siempre su sello de confianza.</p>
        {d.opps.length ? (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {d.opps.map((o) => (
              <li key={o.id}>
                <Link href={`/oportunidades/${o.id}`} className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/50">
                  <Badge>{OPPORTUNITY_TYPE_LABEL[o.type as OpportunityType] ?? o.type}</Badge>
                  <p className="mt-2 font-semibold text-paper">{o.title}</p>
                  <p className="mt-1 text-xs text-faint">{[o.location, o.deadline ? `Plazo: ${o.deadline}` : null].filter(Boolean).join(' · ')}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-8 text-sm text-muted">Todavía no hay oportunidades publicadas de {d.name.toLowerCase()}. Crea tu Passport y te avisaremos cuando las haya.</p>}
        <Card className="mt-10">
          <p className="font-display text-xl text-paper">Antes de aplicar</p>
          <p className="mt-2 text-sm text-muted">Divisiones, requisitos académicos, plazos y visado, explicados con fuentes oficiales.</p>
          <div className="mt-4 flex flex-wrap gap-3"><ButtonLink href="/guia" variant="secondary">Leer la guía</ButtonLink><ButtonLink href="/signup?role=athlete">Crear mi Passport gratis</ButtonLink></div>
        </Card>
      </main>
      <PublicFooter />
    </>
  );
}
