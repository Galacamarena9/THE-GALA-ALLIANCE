import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { loadPortfolio } from '@/lib/data/portfolio';
import { parseFilters } from '@/lib/domain/portfolio';
import { PortfolioView } from './PortfolioView';

export const metadata: Metadata = { title: 'Cartera' };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(['agent']);
  const filters = parseFilters(await searchParams);
  const { agencies, entries, stats } = await loadPortfolio(session.userId);
  return <PortfolioView agencies={agencies} entries={entries} stats={stats} filters={filters} />;
}
