import type { createClient } from '@/lib/supabase/server';
import { DIVISION_LABEL } from '@/lib/domain/labels';

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type DirectoryFilters = Partial<Record<'sport' | 'position' | 'grad' | 'division' | 'gpa' | 'video' | 'q', string>>;

const DIVISIONS = Object.keys(DIVISION_LABEL);

/**
 * Cuenta los atletas que cumplen una búsqueda guardada y se han creado o actualizado desde `since`.
 * Se ejecuta con la sesión de quien busca: la RLS decide qué perfiles existen para él
 * (una marca nunca recibe alertas de menores).
 */
export async function countNewMatches(supabase: Supabase, f: DirectoryFilters, since: string) {
  let q = supabase
    .from('athlete_directory')
    .select('user_id', { count: 'exact', head: true })
    .eq('open_to_opportunities', true)
    .gt('updated_at', since);
  if (f.sport) q = q.eq('sport_id', f.sport);
  if (f.position && /^\d+$/.test(f.position)) q = q.or(`primary_position_id.eq.${f.position},secondary_position_id.eq.${f.position}`);
  if (f.grad && /^\d{4}$/.test(f.grad)) q = q.eq('graduation_year', Number(f.grad));
  if (f.division && DIVISIONS.includes(f.division)) q = q.contains('target_divisions', [f.division]);
  if (f.video === '1') q = q.eq('has_video', true);
  if (f.q) q = q.ilike('display_name', `%${f.q.replace(/[%_,()]/g, '').slice(0, 60)}%`);
  if (f.gpa && /^\d(\.\d{1,2})?$/.test(f.gpa)) {
    const { data: ids } = await supabase.from('athlete_academics').select('athlete_id').gte('gpa_4', Number(f.gpa)).limit(1000);
    q = q.in('user_id', (ids ?? []).map((r) => r.athlete_id));
  }
  const { count } = await q;
  return count ?? 0;
}

export function filtersToQuery(f: DirectoryFilters) {
  return new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
}
