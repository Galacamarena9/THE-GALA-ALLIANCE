'use client';

import { useActionState, useState } from 'react';
import { Ban } from 'lucide-react';
import { blockUser } from '@/app/actions/blocks';
import type { FormState } from '@/app/actions/auth';
import { Notice, inputClass } from '@/components/ui';

/** Bloquear a una persona, con confirmación en dos pasos y motivo opcional (solo lo ves tú). */
export function BlockButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(blockUser, undefined);
  if (state?.ok) return <Notice tone="ok">{state.message}</Notice>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
        <Ban className="h-4 w-4" aria-hidden /> Bloquear a {name}
      </button>
    );
  }
  return (
    <form action={action} className="w-full max-w-md space-y-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-4">
      <input type="hidden" name="blocked_id" value={userId} />
      <p className="text-sm font-semibold text-paper">¿Bloquear a {name}?</p>
      <p className="text-sm text-muted">No podréis escribiros. Si eres atleta (o su familia), dejará de ver tu perfil. No le avisaremos.</p>
      <label className="block text-xs font-medium text-muted" htmlFor={`reason-${userId}`}>Motivo (opcional, solo lo ves tú)</label>
      <input id={`reason-${userId}`} name="reason" maxLength={500} className={inputClass} />
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Bloqueando…' : 'Bloquear'}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line-strong px-4 py-2 text-sm text-paper">Cancelar</button>
      </div>
    </form>
  );
}
