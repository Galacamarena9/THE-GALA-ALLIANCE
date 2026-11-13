import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AthleteAcademics, AthleteProfile } from '@/lib/types';
import { computeReadiness } from '@/lib/domain/readiness';
import { ageOn, ADULT_AGE } from '@/lib/domain/age';

export interface StatRow {
  id: string;
  season: string;
  value: number;
  source: 'self_reported' | 'documented' | 'club_verified';
  sport_stat_definitions: { code: string; label_es: string; unit: string | null; sort_order: number } | null;
}

/**
 * Carga el Passport completo de un atleta con el cliente del usuario actual:
 * lo que la RLS no permita ver, simplemente no llega (bloques a null o vacíos).
 */
export async function loadPassport(athleteId: string) {
  const supabase = await createClient();
  const [profileRes, personRes, academicsRes, statsRes, langsRes, achRes, linksRes, privRes, finRes] = await Promise.all([
    supabase.from('athlete_profiles').select('*').eq('user_id', athleteId).maybeSingle(),
    supabase.from('profiles').select('display_name, avatar_url, country').eq('id', athleteId).maybeSingle(),
    supabase.from('athlete_academics').select('*').eq('athlete_id', athleteId).maybeSingle(),
    supabase
      .from('athlete_statistics')
      .select('id, season, value, source, sport_stat_definitions(code, label_es, unit, sort_order)')
      .eq('athlete_id', athleteId)
      .order('season', { ascending: false }),
    supabase.from('athlete_languages').select('language_code, level').eq('athlete_id', athleteId),
    supabase.from('athlete_achievements').select('id, title, year, description, source').eq('athlete_id', athleteId).order('year', { ascending: false }),
    supabase.from('parent_athlete_links').select('id, status').eq('athlete_id', athleteId).eq('status', 'approved'),
    supabase.from('private_profile_data').select('date_of_birth').eq('user_id', athleteId).maybeSingle(),
    supabase.from('athlete_finances').select('annual_budget_usd').eq('athlete_id', athleteId).maybeSingle(),
  ]);

  const profile = profileRes.data as AthleteProfile | null;
  const academics = academicsRes.data as AthleteAcademics | null;
  const stats = (statsRes.data ?? []) as unknown as StatRow[];
  const languages = langsRes.data ?? [];
  const achievements = achRes.data ?? [];
  const age = privRes.data?.date_of_birth ? ageOn(privRes.data.date_of_birth) : null;

  const readiness = computeReadiness({
    profile,
    academics,
    statsCount: stats.length,
    languagesCount: languages.length,
    achievementsCount: achievements.length,
    hasFamilyLink: (linksRes.data ?? []).length > 0,
    isMinor: age == null ? true : age < ADULT_AGE,
  });

  return {
    profile,
    person: personRes.data,
    academics,
    stats,
    languages,
    achievements,
    readiness,
    annualBudgetUsd: (finRes.data?.annual_budget_usd as number | null | undefined) ?? null,
    familyLinks: linksRes.data ?? [],
  };
}

export async function loadCatalog() {
  const supabase = await createClient();
  const [sports, positions, statDefs] = await Promise.all([
    supabase.from('sports').select('id, name_es').eq('active', true).order('name_es'),
    supabase.from('sport_positions').select('id, sport_id, code, name_es').order('id'),
    supabase.from('sport_stat_definitions').select('id, sport_id, code, label_es, unit').order('sort_order'),
  ]);
  return {
    sports: sports.data ?? [],
    positions: positions.data ?? [],
    statDefs: statDefs.data ?? [],
  };
}
