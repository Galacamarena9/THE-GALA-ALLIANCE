'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getT } from '@/lib/i18n/server-t';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { bestEffort, must } from '@/lib/supabase/must';
import { FILTER_KEYS, parseSearch, savedSearchHref } from '@/lib/domain/recruit-search';
import type { FormState } from './auth';

/**
 * Búsquedas guardadas de la organización (org_saved_searches). La RLS decide: permiso «discover» en la organización,
 * privada por defecto (o de equipo), solo su autor la edita o borra. Los filtros se guardan normalizados (lista cerrada
 * de claves, también validada por la base de datos), nunca una URL. Sin emails todavía.
 */
const uuid = z.string().uuid();

export async function saveOrgSearch(_prev: FormState, formData: FormData): Promise<FormState> {
  const tx = await getT();
  const session = await requireSession();
  const p = z.object({
    org: uuid, name: z.string().trim().min(2).max(80), visibility: z.enum(['private', 'team']),
    need: z.union([uuid, z.literal('')]).optional(), query: z.string().max(2000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: tx('Pon un nombre (2-80 caracteres).') };
  const sp = Object.fromEntries(new URLSearchParams(p.data.query ?? ''));
  const f = parseSearch(sp);
  const supabase = await createClient();
  let sport = f.sport;
  const needId = p.data.need || null;
  if (needId) {
    const { data: need } = await supabase.from('recruiting_needs').select('sport_id').eq('id', needId).eq('organization_id', p.data.org).maybeSingle();
    if (!need) return { error: tx('Esa necesidad ya no existe.') };
    sport = need.sport_id as string;
  }
  if (!sport) return { error: tx('Elige un deporte (o una necesidad) antes de guardar la búsqueda.') };
  const filters: Record<string, string | number | boolean> = { sport };
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (k === 'sport' || v === undefined || v === false) continue;
    filters[k] = v as string | number | boolean;
  }
  const { error } = await supabase.from('org_saved_searches').insert({
    organization_id: p.data.org, created_by: session.userId, name: p.data.name, filters, need_id: needId, visibility: p.data.visibility,
  });
  if (error) {
    if (error.message.includes('row-level security') || error.code === '42501') return { error: tx('Tu rol no permite guardar búsquedas en esta organización.') };
    return { error: tx('No se ha podido guardar la búsqueda. Inténtalo de nuevo.') };
  }
  void logEvent('athlete_search_saved', { filters: Object.keys(filters).length, team: p.data.visibility === 'team' });
  revalidatePath('/app/recruit');
  return { ok: true, message: tx('Búsqueda guardada: la tienes en «Hoy».') };
}

/** Volver a lanzar: marca la última ejecución (solo si es tuya; la RLS lo decide) y abre el buscador con sus filtros. */
export async function runOrgSearch(formData: FormData) {
  await requireSession();
  const id = uuid.parse(formData.get('id'));
  const supabase = await createClient();
  const { data: s } = await supabase.from('org_saved_searches').select('id, organization_id, filters, need_id').eq('id', id).maybeSingle();
  if (!s) redirect('/app/recruit');
  // Solo el autor la puede marcar (RLS); si es de equipo y no es tuya, no pasa nada: se lanza igual.
  bestEffort(await supabase.from('org_saved_searches').update({ last_executed_at: new Date().toISOString() }).eq('id', id), 'org_saved_searches.last_executed_at');
  redirect(savedSearchHref(s.filters as Record<string, unknown>, s.need_id as string | null, s.organization_id as string));
}

export async function deleteOrgSearch(formData: FormData) {
  await requireSession();
  const id = uuid.parse(formData.get('id'));
  const supabase = await createClient();
  // Archivar (no borrar): la RLS solo deja tocar las propias.
  must(await supabase.from('org_saved_searches').update({ status: 'archived' }).eq('id', id), 'org_saved_searches.archive');
  revalidatePath('/app/recruit');
}

/**
 * Un solo sistema de listas para la organización: copia los atletas de las listas personales antiguas (saved_athletes)
 * a una shortlist del equipo. Copia, no mueve: lo personal no se borra. La RLS de org_shortlist_members decide.
 */
export async function importPersonalLists(formData: FormData) {
  const session = await requireSession();
  const p = z.object({ list: uuid }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect('/app/recruit/shortlists');
  const supabase = await createClient();
  const { data: list } = await supabase.from('org_shortlists').select('id, organization_id').eq('id', p.data.list).maybeSingle();
  if (!list) redirect('/app/recruit/shortlists');
  const { data: saved } = await supabase.from('saved_athletes').select('athlete_id').eq('owner_id', session.userId).limit(500);
  const ids = [...new Set((saved ?? []).map((s) => s.athlete_id as string))];
  let added = 0;
  for (const athlete of ids) {
    const { error } = await supabase.from('org_shortlist_members').insert({ shortlist_id: list.id, organization_id: list.organization_id, athlete_id: athlete });
    if (!error) added++;
  }
  if (added) void logEvent('athlete_shortlisted', { added, source: 'personal_lists' });
  revalidatePath('/app/recruit/shortlists');
  redirect(`/app/recruit/shortlists/${list.id}?imported=${added}`);
}
