import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SessionContext } from '@/lib/session';

export interface ManagedAthlete {
  id: string;
  name: string;
  graduationYear: number | null;
  canEdit: boolean;
}

/** Atletas sobre los que actúa la sesión: uno mismo (atleta) y los hijos vinculados y aprobados (familia). */
export async function managedAthletes(session: SessionContext): Promise<ManagedAthlete[]> {
  const supabase = await createClient();
  const out: ManagedAthlete[] = [];
  if (session.roles.includes('athlete')) {
    const { data } = await supabase.from('athlete_profiles').select('graduation_year').eq('user_id', session.userId).maybeSingle();
    out.push({ id: session.userId, name: session.displayName, graduationYear: data?.graduation_year ?? null, canEdit: true });
  }
  if (session.roles.includes('parent')) {
    const { data: links } = await supabase.from('parent_athlete_links').select('athlete_id, can_edit_profile')
      .eq('parent_id', session.userId).eq('status', 'approved');
    const ids = (links ?? []).map((l) => l.athlete_id as string).filter(Boolean);
    if (ids.length) {
      const [{ data: profiles }, { data: aps }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', ids),
        supabase.from('athlete_profiles').select('user_id, graduation_year').in('user_id', ids),
      ]);
      for (const l of links ?? []) {
        if (!l.athlete_id) continue;
        out.push({
          id: l.athlete_id,
          name: profiles?.find((p) => p.id === l.athlete_id)?.display_name ?? 'Atleta',
          graduationYear: aps?.find((a) => a.user_id === l.athlete_id)?.graduation_year ?? null,
          canEdit: Boolean(l.can_edit_profile),
        });
      }
    }
  }
  return out;
}

export type FamilyPlan = 'free' | 'family_core' | 'family_elite' | 'family_signature';

/** Plan efectivo de la familia: el mejor entre el de la sesión y el del atleta (el pago se concede a ambos). */
export async function familyPlan(userIds: string[]): Promise<FamilyPlan> {
  const supabase = await createClient();
  const { data } = await supabase.from('entitlements').select('plan_code').in('user_id', userIds).is('revoked_at', null);
  const codes = new Set((data ?? []).map((e) => e.plan_code as string));
  if (codes.has('family_signature')) return 'family_signature';
  if (codes.has('family_elite')) return 'family_elite';
  if (codes.has('family_core')) return 'family_core';
  return 'free';
}

export const PLAN_RANK: Record<FamilyPlan, number> = { free: 0, family_core: 1, family_elite: 2, family_signature: 3 };
