import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { institutionFit } from '@/lib/domain/institutionFit';
import { DIVISION_LABEL, domainOf, usd } from '@/lib/domain/labels';
import type { Division } from '@/lib/types';
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { OpportunityCard, type OpportunityCardData } from '@/components/OpportunityCard';
import { InstitutionAdminForm, ReportButton } from '@/components/forms';

export const metadata: Metadata = { title: 'Universidad' };

function OfficialLink({ href, label, verified }: { href: string | null; label: string; verified: boolean }) {
  if (!href) return <li className="flex justify-between gap-3 py-2.5 text-sm"><span className="text-muted">{label}</span><span className="text-faint">Sin enlace</span></li>;
  return (
    <li className="flex justify-between gap-3 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <a href={href} target="_blank" rel="noopener noreferrer" className="truncate text-brass hover:underline">
        {domainOf(href)} ↗ {verified ? <span className="text-ok">✓</span> : <span className="text-warn" title="Pendiente de revisión">·</span>}
      </a>
    </li>
  );
}

export default async function UniversityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await requireSession();
  const supabase = await createClient();
  const { data: inst } = await supabase.from('institutions').select('*').eq('id', id).maybeSingle();
  if (!inst) notFound();

  const catalog = await loadCatalog();
  const { data: orgs } = await supabase.from('organizations').select('id, name, international_support, verification_status').eq('institution_id', id).eq('verification_status', 'verified');
  const orgIds = (orgs ?? []).map((o) => o.id);
  const { data: opps } = orgIds.length
    ? await supabase.from('opportunities').select('id, title, type, division, location, deadline, annual_cost_usd, aid_amount_usd, status, organizations(name, verification_status)').in('organization_id', orgIds).eq('status', 'published')
    : { data: [] };
  const passport = session.roles.includes('athlete') ? await loadPassport(session.userId) : null;
  const fit = passport?.profile ? institutionFit(passport.profile, passport.annualBudgetUsd, inst) : null;
  const verified = Boolean(inst.links_verified_at);
  const sports = (inst.sports_offered as string[]).map((s) => catalog.sports.find((c) => c.id === s)?.name_es ?? s);

  return (
    <>
      <PageHeader
        kicker={[inst.division ? DIVISION_LABEL[inst.division as Division] : null, inst.conference].filter(Boolean).join(' · ') || 'Universidad'}
        title={inst.name}
        description={[inst.city, inst.state].filter(Boolean).join(', ')}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/universities/compare?ids=${inst.id}`} className="rounded-lg border border-line-strong px-4 py-2.5 text-sm text-paper hover:border-brass">Añadir al comparador</Link>
            {inst.website_url && <a href={inst.website_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line-strong px-4 py-2.5 text-sm text-paper hover:border-brass">Web oficial ↗</a>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardTitle kicker="Datos oficiales">Coste</CardTitle>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Coste total anual (media)</dt><dd className="font-display text-2xl tabular-nums text-paper">{usd(inst.cost_attendance_usd)}</dd></div>
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Matrícula (no residentes del estado)</dt><dd className="font-display text-2xl tabular-nums text-paper">{usd(inst.tuition_out_of_state_usd)}</dd></div>
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">SAT medio de admitidos</dt><dd className="font-display text-2xl tabular-nums text-paper">{inst.sat_avg ?? 'Sin dato'}</dd></div>
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Tasa de admisión</dt><dd className="font-display text-2xl tabular-nums text-paper">{inst.admission_rate == null ? 'Sin dato' : `${Math.round(Number(inst.admission_rate) * 100)} %`}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">El SAT medio orienta tu preparación, no es un mínimo: muchas universidades son test-optional. Prepáralo en la <a href="/app/academia" className="text-brass hover:underline">Academia</a>.</p>
            <p className="mt-4 text-xs text-faint">
              Fuente: {inst.data_source === 'college_scorecard' ? <a className="text-brass hover:underline" href="https://collegescorecard.ed.gov/" target="_blank" rel="noopener noreferrer">College Scorecard, U.S. Department of Education ↗</a> : 'introducido por el equipo'}
              {inst.source_fetched_at && ` · consultado el ${new Date(inst.source_fetched_at).toLocaleDateString('es-ES')}`}.
              Son medias antes de becas.{inst.price_calculator_url && <> <a href={inst.price_calculator_url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">Calculadora oficial de la universidad ↗</a></>}
            </p>
          </Card>

          <Card>
            <CardTitle kicker="Becas y plazas">Oportunidades publicadas</CardTitle>
            {opps?.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">{opps.map((o) => <li key={o.id}><OpportunityCard o={o as unknown as OpportunityCardData} /></li>)}</ul>
            ) : (
              <EmptyState title="Sin oportunidades publicadas ahora">{orgs?.length ? 'Vuelve pronto o revisa su web de deportes.' : 'Esta universidad aún no tiene cuenta verificada en la plataforma.'}</EmptyState>
            )}
          </Card>

          {orgs?.[0]?.international_support && (
            <Card>
              <CardTitle kicker="Según la universidad">Apoyo a estudiantes internacionales</CardTitle>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{orgs[0].international_support}</p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {fit && (
            <Card className="paper-grain">
              <CardTitle kicker="Tu encaje con esta universidad">Encaje {fit.level}</CardTitle>
              <ul className="space-y-1.5 text-sm">
                {fit.reasons.map((r) => (
                  <li key={r.label} className={r.ok === true ? 'text-ok' : r.ok === false ? 'text-danger' : 'text-warn'}>{r.ok === true ? '✓' : r.ok === false ? '✗' : '?'} {r.label}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">Orientativo. El encaje real depende de cada beca y del cuerpo técnico.</p>
            </Card>
          )}

          <Card>
            <CardTitle kicker="Enlaces oficiales">Información de primera mano</CardTitle>
            <ul className="divide-y divide-line">
              <OfficialLink href={inst.website_url} label="Web de la universidad" verified />
              <OfficialLink href={inst.athletics_url} label="Deportes (athletics)" verified={verified} />
              <OfficialLink href={inst.admissions_url} label="Admisiones" verified={verified} />
              <OfficialLink href={inst.international_url} label="Oficina internacional" verified={verified} />
              <OfficialLink href={inst.virtual_tour_url} label="Campus virtual" verified={verified} />
            </ul>
            <p className="mt-3 text-xs text-faint">✓ revisado por nuestro equipo · enlaces externos: se abren en la web oficial, fuera de la plataforma.</p>
          </Card>

          {sports.length > 0 && (
            <Card>
              <CardTitle kicker="Deportes">En la plataforma</CardTitle>
              <div className="flex flex-wrap gap-1.5">{sports.map((s) => <Badge key={s}>{s}</Badge>)}</div>
            </Card>
          )}

          <div className="text-right"><ReportButton entityType="institution" entityId={inst.id} label="Informar de un dato incorrecto" /></div>
          {session.roles.includes('admin') && (
            <Card>
              <CardTitle kicker="Admin">Datos deportivos y enlaces</CardTitle>
              <InstitutionAdminForm inst={inst} sports={catalog.sports} />
            </Card>
          )}
          <Link href="/app/universities" className="block text-sm text-muted hover:text-paper">← Volver al directorio</Link>
        </div>
      </div>
    </>
  );
}
