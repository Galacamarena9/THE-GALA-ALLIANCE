import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentHomeView } from '@/app/app/AgentHome';
import { PortfolioView } from '@/app/app/portfolio/PortfolioView';
import { DEFAULT_FILTERS } from '@/lib/domain/portfolio';
import { previewPortfolio, previewSports } from '@/lib/preview/fixtures';
import { ROLE_SHORTCUTS, RoleHero, ShortcutTiles } from '@/components/RoleHero';
import { PlanUnlocks } from '@/components/PlanUnlocks';

/**
 * Probador interno de pantallas con datos ficticios. Solo existe si ENABLE_PREVIEW=1
 * (nunca en producción): sirve para revisar el diseño de cada rol sin cuentas reales.
 */
export const metadata: Metadata = { title: 'Probador interno', robots: { index: false, follow: false } };

const SCREENS = ['agent-home', 'portfolio', 'athlete-home', 'coach-home'] as const;

export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.ENABLE_PREVIEW !== '1') notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const d = previewPortfolio;
  return (
    <div className="min-h-dvh bg-ink px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
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
            {screen === 'athlete-home' && <PlanUnlocks plan="family_core" />}
          </div>
        )}
        {screen === 'portfolio' && <PortfolioView agencies={d.agencies} entries={d.entries} stats={d.stats} filters={DEFAULT_FILTERS} />}
      </div>
    </div>
  );
}
