'use server';

import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from './auth';

const program = z.object({
  institution_id: z.string().uuid(),
  sport_id: z.string().min(2).max(40),
  gender: z.enum(['men', 'women', 'coed']),
  association: z.enum(['ncaa', 'naia', 'njcaa', 'other', '']).optional().transform((v) => v || null),
  division: z.enum(['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa', '']).optional().transform((v) => v || null),
  conference: z.string().trim().max(120).optional().transform((v) => v || null),
  program_url: z.string().trim().max(500).regex(/^(https:\/\/\S+)?$/, 'El enlace debe empezar por https://').optional().transform((v) => v || null),
  source: z.enum(['manual_admin', 'official_external']).optional(),
  source_url: z.string().trim().max(500).regex(/^(https:\/\/\S+)?$/, 'El enlace debe empezar por https://').optional().transform((v) => v || null),
});

/** Alta o actualización de un programa deportivo. La RLS decide quién puede (admin u organización verificada vinculada). */
export async function saveProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const p = program.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Datos no válidos.' };
  if (p.data.source === 'official_external' && !p.data.source_url) return { fieldErrors: { source_url: 'Indica la URL oficial de la fuente' } };
  const supabase = await createClient();
  const { error } = await supabase.from('institution_programs').upsert({ ...p.data, source: p.data.source ?? 'manual_admin' }, { onConflict: 'institution_id,sport_id,gender' });
  if (error) return { error: error.code === '42501' ? 'No tienes permiso para editar esta universidad.' : 'No se ha podido guardar el programa.' };
  revalidatePath(`/app/universities/${p.data.institution_id}`);
  return { ok: true, message: 'Programa guardado' };
}

export async function deleteProgram(formData: FormData) {
  await requireSession();
  const id = z.string().uuid().parse(formData.get('id'));
  const inst = z.string().uuid().parse(formData.get('institution_id'));
  const supabase = await createClient();
  must(await supabase.from('institution_programs').delete().eq('id', id), 'institution_programs.delete');
  revalidatePath(`/app/universities/${inst}`);
}

const claim = z.object({
  institution_id: z.string().uuid(),
  work_email: z.string().trim().toLowerCase().email('Email no válido').max(254),
  role_title: z.string().trim().min(2, 'Indica tu cargo').max(120),
  organization_id: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
});

/** "Reclamar esta universidad": queda pendiente de revisión; nunca da acceso automático. */
export async function claimInstitution(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const c = claim.safeParse(Object.fromEntries(formData));
  if (!c.success) return { error: c.error.issues[0]?.message ?? 'Datos no válidos.' };
  const supabase = await createClient();
  const { error } = await supabase.from('institution_claims').insert({ ...c.data, user_id: session.userId });
  if (error) return { error: error.code === '23505' ? 'Ya tienes una solicitud pendiente para esta universidad.' : error.message.includes('not_org_admin') ? 'Debes ser administrador/a de esa organización.' : 'No se ha podido enviar la solicitud.' };
  revalidatePath(`/app/universities/${c.data.institution_id}`);
  return { ok: true, message: 'Solicitud enviada. La revisaremos y te avisaremos.' };
}

/** Admin: aprobar o rechazar una reclamación (la base de datos vincula la organización al aprobar). */
export async function reviewClaim(formData: FormData) {
  const session = await requireSession();
  if (!session.roles.includes('admin')) return;
  const id = z.string().uuid().parse(formData.get('id'));
  const status = z.enum(['approved', 'rejected']).parse(formData.get('status'));
  const supabase = await createClient();
  must(await supabase.from('institution_claims').update({ status, review_note: String(formData.get('note') ?? '').slice(0, 1000) || null }).eq('id', id), 'institution_claims.update');
  revalidatePath('/app/admin');
}

/** Organización: cerrar, marcar cubierta o confirmar que sigue abierta. */
export async function setOpportunityLifecycle(formData: FormData) {
  await requireSession();
  const id = z.string().uuid().parse(formData.get('id'));
  const action = z.enum(['closed', 'filled', 'confirm']).parse(formData.get('action'));
  const supabase = await createClient();
  if (action === 'confirm') must(await supabase.rpc('confirm_opportunity_open', { p_opportunity: id }), 'rpc.confirm_opportunity_open');
  else await supabase.from('opportunities').update({ status: action }).eq('id', id);
  revalidatePath(`/app/opportunities/${id}`);
}
