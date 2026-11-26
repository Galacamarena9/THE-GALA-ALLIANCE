'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyToTrial, inviteToTrial, type TrialResult } from '@/app/actions/trials';
import { useT } from '@/lib/i18n/client';

const btn = 'min-h-10 rounded-full px-4 text-xs font-semibold';
const primary = `${btn} bg-brass text-ink hover:brightness-110 disabled:opacity-60`;
const secondary = `${btn} border border-line-strong text-paper hover:border-brass hover:text-brass`;
const field = 'w-full rounded-xl border border-line bg-ink/40 px-3 py-2 text-sm text-paper';

function offline(): TrialResult | null {
  return typeof navigator !== 'undefined' && !navigator.onLine ? { ok: false, message: 'Necesitas conexión para completar esta acción.' } : null;
}

/**
 * Candidatura a un trial «primero candidatura» desde la propia ficha del trial.
 * Mensaje opcional; si es menor, se avisa antes de enviar de que la familia aprobará la participación.
 */
export function TrialApplyForm({ opportunityId, isMinor }: { opportunityId: string; isMinor: boolean }) {
  const tx = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [res, setRes] = useState<TrialResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok) return <p role="status" className="text-sm font-semibold text-ok">✓ {tx(res.message)}</p>;
  const send = () => start(async () => {
    const r = offline() ?? await applyToTrial({ opportunity: opportunityId, message: message.trim() || undefined });
    setRes(r);
    if (r.ok) router.refresh();
  });
  return (
    <div className="w-full space-y-2">
      <p className="text-sm text-muted">{tx('Primero presenta tu candidatura; si el club la acepta, quedarás inscrito en el trial.')}</p>
      {isMinor && <p className="text-xs text-warn">{tx('Eres menor: si el club te acepta, tu familia tendrá que aprobar tu participación antes de que se confirme la plaza.')}</p>}
      {open ? (
        <div className="space-y-2">
          <label htmlFor={`trial-apply-${opportunityId}`} className="block text-xs text-faint">{tx('Mensaje para el club (opcional)')}</label>
          <textarea id={`trial-apply-${opportunityId}`} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={tx('Por qué te interesa, tu disponibilidad, enlace a un partido completo…')} className={field} />
          <p className="text-[11px] text-faint">{tx('El club verá tu Passport. Tus documentos privados no se comparten sin tu permiso (o el de tu familia, si eres menor).')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={send} className={primary}>{pending ? '…' : tx('Enviar candidatura')}</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted underline">{tx('Cancelar')}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={primary}>{tx('Presentar candidatura')}</button>
      )}
      {res && !res.ok && <p role="alert" className="text-xs text-danger">{tx(res.message)}</p>}
    </div>
  );
}

export type InvitableTrial = { id: string; title: string; when: string };

/**
 * «Invitar a prueba»: solo para staff de clubes y academias verificados (la página decide si se muestra).
 * Selector de trials publicados + mensaje opcional. La invitación no es una oferta y, si es menor, la familia aprueba.
 */
export function InviteToTrialButton({ athleteId, trials, isMinor, source = 'discovery' }: {
  athleteId: string; trials: InvitableTrial[]; isMinor: boolean; source?: 'discovery' | 'shortlist' | 'recruiting_need' | 'gala_match';
}) {
  const tx = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trial, setTrial] = useState(trials[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [res, setRes] = useState<TrialResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok) return <p role="status" className="text-sm font-semibold text-ok">✓ {tx(res.message)}</p>;
  if (!trials.length) return <p className="text-xs text-faint">{tx('Para invitar a prueba, publica antes un trial de tu club.')}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={secondary}>{tx('Invitar a prueba')}</button>;
  const send = () => start(async () => {
    const r = offline() ?? await inviteToTrial({ opportunity: trial, athlete: athleteId, source, message: message.trim() || undefined });
    setRes(r);
    if (r.ok) router.refresh();
  });
  return (
    <div className="w-full max-w-md space-y-3 rounded-xl border border-line bg-ink/40 p-4">
      <div>
        <label htmlFor={`invite-trial-${athleteId}`} className="mb-1 block text-xs text-faint">{tx('Trial')}</label>
        <select id={`invite-trial-${athleteId}`} value={trial} onChange={(e) => setTrial(e.target.value)} className={field}>
          {trials.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.when}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`invite-msg-${athleteId}`} className="mb-1 block text-xs text-faint">{tx('Mensaje (opcional)')}</label>
        <textarea id={`invite-msg-${athleteId}`} rows={3} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
        <p className="mt-1 text-[11px] text-faint">{isMinor
          ? tx('Es menor: su familia verá la invitación y tendrá que aprobar la participación.')
          : tx('Verá fecha, lugar y coste del trial. Una invitación no es una oferta.')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || !trial} onClick={send} className={primary}>{pending ? '…' : tx('Enviar invitación')}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted underline">{tx('Cancelar')}</button>
      </div>
      {res && !res.ok && <p role="alert" className="text-xs text-danger">{tx(res.message)}</p>}
    </div>
  );
}
