'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

const TYPES = ['federation_license', 'league_registration', 'jurisdiction_registration', 'professional_certification', 'other'] as const;

/** Prompt 12 · El agente declara una credencial. Solo la revisión de Gala la convierte en «verificada». */
export async function addCredential(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['agent']);
  const p = z.object({
    issuing_body: z.string().trim().min(2).max(160),
    credential_type: z.enum(TYPES),
    credential_number: z.string().trim().max(80).optional().transform((v) => v || null),
    country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().or(z.literal('')).transform((v) => v || null),
    expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform((v) => v || null),
    organization_id: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Revisa el organismo emisor, el tipo y el país (código de 2 letras).' };
  const supabase = await createClient();
  const { error } = await supabase.from('professional_credentials').insert({ ...p.data, user_id: session.userId });
  if (error) return { error: 'No se ha podido guardar la credencial.' };
  revalidatePath('/app/verify');
  return { ok: true, message: 'Credencial guardada como «declarada». Pide la verificación cuando tengas el documento.' };
}

export async function submitCredential(formData: FormData) {
  await requireSession(['agent']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc('credential_submit', { p_credential: id.data });
  revalidatePath('/app/verify');
}
