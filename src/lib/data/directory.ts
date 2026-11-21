import type { createClient } from '@/lib/supabase/server';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { englishAtLeast, parseTalentFilters, type TalentFilters, type TalentSort } from '@/lib/domain/talent-search';

type Supabase = Awaited<ReturnType<typeof createClient>>;
/** Compatibilidad: las búsquedas guardadas usan las mismas claves que la búsqueda de talento. */
export type DirectoryFilters = TalentFilters;

export const DIRECTORY_DIVISIONS = Object.keys(DIVISION_LABEL);

/**
 * Una sola consulta de talento para la búsqueda, las alertas de búsquedas guardadas y las listas.
 * Se ejecuta con la sesión de quien busca: la RLS decide qué perfiles existen para él (una marca nunca ve menores)
 * y la vista devuelve NULL en lo que no puede ver, así que esos perfiles no cumplen el filtro.
 * Devuelve un objeto (no la consulta): una consulta de Supabase es «thenable» y se ejecutaría al devolverla de un async.
 */
export async function buildTalentQuery(
  supabase: Supabase,
  raw: TalentFilters,
  opts: { select?: string; head?: boolean; sort?: TalentSort; range?: [number, number]; since?: string } = {},
) {
  const f = parseTalentFilters(raw, DIRECTORY_DIVISIONS);
  let q = supabase
    .from('athlete_directory')
    .select(opts.select ?? '*', { count: 'exact', head: opts.head ?? false })
    .eq('open_to_opportunities', true);

  if (f.sport) q = q.eq('sport_id', f.sport);
  if (f.position) q = q.or(`primary_position_id.eq.${f.position},secondary_position_id.eq.${f.position}`);
  if (f.grad) q = q.eq('graduation_year', Number(f.grad));
  if (f.grad_min) q = q.gte('graduation_year', Number(f.grad_min));
  if (f.grad_max) q = q.lte('graduation_year', Number(f.grad_max));
  if (f.division) q = q.contains('target_divisions', [f.division]);
  if (f.video) q = q.eq('has_video', true);
  if (f.verified) q = q.eq('has_verified_stats', true);
  if (f.country) q = q.eq('country', f.country);
  if (f.nationality) q = q.eq('nationality', f.nationality);
  if (f.min_height) q = q.gte('height_cm', Number(f.min_height));
  if (f.max_height) q = q.lte('height_cm', Number(f.max_height));
  if (f.min_weight) q = q.gte('weight_kg', Number(f.min_weight));
  if (f.max_weight) q = q.lte('weight_kg', Number(f.max_weight));
  if (f.side) q = q.eq('dominant_side', f.side);
  if (f.english) q = q.in('english_level', englishAtLeast(f.english));
  if (f.exp_min) q = q.gte('years_experience', Number(f.exp_min));
  if (f.league) q = q.ilike('league', `%${f.league}%`);
  if (f.q) q = q.ilike('display_name', `%${f.q}%`);
  if (opts.since) q = q.gt('updated_at', opts.since);

  let gpaNote = false;
  if (f.gpa) {
    // Solo sobre académicos que el atleta comparte con quien busca (RLS de athlete_academics).
    const { data: ids } = await supabase.from('athlete_academics').select('athlete_id').gte('gpa_4', Number(f.gpa)).limit(1000);
    q = q.in('user_id', (ids ?? []).map((r) => r.athlete_id));
    gpaNote = true;
  }

  switch (opts.sort) {
    case 'height': q = q.order('height_cm', { ascending: false, nullsFirst: false }); break;
    case 'grad': q = q.order('graduation_year', { ascending: true, nullsFirst: false }); break;
    case 'experience': q = q.order('years_experience', { ascending: false, nullsFirst: false }); break;
    default: break;
  }
  q = q.order('updated_at', { ascending: false });
  if (opts.range) q = q.range(opts.range[0], opts.range[1]);
  return { query: q, filters: f, gpaNote };
}

/** Atletas que cumplen una búsqueda guardada y se han creado o actualizado desde `since`. */
export async function countNewMatches(supabase: Supabase, f: DirectoryFilters, since: string) {
  const { query } = await buildTalentQuery(supabase, f, { select: 'user_id', head: true, since });
  const { count } = await query;
  return count ?? 0;
}

export function filtersToQuery(f: DirectoryFilters) {
  return new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
}
