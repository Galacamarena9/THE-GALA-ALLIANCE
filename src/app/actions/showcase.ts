'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';

const entry = z.object({ event_id: z.string().uuid(), athlete_id: z.string().uuid() });

export async function joinShowcase(formData: FormData) {
  await requireSession();
  const p = entry.safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from('showcase_entries').upsert(p.data, { onConflict: 'event_id,athlete_id', ignoreDuplicates: true });
  revalidatePath('/app/showcase');
}

export async function leaveShowcase(formData: FormData) {
  await requireSession();
  const p = entry.safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from('showcase_entries').delete().eq('event_id', p.data.event_id).eq('athlete_id', p.data.athlete_id);
  revalidatePath('/app/showcase');
}

const event = z.object({
  title: z.string().trim().min(4).max(120),
  sport_id: z.string().trim().max(40).optional(),
  starts_at: z.string().min(10),
  ends_at: z.string().min(10),
});

/** Solo administración (lo impone también la base de datos). */
export async function createShowcaseEvent(formData: FormData) {
  await requireSession(['admin']);
  const p = event.safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from('showcase_events').insert({ ...p.data, sport_id: p.data.sport_id || null, starts_at: new Date(p.data.starts_at).toISOString(), ends_at: new Date(p.data.ends_at).toISOString() });
  revalidatePath('/app/showcase');
}
