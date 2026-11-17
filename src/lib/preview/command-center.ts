/** Datos FICTICIOS para el probador interno (/preview/command-center). Nunca se usan en producción. */
import { computeReadiness } from '@/lib/domain/readiness';
import { galaMatch, type AthleteContext } from '@/lib/domain/gala-match/engine';
import { journey, prioritize, stageOf, type DashboardInput } from '@/lib/domain/dashboard';
import type { AthleteDashboard } from '@/lib/data/dashboard';

const ctx = { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: 2, graduation_year: 2027, pathways: ['ncaa_d2'], countries: ['US'], regions: [], intended_majors: ['Business'], school_size: 'medium', sport_level: 'competitive', campus_setting: 'urban', scholarship_need: 'partial', annual_budget_usd: 30000, gpa: 8.7, gpa_scale: 10, education_system: 'es', has_english_certificate: false, has_highlight: true, has_full_game: false, verified_stats: 0 } as unknown as AthleteContext;
const inst = (id: string, name: string, state: string, city: string) => ({ kind: 'institution' as const, id, name, state, city, sports_offered: ['basketball'], division: 'ncaa_d2', association: 'ncaa', athletic_source: 'manual_admin', ownership: 'private_nonprofit', locale: 'city', enrollment: 9000, cost_attendance_usd: 38000, tuition_in_state_usd: 28000, tuition_out_of_state_usd: 28000, program_cips: ['5214'] });
const insts = [inst('i1', 'Universidad Ficticia del Norte', 'FL', 'Ciudad Ejemplo'), inst('i2', 'College Demo del Lago', 'OH', 'Villa Demo')];
const scored = insts.map((i) => ({ inst: i, m: galaMatch(ctx, i as never), saved: false, activeOpps: 1 }));

const readiness = computeReadiness({
  profile: { sport_id: 'basketball', primary_position_id: 1, graduation_year: 2027, height_cm: 180, current_team: 'Club Demo', competitive_level: 'national', city: 'Valencia', nationality: 'ES', username: 'lucia-demo' } as never,
  academics: { gpa: 8.7, education_system: 'es' } as never,
  statsCount: 3, languagesCount: 1, achievementsCount: 1, hasFamilyLink: false, isMinor: false,
  videos: [{ kind: 'highlight', is_featured: true }] as never,
});
const in7 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const input: DashboardInput = {
  readiness, unseenMatches: 2, savedUniversities: 2, savedOpportunities: 1, applications: [], offers: [],
  officialDeadlines: [{ id: 'o1', title: 'Beca deportiva demo', date: in7, href: '#' }], highMatchOpportunities: 1, isMinor: false, seeksUSCollege: true,
};

export const previewCommandCenter = {
  passport: { readiness, profile: { username: 'lucia-demo' } },
  photo: null, seeksUSCollege: true, stage: stageOf(input), actions: prioritize(input), journey: journey(input), doneRecently: 1,
  modules: {
    matches: { ok: true, data: { unseen: scored, unseenCount: 2, top: scored, directoryEmpty: false } },
    opportunities: { ok: true, data: [{ opp: { id: 'o1', title: 'Beca deportiva demo', org_name: 'Organización Ficticia', deadline: in7 }, m: scored[0].m, saved: true }] },
    shortlist: { ok: true, data: { items: [{ target_id: 'i1', name: 'Universidad Ficticia del Norte', m: scored[0].m }], total: 2, withActive: 1 } },
    deadlines: { ok: true, data: [{ id: 'o1', title: 'Beca deportiva demo', date: in7, href: '#', kind: 'official', label: 'Plazo oficial' }] },
    changes: [], views: { total: 4, uniqueMembers: 2, universities: 1, clubs: 1, organizations: ['Organización Ficticia'] }, linkViews: 3,
    activity: { ok: true, data: [] }, applications: [], offers: [],
  },
} as unknown as AthleteDashboard;
