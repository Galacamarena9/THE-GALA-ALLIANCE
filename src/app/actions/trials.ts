'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { TRIAL_INVITER_ORG_TYPES, isTrialType, trialErrorMessage } from '@/lib/domain/trials';

export type TrialResult = { ok: boolean; message: string };
const uuid = z.string().uuid();

function refresh(opportunity?: string) {
  revalidatePath('/app/portfolio/trials');
  revalidatePath('/app/process');
  revalidatePath('/app/family');
  if (opportunity) revalidatePath(`/app/opportunities/${opportunity}`);
}

/** Inscribirse en un trial: el atleta, su familia o su agente (con representación activa). Las reglas están en la BD. */
export async function registerForTrial(input: { opportunity: string; athlete: string; agency?: string }): Promise<TrialResult> {
  await requireSession(['athlete', 'parent', 'agent']);
  const p = z.object({ opportunity: uuid, athlete: uuid, agency: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('trial_register', { p_opportunity: p.data.opportunity, p_athlete: p.data.athlete, p_agency: p.data.agency ?? null });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  const { data: reg } = await supabase.from('opportunity_registrations').select('status, needs_athlete_ok, guardian_status').eq('id', id as string).maybeSingle();
  await logEvent(reg?.status === 'registered' ? 'trial_registered' : 'trial_applied', { by: p.data.agency ? 'agent' : 'athlete' });
  refresh(p.data.opportunity);
  if (reg?.needs_athlete_ok) return { ok: true, message: 'Propuesta enviada. El atleta debe aceptar el coste antes de que se envíe la inscripción.' };
  if (reg?.guardian_status === 'pending') return { ok: true, message: 'Pendiente de la aprobación de la familia.' };
  return { ok: true, message: 'Inscripción enviada. El club confirmará la plaza.' };
}

/**
 * Candidatura a un trial «primero candidatura» (solo el propio atleta; la RLS `apps_insert` lo exige).
 * Si es menor, la candidatura queda con el consentimiento familiar pendiente y, si el club la acepta, la inscripción
 * no avanza hasta que la familia la apruebe (`application_org_decide` + `trial_respond`).
 */
export async function applyToTrial(input: { opportunity: string; message?: string }): Promise<TrialResult> {
  const session = await requireSession(['athlete']);
  const p = z.object({ opportunity: uuid, message: z.string().trim().max(2000).optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data: o } = await supabase.from('opportunities').select('type, trial_details(registration_mode)').eq('id', p.data.opportunity).maybeSingle();
  const td = o?.trial_details as unknown as { registration_mode: string } | { registration_mode: string }[] | null;
  const mode = Array.isArray(td) ? td[0]?.registration_mode : td?.registration_mode;
  if (!o || !isTrialType(o.type as string) || mode !== 'application_required') return { ok: false, message: 'Este trial no admite candidaturas.' };
  const { error } = await supabase.from('applications').insert({ opportunity_id: p.data.opportunity, athlete_id: session.userId, athlete_message: p.data.message || null });
  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Ya has presentado tu candidatura a este trial.' };
    return { ok: false, message: trialErrorMessage(error.message) };
  }
  await logEvent('trial_applied', { by: 'athlete' });
  refresh(p.data.opportunity);
  revalidatePath('/app/applications');
  return {
    ok: true,
    message: session.isMinor
      ? 'Candidatura enviada. Si el club la acepta, tu familia tendrá que aprobar tu participación.'
      : 'Candidatura enviada. Si el club la acepta, quedarás inscrito y te avisaremos.',
  };
}

/** Respuestas del lado del atleta sobre una inscripción: aceptar coste, aprobación familiar, retirarse. */
export async function respondTrial(input: { registration: string; action: 'confirm_cost' | 'guardian_approve' | 'guardian_decline' | 'withdraw'; opportunity?: string }): Promise<TrialResult> {
  await requireSession(['athlete', 'parent', 'agent']);
  const p = z.object({ registration: uuid, action: z.enum(['confirm_cost', 'guardian_approve', 'guardian_decline', 'withdraw']), opportunity: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('trial_respond', { p_registration: p.data.registration, p_action: p.data.action });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  if (p.data.action === 'guardian_approve') await logEvent('trial_consent_approved');
  refresh(p.data.opportunity);
  const msg: Record<string, string> = {
    registered: 'Inscripción enviada. El club confirmará la plaza.', pending: 'Hecho. Falta otro paso (coste o aprobación familiar).',
    withdrawn: 'Hecho. Se ha avisado al club.',
  };
  return { ok: true, message: p.data.action === 'guardian_approve' ? '✓ Participación aprobada. La inscripción continúa.' : msg[data as string] ?? 'Actualizado.' };
}

/** Invitación del club: vista, interesado, rechazar (motivo opcional) o aprobación de la familia (crea la inscripción). */
export async function respondInvitation(input: { invitation: string; action: 'viewed' | 'interested' | 'declined' | 'guardian_approve'; reason?: string; opportunity?: string }): Promise<TrialResult> {
  await requireSession(['athlete', 'parent']);
  const p = z.object({
    invitation: uuid, action: z.enum(['viewed', 'interested', 'declined', 'guardian_approve']),
    reason: z.enum(['timing', 'location', 'cost', 'not_interested', 'other']).optional(), opportunity: uuid.optional(),
  }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('invitation_respond', { p_invitation: p.data.invitation, p_action: p.data.action, p_reason: p.data.reason ?? null });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  if (p.data.action === 'viewed') await logEvent('trial_invitation_opened');
  if (p.data.action === 'guardian_approve') await logEvent('trial_consent_approved');
  refresh(p.data.opportunity);
  const msg = { viewed: 'Vista.', interested: 'Has indicado interés. El siguiente paso es inscribirte.', declined: 'Invitación rechazada. El club lo verá como «rechazada».', guardian_approve: '✓ Participación aprobada. La inscripción se ha enviado.' };
  return { ok: true, message: msg[p.data.action] };
}

/** Club: invitar a un atleta a un trial (permiso de contacto, organización verificada, sin duplicados). */
export async function inviteToTrial(input: { opportunity: string; athlete: string; source?: 'discovery' | 'shortlist' | 'recruiting_need' | 'gala_match' | 'trial_follow_up'; shortlist?: string; message?: string }): Promise<TrialResult> {
  await requireSession(['university', 'coach']);
  const p = z.object({
    opportunity: uuid, athlete: uuid, source: z.enum(['discovery', 'shortlist', 'recruiting_need', 'gala_match', 'trial_follow_up']).default('discovery'),
    shortlist: uuid.optional(), message: z.string().trim().max(600).optional(),
  }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  // Solo clubes y academias invitan a sus trials desde aquí (universidades/colleges: ventana NCAA; la BD tiene su propia guarda).
  const { data: o } = await supabase.from('opportunities').select('type, organizations(type)').eq('id', p.data.opportunity).maybeSingle();
  const orgType = (o?.organizations as unknown as { type: string } | null)?.type ?? '';
  if (!o || !isTrialType(o.type as string) || !(TRIAL_INVITER_ORG_TYPES as readonly string[]).includes(orgType)) return { ok: false, message: 'Solo los clubes y academias pueden invitar a sus trials.' };
  const { error } = await supabase.rpc('trial_org_invite', {
    p_opportunity: p.data.opportunity, p_athlete: p.data.athlete, p_source: p.data.source, p_shortlist: p.data.shortlist ?? null, p_message: p.data.message ?? null,
  });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  await logEvent('trial_invitation_sent');
  refresh(p.data.opportunity);
  return { ok: true, message: 'Invitación enviada. El atleta (y su familia, si es menor) la verá con fecha, lugar y coste.' };
}

/** Club: decisión sobre una candidatura (aceptar a un trial crea la inscripción; a un programa, la plaza ofrecida). */
export async function decideApplication(input: { application: string; decision: 'reviewed' | 'information_requested' | 'accepted' | 'waitlisted' | 'declined'; message?: string; opportunity?: string }): Promise<TrialResult> {
  await requireSession(['university', 'coach']);
  const p = z.object({
    application: uuid, decision: z.enum(['reviewed', 'information_requested', 'accepted', 'waitlisted', 'declined']), message: z.string().trim().max(1000).optional(), opportunity: uuid.optional(),
  }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('application_org_decide', { p_application: p.data.application, p_decision: p.data.decision, p_message: p.data.message ?? null });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  refresh(p.data.opportunity);
  revalidatePath('/app/recruit/candidates');
  const msg = { reviewed: 'Marcada como revisada.', information_requested: 'Se ha pedido más información.', accepted: 'Aceptada. El atleta recibe el siguiente paso.', waitlisted: 'En lista de espera.', declined: 'No continúa.' };
  return { ok: true, message: msg[p.data.decision] };
}

/** Acciones del club sobre una inscripción: confirmar, lista de espera, no continuar, asistencia, resultado. */
export async function clubTrialAction(input: {
  registration: string; action: 'confirm' | 'waitlist' | 'decline' | 'check_in' | 'attended' | 'no_show' | 'partial' | 'outcome';
  outcome?: 'no_further_action' | 'follow_up' | 'invite_again' | 'start_recruiting_process' | 'closed'; athleteMessage?: string; note?: string; opportunity?: string;
}): Promise<TrialResult> {
  await requireSession(['university', 'coach']);
  const p = z.object({
    registration: uuid, action: z.enum(['confirm', 'waitlist', 'decline', 'check_in', 'attended', 'no_show', 'partial', 'outcome']),
    outcome: z.enum(['no_further_action', 'follow_up', 'invite_again', 'start_recruiting_process', 'closed']).optional(),
    athleteMessage: z.string().trim().max(500).optional(), note: z.string().trim().max(1000).optional(), opportunity: uuid.optional(),
  }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { error } = p.data.action === 'outcome'
    ? await supabase.rpc('outcome_record', { p_registration: p.data.registration, p_outcome: p.data.outcome ?? 'follow_up', p_internal_note: p.data.note ?? null, p_athlete_message: p.data.athleteMessage ?? null })
    : await supabase.rpc('trial_org_action', { p_registration: p.data.registration, p_action: p.data.action, p_outcome: null });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  if (p.data.action === 'check_in' || p.data.action === 'attended') await logEvent('trial_checked_in');
  if (p.data.outcome === 'start_recruiting_process') await logEvent('recruiting_process_started', { source: 'trial' });
  refresh(p.data.opportunity);
  const msg: Record<string, string> = {
    confirm: 'Plaza confirmada.', waitlist: 'En lista de espera.', decline: 'No continúa. Se ha avisado al atleta.',
    check_in: `✓ Check-in · ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, attended: 'Asistencia registrada.', no_show: 'Ausencia registrada.', partial: 'Asistencia parcial registrada.',
    outcome: p.data.outcome === 'start_recruiting_process' ? 'Proceso de recruiting iniciado (sin crear ninguna oferta).' : 'Resultado guardado (interno).',
  };
  return { ok: true, message: msg[p.data.action] };
}

/** Matrícula en academia: atleta/familia (aceptar, rechazar, aprobar, retirarse) y academia (matricular, activar, completar, cancelar). */
export async function enrollmentAction(input: { enrollment: string; action: 'accept' | 'decline' | 'guardian_approve' | 'guardian_decline' | 'withdraw' | 'enroll' | 'activate' | 'complete' | 'cancel'; opportunity?: string }): Promise<TrialResult> {
  const org = ['enroll', 'activate', 'complete', 'cancel'].includes(input.action);
  await requireSession(org ? ['university', 'coach'] : ['athlete', 'parent']);
  const p = z.object({ enrollment: uuid, action: z.enum(['accept', 'decline', 'guardian_approve', 'guardian_decline', 'withdraw', 'enroll', 'activate', 'complete', 'cancel']), opportunity: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data, error } = org
    ? await supabase.rpc('enrollment_org_action', { p_enrollment: p.data.enrollment, p_action: p.data.action, p_reason: null })
    : await supabase.rpc('enrollment_respond', { p_enrollment: p.data.enrollment, p_action: p.data.action });
  if (error) return { ok: false, message: trialErrorMessage(error.message) };
  refresh(p.data.opportunity);
  const msg: Record<string, string> = {
    accepted: 'Plaza aceptada. La academia formalizará la matrícula.', pending_guardian: 'Falta la aprobación de la familia.', declined: 'Plaza rechazada.', withdrawn: 'Te has retirado.',
    enrolled: 'Matrícula formalizada.', active: 'Programa en curso.', completed: 'Programa completado.', cancelled: 'Plaza cancelada.',
  };
  return { ok: true, message: msg[data as string] ?? 'Actualizado.' };
}
