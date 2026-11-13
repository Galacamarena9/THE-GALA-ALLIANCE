'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';

const saveSchema = z.object({
  athlete_id: z.string().uuid(),
  list_name: z.string().trim().min(1).max(80).default('Shortlist'),
});

export async function saveAthlete(formData: FormData) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const parsed = saveSchema.safeParse({ athlete_id: formData.get('athlete_id'), list_name: formData.get('list_name') || 'Shortlist' });
  if (!parsed.success) return;
  const supabase = await createClient();
  // La RLS solo permite guardar a quien puedes ver (p. ej. una marca nunca guarda a un menor).
  await supabase.from('saved_athletes').upsert({ owner_id: session.userId, ...parsed.data }, { onConflict: 'owner_id,athlete_id,list_name', ignoreDuplicates: true });
  revalidatePath('/app/discover');
  revalidatePath('/app/lists');
}

export async function removeSavedAthlete(formData: FormData) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const parsed = saveSchema.safeParse({ athlete_id: formData.get('athlete_id'), list_name: formData.get('list_name') || 'Shortlist' });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('saved_athletes').delete().eq('owner_id', session.userId).eq('athlete_id', parsed.data.athlete_id).eq('list_name', parsed.data.list_name);
  revalidatePath('/app/lists');
  revalidatePath('/app/discover');
}

export async function updateSavedNote(formData: FormData) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const parsed = z
    .object({ athlete_id: z.string().uuid(), list_name: z.string().min(1).max(80), private_note: z.string().max(2000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from('saved_athletes')
    .update({ private_note: parsed.data.private_note || null })
    .eq('owner_id', session.userId)
    .eq('athlete_id', parsed.data.athlete_id)
    .eq('list_name', parsed.data.list_name);
  revalidatePath('/app/lists');
}
