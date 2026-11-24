'use server';

import { must, bestEffort } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { GALA_MATCH_VERSION } from '@/lib/domain/gala-match/engine';
import { stampMatchAtSave } from '@/lib/data/gala-match';

const target = z.object({
  kind: z.enum(['institution', 'opportunity']),
  id: z.string().uuid(),
  score: z.union([z.literal(''), z.coerce.number().int().min(0).max(100)]).optional().transform((v) => (v === '' || v == null ? null : v)),
});

async function signal(athleteId: string, kind: string, id: string, s: string, score: number | null) {
  const supabase = await createClient();
  bestEffort(await supabase.from('match_signals').insert({ athlete_id: athleteId, target_kind: kind, target_id: id, signal: s, match_score: score, engine_version: GALA_MATCH_VERSION }), 'match_signals.insert');
}

/** Guardar / quitar (base del Opportunity Pipeline). */
export async function toggleSaved(formData: FormData) {
  const session = await requireSession(['athlete']);
  const t = target.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { data: existing } = await supabase.from('saved_items').select('id').eq('athlete_id', session.userId).eq('target_kind', t.kind).eq('target_id', t.id).maybeSingle();
  if (existing) {
    must(await supabase.from('saved_items').delete().eq('id', existing.id), 'saved_items.delete');
    await signal(session.userId, t.kind, t.id, 'unsaved', t.score);
  } else {
    // El encaje al guardar lo calcula el servidor (no se fía del valor que envía el navegador).
    const { error } = await supabase.from('saved_items').insert({ athlete_id: session.userId, target_kind: t.kind, target_id: t.id });
    if (!error) {
      const score = await stampMatchAtSave(session.userId, t.kind, t.id);
      await signal(session.userId, t.kind, t.id, 'saved', score ?? t.score);
      await logEvent(t.kind === 'institution' ? 'university_saved' : 'opportunity_saved');
    }
  }
  revalidatePath('/app', 'layout');
}

export async function setHidden(formData: FormData) {
  const session = await requireSession(['athlete']);
  const t = target.parse(Object.fromEntries(formData));
  const hide = formData.get('hide') === '1';
  await signal(session.userId, t.kind, t.id, hide ? 'hidden' : 'unhidden', t.score);
  revalidatePath('/app/match');
}

const tierSchema = z.object({ id: z.string().uuid(), tier: z.enum(['dream', 'target', 'strong_fit', 'backup', '']) });
export async function setShortlistTier(formData: FormData) {
  const session = await requireSession(['athlete']);
  const p = tierSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  must(await supabase.from('saved_items').update({ shortlist_tier: p.tier || null }).eq('id', p.id).eq('athlete_id', session.userId), 'saved_items.update');
  revalidatePath('/app', 'layout');
}

/** Registro de vista de un match (señal para el futuro; una por sesión de página). */
export async function recordMatchView(kind: 'institution' | 'opportunity', id: string, score: number | null) {
  const session = await requireSession(['athlete']);
  if (!z.string().uuid().safeParse(id).success) return;
  await signal(session.userId, kind, id, 'viewed', score);
}
