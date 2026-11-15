import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentHomeView } from '@/app/app/AgentHome';
import { PortfolioView } from '@/app/app/portfolio/PortfolioView';
import { DEFAULT_FILTERS } from '@/lib/domain/portfolio';
import { previewPortfolio, previewSports } from '@/lib/preview/fixtures';

/**
 * Probador interno de pantallas con datos ficticios. Solo existe si ENABLE_PREVIEW=1
 * (nunca en producción): sirve para revisar el diseño de cada rol sin cuentas reales.
 */
export const metadata: Metadata = { title: 'Probador interno', robots: { index: false, follow: false } };

const SCREENS = ['agent-home', 'portfolio'] as const;

export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.ENABLE_PREVIEW !== '1') notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const d = previewPortfolio;
  return (
    <div className="min-h-dvh bg-ink px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {screen === 'agent-home' && <AgentHomeView displayName="Carlos Ruiz" data={d} sports={previewSports} />}
        {screen === 'portfolio' && <PortfolioView agencies={d.agencies} entries={d.entries} stats={d.stats} filters={DEFAULT_FILTERS} />}
      </div>
    </div>
  );
}
