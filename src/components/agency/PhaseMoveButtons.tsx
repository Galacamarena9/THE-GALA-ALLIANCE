'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { phaseMove } from '@/lib/domain/agent-home';
import { moveCase } from '@/app/actions/agency-cases';

/**
 * Mover una tarjeta del tablero a la fase anterior o siguiente con botones (teclado y lector de pantalla incluidos),
 * sin tener que abrir el proceso. La escritura la valida la base de datos (RLS y rol de la agencia).
 */
export function PhaseMoveButtons({ caseId, stage, athleteName }: { caseId: string; stage: string; athleteName: string }) {
  const tx = useT();
  const prev = phaseMove(stage, 'prev');
  const next = phaseMove(stage, 'next');
  if (!prev && !next) return null;
  const btn = 'inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-2.5 text-xs font-semibold text-muted hover:border-brass hover:text-paper focus-visible:outline-2 focus-visible:outline-brass';
  return (
    <div className="mt-2 flex items-center justify-between gap-2" data-testid="case-phase-move">
      {prev ? (
        <form action={moveCase}>
          <input type="hidden" name="id" value={caseId} /><input type="hidden" name="stage" value={prev.stage} />
          <button className={btn} aria-label={tx(`Mover a ${athleteName} a la fase anterior: ${prev.label}`)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden />{tx(prev.label)}</button>
        </form>
      ) : <span />}
      {next && (
        <form action={moveCase}>
          <input type="hidden" name="id" value={caseId} /><input type="hidden" name="stage" value={next.stage} />
          <button className={btn} aria-label={tx(`Mover a ${athleteName} a la fase siguiente: ${next.label}`)}>{tx(next.label)}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
        </form>
      )}
    </div>
  );
}
