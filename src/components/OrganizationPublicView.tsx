import Link from 'next/link';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader } from '@/components/ui';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL, ORG_TYPE_LABEL, ORG_TYPE_LABEL_EN, domainOf } from '@/lib/domain/labels';
import { COUNTRY_NAME } from '@/lib/domain/passport';
import type { PublicOppRow, PublicOrg } from '@/lib/data/public-seo';
import type { Division, OpportunityType, OrgType } from '@/lib/types';

/**
 * Página pública de una organización verificada con el estilo «Estadio». Solo lo que ya es público (columnas abiertas a
 * anónimos): tipo, división, conferencia, deportes, ubicación, descripción, apoyo internacional, web y oportunidades.
 */
export function OrganizationPublicView({ org, opportunities, tx, locale }: { org: PublicOrg; opportunities: PublicOppRow[]; tx: (s: string) => string; locale: 'es' | 'en' }) {
  const type = (locale === 'en' ? ORG_TYPE_LABEL_EN : ORG_TYPE_LABEL)[org.type as OrgType] ?? tx('Organización');
  const place = [org.city, org.state, org.country ? COUNTRY_NAME[org.country] ?? org.country : null].filter(Boolean).join(', ');
  const verifiedOn = org.verified_at ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' }).format(new Date(org.verified_at)) : null;
  const facts: [string, string][] = [
    [tx('Tipo'), type],
    ...(org.division ? [[tx('División'), DIVISION_LABEL[org.division as Division] ?? org.division] as [string, string]] : []),
    ...(org.conference ? [[tx('Conferencia'), org.conference] as [string, string]] : []),
    ...(org.sports.length ? [[tx('Deportes'), org.sports.join(' · ')] as [string, string]] : []),
    ...(place ? [[tx('Ubicación'), place] as [string, string]] : []),
  ];
  return (
    <>
      <Link href="/oportunidades" className="text-sm text-muted hover:text-paper">{tx('← Todas las oportunidades')}</Link>
      <div className="mt-4">
        <PageHeader
          kicker={[type, org.division ? DIVISION_LABEL[org.division as Division] : null].filter(Boolean).join(' · ')}
          title={org.name}
          description={place || undefined}
          action={(
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="stadium-tag inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" aria-hidden /> {tx('Verificada por The Gala Alliance')}</span>
              {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-semibold text-white underline">{domainOf(org.website)} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
            </div>
          )}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {org.description && (
            <Card>
              <h2 className="kicker">{tx('Sobre la organización')}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-paper">{org.description}</p>
            </Card>
          )}
          <section aria-labelledby="opps">
            <h2 id="opps" className="font-display text-2xl font-bold uppercase text-paper">{tx('Oportunidades abiertas')} <span className="text-muted">({opportunities.length})</span></h2>
            {opportunities.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/oportunidades/${o.id}`} className="block h-full rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/50">
                      <Badge>{tx(OPPORTUNITY_TYPE_LABEL[o.type as OpportunityType] ?? o.type)}</Badge>
                      <p className="mt-2 font-semibold text-paper">{o.title}</p>
                      <p className="mt-1 text-xs text-muted">{[o.location, o.deadline ? `${tx('Plazo:')} ${o.deadline}` : null].filter(Boolean).join(' · ')}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">{tx('Ahora mismo no tiene oportunidades abiertas.')}</p>}
          </section>
          {org.international_support && (
            <Card>
              <h2 className="kicker">{tx('Apoyo a atletas internacionales')}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-paper">{org.international_support}</p>
            </Card>
          )}
        </div>
        <aside className="space-y-6" aria-label={tx('Datos de la organización')}>
          <Card>
            <h2 className="kicker">{tx('En resumen')}</h2>
            <dl className="mt-3 space-y-2 text-sm" data-testid="org-facts">
              {facts.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold text-paper">{v}</dd></div>)}
              <div><dt className="text-xs text-muted">{tx('Verificación')}</dt><dd className="inline-flex items-center gap-1 font-semibold text-ok"><BadgeCheck className="h-4 w-4" aria-hidden /> {tx('Verificada')}{verifiedOn ? ` · ${verifiedOn}` : ''}</dd></div>
            </dl>
          </Card>
          <Card>
            <p className="font-display text-xl text-paper">{tx('¿Eres atleta?')}</p>
            <p className="mt-2 text-sm text-muted">{tx('Crea tu Passport gratis: las organizaciones verificadas te encuentran y tú decides quién ve qué.')}</p>
            <ButtonLink href="/signup?role=athlete" className="mt-4">{tx('Crear mi Passport')}</ButtonLink>
          </Card>
          <Card>
            <p className="font-semibold text-paper">{tx('¿Trabajas en esta organización?')}</p>
            <p className="mt-1 text-sm text-muted">{tx('Crea tu cuenta de staff y pide unirte: un administrador lo confirma.')}</p>
            <ButtonLink href="/signup?role=coach" variant="secondary" className="mt-3">{tx('Unirme como staff')}</ButtonLink>
          </Card>
        </aside>
      </div>
    </>
  );
}
