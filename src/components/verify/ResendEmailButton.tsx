'use client';

import { useState, useTransition } from 'react';
import { resendVerificationEmail } from '@/app/actions/verification';

/** Reenviar el enlace: solo dice «enviado» si el servidor lo confirma. */
export function ResendEmailButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await resendVerificationEmail(id); setMsg({ ok: r.ok, text: r.message }); })}
        className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold text-paper">{pending ? 'Enviando…' : 'Reenviar enlace'}</button>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? 'text-ok' : 'text-muted'}`}>{msg.text}</p>}
    </div>
  );
}
