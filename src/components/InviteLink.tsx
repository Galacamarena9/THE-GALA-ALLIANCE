'use client';

import { useActionState, useState } from 'react';
import { createFamilyInvitation } from '@/app/actions/family';
import type { FormState } from '@/app/actions/auth';
import { Button, Notice, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function InviteLink({ siteUrl, label }: { siteUrl: string; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(createFamilyInvitation, undefined);
  const [copied, setCopied] = useState(false);
  const url = state?.ok && state.message ? `${siteUrl}/invite/${state.message}` : null;

  return (
    <div>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {url ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Envía este enlace por WhatsApp o email. Caduca en 14 días y solo sirve una vez.</p>
          <div className="flex gap-2">
            <input readOnly value={url} className={inputClass} aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      ) : (
        <form action={action}>
          <SubmitButton pendingText="Creando enlace…">{label}</SubmitButton>
        </form>
      )}
    </div>
  );
}
