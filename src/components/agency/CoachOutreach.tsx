'use client';

import { useActionState, useState } from 'react';
import { prepareOutreach, markOutreach, type PrepareState } from '@/app/actions/coach-outreach';
import { OUTREACH_STATUS_LABEL, awaitingTooLong, replyRate, type OutreachStatus } from '@/lib/domain/coach-outreach';
import { Badge, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export interface OutreachRow {
  id: string; toEmail: string; subject: string; status: OutreachStatus; sentAt: string | null; repliedAt: string | null;
  note: string | null; createdAt: string; views: number; lastViewedAt: string | null; linkActive: boolean;
}
type ContactOpt = { id: string; name: string; email: string | null };

const TONE: Record<OutreachStatus, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  draft: 'neutral', sent: 'warn', replied: 'ok', no_reply: 'neutral', bounced: 'danger',
};
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function MarkButton({ id, caseId, status, label, withNote }: { id: string; caseId: string; status: string; label: string; withNote?: boolean }) {
  return (
    <form action={markOutreach} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="status" value={status} />
      {withNote && <input name="note" maxLength={1000} placeholder="Qué ha dicho (opcional)" aria-label="Qué ha dicho el coach" className={`${inputClass} min-h-9 w-56 text-xs`} />}
      <button className="min-h-9 rounded-full border border-line-strong px-3 text-xs font-semibold text-paper hover:border-brass" data-testid={`outreach-${status}`}>{label}</button>
    </form>
  );
}

function Prepared({ p }: { p: NonNullable<PrepareState['prepared']> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-brass/40 bg-brass/5 p-4" data-testid="outreach-prepared">
      <p className="mb-2 text-sm font-semibold text-paper">Email listo para {p.to}</p>
      <p className="mb-3 text-xs text-muted">Ábrelo en tu correo, revísalo y envíalo. Después pulsa «Ya lo he enviado» en la lista de abajo.</p>
      <div className="flex flex-wrap gap-2">
        <a href={p.mailto} className="inline-flex min-h-10 items-center rounded-full bg-brass px-4 text-sm font-semibold text-ink">Abrir en mi correo</a>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${p.subject}\n\n${p.body}`); setCopied(true); }}
          className="min-h-10 rounded-full border border-line-strong px-4 text-sm font-semibold text-paper hover:border-brass">
          {copied ? 'Copiado' : 'Copiar asunto y texto'}
        </button>
      </div>
      <p className="mt-3 break-all text-xs text-faint">Enlace privado al Passport: {p.link}</p>
    </div>
  );
}

export function CoachOutreach({ caseId, canSend, blockedReason, contacts, defaultContactId, draft, rows, ncaaNote, now }: {
  caseId: string; canSend: boolean; blockedReason?: string | null; contacts: ContactOpt[]; defaultContactId: string | null;
  draft: { subject: string; body: string }; rows: OutreachRow[]; ncaaNote?: string | null; now: string;
}) {
  const [state, action] = useActionState<PrepareState, FormData>(prepareOutreach, {});
  const [contactId, setContactId] = useState(defaultContactId ?? '');
  const contactEmail = contacts.find((c) => c.id === contactId)?.email ?? '';
  const rate = replyRate(rows);
  const nowDate = new Date(now);

  return (
    <div className="space-y-5">
      {rate.sent > 0 && (
        <p className="text-sm text-muted" data-testid="outreach-rate">
          {rate.sent} {rate.sent === 1 ? 'email enviado' : 'emails enviados'} · {rate.replied} con respuesta
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3" aria-label="Emails a coaches">
          {rows.map((r) => {
            const late = awaitingTooLong(r, nowDate);
            return (
              <li key={r.id} className="rounded-xl border border-line p-3" data-testid="outreach-row" data-status={r.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm text-paper">{r.subject}</p>
                  <Badge tone={late ? 'danger' : TONE[r.status]}>{late ? 'Sin respuesta aún' : OUTREACH_STATUS_LABEL[r.status]}</Badge>
                </div>
                <p className="mt-1 text-xs text-faint">
                  {r.toEmail}
                  {r.sentAt ? ` · enviado el ${day(r.sentAt)}` : ` · preparado el ${day(r.createdAt)}`}
                  {r.repliedAt ? ` · respondió el ${day(r.repliedAt)}` : ''}
                  {' · '}
                  {r.views ? `perfil abierto ${r.views} ${r.views === 1 ? 'vez' : 'veces'} (última: ${day(r.lastViewedAt)})` : 'perfil sin abrir'}
                  {!r.linkActive ? ' · enlace desactivado' : ''}
                </p>
                {r.note && <p className="mt-1 text-xs text-muted">«{r.note}»</p>}
                {canSend && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === 'draft' && <MarkButton id={r.id} caseId={caseId} status="sent" label="Ya lo he enviado" />}
                    {(r.status === 'sent' || r.status === 'no_reply') && <MarkButton id={r.id} caseId={caseId} status="replied" label="Ha respondido" withNote />}
                    {r.status === 'sent' && <MarkButton id={r.id} caseId={caseId} status="no_reply" label="Sin respuesta" />}
                    {r.status === 'sent' && <MarkButton id={r.id} caseId={caseId} status="bounced" label="Ha rebotado" />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {state.prepared && <Prepared p={state.prepared} />}

      {canSend ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="case_id" value={caseId} />
          {ncaaNote && <p className="rounded-lg border border-line bg-surface-2 p-3 text-xs text-muted">{ncaaNote}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Coach" htmlFor="co-contact">
              <select id="co-contact" name="contact_id" className={inputClass} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Otro (escribe su email)</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Email del coach" htmlFor="co-email" hint={contactEmail ? 'El del contacto elegido.' : undefined}>
              <input id="co-email" name="to_email" type="email" key={contactId} defaultValue={contactEmail} maxLength={254} className={inputClass} placeholder="coach@university.edu" />
            </Field>
          </div>
          <Field label="Asunto (en inglés)" htmlFor="co-subject">
            <input id="co-subject" name="subject" required maxLength={200} defaultValue={draft.subject} className={inputClass} />
          </Field>
          <Field label="Mensaje (en inglés)" htmlFor="co-body" hint="{{passport_link}} se cambia por el enlace privado al Passport al preparar el email.">
            <textarea id="co-body" name="body" required rows={12} maxLength={4800} defaultValue={draft.body} className={`${inputClass} font-mono text-xs leading-relaxed`} />
          </Field>
          <div className="flex items-center gap-3">
            <SubmitButton>Preparar email</SubmitButton>
            {state.error && <span className="text-xs text-danger" role="alert">{state.error}</span>}
          </div>
        </form>
      ) : (
        blockedReason && <p className="text-sm text-muted" data-testid="outreach-blocked">{blockedReason}</p>
      )}
    </div>
  );
}
