/**
 * Columnas de athlete_profiles que la API sirve directamente (fase 6, S4).
 * Las de bloques con visibilidad propia (deportivo, objetivos, vídeo) solo salen por `athlete_block_fields`,
 * que aplica el bloque de cada una: ver supabase/migrations/20261221000100_phase6_privacy.sql.
 */
export const ATHLETE_PROFILE_PUBLIC_COLUMNS =
  'user_id, headline, bio, sport_id, primary_position_id, secondary_position_id, graduation_year, city, open_to_opportunities, profile_visibility, academics_visibility, stats_visibility, sport_visibility, videos_visibility, goals_visibility, created_at, updated_at, username, nationality, photo_path';

export const ATHLETE_BLOCK_COLUMNS = [
  'height_cm', 'weight_kg', 'dominant_side', 'current_team', 'competitive_level',
  'league', 'years_experience', 'target_divisions', 'intended_major', 'highlight_video_url',
] as const;

export type AthleteBlockFields = {
  height_cm: number | null; weight_kg: number | null; dominant_side: string | null; current_team: string | null;
  competitive_level: string | null; league: string | null; years_experience: number | null;
  target_divisions: string[] | null; intended_major: string | null; highlight_video_url: string | null;
};

export const EMPTY_BLOCK_FIELDS: AthleteBlockFields = {
  height_cm: null, weight_kg: null, dominant_side: null, current_team: null, competitive_level: null,
  league: null, years_experience: null, target_divisions: [], intended_major: null, highlight_video_url: null,
};

/** Une la fila pública con los campos por bloque (lo que no se puede ver llega a null o vacío). */
export function withBlockFields<T extends object>(row: T, fields: Partial<AthleteBlockFields> | null | undefined): T & AthleteBlockFields {
  const f = { ...EMPTY_BLOCK_FIELDS, ...(fields ?? {}) };
  const { user_id: _drop, ...rest } = f as AthleteBlockFields & { user_id?: string };
  void _drop;
  return { ...row, ...rest, target_divisions: rest.target_divisions ?? [] };
}
