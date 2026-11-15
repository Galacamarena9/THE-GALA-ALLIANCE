'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { Field, Notice, inputClass } from '@/components/ui';

export function MfaChallenge({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    const supabase = createBrowserSupabase();
    const { data: factors, error: lfErr } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === 'verified');
    if (lfErr || !factor) { setPending(false); setError('No encontramos tu verificación en dos pasos. Vuelve a iniciar sesión.'); return; }
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, '') });
    if (vErr) { setPending(false); setError('Código incorrecto o caducado. Espera al siguiente y vuelve a probar.'); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Código de 6 cifras" htmlFor="code">
        <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} text-center text-2xl tracking-[0.4em]`} />
      </Field>
      <button disabled={pending} className="h-11 w-full rounded-xl bg-brass text-sm font-semibold text-ink disabled:opacity-60">{pending ? 'Comprobando…' : 'Verificar'}</button>
    </form>
  );
}
