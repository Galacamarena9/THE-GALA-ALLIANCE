import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShellPreview } from '../ShellPreview';
import { previewAgentHome, previewCrmRows } from '@/lib/preview/agent-home';
import { AgentHomeView } from '@/app/app/AgentHome';
import { AthletesCrm } from '@/app/app/portfolio/AthletesCrm';
import { DEFAULT_CRM } from '@/lib/domain/athletes-crm';
import { Athlete360View } from '@/app/app/portfolio/[athleteId]/Athlete360View';
import { previewAthlete360 } from '@/lib/preview/athlete-360';
import { parseA360Tab } from '@/lib/domain/athlete-360';
import { previewPortfolio, previewSports, previewCases } from '@/lib/preview/fixtures';
import { PipelineBoard } from '@/components/agency/PipelineBoard';
import { ROLE_SHORTCUTS, RoleHero, ShortcutTiles } from '@/components/RoleHero';
import { PlanUnlocks } from '@/components/PlanUnlocks';
import { AthleteCard } from '@/components/AthleteCard';
import { ProgressRing } from '@/components/ProgressRing';
import { MatchBreakdown } from '@/components/MatchBreakdown';
import { matchAthleteToOpportunity } from '@/lib/domain/match';
import { PassportView, type PassportViewData } from '@/components/passport/PassportView';
import { galaMatch } from '@/lib/domain/gala-match/engine';
import { AthleteCommandCenter } from '@/components/dashboard/AthleteCommandCenter';
import { previewCommandCenter, previewPipeline } from '@/lib/preview/command-center';
import { PipelineView } from '@/components/pipeline/PipelineView';
import { ConfidenceBadge, DimensionChips, MatchBreakdownV2, MatchScore } from '@/components/match/MatchParts';

/** Atleta FICTICIA para revisar el diseño del Passport sin datos reales. */
const demoPassport: PassportViewData = {
  athleteId: '00000000-0000-0000-0000-000000000000', name: 'Lucía Martínez', country: 'ES', photoUrl: null, age: 18,
  profile: {
    user_id: '0', headline: 'Base zurda, visión de juego y defensa al hombre. Busco NCAA D-I o D-II para estudiar Business.', bio: null,
    sport_id: 'basketball', primary_position_id: 1, secondary_position_id: 2, graduation_year: 2027, height_cm: 178, weight_kg: null, dominant_side: 'left',
    current_team: 'Club Ficticio Valencia', competitive_level: 'Junior nacional', league: 'Liga Junior Autonómica', years_experience: 9, city: 'Valencia', nationality: 'ES',
    target_divisions: ['ncaa_d1', 'ncaa_d2'], intended_major: 'Business', open_to_opportunities: true, highlight_video_url: null, username: 'lucia-martinez',
    profile_visibility: 'public', academics_visibility: 'verified_orgs', stats_visibility: 'public', sport_visibility: 'public', videos_visibility: 'members', goals_visibility: 'verified_orgs', updated_at: '',
  },
  academics: { athlete_id: '0', gpa: 8.7, gpa_scale: 10, grade_display: '8,7 / 10', education_system: 'es', school_name: 'IES Ficticio', english_test: null, english_score: null, cambridge_level: 'c1', toefl_score: null, ielts_score: null, duolingo_score: null, sat_score: null, act_score: null, school_year: 'bach_2', gpa_source: 'documented', english_source: 'documented', tests_source: 'self_reported' },
  stats: [
    { id: 's1', season: '2025-26', value: 14.2, team: 'Club Ficticio Valencia', competition: 'Liga Junior', source: 'club_verified', sport_stat_definitions: { code: 'ppg', label_es: 'Puntos por partido', unit: 'pts', sort_order: 1 } },
    { id: 's2', season: '2025-26', value: 5.1, team: 'Club Ficticio Valencia', competition: 'Liga Junior', source: 'club_verified', sport_stat_definitions: { code: 'apg', label_es: 'Asistencias por partido', unit: 'ast', sort_order: 3 } },
    { id: 's3', season: '2025-26', value: 41, team: 'Club Ficticio Valencia', competition: 'Liga Junior', source: 'self_reported', sport_stat_definitions: { code: 'fg_pct', label_es: '% tiro de campo', unit: '%', sort_order: 4 } },
    { id: 's4', season: '2025-26', value: 2.3, team: 'Club Ficticio Valencia', competition: 'Liga Junior', source: 'self_reported', sport_stat_definitions: { code: 'spg', label_es: 'Robos por partido', unit: 'rob', sort_order: 7 } },
  ],
  languages: [{ language_code: 'es', level: 'native' }, { language_code: 'en', level: 'c1' }],
  achievements: [
    { id: 'a1', title: 'Campeonato autonómico junior', year: 2025, description: null, source: 'self_reported', kind: 'championship', level: 'regional' },
    { id: 'a2', title: 'Capitana del equipo', year: 2025, description: null, source: 'self_reported', kind: 'captaincy', level: 'club' },
  ],
  career: [{ id: 'c1', team: 'Escuela Ficticia', league: 'Cadete', country: 'ES', season_from: '2021-22', season_to: '2023-24', role: 'Titular' }],
  videos: [{ id: 'v1', kind: 'highlight', url: 'https://www.hudl.com/video/ejemplo', title: 'Highlights 2025-26', season: '2025-26', is_featured: true }],
  goals: { athlete_id: '0', pathways: ['ncaa_d1', 'ncaa_d2'], countries: ['US'], regions: ['Florida'], intended_majors: ['Business'], school_size: 'medium', sport_level: 'competitive', scholarship_need: 'partial', campus_setting: 'any', start_term: '2027-08' },
  links: [], recs: [], sportName: 'Baloncesto', position: 'Base', position2: 'Escolta',
};
import { PublicOpportunityView } from '@/app/oportunidades/[id]/View';
import { TrialsBoard } from '@/components/trials/TrialsBoard';
import { TrialPanel } from '@/components/trials/TrialPanel';
import { FamilyTrialCenter } from '@/components/trials/FamilyTrialCenter';
import { FamilyHome, FamilyOnboarding } from '@/components/family/FamilyHome';
import { CostComparison } from '@/components/family/CostComparison';
import { familyNextAction } from '@/lib/domain/family';
import { previewFamilyChild, previewFamilyLinks, previewFamilyToday, previewScenarios } from '@/lib/preview/family';
import { previewTrials, previewTrialPanel, previewFamilyTrials, previewProgram } from '@/lib/preview/trials';
import { ProgramPanel } from '@/components/trials/ProgramPanel';
import type { PublicOpportunity } from '@/lib/data/public-opportunity';

// Oportunidad pública ficticia (organización y cifras inventadas solo para revisar el diseño).
const demoPublicOpp: PublicOpportunity = {
  id: '00000000-0000-0000-0000-000000000000', title: 'Beca parcial de baloncesto femenino (ejemplo)', type: 'athletic_scholarship', sport_id: 'basketball',
  position_ids: [], graduation_years: [2027, 2028], division: 'ncaa_d2', min_gpa_4: 2.5, english_required: 'TOEFL 79', location: 'Ohio, EE. UU.', start_term: 'Otoño 2027',
  places: 2, deadline: '2027-03-01', annual_cost_usd: 42000, aid_amount_usd: 28000, financial_source: 'organization_provided',
  description: 'Ejemplo ficticio para revisar el diseño. Buscamos bases y escoltas con buena lectura de juego.\nIncluye alojamiento en campus.',
  status: 'published', is_reviewed: false, updated_at: new Date().toISOString(),
  organizations: { name: 'Universidad de ejemplo', type: 'university', verification_status: 'verified', website: 'https://example.edu' },
};

/**
 * Probador interno de pantallas con datos ficticios. Solo existe si ENABLE_PREVIEW=1
 * (nunca en producción): sirve para revisar el diseño de cada rol sin cuentas reales.
 */
export const metadata: Metadata = { title: 'Probador interno', robots: { index: false, follow: false } };

const SCREENS = ['athlete-360', 'athlete-360-empty', 'athlete-360-viewer', 'athlete-360-locked', 'portfolio-100', 'portfolio-empty', 'agent-home', 'agent-home-empty', 'agent-home-partial', 'agent-home-no-agency', 'agent-home-error', 'portfolio', 'athlete-home', 'coach-home', 'pipeline', 'pipeline-table', 'match', 'opportunity', 'passport', 'galamatch', 'command-center', 'athlete-pipeline', 'club-trials', 'trial-club', 'trial-athlete', 'family-trials', 'program-athlete', 'family-home', 'family-costs', 'family-welcome', 'shell-agent', 'shell-athlete', 'shell-university', 'shell-operations'] as const;

// Gala Match con el motor real y datos ficticios: un Passport completo y otro con muchos datos ausentes.
const demoOpp = { sport_id: 'basketball', position_ids: [1], graduation_years: [2027], division: 'ncaa_d2' as const, min_gpa_4: 2.5, english_required: 'TOEFL 80', annual_cost_usd: 40000, aid_amount_usd: 30000 };
const demoFull = matchAthleteToOpportunity({ sport_id: 'basketball', primary_position_id: 1, secondary_position_id: null, graduation_year: 2027, target_divisions: ['ncaa_d1'], annual_budget_usd: 8000 }, { gpa: 8, gpa_scale: 10, english_test: 'toefl', english_score: '92' }, demoOpp);
const demoThin = matchAthleteToOpportunity({ sport_id: 'basketball', primary_position_id: null, secondary_position_id: null, graduation_year: 2027, target_divisions: [], annual_budget_usd: null }, null, demoOpp);

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ screen: string }>; searchParams: Promise<{ tab?: string }> }) {
  if (process.env.ENABLE_PREVIEW !== '1') notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const d = previewPortfolio;
  if (screen.startsWith('shell-')) {
    const role = ({ 'shell-agent': 'agent', 'shell-athlete': 'athlete', 'shell-university': 'university', 'shell-operations': 'admin' } as const)[screen as 'shell-agent'];
    const people = role === 'agent' ? [...new Map(d.entries.map((e) => [e.athleteId, e])).values()].map((e) => ({ href: `/app/portfolio/${e.athleteId}`, label: e.name, kind: 'Atleta', desc: e.sportName ?? '' })) : [];
    return <ShellPreview role={role} people={people} />;
  }
  return (
    <div className="min-h-dvh bg-ink px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {(screen === 'pipeline' || screen === 'pipeline-table') && (
          <PipelineBoard cases={previewCases} view={screen === 'pipeline' ? 'board' : 'table'} sportName={new Map(previewSports.map((s) => [s.id, s.name_es]))} writableAgencies={new Set(['org-1'])} />
        )}
        {screen.startsWith('agent-home') && <AgentHomeView displayName="Carlos Ruiz" data={previewAgentHome(({ 'agent-home': 'full', 'agent-home-empty': 'empty', 'agent-home-partial': 'partial', 'agent-home-no-agency': 'no_agency', 'agent-home-error': 'error' } as const)[screen as 'agent-home'])} />}
        {(screen === 'athlete-home' || screen === 'coach-home') && (
          <div className="space-y-6">
            <RoleHero
              role={screen === 'athlete-home' ? 'athlete' : 'coach'}
              firstName={screen === 'athlete-home' ? 'Lucía' : 'Marta'}
              status="2 pasos por completar"
              next={{ label: screen === 'athlete-home' ? 'Apúntate a tu primera beca' : 'Explora el escaparate de atletas', href: '#' }}
              stats={screen === 'athlete-home' ? [{ label: 'Passport listo', value: 82, suffix: '%' }, { label: 'Primeros pasos', value: 3, note: 'de 5' }, { label: 'Avisos sin leer', value: 2 }] : [{ label: 'Primeros pasos', value: 2, note: 'de 4' }, { label: 'Avisos sin leer', value: 1 }]}
            />
            <ShortcutTiles items={ROLE_SHORTCUTS[screen === 'athlete-home' ? 'athlete' : 'coach']!} />
            {screen === 'athlete-home' && <div className="flex items-center gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6"><ProgressRing value={82} label="Passport listo" /><p className="font-display text-[28px] font-bold uppercase text-paper">En marcha</p></div>}
            {screen === 'athlete-home' && <PlanUnlocks plan="family_core" />}
            {screen === 'coach-home' && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {([['Lucía Ferrer', 'basketball', 'ES', 'Base', 2027, 178], ['Marco Sanz', 'soccer', 'IT', 'Delantero', 2028, 183], ['Inés Costa', 'athletics', 'PT', 'Velocista', 2027, 171]] as const).map(([n, sp, cc, pos, gy, h], i) => (
                  <AthleteCard key={n} a={{ user_id: `demo-${i}`, display_name: n, country: cc, headline: 'Ejemplo ficticio para revisar el diseño.', sport_id: sp, primary_position_id: null, graduation_year: gy, height_cm: h, current_team: 'Club de ejemplo', competitive_level: null, target_divisions: ['ncaa_d1'], open_to_opportunities: true, has_video: i !== 1 }} sportName={sp === 'basketball' ? 'Baloncesto' : sp === 'soccer' ? 'Fútbol' : 'Atletismo'} positionName={pos} />
                ))}
              </div>
            )}
          </div>
        )}
        {screen === 'athlete-pipeline' && <PipelineView rows={previewPipeline} f={{ view: 'board', sort: 'urgency' }} athlete="" params={{}} editable />}
        {screen === 'command-center' && <AthleteCommandCenter d={previewCommandCenter} firstName="Lucía" isMinor={false} />}
        {screen === 'passport' && <PassportView d={demoPassport} mode="owner" />}
        {screen === 'galamatch' && (() => {
          const m = galaMatch(
            { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: 2, graduation_year: 2027, pathways: ['ncaa_d1', 'ncaa_d2'], countries: ['US'], regions: ['Florida'], intended_majors: ['Business'], school_size: 'medium', sport_level: 'competitive', campus_setting: 'urban', scholarship_need: 'partial', annual_budget_usd: 30000, gpa: 8.7, gpa_scale: 10, education_system: 'es', has_english_certificate: false, has_highlight: true, has_full_game: false, verified_stats: 0 },
            { kind: 'institution', id: 'demo', name: 'Universidad Ficticia', state: 'FL', sports_offered: ['basketball'], division: 'ncaa_d2', association: 'ncaa', athletic_source: 'manual_admin', ownership: 'private_nonprofit', locale: 'city', enrollment: 9000, cost_attendance_usd: 38000, tuition_in_state_usd: 28000, tuition_out_of_state_usd: 28000, program_cips: ['5214'] },
          );
          return (<div className="space-y-6"><div className="flex items-center gap-4"><MatchScore m={m} size="lg" /><div><p className="font-display text-3xl font-bold uppercase text-paper">Universidad Ficticia</p><ConfidenceBadge m={m} /><div className="mt-2"><DimensionChips m={m} /></div></div></div><MatchBreakdownV2 m={m} /></div>);
        })()}
        {screen === 'club-trials' && <div className="mx-auto max-w-xl"><TrialsBoard trials={previewTrials} /></div>}
        {screen === 'trial-club' && <div className="mx-auto max-w-xl space-y-4"><TrialPanel {...previewTrialPanel} me={null} asClub asFamily={false} preview={false} filterHref={(f) => `/preview/trial-club?pf=${f}`} /></div>}
        {screen === 'trial-athlete' && <div className="mx-auto max-w-xl space-y-4"><TrialPanel {...previewTrialPanel} me="00000000-0000-0000-0000-00000000a001" registrations={[]} applications={[]} asClub={false} asFamily={false} preview={false} /></div>}
        {screen === 'program-athlete' && <div className="mx-auto max-w-xl space-y-4"><ProgramPanel {...previewProgram} me="00000000-0000-0000-0000-00000000a001" applications={[]} asClub={false} asFamily /></div>}
        {screen === 'family-trials' && <div className="mx-auto max-w-xl"><FamilyTrialCenter items={previewFamilyTrials} /></div>}
        {screen === 'family-welcome' && <FamilyOnboarding name={previewFamilyLinks[0].name} scopes={previewFamilyLinks[0].scopes} />}
        {screen === 'family-home' && (
          <FamilyHome links={previewFamilyLinks} current={previewFamilyLinks[0]} home={previewFamilyChild} today={previewFamilyToday}
            action={familyNextAction({ today: previewFamilyToday, approvals: previewFamilyChild.approvals, deadlines: previewFamilyChild.deadlines, offers: [], incompleteCosts: 1, missingDocuments: 2, hasAthlete: true })}
            switchHref={(id) => `/preview/family-home?child=${id}`} />
        )}
        {screen === 'family-costs' && <CostComparison scenarios={previewScenarios} budget={{ amount: 15000, currency: 'USD' }} canDelete={false} />}
        {screen === 'opportunity' && <PublicOpportunityView o={demoPublicOpp} sport="Baloncesto" positions={['Base', 'Escolta']} />}
        {screen === 'match' && (
          <div className="grid gap-5 md:grid-cols-2">
            {[demoFull, demoThin].map((m, i) => <section key={i} className="rounded-[var(--radius-card)] border border-line bg-surface p-6"><MatchBreakdown match={m} editHref="#" /></section>)}
          </div>
        )}
        {screen.startsWith('athlete-360') && (
          <Athlete360View
            data={previewAthlete360(screen === 'athlete-360-empty' ? 'empty' : screen === 'athlete-360-viewer' ? 'viewer' : screen === 'athlete-360-locked' ? 'no-permissions' : 'full')}
            tab={parseA360Tab((await searchParams).tab).tab}
            userId="me"
          />
        )}
        {screen.startsWith('portfolio') && <AthletesCrm rows={screen === 'portfolio-100' ? previewCrmRows(100) : screen === 'portfolio-empty' ? [] : previewCrmRows()} initial={DEFAULT_CRM} agency={{ name: 'Norte Sports Management', verified: true }} />}
      </div>
    </div>
  );
}
