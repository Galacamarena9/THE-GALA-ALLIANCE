import { getT } from '@/lib/i18n/server-t';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { currentRecruitOrg } from '@/lib/data/recruit';
import { EmptyState, Notice, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { TrialsBoard, type TrialSummary } from '@/components/trials/TrialsBoard';
import { CLUB_TYPES } from '@/lib/domain/trials';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Trials') };
}

type Tab = 'upcoming' | 'applications' | 'past';
/** Un trial es «pasado» 12 h después de empezar (el día del trial sigue en «Próximos» para hacer check-in). */
function pastCheck() {
  const now = Date.now();
  return (t: TrialSummary) => !!t.start_at && new Date(t.start_at).getTime() < now - 12 * 3600_000;
}
const TYPES: readonly string[] = CLUB_TYPES;

/**
 * Trials del club en el móvil: próximos, candidaturas por revisar y pasados. Todos los recuentos salen de datos reales
 * (inscripciones, candidaturas y materiales) con 3 consultas agregadas en total, no una por trial.
 */
export default async function ClubTrialsPage({ searchParams }: { searchParams: Promise<{ org?: string; tab?: string }> }) {
  const tx = await getT();
  const session = await requireSession();
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'applications' || sp.tab === 'past' ? sp.tab : 'upcoming';
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const supabase = await createClient();

  let trials: TrialSummary[] = [];
  let failed = false;
  if (org) {
    const { data: opps, error } = await supabase.from('opportunities')
      .select('id, title, type, status, start_at, timezone, city, venue_name')
      .eq('organization_id', org.id).in('type', TYPES as string[]).neq('status', 'archived')
      .order('start_at', { ascending: true, nullsFirst: false }).limit(60);
    failed = !!error;
    const ids = (opps ?? []).map((o) => o.id);
    const [{ data: regs }, { data: apps }] = ids.length ? await Promise.all([
      supabase.from('opportunity_registrations').select('opportunity_id, status, materials_status').in('opportunity_id', ids),
      supabase.from('applications').select('opportunity_id, status').in('opportunity_id', ids),
    ]) : [{ data: [] }, { data: [] }];
    trials = (opps ?? []).map((o) => {
      const r = (regs ?? []).filter((x) => x.opportunity_id === o.id);
      const a = (apps ?? []).filter((x) => x.opportunity_id === o.id);
      const active = r.filter((x) => ['pending', 'registered', 'confirmed', 'waitlisted'].includes(x.status));
      return {
        id: o.id, title: o.title, type: o.type as string, status: o.status as string, start_at: o.start_at, timezone: o.timezone,
        place: [o.venue_name, o.city].filter(Boolean).join(' · ') || null,
        confirmed: r.filter((x) => x.status === 'confirmed').length,
        pending: r.filter((x) => ['pending', 'registered'].includes(x.status)).length,
        waitlist: r.filter((x) => x.status === 'waitlisted').length,
        missingDocs: active.filter((x) => x.materials_status && x.materials_status !== 'complete' && x.materials_status !== 'not_required').length,
        toReview: a.filter((x) => ['applied', 'reviewed', 'information_requested'].includes(x.status)).length,
      };
    });
  }
  const isPast = pastCheck();
  const shown = tab === 'past' ? trials.filter(isPast).reverse()
    : tab === 'applications' ? trials.filter((t) => t.toReview > 0)
    : trials.filter((t) => !isPast(t));
  const counts = { upcoming: trials.filter((t) => !isPast(t)).length, applications: trials.filter((t) => t.toReview > 0).length, past: trials.filter(isPast).length };
  const href = (t: Tab) => `/app/recruit/trials?tab=${t}${sp.org ? `&org=${sp.org}` : ''}`;

  return (
    <>
      <PageHeader kicker={tx('Recruiting')} title={tx('Trials')} description={tx('Próximos trials, candidaturas por revisar y seguimiento después de cada prueba.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/trials">
        {org && (
          <div className="space-y-4">
            <nav aria-label={tx('Vista de trials')} className="grid grid-cols-3 gap-1 rounded-full border border-line p-1 text-sm">
              {(['upcoming', 'applications', 'past'] as const).map((t) => (
                <Link key={t} href={href(t)} aria-current={tab === t ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center justify-center rounded-full px-2 font-semibold ${tab === t ? 'bg-brass text-ink' : 'text-muted'}`}>
                  {t === 'upcoming' ? tx('Próximos') : t === 'applications' ? tx('Candidaturas') : tx('Pasados')} <span className="ml-1 text-xs opacity-80">{counts[t]}</span>
                </Link>
              ))}
            </nav>
            {failed ? <Notice tone="danger">{tx('No se han podido cargar los trials. Vuelve a intentarlo.')}</Notice>
          : shown.length ? <TrialsBoard trials={shown} past={tab === 'past'} />
              : <EmptyState title={tab === 'applications' ? tx('No hay candidaturas pendientes') : tab === 'past' ? tx('Aún no hay trials pasados') : tx('No hay trials próximos')}>
                  {tab === 'upcoming' ? <>{tx('Publica un trial o un programa desde')}{' '}<Link href="/app/opportunities/new" className="text-brass underline">{tx('Nueva oportunidad')}</Link>.</> : tx('Aparecerán aquí cuando existan.')}
                </EmptyState>}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
