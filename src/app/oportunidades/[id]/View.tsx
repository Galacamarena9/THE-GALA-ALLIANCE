import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, Lock } from 'lucide-react';
import { TrustSeal } from '@/components/TrustSeal';
import { Badge, ButtonLink, Card, CardTitle } from '@/components/ui';
import type { PublicOpportunity } from '@/lib/data/public-opportunity';
import { assessOpportunity } from '@/lib/domain/trust';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL, daysUntil, domainOf, usd } from '@/lib/domain/labels';
import { BRAND } from '@/content/brand';

const FIN_SOURCE: Record<string, string> = {
  platform_verified: 'Cifras verificadas por la plataforma.',
  organization_provided: 'Cifras aportadas por la organización, sin verificar.',
};

/** Vista de la oportunidad pública (separada para poder revisarla con datos ficticios en /preview). */
export function PublicOpportunityView({ o, sport, positions }: { o: PublicOpportunity; sport: string; positions: string[] }) {
  const net = o.annual_cost_usd != null && o.aid_amount_usd != null ? o.annual_cost_usd - o.aid_amount_usd : null;
  const days = o.deadline ? daysUntil(o.deadline) : null;
  const closed = days != null && days < 0;
  const notProvided = 'No indicado';

  return (
    <>
      <Link href="/oportunidades" className="inline-flex items-center gap-1 text-sm text-muted hover:text-paper"><ArrowLeft className="h-4 w-4" aria-hidden />Todas las oportunidades</Link>

      <header className="mt-6 max-w-3xl">
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span className="font-semibold text-paper">{o.organizations.name}</span>
          <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="h-4 w-4" aria-hidden />Organización verificada</span>
          {o.organizations.website && <span>· {domainOf(o.organizations.website)}</span>}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] text-paper sm:text-5xl">{o.title}</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge>{OPPORTUNITY_TYPE_LABEL[o.type]}</Badge>
          {o.division && <Badge>{DIVISION_LABEL[o.division]}</Badge>}
          <Badge>{sport}</Badge>
          {closed ? <Badge tone="danger">Plazo cerrado</Badge> : days != null && days <= 14 ? <Badge tone="warn">Cierra en {days} días</Badge> : null}
        </div>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardTitle kicker="La oportunidad">Descripción</CardTitle>
            <p className="whitespace-pre-line leading-relaxed text-muted">{o.description || 'La organización no ha añadido descripción.'}</p>
          </Card>

          <Card>
            <CardTitle kicker="Lo que piden">Requisitos</CardTitle>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Row label="Posiciones" value={positions.length ? positions.join(', ') : 'Cualquiera'} />
              <Row label="Promoción (graduación)" value={o.graduation_years.length ? o.graduation_years.join(', ') : 'Cualquiera'} />
              <Row label="Nota mínima" value={o.min_gpa_4 != null ? `${o.min_gpa_4} / 4.0` : notProvided} />
              <Row label="Inglés" value={o.english_required ?? notProvided} />
              <Row label="Plazas" value={o.places != null ? String(o.places) : notProvided} />
              <Row label="Ubicación" value={o.location ?? notProvided} />
              <Row label="Inicio" value={o.start_term ?? notProvided} />
              <Row label="Plazo" value={o.deadline ?? 'Abierto'} />
            </dl>
          </Card>

          <Card>
            <CardTitle kicker="Transparencia financiera">Coste real</CardTitle>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Money label="Coste anual" value={o.annual_cost_usd == null ? notProvided : usd(o.annual_cost_usd)} />
              <Money label="Ayuda anual" value={o.aid_amount_usd == null ? notProvided : usd(o.aid_amount_usd)} />
              <Money label="Neto familia / año" value={net == null ? 'Incompleto' : usd(net)} strong />
            </dl>
            <p className="mt-4 text-xs text-faint">{FIN_SOURCE[o.financial_source ?? ''] ?? 'La organización no ha publicado cifras.'} Una ayuda solo cuenta cuando está por escrito en la oferta.</p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-brass/40">
            <CardTitle kicker="Tu encaje">¿Encajas en esta oportunidad?</CardTitle>
            <p className="text-sm leading-relaxed text-muted">Crea tu {BRAND.passport} gratis y verás tu Gala Match por áreas: por qué encajas, qué no cumples y qué te falta. Desde ahí puedes candidatar.</p>
            <ButtonLink href="/signup?role=athlete&from=opportunity" className="group mt-5 w-full justify-center">Crear mi Passport gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
            <p className="mt-3 text-center text-sm"><Link href="/login" className="text-brass hover:underline">Ya tengo cuenta</Link></p>
            <p className="mt-4 flex items-start gap-2 text-xs text-faint"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Con menores, el contacto con organizaciones pasa siempre por la familia.</p>
          </Card>
          <TrustSeal {...assessOpportunity(o)} />
        </div>
      </div>
    </>
  );
}


function Row({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-faint">{label}</dt><dd className="text-paper">{value}</dd></div>;
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl bg-ink/50 p-4 ${strong ? 'border border-brass/40' : ''}`}>
      <dt className={`text-xs ${strong ? 'text-brass' : 'text-faint'}`}>{label}</dt>
      <dd className="font-display text-2xl tabular-nums text-paper">{value}</dd>
    </div>
  );
}
