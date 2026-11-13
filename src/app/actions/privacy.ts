'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

const schema = z.object({
  request_type: z.enum(['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability']),
  details: z.string().trim().max(2000).optional(),
});

/** Registra una solicitud de derechos RGPD. Plazo legal de respuesta: un mes. */
export async function submitDataRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  const { error } = await supabase.from('data_subject_requests').insert({
    user_id: session.userId,
    request_type: parsed.data.request_type,
    details: parsed.data.details || null,
  });
  if (error) return { error: 'No se ha podido registrar la solicitud.' };
  revalidatePath('/app/settings');
  return { ok: true, message: 'Solicitud registrada. Te responderemos en un plazo máximo de un mes.' };
}
