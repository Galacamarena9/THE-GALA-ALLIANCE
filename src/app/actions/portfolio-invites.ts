'use server';

import { revalidatePath } from 'next/cache';
import { planLimitMessage } from '@/lib/domain/plan-limits';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { siteUrl } from '@/lib/env';
import { parsePortfolioCsv } from '@/lib/domain/portfolio-import';

export interface InviteLink { id: string; name: string; email: string | null; link: string }
export interface ImportState { error?: string; created?: InviteLink[]; errors?: { line: number; message: string }[] }

const linkFor = (token: string) => `${siteUrl()}/invite/agencia/${token}`;

/** Importa la cartera (CSV pegado o subido) y devuelve un enlace personal por atleta, mostrado una sola vez. */
export async function importPortfolio(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireSession(['agent']);
  const parsed = z.object({ agency_id: z.string().uuid(), csv: z.string().min(1).max(500_000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Pega o sube un CSV con al menos la columna «Nombre».' };
  const result = parsePortfolioCsv(parsed.data.csv);
  if (result.fatal && !result.rows.length) return { error: result.fatal, errors: result.errors };
  if (!result.rows.length) return { error: 'No hay ninguna fila válida que importar.', errors: result.errors };

  const supabase = await createClient();
  const created: InviteLink[] = [];
  for (const r of result.rows) {
    const { data, error } = await supabase.rpc('agency_invite_create', {
      p_agency: parsed.data.agency_id, p_name: r.full_name, p_email: r.email ?? undefined, p_sport: r.sport ?? undefined, p_year: r.graduation_year ?? undefined,
    });
    if (error) {
      if (error.message.includes('not_allowed')) return { error: 'No tienes permiso para importar en esta agencia.' };
      const limit = planLimitMessage(error.message);
      if (limit) return { error: `${limit} Se han creado ${created.length} invitaciones.`, created };
      if (error.message.includes('too_many_open_invites')) return { error: 'Tienes 500 invitaciones abiertas: espera a que las reclamen o cancela alguna.', created };
      return { error: 'No se ha podido terminar la importación. Lo creado hasta ahora se conserva.', created };
    }
    const row = (data as { id: string; token: string }[] | null)?.[0];
    if (row) created.push({ id: row.id, name: r.full_name, email: r.email, link: linkFor(row.token) });
  }
  await logEvent('athlete_invited', { count: created.length, source: 'portfolio_import' });
  revalidatePath('/app/portfolio');
  return { created, errors: result.errors };
}

/** Enlace nuevo para una invitación pendiente (el anterior deja de valer). */
export async function reissueInvite(_prev: { link?: string; error?: string }, formData: FormData): Promise<{ link?: string; error?: string }> {
  await requireSession(['agent']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Invitación no válida.' };
  const { data, error } = await (await createClient()).rpc('agency_invite_reissue', { p_id: id.data });
  if (error || !data) return { error: 'No se ha podido generar el enlace.' };
  return { link: linkFor(data as string) };
}

export async function revokeInvite(formData: FormData) {
  await requireSession(['agent']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await (await createClient()).rpc('agency_invite_revoke', { p_id: id.data });
  revalidatePath('/app/portfolio');
}

/** Lado del atleta: reclamar la invitación con su cuenta. */
export async function claimAgencyInvite(formData: FormData) {
  await requireSession(['athlete']);
  const token = String(formData.get('token') ?? '');
  if (!/^[a-f0-9]{64}$/.test(token)) redirect(`/invite/agencia/${token}?error=invalid`);
  const { error } = await (await createClient()).rpc('agency_invite_claim', { p_token: token });
  if (error) redirect(`/invite/agencia/${token}?error=${error.message.includes('blocked') ? 'blocked' : 'invalid'}`);
  await logEvent('athlete_claimed', { source: 'agency_invite' });
  redirect('/app/agents?invitacion=aceptada');
}
