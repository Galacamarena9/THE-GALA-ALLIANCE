'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';

const taskInput = z.object({
  key: z.string().regex(/^[a-z_]+(:[A-Za-z0-9_-]+)?$/).max(80),
  action: z.enum(['done', 'snooze', 'dismiss', 'reopen']),
  priority: z.enum(['urgent', 'important', 'recommended']).optional(),
});

/** Completar, posponer 3 días, descartar o reabrir una tarea del panel. */
export async function setTaskState(formData: FormData) {
  const session = await requireSession(['athlete']);
  const t = taskInput.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  if (t.action === 'reopen') {
    await supabase.from('athlete_task_state').delete().eq('athlete_id', session.userId).eq('task_key', t.key);
  } else {
    const until = new Date(); until.setDate(until.getDate() + 3);
    await supabase.from('athlete_task_state').upsert({
      athlete_id: session.userId, task_key: t.key,
      status: t.action === 'done' ? 'done' : t.action === 'snooze' ? 'snoozed' : 'dismissed',
      snoozed_until: t.action === 'snooze' ? until.toISOString().slice(0, 10) : null,
    });
    if (t.action === 'done') await logEvent('task_completed', { task: t.key.split(':')[0], priority: t.priority ?? 'recommended' });
  }
  revalidatePath('/app');
}

/** Marcar un aviso concreto como leído o no leído. */
export async function toggleNotificationRead(formData: FormData) {
  const session = await requireSession();
  const id = z.coerce.number().int().positive().parse(formData.get('id'));
  const read = formData.get('read') === '1';
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: read ? new Date().toISOString() : null }).eq('id', id).eq('user_id', session.userId);
  revalidatePath('/app/notifications');
  revalidatePath('/app');
}

const CATEGORIES = ['messages', 'applications', 'deadlines', 'matches', 'platform'] as const;
const FAMILY_CATEGORIES = ['family_process', 'family_offers'] as const;

/** Preferencias de avisos: cada categoría se activa o silencia. Lo esencial (familia, seguridad) no se puede silenciar. */
export async function saveNotificationPreferences(formData: FormData) {
  const session = await requireSession();
  const supabase = await createClient();
  const cats = [...CATEGORIES, ...(session.roles.includes('parent') ? FAMILY_CATEGORIES : [])];
  const rows = cats.map((c) => ({ user_id: session.userId, category: c, in_app: formData.get(c) === 'on', updated_at: new Date().toISOString() }));
  await supabase.from('notification_preferences').upsert(rows);
  revalidatePath('/app/notifications');
}
