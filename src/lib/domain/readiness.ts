import type { AthleteAcademics, AthleteProfile } from '@/lib/types';

/**
 * Opportunity Readiness: cuánto de preparado está el Passport para que una
 * universidad pueda evaluarlo. Mide PREPARACIÓN, no talento ni probabilidad de beca.
 * Se calcula solo con datos reales de la base de datos.
 */
export interface ReadinessInput {
  profile: Pick<
    AthleteProfile,
    | 'sport_id'
    | 'primary_position_id'
    | 'graduation_year'
    | 'height_cm'
    | 'current_team'
    | 'competitive_level'
    | 'headline'
    | 'target_divisions'
    | 'highlight_video_url'
  > | null;
  academics: Pick<AthleteAcademics, 'gpa' | 'english_test' | 'english_score' | 'school_year'> | null;
  statsCount: number;
  languagesCount: number;
  achievementsCount: number;
  hasFamilyLink: boolean;
  isMinor: boolean;
}

export interface ReadinessItem {
  key: string;
  block: 'perfil' | 'deportivo' | 'academico' | 'proceso';
  label: string;
  done: boolean;
  weight: number;
  action: string;
  href: string;
}

export function computeReadiness(input: ReadinessInput) {
  const p = input.profile;
  const a = input.academics;
  const items: ReadinessItem[] = [
    { key: 'sport', block: 'perfil', label: 'Deporte y posición', done: Boolean(p?.sport_id && p?.primary_position_id), weight: 12, action: 'Indica tu deporte y posición', href: '/app/athlete/passport#deporte' },
    { key: 'grad', block: 'perfil', label: 'Año de graduación', done: Boolean(p?.graduation_year), weight: 8, action: 'Añade tu año de graduación del instituto', href: '/app/athlete/passport#deporte' },
    { key: 'headline', block: 'perfil', label: 'Titular del perfil', done: Boolean(p?.headline && p.headline.length >= 20), weight: 5, action: 'Escribe un titular que te presente en una línea', href: '/app/athlete/passport#perfil' },
    { key: 'team', block: 'deportivo', label: 'Equipo y nivel actual', done: Boolean(p?.current_team && p?.competitive_level), weight: 10, action: 'Añade tu equipo y la liga en la que compites', href: '/app/athlete/passport#deporte' },
    { key: 'height', block: 'deportivo', label: 'Altura', done: Boolean(p?.height_cm), weight: 4, action: 'Añade tu altura', href: '/app/athlete/passport#deporte' },
    { key: 'video', block: 'deportivo', label: 'Vídeo de highlights', done: Boolean(p?.highlight_video_url), weight: 18, action: 'Sube el enlace a tu vídeo de highlights', href: '/app/athlete/passport#video' },
    { key: 'stats', block: 'deportivo', label: 'Estadísticas de la temporada', done: input.statsCount >= 3, weight: 10, action: 'Añade al menos 3 estadísticas de esta temporada', href: '/app/athlete/passport#estadisticas' },
    { key: 'gpa', block: 'academico', label: 'Nota media (GPA)', done: a?.gpa != null, weight: 12, action: 'Añade tu nota media', href: '/app/athlete/passport#academico' },
    { key: 'english', block: 'academico', label: 'Nivel de inglés acreditado', done: Boolean(a?.english_test && a.english_test !== 'none' && a.english_score), weight: 8, action: 'Añade tu certificado de inglés (TOEFL, IELTS, Duolingo…)', href: '/app/athlete/passport#academico' },
    { key: 'divisions', block: 'proceso', label: 'Divisiones objetivo', done: Boolean(p?.target_divisions?.length), weight: 5, action: 'Elige a qué divisiones apuntas (NCAA D1, D2, NAIA…)', href: '/app/athlete/passport#objetivos' },
    { key: 'achievements', block: 'deportivo', label: 'Logros', done: input.achievementsCount > 0, weight: 4, action: 'Añade un logro o convocatoria', href: '/app/athlete/passport#logros' },
    { key: 'languages', block: 'perfil', label: 'Idiomas', done: input.languagesCount > 0, weight: 2, action: 'Añade los idiomas que hablas', href: '/app/athlete/passport#idiomas' },
  ];

  if (input.isMinor) {
    items.push({ key: 'family', block: 'proceso', label: 'Familia vinculada', done: input.hasFamilyLink, weight: 6, action: 'Vincula a tu familia o tutor', href: '/app/settings#familia' });
  }

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const score = Math.round((earned / total) * 100);

  // La siguiente acción es la pendiente con más peso: una sola, clara.
  const pending = items.filter((i) => !i.done).sort((x, y) => y.weight - x.weight);
  const blocks = (['perfil', 'deportivo', 'academico', 'proceso'] as const).map((block) => {
    const b = items.filter((i) => i.block === block);
    const bt = b.reduce((s, i) => s + i.weight, 0);
    const be = b.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
    return { block, pct: bt ? Math.round((be / bt) * 100) : 100 };
  });

  return { score, items, nextAction: pending[0] ?? null, blocks };
}
