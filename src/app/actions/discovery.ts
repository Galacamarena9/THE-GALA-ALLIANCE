'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { loadDiscoveryRoster, loadOneForShortlist } from '@/lib/data/opportunity-discovery';
import { DISCOVERY_FILTER_KEYS, canShortlist, cycleFor, filtersToRecord, parseDiscoveryFilters } from '@/lib/domain/opportunity-discovery';

export type DiscoveryActionState = { ok?: boolean; error?: string; message?: string } | undefined;

const uuid = z.string().uuid();

/**
 * Añade una oportunidad a la shortlist del atleta = abre un proceso en el pipeline canónico (fase «shortlist»).
 * El encaje se RECALCULA aquí con el motor real; el navegador no decide nada. Un requisito obligatorio
 * incumplido (NO CUMPLE) bloquea la acción y no hay forma de saltarlo.
 */
export async function shortlistOpportunity(_prev: DiscoveryActionState, formData: FormData): Promise<DiscoveryActionState> {
  const session = await requireSession(['agent']);
  const athlete = uuid.safeParse(formData.get('athlete'));
  const opportunity = uuid.safeParse(formData.get('opportunity'));
  if (!athlete.success || !opportunity.success) return { error: 'Faltan datos para añadirla.' };

  const roster = await loadDiscoveryRoster(session.userId);
  const rep = roster.find((r) => r.id === athlete.data);
  if (!rep) return { error: 'No representas a este atleta.' };

  const one = await loadOneForShortlist(athlete.data, opportunity.data);
  if (one.state === 'forbidden') return { error: 'No tienes permiso para ver el perfil de este atleta.' };
  if (one.state === 'not_found') return { error: 'Esta oportunidad ya no está disponible.' };
  if (!canShortlist(one.m)) {
    const why = one.m.blockers[0]?.label ?? 'un requisito obligatorio';
    return { error: `No es elegible (${why.toLowerCase()}). No se puede añadir a la shortlist.` };
  }

  const gy = one.base.ctx.graduation_year;
  const years = one.opp.graduation_years ?? [];
  const intake = gy && (!years.length || years.includes(gy)) ? gy : years[0] ?? gy ?? new Date().getFullYear() + 1;
  const supabase = await createClient();
  const { error } = await supabase.from('recruiting_cases').insert({
    agency_id: rep.agencyId,
    athlete_id: athlete.data,
    institution_name: one.opp.organization.name.slice(0, 200),
    institution_id: one.opp.organization.institutionId,
    sport_id: one.opp.sport_id,
    cycle: cycleFor(intake),
    stage: 'shortlisted',
    next_action: `Revisar requisitos: ${one.opp.title}`.slice(0, 300),
    next_action_due: one.opp.deadline,
  });
  if (error) {
    if (error.code === '23505' || error.message.includes('duplicate')) return { error: `Ya hay un proceso con ${one.opp.organization.name} para esa temporada.` };
    if (error.message.includes('row-level security')) return { error: 'Tu permiso en esta representación es de solo lectura.' };
    return { error: 'No se ha podido añadir. Inténtalo de nuevo.' };
  }
  revalidatePath('/app/opportunities/discover');
  revalidatePath('/app/pipeline');
  return { ok: true, message: 'Añadida a la shortlist. La tienes en Procesos.' };
}

export async function saveDiscoverySearch(_prev: DiscoveryActionState, formData: FormData): Promise<DiscoveryActionState> {
  const session = await requireSession(['agent']);
  const athlete = uuid.safeParse(formData.get('athlete'));
  const label = z.string().trim().min(2, 'Ponle un nombre (mín. 2 caracteres)').max(80).safeParse(formData.get('label'));
  if (!athlete.success) return { error: 'Elige un atleta.' };
  if (!label.success) return { error: label.error.issues[0].message };
  const raw: Record<string, string> = {};
  for (const k of DISCOVERY_FILTER_KEYS) {
    const v = formData.get(k);
    if (typeof v === 'string') raw[k] = v;
  }
  const filters = filtersToRecord(parseDiscoveryFilters(raw));
  const supabase = await createClient();
  const { error } = await supabase.from('saved_searches').insert({ owner_id: session.userId, label: label.data, filters, scope: 'opportunities', subject_id: athlete.data });
  if (error) {
    if (error.message.includes('saved_search_limit')) return { error: 'Has llegado al máximo de 25 búsquedas guardadas.' };
    if (error.code === '23505') return { error: 'Ya tienes una búsqueda con ese nombre.' };
    if (error.message.includes('not_authorized')) return { error: 'No representas a este atleta.' };
    return { error: 'No se ha podido guardar la búsqueda.' };
  }
  revalidatePath('/app/opportunities/discover');
  return { ok: true, message: 'Búsqueda guardada. Te marcaremos lo nuevo cuando vuelvas.' };
}

export async function deleteDiscoverySearch(formData: FormData) {
  const session = await requireSession(['agent']);
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('saved_searches').delete().eq('id', id.data).eq('owner_id', session.userId).eq('scope', 'opportunities');
  revalidatePath('/app/opportunities/discover');
}

export async function markDiscoverySearchSeen(formData: FormData) {
  const session = await requireSession(['agent']);
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('saved_searches').update({ last_seen_at: new Date().toISOString() }).eq('id', id.data).eq('owner_id', session.userId).eq('scope', 'opportunities');
  revalidatePath('/app/opportunities/discover');
}
