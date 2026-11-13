'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession, getSession } from '@/lib/session';
import type { FormState } from './auth';

/** Crea una invitación (desde familia o desde atleta). El enlace se comparte fuera de la plataforma. */
export async function createFamilyInvitation(): Promise<FormState> {
  const session = await requireSession(['parent', 'athlete']);
  const supabase = await createClient();
  const asParent = session.roles.includes('parent');
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
  if (error) redirect(`/invite/${token.data}?error=1`);
  redirect(session.roles.includes('parent') ? '/app/family' : '/app/settings#familia');
}

export async function revokeFamilyLink(formData: FormData) {
  const session = await requireSession(['parent', 'athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase
    .from('parent_athlete_links')
    .update({ status: 'revoked' })
    .eq('id', id)
    .or(`parent_id.eq.${session.userId},athlete_id.eq.${session.userId}`);
  revalidatePath('/app/family');
  revalidatePath('/app/settings');
}

/** Solo el atleta decide qué puede ver su familia (la base de datos lo exige). */
export async function updateFamilyPermissions(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase
    .from('parent_athlete_links')
    .update({
      can_view_profile: formData.get('can_view_profile') === 'on',
      can_view_applications: formData.get('can_view_applications') === 'on',
      can_view_academics: formData.get('can_view_academics') === 'on',
      can_edit_profile: formData.get('can_edit_profile') === 'on',
    })
    .eq('id', id)
    .eq('athlete_id', session.userId);
  revalidatePath('/app/settings');
}
