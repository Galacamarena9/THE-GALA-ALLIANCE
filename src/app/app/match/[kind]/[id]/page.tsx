import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { loadAthleteContext, loadOneMatch } from '@/lib/data/gala-match';
import { recordMatchView } from '@/app/actions/match';
import { logEvent } from '@/lib/events';
import { STATE_NAME, estimatedIntlCost, usdFmt } from '@/lib/domain/gala-match/engine';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { ConfidenceBadge, HideButton, MatchBreakdownV2, MatchScore, SaveButton } from '@/components/match/MatchParts';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Tu match' };

export default async function MatchDetailPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireSession(['athlete']);
  const { kind, id } = await params;
  if ((kind !== 'institution' && kind !== 'opportunity') || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const loaded = await loadAthleteContext(session.userId);
  if (!loaded) return <Notice tone="warn">Completa tu Passport para ver tu encaje.</Notice>;
  const r = await loadOneMatch(session.userId, loaded.ctx, kind, id);
  if (!r) notFound();
  await recordMatchView(kind, id, r.m.score);
  await logEvent('match_viewed', { kind });

  const title = r.kind === 'opportunity' ? r.opp!.title : r.inst!.name;
  const sub = r.kind === 'opportunity'
    ? [r.opp!.org_name, r.opp!.division && DIVISION_LABEL[r.opp!.division as keyof typeof DIVISION_LABEL]].filter(Boolean).join(' · ')
    : [r.inst!.city, STATE_NAME(r.inst!.state), r.inst!.division && DIVISION_LABEL[r.inst!.division as keyof typeof DIVISION_LABEL]].filter(Boolean).join(' · ');
  const cost = r.inst ? estimatedIntlCost(r.inst) : null;

  return (
    <>
      <Link href={`/app/match?tab=${kind === 'opportunity' ? 'oportunidades' : 'universidades'}`} className="text-sm text-brass hover:underline">← Tus matches</Link>
      <header className="carbon mb-6 mt-3 rounded-[28px] p-5 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <MatchScore m={r.m} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-lime">Your match</p>
            <h1 className="mt-1 font-display text-3xl font-bold uppercase leading-none text-white sm:text-5xl">{title}</h1>
            <p className="mt-2 text-sm text-white/75">{sub}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><ConfidenceBadge m={r.m} />{r.m.blocked && <span className="rounded-full border border-danger/50 px-2.5 py-0.5 text-[11px] font-semibold text-danger">No encaja ahora</span>}{cost != null && <span className="text-xs text-white/70">Coste publicado est.: {usdFmt(cost)}/año (sin becas)</span>}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <SaveButton kind={r.kind} id={id} saved={r.saved} score={r.m.score} />
          {r.kind === 'opportunity' && <Link href={`/app/opportunities/${id}`} className="inline-flex min-h-10 items-center rounded-full bg-lime px-4 text-sm font-bold text-[#0a0a0c]">Ver oportunidad</Link>}
          {r.inst && <Link href={`/app/universities/${r.inst.id}`} className="inline-flex min-h-10 items-center rounded-full px-4 text-sm text-white ring-1 ring-white/25 hover:bg-white/10">Ver universidad</Link>}
          <HideButton kind={r.kind} id={id} score={r.m.score} hidden={r.hidden} />
        </div>
      </header>
      <MatchBreakdownV2 m={r.m} />
    </>
  );
}
