'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from '@/app/actions/auth';

const ERRORS: Record<string, string> = {
  club_admin_required: 'Solo los administradores de un club verificado pueden recomendar.',
  not_in_roster: 'Solo puedes recomendar a atletas activos en tu roster.',
  recommendation_transition_not_allowed: 'Esta recomendación ya no se puede cambiar.',
};
const errorText = (msg?: string) => Object.entries(ERRORS).find(([k]) => msg?.includes(k))?.[1] ?? 'No se ha podido guardar. Inténtalo de nuevo.';

const write = z.object({
  athlete_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  body: z.string().trim().min(40, 'Escribe al menos 40 caracteres: qué tipo de jugador y compañero es.').max(1200, 'Máximo 1.200 caracteres.'),
});

/** El club escribe (o reescribe mientras está pendiente) su recomendación. El atleta decide si se publica. */
export async function writeRecommendation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = write.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data: existing } = await supabase.from('club_recommendations').select('id, status')
    .eq('athlete_id', parsed.data.athlete_id).eq('organization_id', parsed.data.organization_id).maybeSingle();
  const { error } = existing
    ? await supabase.from('club_recommendations').update({ body: parsed.data.body }).eq('id', existing.id)
    : await supabase.from('club_recommendations').insert(parsed.data);
  if (error) return { error: errorText(error.message) };
  revalidatePath('/app/club');
  return { ok: true, message: 'Enviada. El atleta decidirá si la muestra en su perfil.' };
}

const decide = z.object({ id: z.string().uuid(), status: z.enum(['published', 'hidden']) });

/** El atleta (o su familia) publica u oculta la recomendación. */
export async function decideRecommendation(formData: FormData) {
  await requireSession();
  const parsed = decide.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('club_recommendations').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  revalidatePath('/app/athlete/passport');
}
