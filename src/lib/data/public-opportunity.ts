import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Division, OpportunityType } from '@/lib/types';

/**
 * Lectura pública de UNA oportunidad. Solo publicadas y de organizaciones verificadas
 * (la RLS ya lo impone a anónimos; aquí se filtra también por defensa en profundidad).
 * Lista de columnas explícita y alineada con los permisos por columna de `anon`
 * (migración 20261116001000): nunca notas de revisión ni quién la creó o revisó.
 */
const PUBLIC_COLUMNS =
  'id, organization_id, title, type, sport_id, position_ids, graduation_years, division, min_gpa_4, english_required, location, start_term, places, deadline, annual_cost_usd, aid_amount_usd, financial_source, description, status, is_reviewed, updated_at, organizations!inner(name, type, verification_status, website)';

export interface PublicOpportunity {
  id: string;
  title: string;
  type: OpportunityType;
  sport_id: string;
  position_ids: number[];
  graduation_years: number[];
  division: Division | null;
  min_gpa_4: number | null;
  english_required: string | null;
  location: string | null;
  start_term: string | null;
  places: number | null;
  deadline: string | null;
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  financial_source: string | null;
  description: string | null;
  status: string;
  is_reviewed: boolean | null;
  updated_at: string | null;
  organization_id?: string;
  organizations: { name: string; type: string; verification_status: string; website: string | null };
}

export type PublicOpportunityResult = { ok: true; opp: PublicOpportunity | null } | { ok: false };

export const loadPublicOpportunity = cache(async (id: string): Promise<PublicOpportunityResult> => {
  if (!/^[0-9a-f-]{36}$/.test(id) || !isSupabaseConfigured()) return { ok: true, opp: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('opportunities')
      .select(PUBLIC_COLUMNS)
      .eq('id', id)
      .eq('status', 'published')
      .eq('organizations.verification_status', 'verified')
      .maybeSingle();
    if (error) return { ok: false };
    return { ok: true, opp: (data as unknown as PublicOpportunity) ?? null };
  } catch {
    return { ok: false };
  }
});
