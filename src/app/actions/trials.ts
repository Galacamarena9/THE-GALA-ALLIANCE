'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { trialErrorMessage } from '@/lib/domain/trials';

export type TrialResult = { ok: boolean; message: string };
const uuid = z.string().uuid();

function refresh(opportunity?: string) {
  revalidatePath('/app/portfolio/trials');
  revalidatePath('/app/process');
  if (opportunity) revalidatePath(`/app/opportunities/${opportunity}`);
}

/** Inscribir en un trial: el atleta, su familia o su agente (con representación activa). Las reglas están en la BD. */
export async function registerForTrial(input: { opportunity: string; athlete: string; agency?: string }): Promise<TrialResult> {
  await requireSession(['athlete', 'parent', 'agent']);
  const p = z.object({ opportunity: uuid, athlete: uuid, agency: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('trial_register', { p_opportunity: p.data.opportunity, p_athlete: p.data.athlete, p_agency: p.data.agency ?? null });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  await logEvent('trial_applied', { by: p.data.agency ? 'agent' : 'athlete' });
  refresh(p.data.opportunity);
  return { ok: true, message: p.data.agency ? 'Hecho. Si el trial tiene coste, el atleta debe aceptarlo antes de que se envíe.' : 'Inscripción enviada.' };
}

/** Respuestas del lado del atleta: interesado, aceptar coste, aprobación familiar, retirarse. */
export async function respondTrial(input: { registration: string; action: 'interested' | 'confirm_cost' | 'guardian_approve' | 'guardian_decline' | 'withdraw'; opportunity?: string }): Promise<TrialResult> {
  await requireSession(['athlete', 'parent', 'agent']);
  const p = z.object({ registration: uuid, action: z.enum(['interested', 'confirm_cost', 'guardian_approve', 'guardian_decline', 'withdraw']), opportunity: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('trial_respond', { p_registration: p.data.registration, p_action: p.data.action });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  refresh(p.data.opportunity);
  return { ok: true, message: data === 'interested' && p.data.action !== 'interested' ? 'Pendiente de la aprobación familiar.' : 'Actualizado.' };
}

/** Acciones del club (con permiso de candidatos). */
export async function clubTrialAction(input: { registration: string; action: 'confirm' | 'waitlist' | 'decline' | 'attended' | 'no_show' | 'outcome'; outcome?: string; opportunity?: string }): Promise<TrialResult> {
  await requireSession(['university', 'coach']);
  const p = z.object({ registration: uuid, action: z.enum(['confirm', 'waitlist', 'decline', 'attended', 'no_show', 'outcome']), outcome: z.enum(['follow_up', 'continue_recruiting', 'not_selected']).optional(), opportunity: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('trial_org_action', { p_registration: p.data.registration, p_action: p.data.action, p_outcome: p.data.outcome ?? null });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  refresh(p.data.opportunity);
  return { ok: true, message: 'Actualizado.' };
}
