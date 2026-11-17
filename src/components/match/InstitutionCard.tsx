import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import type { ScoredInstitution } from '@/lib/data/gala-match';
import { estimatedIntlCost, STATE_NAME, usdFmt } from '@/lib/domain/gala-match/engine';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { ConfidenceBadge, DimensionChips, HideButton, MatchScore, SaveButton } from './MatchParts';

/** Tarjeta de universidad con su Gala Match (la usan el directorio y Gala Match: un solo componente). */
export function InstitutionCard({ x, showHide = true }: { x: ScoredInstitution; showHide?: boolean }) {
  const { inst, m } = x;
  const cost = estimatedIntlCost(inst);
  const program = m.why.find((w) => w.id === 'program');
  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        <MatchScore m={m} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold uppercase leading-tight text-paper">{inst.name}</h2>
          <p className="text-sm text-muted">{[inst.city, STATE_NAME(inst.state)].filter(Boolean).join(', ')}{inst.division && ` · ${DIVISION_LABEL[inst.division as keyof typeof DIVISION_LABEL]}`}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><ConfidenceBadge m={m} />{x.activeOpps > 0 && <span className="rounded-full bg-brass px-2.5 py-0.5 text-[11px] font-semibold text-ink">{x.activeOpps} oportunidad{x.activeOpps > 1 ? 'es' : ''} activa{x.activeOpps > 1 ? 's' : ''}</span>}{m.blocked && <span className="rounded-full border border-danger/40 px-2.5 py-0.5 text-[11px] font-semibold text-danger">No encaja ahora</span>}</div>
        </div>
      </div>
      <DimensionChips m={m} />
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-faint">Coste publicado est.</dt><dd className="text-paper">{cost != null ? `${usdFmt(cost)}/año · sin becas` : 'No publicado'}</dd></div>
        <div><dt className="text-faint">Tus estudios</dt><dd className="text-paper">{program ? (program.status === 'met' ? 'Disponibles' : 'Relacionados') : 'Sin datos'}</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Link href={`/app/universities/${inst.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-paper px-4 text-sm font-semibold text-ink">Ver universidad<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        <Link href={`/app/match/institution/${inst.id}`} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm text-muted hover:text-paper">Ver match</Link>
        <SaveButton kind="institution" id={inst.id} saved={x.saved} score={m.score} />
        <Link href={`/app/universities/compare?ids=${inst.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:text-paper"><Scale className="h-4 w-4" aria-hidden />Comparar</Link>
        {showHide && <HideButton kind="institution" id={inst.id} score={m.score} />}
      </div>
    </article>
  );
}

