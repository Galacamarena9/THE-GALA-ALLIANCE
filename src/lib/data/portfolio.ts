import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations, type MyOrg } from '@/lib/data/orgs';
import { isRepStatus, portfolioStats, type AgencyNote, type PortfolioEntry, type PortfolioStats } from '@/lib/domain/portfolio';

export interface PortfolioData {
  agencies: MyOrg[];
  entries: PortfolioEntry[];
  notes: AgencyNote[];
  stats: PortfolioStats;
}

type RepRow = {
  id: string; agency_id: string; agent_id: string; athlete_id: string; status: string; message: string | null;
  created_at: string; responded_at: string | null; ended_at: string | null;
};
type DirRow = {
  user_id: string; display_name: string | null; avatar_url: string | null; country: string | null; sport_id: string | null;
  primary_position_id: number | null; graduation_year: number | null; current_team: string | null; has_video: boolean | null;
};

/**
 * Cartera completa de las agencias del usuario: todas las representaciones (cualquier estado),
 * datos del directorio y notas internas. 5 consultas en total, sin N+1.
 * La RLS decide qué ve cada uno; si el directorio oculta a un atleta, se usa su perfil mínimo.
 */
export const loadPortfolio = cache(async (userId: string): Promise<PortfolioData> => {
  const supabase = await createClient();
  const agencies = (await myOrganizations(userId)).filter((o) => o.type === 'agency');
  const agencyIds = agencies.map((a) => a.id);
  if (!agencyIds.length) return { agencies, entries: [], notes: [], stats: portfolioStats([], []) };

  const [{ data: reps }, { data: notes }] = await Promise.all([
    supabase
      .from('agent_representations')
      .select('id, agency_id, agent_id, athlete_id, status, message, created_at, responded_at, ended_at')
      .in('agency_id', agencyIds)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('agency_athlete_notes')
      .select('id, agency_id, athlete_id, author_id, kind, body, due_date, done, done_at, created_at, updated_at')
      .in('agency_id', agencyIds)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const repRows = (reps ?? []) as RepRow[];
  const athleteIds = [...new Set(repRows.map((r) => r.athlete_id))];

  const [{ data: dir }, { data: profiles }] = athleteIds.length
    ? await Promise.all([
        supabase
          .from('athlete_directory')
          .select('user_id, display_name, avatar_url, country, sport_id, primary_position_id, graduation_year, current_team, has_video')
          .in('user_id', athleteIds),
        supabase.from('profiles').select('id, display_name, avatar_url, country').in('id', athleteIds),
      ])
    : [{ data: [] }, { data: [] }];

  const dirById = new Map(((dir ?? []) as DirRow[]).map((d) => [d.user_id, d]));
  const profById = new Map((profiles ?? []).map((p) => [p.id as string, p as { display_name: string | null; avatar_url: string | null; country: string | null }]));

  const sportIds = [...new Set([...dirById.values()].map((d) => d.sport_id).filter((s): s is string => Boolean(s)))];
  const positionIds = [...new Set([...dirById.values()].map((d) => d.primary_position_id).filter((p): p is number => p != null))];
  const [{ data: sports }, { data: positions }] = await Promise.all([
    sportIds.length ? supabase.from('sports').select('id, name_es').in('id', sportIds) : Promise.resolve({ data: [] }),
    positionIds.length ? supabase.from('sport_positions').select('id, name_es').in('id', positionIds) : Promise.resolve({ data: [] }),
  ]);
  const sportName = new Map((sports ?? []).map((s) => [s.id as string, s.name_es as string]));
  const positionName = new Map((positions ?? []).map((p) => [p.id as number, p.name_es as string]));

  const noteRows = (notes ?? []) as AgencyNote[];
  const lastNote = new Map<string, string>();
  for (const n of noteRows) {
    const k = `${n.agency_id}:${n.athlete_id}`;
    if (!lastNote.has(k)) lastNote.set(k, n.created_at); // ya vienen ordenadas de más reciente a más antigua
  }
  const agencyName = new Map(agencies.map((a) => [a.id, a.name]));

  const entries: PortfolioEntry[] = repRows
    .filter((r) => isRepStatus(r.status))
    .map((r) => {
      const d = dirById.get(r.athlete_id);
      const p = profById.get(r.athlete_id);
      return {
        repId: r.id,
        agencyId: r.agency_id,
        agencyName: agencyName.get(r.agency_id) ?? 'Agencia',
        agentId: r.agent_id,
        athleteId: r.athlete_id,
        status: r.status as PortfolioEntry['status'],
        message: r.message,
        createdAt: r.created_at,
        respondedAt: r.responded_at,
        endedAt: r.ended_at,
        name: d?.display_name || p?.display_name || 'Atleta',
        avatarUrl: d?.avatar_url ?? p?.avatar_url ?? null,
        country: d?.country ?? p?.country ?? null,
        sportId: d?.sport_id ?? null,
        sportName: d?.sport_id ? sportName.get(d.sport_id) ?? null : null,
        positionName: d?.primary_position_id != null ? positionName.get(d.primary_position_id) ?? null : null,
        graduationYear: d?.graduation_year ?? null,
        currentTeam: d?.current_team ?? null,
        hasVideo: Boolean(d?.has_video),
        lastNoteAt: lastNote.get(`${r.agency_id}:${r.athlete_id}`) ?? null,
      };
    });

  return { agencies, entries, notes: noteRows, stats: portfolioStats(entries, noteRows) };
});

export interface AthleteDetail {
  headline: string | null;
  bio: string | null;
  heightCm: number | null;
  dominantSide: string | null;
  city: string | null;
  competitiveLevel: string | null;
  targetDivisions: string[];
  intendedMajor: string | null;
  videoUrl: string | null;
  gpa: number | null;
  gpaScale: number | null;
  englishTest: string | null;
  englishScore: string | null;
  sat: number | null;
  schoolYear: string | null;
}

/**
 * Ficha de gestión de un atleta: solo si está (o estuvo) en la cartera del usuario.
 * Los datos deportivos y académicos llegan filtrados por la RLS y la visibilidad que eligió el atleta.
 */
export async function loadAthleteWorkspace(userId: string, athleteId: string) {
  const portfolio = await loadPortfolio(userId);
  const history = portfolio.entries.filter((e) => e.athleteId === athleteId);
  if (!history.length) return null;

  const supabase = await createClient();
  const notes = portfolio.notes.filter((n) => n.athlete_id === athleteId);
  const authorIds = [...new Set(notes.map((n) => n.author_id))];
  const [{ data: ap }, { data: ac }, { data: authors }] = await Promise.all([
    supabase
      .from('athlete_profiles')
      .select('headline, bio, height_cm, dominant_side, city, competitive_level, target_divisions, intended_major, highlight_video_url')
      .eq('user_id', athleteId)
      .maybeSingle(),
    supabase
      .from('athlete_academics')
      .select('gpa, gpa_scale, english_test, english_score, sat_score, school_year')
      .eq('athlete_id', athleteId)
      .maybeSingle(),
    authorIds.length ? supabase.from('profiles').select('id, display_name').in('id', authorIds) : Promise.resolve({ data: [] }),
  ]);

  const detail: AthleteDetail = {
    headline: ap?.headline ?? null,
    bio: ap?.bio ?? null,
    heightCm: ap?.height_cm ?? null,
    dominantSide: ap?.dominant_side ?? null,
    city: ap?.city ?? null,
    competitiveLevel: ap?.competitive_level ?? null,
    targetDivisions: (ap?.target_divisions as string[] | null) ?? [],
    intendedMajor: ap?.intended_major ?? null,
    videoUrl: ap?.highlight_video_url ?? null,
    gpa: ac?.gpa != null ? Number(ac.gpa) : null,
    gpaScale: ac?.gpa_scale != null ? Number(ac.gpa_scale) : null,
    englishTest: ac?.english_test ?? null,
    englishScore: ac?.english_score ?? null,
    sat: ac?.sat_score ?? null,
    schoolYear: ac?.school_year ?? null,
  };

  return {
    current: history[0], // la más reciente
    history,
    notes,
    authorName: new Map((authors ?? []).map((a) => [a.id as string, (a.display_name as string) || 'Miembro de la agencia'])),
    detail,
    agencies: portfolio.agencies,
  };
}
