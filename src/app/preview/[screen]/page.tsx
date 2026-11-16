import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentHomeView } from '@/app/app/AgentHome';
import { PortfolioView } from '@/app/app/portfolio/PortfolioView';
import { DEFAULT_FILTERS } from '@/lib/domain/portfolio';
import { previewPortfolio, previewSports, previewCases } from '@/lib/preview/fixtures';
import { PipelineBoard } from '@/components/agency/PipelineBoard';
import { ROLE_SHORTCUTS, RoleHero, ShortcutTiles } from '@/components/RoleHero';
import { PlanUnlocks } from '@/components/PlanUnlocks';
import { AthleteCard } from '@/components/AthleteCard';
import { ProgressRing } from '@/components/ProgressRing';

/**
 * Probador interno de pantallas con datos ficticios. Solo existe si ENABLE_PREVIEW=1
 * (nunca en producción): sirve para revisar el diseño de cada rol sin cuentas reales.
 */
export const metadata: Metadata = { title: 'Probador interno', robots: { index: false, follow: false } };

const SCREENS = ['agent-home', 'portfolio', 'athlete-home', 'coach-home', 'pipeline', 'pipeline-table'] as const;

export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.ENABLE_PREVIEW !== '1') notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const d = previewPortfolio;
  return (
    <div className="min-h-dvh bg-ink px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {(screen === 'pipeline' || screen === 'pipeline-table') && (
          <PipelineBoard cases={previewCases} view={screen === 'pipeline' ? 'board' : 'table'} sportName={new Map(previewSports.map((s) => [s.id, s.name_es]))} writableAgencies={new Set(['org-1'])} />
        )}
        {screen === 'agent-home' && <AgentHomeView displayName="Carlos Ruiz" data={d} sports={previewSports} />}
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
        {screen === 'portfolio' && <PortfolioView agencies={d.agencies} entries={d.entries} stats={d.stats} filters={DEFAULT_FILTERS} />}
      </div>
    </div>
  );
}
