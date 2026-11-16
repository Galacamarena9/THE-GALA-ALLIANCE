import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { familyPlan, managedAthletes, PLAN_RANK, type FamilyPlan } from '@/lib/data/family';
import { buildShortlist } from '@/lib/data/shortlist';
import { DIVISION_LABEL, daysUntil, usd } from '@/lib/domain/labels';
import { SAT_DATES } from '@/content/academy';
import { planByCode } from '@/content/plans';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Meter, Notice, PageHeader } from '@/components/ui';
import { seedDocumentChecklist } from '@/app/actions/autonomy';

export const metadata: Metadata = { title: 'Mi plan' };

const PLAN_NAME: Record<FamilyPlan, string> = { free: 'Passport (gratis)', family_core: 'Core', family_elite: 'Elite', family_signature: 'Signature 1:1' };

function Locked({ plan, children }: { plan: 'family_core' | 'family_elite'; children: React.ReactNode }) {
  const p = planByCode(plan);
  return (
    <div className="relative min-h-[150px] overflow-hidden rounded-2xl border border-line bg-surface-2">
      {/* Vista previa difuminada de lo que hay detrás del candado. */}
      <div className="pointer-events-none select-none space-y-2 p-4 blur-[3px]" aria-hidden>
        <div className="h-3 w-3/4 rounded-full bg-line-strong" /><div className="h-3 w-1/2 rounded-full bg-line-strong" /><div className="h-3 w-2/3 rounded-full bg-line-strong" />
      </div>
      <div className="absolute inset-0 flex flex-col items-start justify-center gap-2 bg-gradient-to-r from-surface via-surface/90 to-surface/40 p-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-night px-2.5 py-1 text-xs font-semibold text-lime">🔒 {p?.name}</span>
        <p className="max-w-md">{children}</p>
        <Link href="/precios" className="rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-white hover:bg-brass-soft">Desbloquear por {p?.price}</Link>
      </div>
    </div>
  );
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ a?: string; pago?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  if (!athletes.length) {
    return (
      <>
        <PageHeader kicker="Mi plan" title="Tu plan" />
        <EmptyState title="Vincula primero a tu hijo o hija" action={<ButtonLink href="/app/family">Ir a Familia</ButtonLink>}>El plan se genera desde el Passport del atleta.</EmptyState>
      </>
    );
  }
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  const [plan, passport] = await Promise.all([familyPlan([session.userId, athlete.id]), loadPassport(athlete.id)]);
  const core = PLAN_RANK[plan] >= PLAN_RANK.family_core;
  const elite = PLAN_RANK[plan] >= PLAN_RANK.family_elite;
  const supabase = await createClient();
  const [shortlist, { data: docs }] = await Promise.all([
    core && passport.profile ? buildShortlist(passport.profile, passport.annualBudgetUsd) : Promise.resolve([]),
    supabase.from('athlete_documents').select('title, due_date, storage_path').eq('athlete_id', athlete.id).is('storage_path', null)
      .not('due_date', 'is', null).order('due_date').limit(8),
  ]);
  const pending = passport.readiness.items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight);
  const nextSat = SAT_DATES.filter((d) => daysUntil(d.deadline) >= 0).slice(0, 3);

  return (
    <>
      <PageHeader
        kicker="Mi plan"
        title={`Plan ${PLAN_NAME[plan]}`}
        description="Todo se genera desde el Passport y datos oficiales, y se actualiza solo cuando lo mejoras."
        action={!elite ? <ButtonLink href="/precios">Mejorar plan</ButtonLink> : undefined}
      />
      {sp.pago === 'ok' && <div className="mb-5"><Notice tone="ok">Pago recibido. El plan se activa en cuanto Stripe confirma el cobro (normalmente en segundos); si aún no lo ves, recarga la página.</Notice></div>}
      {athletes.length > 1 && (
        <nav className="mb-5 flex flex-wrap gap-2" aria-label="Atleta">
          {athletes.map((a) => <Link key={a.id} href={`/app/plan?a=${a.id}`} className={`rounded-full border px-3 py-1 text-sm ${a.id === athlete.id ? 'border-brass text-paper' : 'border-line text-muted'}`}>{a.name}</Link>)}
        </nav>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle kicker="1 · Informe del Passport" action={<span className="font-display text-3xl tabular-nums text-paper">{passport.readiness.score}%</span>}>Mejoras por impacto</CardTitle>
          <Meter value={passport.readiness.score} label="Passport listo para enviar" />
          {core ? (
            pending.length ? (
              <ol className="mt-4 space-y-2 text-sm">
                {pending.map((i, n) => (
                  <li key={i.key} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted"><span className="text-paper">{n + 1}.</span> {i.action}</span>
                    <Link href={i.href} className="shrink-0 text-xs text-brass hover:underline">+{i.weight} pts</Link>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4 text-sm text-ok">Tu Passport está completo.</p>
          ) : (
            <div className="mt-4"><Locked plan="family_core">El informe ordena todas las mejoras por el impacto que tienen en cómo te ve un coach.</Locked></div>
          )}
        </Card>

        <Card>
          <CardTitle kicker="2 · Sports CV">Currículum deportivo en inglés</CardTitle>
          <p className="text-sm text-muted">Generado desde tu Passport con el formato que esperan los coaches de EE. UU.: datos deportivos, académicos, inglés, vídeo y contacto a través de la plataforma.</p>
          <div className="mt-4">
            {core ? <ButtonLink href={`/print/cv?a=${athlete.id}`}>Abrir y guardar en PDF</ButtonLink> : <Locked plan="family_core">Tu Sports CV listo para enviar en un clic.</Locked>}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle kicker="3 · Lista automática">Universidades que encajan contigo</CardTitle>
          {!core ? (
            <Locked plan="family_core">Hasta 15 universidades reales del directorio oficial que ofrecen tu deporte, ordenadas por encaje y coste.</Locked>
          ) : !passport.profile?.sport_id ? (
            <p className="text-sm text-muted">Indica tu deporte en el <Link href="/app/athlete/passport" className="text-brass hover:underline">Passport</Link> para generarla.</p>
          ) : shortlist.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay universidades con tu deporte{passport.profile.target_divisions.length ? ' en tus divisiones objetivo' : ''} en el directorio. Prueba a ampliar divisiones.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead><tr className="text-left text-xs text-faint"><th className="py-2 pr-3 font-normal">Universidad</th><th className="pr-3 font-normal">División</th><th className="pr-3 text-right font-normal">Coste oficial/año</th><th className="pr-3 text-right font-normal">SAT medio</th><th className="font-normal">Encaje</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {shortlist.map((u) => (
                      <tr key={u.id}>
                        <td className="py-2.5 pr-3"><Link href={`/app/universities/${u.id}`} className="text-paper hover:text-brass">{u.name}</Link>{u.state && <span className="ml-1 text-xs text-faint">{u.state}</span>}</td>
                        <td className="pr-3 text-muted">{u.division ? DIVISION_LABEL[u.division] : '—'}</td>
                        <td className="pr-3 text-right tabular-nums text-muted">{usd(u.costUsd)}</td>
                        <td className="pr-3 text-right tabular-nums text-muted">{u.satAvg ?? '—'}</td>
                        <td><Badge tone={u.level === 'alto' ? 'ok' : u.level === 'bajo' ? 'danger' : 'neutral'}>{u.level}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-faint">Coste sin beca (College Scorecard). El encaje no es probabilidad de admisión ni de beca.</p>
                <Link href={`/app/universities/compare?ids=${shortlist.slice(0, 5).map((u) => u.id).join(',')}`} className="text-sm text-brass hover:underline">Comparar las 5 primeras →</Link>
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardTitle kicker="4 · Calendario">Exámenes y documentos</CardTitle>
          {!core ? (
            <Locked plan="family_core">Fechas de SAT y de cada documento calculadas según tu promoción.</Locked>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-faint">Próximos SAT (inscripción)</p>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {nextSat.map((d) => <li key={d.test}>Examen {d.test} · inscríbete antes del {d.deadline} <span className="text-faint">(tardía {d.late})</span></li>)}
              </ul>
              <p className="mt-2 text-xs text-faint">Solo si alguna universidad o beca académica lo pide: la NCAA no lo exige. <Link href="/app/academia" className="text-brass hover:underline">Preparar en la Academia</Link></p>
              <p className="mt-4 text-xs uppercase tracking-wide text-faint">Documentos pendientes</p>
              {(docs ?? []).length ? (
                <ul className="mt-1 space-y-1 text-sm text-muted">
                  {(docs ?? []).map((d) => <li key={d.title}>{d.due_date} · {d.title}</li>)}
                </ul>
              ) : athlete.canEdit ? (
                <form action={seedDocumentChecklist} className="mt-2">
                  <input type="hidden" name="athlete_id" value={athlete.id} />
                  <button className="text-sm text-brass hover:underline">Generar el calendario de documentos</button>
                </form>
              ) : <p className="mt-1 text-sm text-muted">Sin documentos pendientes con fecha.</p>}
              <Link href={`/app/documents?a=${athlete.id}`} className="mt-3 inline-block text-sm text-brass hover:underline">Abrir el centro de documentos →</Link>
            </>
          )}
        </Card>

        <Card>
          <CardTitle kicker="5 · Decisión">Ofertas, memo y visado</CardTitle>
          {elite ? (
            <ul className="space-y-2 text-sm">
              <li><Link href={`/app/offers?a=${athlete.id}`} className="text-brass hover:underline">Comparador de ofertas y memo de decisión →</Link></li>
              <li><Link href={`/app/documents?a=${athlete.id}`} className="text-brass hover:underline">Checklist de visado y llegada (I-20, SEVIS, DS-160) →</Link></li>
            </ul>
          ) : (
            <Locked plan="family_elite">Compara hasta 5 ofertas, obtén un memo con la opción más sólida y prepara el visado con fechas.</Locked>
          )}
          {plan === 'family_signature' && <div className="mt-4"><Notice tone="brass">Tienes Signature: Gala te acompaña personalmente. Escríbele desde los datos de contacto que recibiste al confirmar tu plaza.</Notice></div>}
        </Card>
      </div>
    </>
  );
}
