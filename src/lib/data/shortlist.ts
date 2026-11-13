import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { institutionFit } from '@/lib/domain/institutionFit';
import type { AthleteProfile, Division } from '@/lib/types';

export interface ShortlistItem {
  id: string;
  name: string;
  state: string | null;
  division: Division | null;
  costUsd: number | null;
  satAvg: number | null;
  admissionRate: number | null;
  level: 'alto' | 'medio' | 'bajo' | 'sin datos';
  reasons: { ok: boolean | null; label: string }[];
}

const RANK = { alto: 0, medio: 1, 'sin datos': 2, bajo: 3 } as const;

/** Shortlist automática: universidades reales que ofrecen el deporte, ordenadas por encaje y coste oficial. */
export async function buildShortlist(profile: Pick<AthleteProfile, 'sport_id' | 'target_divisions'>, budgetUsd: number | null, limit = 15): Promise<ShortlistItem[]> {
  if (!profile.sport_id) return [];
  const supabase = await createClient();
  let q = supabase.from('institutions')
    .select('id, name, state, division, sports_offered, cost_attendance_usd, sat_avg, admission_rate')
    .contains('sports_offered', [profile.sport_id]).limit(200);
  if (profile.target_divisions.length) q = q.in('division', profile.target_divisions);
  const { data } = await q;
  return (data ?? [])
    .map((i) => {
      const fit = institutionFit(profile, budgetUsd, { sports_offered: i.sports_offered, division: i.division, cost_attendance_usd: i.cost_attendance_usd });
      return { id: i.id, name: i.name, state: i.state, division: i.division, costUsd: i.cost_attendance_usd, satAvg: i.sat_avg, admissionRate: i.admission_rate, ...fit };
    })
    .sort((a, b) => RANK[a.level] - RANK[b.level] || (a.costUsd ?? Number.MAX_SAFE_INTEGER) - (b.costUsd ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit);
}
