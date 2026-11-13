'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

const https = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? (v.startsWith('http') ? v.replace(/^http:/, 'https:') : `https://${v}`) : null))
  .refine((v) => v == null || /^https:\/\/[^\s]+$/.test(v), 'Debe ser un enlace https');

export async function updateOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['university', 'coach', 'agent', 'brand']);
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(160),
      city: z.string().trim().max(120).optional(),
      state: z.string().trim().max(60).optional(),
      website: https,
      description: z.string().trim().max(2000).optional(),
      international_support: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' };
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('organizations')
    .update({ ...data, city: data.city || null, state: data.state || null, description: data.description || null, international_support: data.international_support || null }, { count: 'exact' })
    .eq('id', id);
  if (error || !count) return { error: 'No se ha podido guardar (solo los administradores de la organización pueden editarla).' };
  revalidatePath('/app/organization');
  return { ok: true, message: 'Organización actualizada. Si cambiaste nombre o web, volverá a revisión.' };
}

export async function submitVerification(formData: FormData) {
  await requireSession(['university', 'coach', 'agent', 'brand']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('organizations').update({ verification_status: 'submitted' }).eq('id', id);
  revalidatePath('/app/organization');
}

export async function createTeamInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['university', 'coach']);
  const id = z.string().uuid().safeParse(formData.get('organization_id'));
  if (!id.success) return { error: 'Organización no válida.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_invitations')
    .insert({ organization_id: id.data, invited_by: session.userId, member_role: 'coach' })
    .select('token')
    .single();
  if (error || !data) return { error: 'Solo los administradores de la organización pueden invitar.' };
  revalidatePath('/app/organization');
  return { ok: true, message: data.token };
}

export async function removeMember(formData: FormData) {
  await requireSession(['university', 'coach']);
  const parsed = z.object({ organization_id: z.string().uuid(), user_id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('organization_members').delete().eq('organization_id', parsed.data.organization_id).eq('user_id', parsed.data.user_id).neq('member_role', 'admin');
  revalidatePath('/app/organization');
}

export async function updateInstitutionLinks(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['university']);
  const parsed = z
    .object({ id: z.string().uuid(), athletics_url: https, admissions_url: https, international_url: https, virtual_tour_url: https })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enlaces no válidos.' };
  const { id, ...links } = parsed.data;
  const supabase = await createClient();
  const { error, count } = await supabase.from('institutions').update(links, { count: 'exact' }).eq('id', id);
  if (error || !count) return { error: 'No se han podido guardar los enlaces.' };
  revalidatePath('/app/organization');
  revalidatePath(`/app/universities/${id}`);
  return { ok: true, message: 'Enlaces enviados. Se mostrarán como "pendientes de revisión" hasta que los comprobemos.' };
}

export async function publishNews(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['university', 'coach', 'agent', 'brand', 'admin']);
  const parsed = z
    .object({
      organization_id: z.string().uuid().optional().or(z.literal('')),
      kind: z.enum(['announcement', 'signing', 'rule_update', 'event', 'story']),
      title: z.string().trim().min(6, 'Título demasiado corto').max(160),
      body: z.string().trim().min(20, 'Mínimo 20 caracteres').max(5000),
      source_url: https,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('news_posts').insert({
    ...parsed.data,
    organization_id: parsed.data.organization_id || null,
    author_id: session.userId,
  });
  if (error) {
    if (error.message.includes('verified_organization_required')) return { error: 'Tu organización debe estar verificada para publicar.' };
    return { error: 'No se ha podido publicar.' };
  }
  revalidatePath('/app/news');
  return { ok: true, message: 'Publicado en Actualidad.' };
}

export async function respondNewsTag(formData: FormData) {
  await requireSession(['athlete']);
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['published', 'hidden']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('news_posts').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  revalidatePath('/app/news');
}
