'use client';

import { useActionState } from 'react';
import { writeRecommendation } from '@/app/actions/recommendations';
import type { FormState } from '@/app/actions/auth';
import { inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function RecommendationForm({ athleteId, organizationId, current }: { athleteId: string; organizationId: string; current?: string }) {
  const [state, action] = useActionState<FormState, FormData>(writeRecommendation, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <label className="sr-only" htmlFor={`rec-${athleteId}`}>Recomendación</label>
      <textarea id={`rec-${athleteId}`} name="body" rows={3} defaultValue={current} maxLength={1200} placeholder="Qué tipo de jugador y compañero es, cómo ha evolucionado y en qué destaca." className={inputClass} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Enviando…">{current ? 'Actualizar' : 'Enviar recomendación'}</SubmitButton>
        {state?.ok && <span className="text-xs text-ok" role="status">{state.message}</span>}
        {state?.error && <span className="text-xs text-danger" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}
