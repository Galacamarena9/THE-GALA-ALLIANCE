'use client';

import { useActionState } from 'react';
import { answerQuestion, askQuestion } from '@/app/actions/questions';
import type { FormState } from '@/app/actions/auth';
import { inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

function Feedback({ state }: { state: FormState }) {
  if (state?.ok) return <p className="text-xs text-ok" role="status">{state.message}</p>;
  if (state?.error) return <p className="text-xs text-danger" role="alert">{state.error}</p>;
  return null;
}

export function AskQuestionForm({ opportunityId }: { opportunityId: string }) {
  const [state, action] = useActionState<FormState, FormData>(askQuestion, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <label htmlFor="q-body" className="text-sm font-semibold text-paper">Haz una pregunta a la universidad</label>
      <textarea id="q-body" name="body" rows={2} maxLength={500} placeholder="Ej.: ¿Qué nivel de inglés pedís? ¿Cuándo son las pruebas?" className={inputClass} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Enviando…">Preguntar</SubmitButton>
        <span className="text-xs text-faint">Se publica sin tu nombre. No incluyas datos de contacto.</span>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function AnswerQuestionForm({ id, opportunityId }: { id: string; opportunityId: string }) {
  const [state, action] = useActionState<FormState, FormData>(answerQuestion, undefined);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <label className="sr-only" htmlFor={`a-${id}`}>Respuesta</label>
      <textarea id={`a-${id}`} name="answer" rows={2} maxLength={1500} placeholder="Tu respuesta será pública para todos los atletas." className={inputClass} />
      <SubmitButton pendingText="Publicando…">Responder</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
