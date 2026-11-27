import type { AthleteAcademics, AthleteGoals, AthleteProfile, AthleteVideo, DataSource } from '@/lib/types';

/**
 * RECRUITING READINESS (0–100): lo preparado que está el Passport para iniciar o mejorar un proceso de recruiting.
 * Mide PREPARACIÓN DEL PERFIL, nunca talento ni probabilidad de beca. Se calcula solo con datos reales.
 *
 * Seis categorías con un máximo fijo (suman 100):
 *   Perfil 20 · Deportivo 20 · Académico 20 · Vídeo 15 · Verificaciones 15 · Preferencias 10
 */
/**
 * Nombre ÚNICO del % de perfil completo en todas las pantallas del atleta y de la familia (QA familia, hallazgo 10):
 * antes convivían «Recruiting Readiness 45/100», «Opportunity readiness» y «Passport listo 45 %».
 */
export const READINESS_LABEL = 'Passport listo';

export type ReadinessCategory = 'profile' | 'sport' | 'academic' | 'video' | 'verification' | 'goals';

export const READINESS_CATEGORIES: { key: ReadinessCategory; label: string; max: number }[] = [
  { key: 'profile', label: 'Datos básicos', max: 20 },
  { key: 'sport', label: 'Información deportiva', max: 20 },
  { key: 'academic', label: 'Información académica', max: 20 },
  { key: 'video', label: 'Vídeo', max: 15 },
  { key: 'verification', label: 'Verificaciones', max: 15 },
  { key: 'goals', label: 'Preferencias de recruiting', max: 10 },
];

export interface ReadinessInput {
  profile: Partial<Pick<AthleteProfile,
    | 'sport_id' | 'primary_position_id' | 'graduation_year' | 'height_cm' | 'current_team' | 'competitive_level' | 'headline'
    | 'target_divisions' | 'highlight_video_url' | 'city' | 'nationality' | 'league' | 'username'>> | null;
  academics: Partial<Pick<AthleteAcademics,
    | 'gpa' | 'english_test' | 'english_score' | 'school_year' | 'education_system' | 'school_name' | 'grade_display'
    | 'toefl_score' | 'ielts_score' | 'cambridge_level' | 'duolingo_score' | 'sat_score' | 'act_score' | 'gpa_source' | 'english_source'>> | null;
  statsCount: number;
  languagesCount: number;
  achievementsCount: number;
  hasFamilyLink: boolean;
  isMinor: boolean;
  hasAvatar?: boolean;
  careerCount?: number;
  videos?: Pick<AthleteVideo, 'kind' | 'is_featured'>[];
  verifiedStatsCount?: number;
  verifiedLinksCount?: number;
  goals?: Partial<Pick<AthleteGoals, 'pathways' | 'countries' | 'start_term' | 'scholarship_need' | 'intended_majors'>> | null;
}

export interface ReadinessItem {
  key: string;
  category: ReadinessCategory;
  label: string;
  done: boolean;
  points: number;
  /** Alias de `points` para código anterior. */
  weight: number;
  action: string;
  href: string;
}

const E = '/app/athlete/passport';
const raised = (s?: DataSource | null) => s === 'documented' || s === 'club_verified';

export function computeReadiness(input: ReadinessInput) {
  const p = input.profile;
  const a = input.academics;
  const g = input.goals ?? null;
  const videos = input.videos ?? (p?.highlight_video_url ? [{ kind: 'highlight' as const, is_featured: true }] : []);
  const hasEnglish = Boolean(
    a && (a.toefl_score != null || a.ielts_score != null || a.cambridge_level || a.duolingo_score != null
      || (a.english_test && a.english_test !== 'none' && a.english_score)),
  );
  const pathways = g?.pathways?.length ? g.pathways : (p?.target_divisions ?? []);

  const raw: Omit<ReadinessItem, 'weight'>[] = [
    // Datos básicos (20)
    { key: 'sport', category: 'profile', label: 'Deporte y posición', done: Boolean(p?.sport_id && p?.primary_position_id), points: 5, action: 'Indica tu deporte y posición', href: `${E}?s=identidad` },
    { key: 'photo', category: 'profile', label: 'Foto de perfil', done: Boolean(input.hasAvatar), points: 4, action: 'Añade una foto de perfil', href: '/app/settings#perfil' },
    { key: 'grad', category: 'profile', label: 'Año de graduación', done: Boolean(p?.graduation_year), points: 3, action: 'Añade tu año de graduación', href: `${E}?s=identidad` },
    { key: 'origin', category: 'profile', label: 'Ciudad y nacionalidad', done: Boolean(p?.city && p?.nationality), points: 3, action: 'Añade tu ciudad y nacionalidad', href: `${E}?s=identidad` },
    { key: 'headline', category: 'profile', label: 'Titular', done: Boolean(p?.headline && p.headline.length >= 20), points: 3, action: 'Escribe un titular que te presente en una línea', href: `${E}?s=identidad` },
    input.isMinor
      ? { key: 'family', category: 'profile', label: 'Familia vinculada', done: input.hasFamilyLink, points: 2, action: 'Vincula a tu familia o tutor', href: '/app/settings#familia' }
      : { key: 'username', category: 'profile', label: 'Enlace personal', done: Boolean(p?.username), points: 2, action: 'Elige tu enlace personal del Passport', href: `${E}?s=compartir` },
    // Información deportiva (20)
    { key: 'team', category: 'sport', label: 'Equipo y nivel actual', done: Boolean(p?.current_team && p?.competitive_level), points: 5, action: 'Añade tu equipo y nivel actual', href: `${E}?s=deportivo` },
    { key: 'stats', category: 'sport', label: 'Estadísticas de la temporada', done: input.statsCount >= 3, points: 5, action: 'Añade al menos 3 estadísticas de esta temporada', href: `${E}?s=estadisticas` },
    { key: 'career', category: 'sport', label: 'Trayectoria', done: (input.careerCount ?? 0) > 0, points: 3, action: 'Añade tus equipos anteriores', href: `${E}?s=deportivo` },
    { key: 'achievements', category: 'sport', label: 'Logros', done: input.achievementsCount > 0, points: 3, action: 'Añade un logro, convocatoria o premio', href: `${E}?s=deportivo` },
    { key: 'league', category: 'sport', label: 'Liga', done: Boolean(p?.league), points: 2, action: 'Indica la liga en la que compites', href: `${E}?s=deportivo` },
    { key: 'height', category: 'sport', label: 'Altura', done: Boolean(p?.height_cm), points: 2, action: 'Añade tu altura', href: `${E}?s=identidad` },
    // Información académica (20)
    { key: 'grade', category: 'academic', label: 'Nota media', done: a?.gpa != null || Boolean(a?.grade_display), points: 6, action: 'Añade tu nota media en tu sistema educativo', href: `${E}?s=academico` },
    { key: 'english', category: 'academic', label: 'Certificado de inglés', done: hasEnglish, points: 6, action: 'Añade tu certificado de inglés (TOEFL, IELTS, Cambridge…)', href: `${E}?s=academico` },
    { key: 'school', category: 'academic', label: 'Centro y sistema educativo', done: Boolean(a?.school_name && a?.education_system), points: 4, action: 'Añade tu centro y sistema educativo', href: `${E}?s=academico` },
    { key: 'languages', category: 'academic', label: 'Idiomas', done: input.languagesCount > 0, points: 2, action: 'Añade los idiomas que hablas', href: `${E}?s=academico` },
    { key: 'tests', category: 'academic', label: 'SAT o ACT', done: a?.sat_score != null || a?.act_score != null, points: 2, action: 'Añade tu SAT o ACT si lo tienes', href: `${E}?s=academico` },
    // Vídeo (15)
    { key: 'highlight', category: 'video', label: 'Highlight Reel', done: videos.some((v) => v.kind === 'highlight'), points: 9, action: 'Sube tu Highlight Reel', href: `${E}?s=video` },
    { key: 'full_game', category: 'video', label: 'Partido completo', done: videos.some((v) => v.kind === 'full_game'), points: 4, action: 'Añade un partido completo', href: `${E}?s=video` },
    { key: 'more_video', category: 'video', label: 'Más material', done: videos.filter((v) => v.kind !== 'highlight' && v.kind !== 'full_game').length > 0, points: 2, action: 'Añade un clip o un entrenamiento', href: `${E}?s=video` },
    // Verificaciones (15)
    { key: 'verified_stats', category: 'verification', label: 'Estadísticas verificadas por tu club', done: (input.verifiedStatsCount ?? 0) > 0, points: 6, action: 'Pide a tu club que verifique tus estadísticas', href: `${E}?s=verificacion` },
    { key: 'academic_docs', category: 'verification', label: 'Notas o inglés documentados', done: raised(a?.gpa_source) || raised(a?.english_source), points: 5, action: 'Sube tu expediente o certificado para documentarlo', href: '/app/documents' },
    { key: 'verified_link', category: 'verification', label: 'Enlace oficial verificado', done: (input.verifiedLinksCount ?? 0) > 0, points: 4, action: 'Añade un enlace oficial (club, federación, ranking)', href: `${E}?s=verificacion` },
    // Preferencias (10)
    { key: 'pathways', category: 'goals', label: 'Qué buscas', done: pathways.length > 0, points: 4, action: 'Indica qué tipo de oportunidades buscas', href: `${E}?s=objetivos` },
    { key: 'countries', category: 'goals', label: 'Países preferidos', done: Boolean(g?.countries?.length), points: 2, action: 'Elige tus países preferidos', href: `${E}?s=objetivos` },
    { key: 'start', category: 'goals', label: 'Fecha de incorporación', done: Boolean(g?.start_term), points: 2, action: 'Indica cuándo quieres empezar', href: `${E}?s=objetivos` },
    { key: 'scholarship', category: 'goals', label: 'Beca necesaria', done: Boolean(g?.scholarship_need), points: 1, action: 'Indica qué beca necesitas', href: `${E}?s=objetivos` },
    { key: 'majors', category: 'goals', label: 'Estudios de interés', done: Boolean(g?.intended_majors?.length), points: 1, action: 'Añade qué te gustaría estudiar', href: `${E}?s=objetivos` },
  ];
  const items: ReadinessItem[] = raw.map((i) => ({ ...i, weight: i.points }));

  const categories = READINESS_CATEGORIES.map((c) => {
    const earned = items.filter((i) => i.category === c.key && i.done).reduce((s, i) => s + i.points, 0);
    return { ...c, earned };
  });
  const score = categories.reduce((s, c) => s + c.earned, 0);

  const pending = items.filter((i) => !i.done).sort((x, y) => y.points - x.points);
  const plan = pending.slice(0, 3);
  const target = score + plan.reduce((s, i) => s + i.points, 0);

  return {
    score,
    items,
    categories,
    nextAction: pending[0] ?? null,
    plan,
    target,
    /** Compatibilidad: porcentaje por categoría. */
    blocks: categories.map((c) => ({ block: c.key, label: c.label, pct: Math.round((c.earned / c.max) * 100) })),
  };
}

export type Readiness = ReturnType<typeof computeReadiness>;
