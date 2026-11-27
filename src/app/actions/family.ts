'use server';

import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession, getSession } from '@/lib/session';
import type { FormState } from './auth';
import { isGuardianChangeError } from '@/lib/domain/minor-guard';
import { getT } from '@/lib/i18n/server-t';

/** QA menores: un atleta menor no quita a su tutor (lo exige la BD); se explica en pantalla en vez de un error genérico. */
const GUARDIAN_BLOCKED = '/app/settings?familia=tutor#familia';

/** Crea una invitación (desde familia o desde atleta). El enlace se comparte fuera de la plataforma. */
export async function createFamilyInvitation(): Promise<FormState> {
  const session = await requireSession(['parent', 'athlete']);
  const supabase = await createClient();
  const asParent = session.roles.includes('parent');
  // 10D: si ya hay una invitación propia pendiente y vigente, se reutiliza (sin enlaces duplicados).
  const { data: pending } = await supabase.from('parent_athlete_links').select('invitation_token')
    .eq('invited_by', session.userId).eq('status', 'pending').gt('expires_at', new Date(Date.now() + 86400000).toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (pending?.invitation_token) return { ok: true, message: pending.invitation_token as string };
  const { data, error } = await supabase
    .from('parent_athlete_links')
    .insert(
      asParent
        ? { parent_id: session.userId, invited_by: session.userId }
        : { athlete_id: session.userId, invited_by: session.userId },
    )
    .select('invitation_token')
    .single();
  if (error || !data) return { error: 'No se ha podido crear la invitación.' };
  revalidatePath('/app/family');
  revalidatePath('/app/settings');
  return { ok: true, message: data.invitation_token };
}

export async function acceptFamilyInvitation(formData: FormData) {
  const session = await getSession();
  const token = z.string().regex(/^[a-f0-9]{64}$/).safeParse(formData.get('token'));
  if (!token.success) redirect('/app');
  if (!session) redirect(`/login?next=/invite/${token.data}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_family_invitation', { p_token: token.data });
  if (error) redirect(`/invite/${token.data}?error=${error.code === '23505' ? 'linked' : '1'}`);
  redirect(session.roles.includes('parent') ? '/app/family?bienvenida=1' : '/app/settings#familia');
}

export async function revokeFamilyLink(formData: FormData) {
  const session = await requireSession(['parent', 'athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  if (formData.get('confirm') !== 'yes') return; // 10D: dejar de seguir siempre pasa por la confirmación
  const supabase = await createClient();
  const res = await supabase
    .from('parent_athlete_links')
    .update({ status: 'revoked' })
    .eq('id', id)
    .or(`parent_id.eq.${session.userId},athlete_id.eq.${session.userId}`);
  if (isGuardianChangeError(res.error?.message)) redirect(GUARDIAN_BLOCKED);
  must(res, 'parent_athlete_links.update');
  revalidatePath('/app/family');
  revalidatePath('/app/settings');
}

/** Solo el atleta decide qué puede ver su familia (la base de datos lo exige). */
export async function updateFamilyPermissions(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const on = (k: string) => formData.get(k) === 'on';
  const supabase = await createClient();
  must(await supabase
    .from('parent_athlete_links')
    .update({
      can_view_profile: on('can_view_profile'),
      can_view_applications: on('can_view_applications'),
      can_view_academics: on('can_view_academics'),
      can_edit_profile: on('can_edit_profile'),
      can_view_costs: on('can_view_costs'),
      can_view_budget: on('can_view_budget'),
      can_view_documents: on('can_view_documents'),
      can_view_contacts: on('can_view_contacts'),
      can_view_messages: on('can_view_messages'),
    })
    .eq('id', id)
    .eq('athlete_id', session.userId), 'parent_athlete_links.update');
  revalidatePath('/app/settings');
}

/** Al cumplir 18: el atleta decide si su familia sigue teniendo acceso. */
export async function reviewFamilyLink(formData: FormData) {
  await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const keep = formData.get('keep') === 'yes';
  const supabase = await createClient();
  must(await supabase.rpc('family_link_review', { p_link: id, p_keep: keep }), 'rpc.family_link_review');
  revalidatePath('/app/settings');
}

/** Pausar o reanudar el acceso de un familiar sin deshacer la relación. */
export async function restrictFamilyLink(formData: FormData) {
  await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const restrict = formData.get('restrict') === 'yes';
  if (restrict && formData.get('confirm') !== 'yes') return; // pausar a la familia siempre pasa por la confirmación
  const supabase = await createClient();
  const res = await supabase.rpc('family_link_restrict', { p_link: id, p_restrict: restrict, p_reason: null });
  if (isGuardianChangeError(res.error?.message)) redirect(GUARDIAN_BLOCKED);
  must(res, 'rpc.family_link_restrict');
  revalidatePath('/app/settings');
}

// ------------------------------------------------------------------ Notas familiares
export async function addFamilyNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['parent', 'athlete']);
  const p = z.object({
    athlete: z.string().uuid(),
    body: z.string().trim().min(1, 'Escribe la nota.').max(2000, 'Máximo 2.000 caracteres.'),
    visibility: z.enum(['guardians', 'family']),
  }).safeParse({ athlete: formData.get('athlete'), body: formData.get('body'), visibility: formData.get('visibility') ?? 'guardians' });
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa la nota.' };
  const supabase = await createClient();
  const { error } = await supabase.from('family_notes').insert({ athlete_id: p.data.athlete, author_id: session.userId, body: p.data.body, visibility: p.data.visibility });
  if (error) return { error: 'No se ha podido guardar. Puede que ya no tengas acceso a este atleta.' };
  revalidatePath('/app/family');
  return { ok: true, message: 'Nota guardada.' };
}

export async function deleteFamilyNote(formData: FormData) {
  await requireSession(['parent', 'athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  must(await supabase.from('family_notes').delete().eq('id', id), 'family_notes.delete');
  revalidatePath('/app/family');
}

// ------------------------------------------------------------------ Coste real
const money = z.union([z.literal(''), z.coerce.number().int().min(0).max(500000)]).optional()
  .transform((v) => (v === '' || v == null ? null : v));
const scenarioSchema = z.object({
  athlete: z.string().uuid(),
  label: z.string().trim().min(2, 'Pon un nombre (p. ej., la universidad).').max(120),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  offer: z.union([z.literal(''), z.string().uuid()]).optional().transform((v) => v || null),
  tuition: money, fees: money, housing: money, meals: money, insurance: money, travel: money, other_costs: money,
  athletic_aid: money, academic_aid: money, other_aid: money,
  housing_included: z.enum(['', 'yes', 'no']).optional().transform((v) => (v === 'yes' ? true : v === 'no' ? false : null)),
  source_note: z.string().trim().max(500).optional().transform((v) => v || null),
});

export async function saveCostScenario(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['parent', 'athlete']);
  const p = scenarioSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa los importes (números enteros, sin decimales).' };
  const { athlete, offer, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from('family_cost_scenarios').insert({ ...rest, athlete_id: athlete, offer_id: offer, created_by: session.userId });
  if (error) return { error: 'No se ha podido guardar el escenario. Comprueba que sigues teniendo acceso a los costes.' };
  revalidatePath('/app/family/costs');
  revalidatePath('/app/family');
  return { ok: true, message: 'Escenario guardado. Lo que dejes en blanco cuenta como «desconocido», no como 0.' };
}

export async function deleteCostScenario(formData: FormData) {
  await requireSession(['parent', 'athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  must(await supabase.from('family_cost_scenarios').delete().eq('id', id), 'family_cost_scenarios.delete');
  revalidatePath('/app/family/costs');
}

export async function saveFamilyBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['parent', 'athlete']);
  const p = z.object({
    athlete: z.string().uuid(),
    amount: z.union([z.literal(''), z.coerce.number().int().min(0).max(200000)]).transform((v) => (v === '' ? null : v)),
    mode: z.enum(['preference', 'hard_limit']),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'El presupuesto debe ser un número entero entre 0 y 200.000.' };
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_finances')
    .upsert({ athlete_id: p.data.athlete, annual_budget_usd: p.data.amount, budget_mode: p.data.mode }, { onConflict: 'athlete_id' });
  if (error) return { error: 'No tienes permiso para cambiar el presupuesto. Si el atleta es mayor de edad, necesitas además permiso para editar su perfil.' };
  revalidatePath('/app/family/costs');
  return { ok: true, message: 'Presupuesto guardado. Es privado: ninguna universidad ni club lo ve.' };
}

/**
 * Tipo de cambio de la familia (1 US$ = X €), siempre con fecha y fuente. Vacío = sin tipo: todo en la moneda de la
 * fuente. Nunca proponemos un tipo nosotros. Misma regla de acceso que los escenarios (RLS de family_cost_settings).
 */
export async function saveFamilyFx(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['parent', 'athlete']);
  const tx = await getT();
  const raw = { athlete: formData.get('athlete'), rate: String(formData.get('rate') ?? '').trim().replace(',', '.'),
    date: String(formData.get('date') ?? '').trim(), source: String(formData.get('source') ?? '').trim() };
  const athlete = z.string().uuid().safeParse(raw.athlete);
  if (!athlete.success) return { error: tx('No se ha podido guardar el tipo de cambio.') };
  const supabase = await createClient();
  if (!raw.rate && !raw.date && !raw.source) {
    const { error } = await supabase.from('family_cost_settings').delete().eq('athlete_id', athlete.data);
    if (error) return { error: tx('No se ha podido quitar el tipo de cambio.') };
    revalidatePath('/app/family/costs');
    return { ok: true, message: tx('Tipo de cambio quitado: los importes se muestran solo en la moneda de la fuente.') };
  }
  const p = z.object({
    rate: z.coerce.number().gt(0).lt(10),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d <= new Date().toISOString().slice(0, 10)),
    source: z.string().min(3).max(200),
  }).safeParse(raw);
  if (!p.success) return { error: tx('Indica el tipo (p. ej., 0,92), la fecha (no futura) y la fuente (p. ej., BCE o tu banco). Los tres datos o ninguno.') };
  const { error } = await supabase.from('family_cost_settings').upsert(
    { athlete_id: athlete.data, eur_per_usd: p.data.rate, rate_date: p.data.date, rate_source: p.data.source }, { onConflict: 'athlete_id' });
  if (error) return { error: tx('No se ha podido guardar. Comprueba que sigues teniendo acceso a los costes.') };
  revalidatePath('/app/family/costs');
  return { ok: true, message: tx('Tipo de cambio guardado. Solo lo ve vuestra familia.') };
}

// ------------------------------------------------------------------ Tareas compartidas (motor central)
export async function addFamilyTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['parent']);
  const p = z.object({
    athlete: z.string().uuid(),
    title: z.string().trim().min(3, 'Describe la tarea.').max(160),
    due: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null),
    owner: z.enum(['guardian', 'both']),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa la tarea.' };
  const supabase = await createClient();
  const { error } = await supabase.from('pipeline_tasks').insert({
    athlete_id: p.data.athlete, title: p.data.title, due_date: p.data.due, owner: p.data.owner, source: 'family', created_by: session.userId,
  });
  if (error) return { error: 'No se ha podido crear la tarea. Puede que ya no tengas acceso a este atleta.' };
  revalidatePath('/app/family');
  return { ok: true, message: p.data.owner === 'both' ? 'Tarea compartida con tu hijo/a.' : 'Tarea guardada.' };
}

/** 10D · Retirar el acceso de una organización a un documento. La base de datos decide quién puede (atleta o tutor activo). */
export async function revokeDocumentGrant(formData: FormData) {
  await requireSession(['parent', 'athlete']);
  const p = z.object({ id: z.string().uuid(), child: z.string().uuid().optional(), confirm: z.literal('yes') }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  const { data } = await supabase.from('document_access_grants').update({ revoked_at: new Date().toISOString() })
    .eq('id', p.data.id).is('revoked_at', null).select('id');
  revalidatePath('/app/family/safety');
  redirect(`/app/family/safety?${p.data.child ? `child=${p.data.child}&` : ''}${data?.length ? 'revoked=1' : 'error=1'}`);
}
