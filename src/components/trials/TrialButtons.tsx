'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clubTrialAction, decideApplication, enrollmentAction, registerForTrial, respondInvitation, respondTrial, type TrialResult } from '@/app/actions/trials';

type Call =
  | { kind: 'register'; opportunity: string; athlete: string; agency?: string }
  | { kind: 'respond'; registration: string; action: 'confirm_cost' | 'guardian_approve' | 'guardian_decline' | 'withdraw'; opportunity?: string }
  | { kind: 'invite'; invitation: string; action: 'viewed' | 'interested' | 'declined' | 'guardian_approve'; reason?: 'timing' | 'location' | 'cost' | 'not_interested' | 'other'; opportunity?: string }
  | { kind: 'decide'; application: string; decision: 'reviewed' | 'information_requested' | 'accepted' | 'waitlisted' | 'declined'; message?: string; opportunity?: string }
  | { kind: 'enrollment'; enrollment: string; action: 'accept' | 'decline' | 'guardian_approve' | 'guardian_decline' | 'withdraw' | 'enroll' | 'activate' | 'complete' | 'cancel'; opportunity?: string }
  | { kind: 'club'; registration: string; action: 'confirm' | 'waitlist' | 'decline' | 'check_in' | 'attended' | 'no_show' | 'partial' | 'outcome';
      outcome?: 'no_further_action' | 'follow_up' | 'invite_again' | 'start_recruiting_process' | 'closed'; athleteMessage?: string; opportunity?: string };

/**
 * Botón de acción de trial con resultado real (nunca dice «hecho» si la base de datos lo rechazó).
 * `confirm`: texto de confirmación para acciones con consecuencias (coste, retirarse, rechazar).
 */
export function TrialButton({ call, label, confirm, variant = 'secondary' }: { call: Call; label: string; confirm?: string; variant?: 'primary' | 'secondary' | 'danger' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  const [res, setRes] = useState<TrialResult | null>(null);
  const run = () => start(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setRes({ ok: false, message: 'Necesitas conexión para completar esta acción.' });
      return;
    }
    const r = call.kind === 'register' ? await registerForTrial(call)
      : call.kind === 'respond' ? await respondTrial(call)
      : call.kind === 'invite' ? await respondInvitation(call)
      : call.kind === 'decide' ? await decideApplication(call)
      : call.kind === 'enrollment' ? await enrollmentAction(call)
      : await clubTrialAction(call);
    setRes(r); setAsk(false);
    if (r.ok) router.refresh();
  });
  const cls = variant === 'primary' ? 'bg-brass text-ink hover:brightness-110' : variant === 'danger' ? 'border border-line text-muted hover:border-danger hover:text-danger' : 'border border-line-strong text-paper hover:border-brass hover:text-brass';
  if (res?.ok) return <span role="status" className="text-xs font-semibold text-ok">✓ {res.message}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {ask ? (
        <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-paper">
          {confirm}
          <button type="button" disabled={pending} onClick={run} className="rounded-full bg-brass px-3 py-1 font-semibold text-ink">{pending ? '…' : 'Confirmar'}</button>
          <button type="button" onClick={() => setAsk(false)} className="text-muted underline">Cancelar</button>
        </span>
      ) : (
        <button type="button" disabled={pending} onClick={() => (confirm ? setAsk(true) : run())} className={`min-h-10 rounded-full px-4 text-xs font-semibold ${cls}`}>{pending ? '…' : label}</button>
      )}
      {res && !res.ok && <span role="alert" className="text-xs text-danger">{res.message}</span>}
    </span>
  );
}
