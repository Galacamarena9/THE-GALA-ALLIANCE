'use server';

import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from '@/app/actions/auth';

const target = z.object({ blocked_id: z.string().uuid(), reason: z.string().trim().max(500).optional(), back: z.string().optional() });

/** Bloquea a una persona: deja de ver tu perfil (si eres atleta o su familia) y nadie de los dos puede escribir. */
export async function blockUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = target.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.blocked_id === session.userId) return { error: 'No se ha podido bloquear.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: session.userId, blocked_id: parsed.data.blocked_id, reason: parsed.data.reason || null }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) return { error: 'No se ha podido bloquear. Inténtalo de nuevo.' };
  revalidatePath('/app/inbox', 'layout');
  revalidatePath('/app/settings');
  return { ok: true, message: 'Bloqueado. No podréis escribiros y, si eres atleta, ya no verá tu perfil. Puedes deshacerlo en Ajustes.' };
}

export async function unblockUser(formData: FormData) {
  const session = await requireSession();
  const parsed = target.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  must(await supabase.from('user_blocks').delete().eq('blocker_id', session.userId).eq('blocked_id', parsed.data.blocked_id), 'user_blocks.delete');
  revalidatePath('/app/settings');
  revalidatePath('/app/inbox', 'layout');
}
