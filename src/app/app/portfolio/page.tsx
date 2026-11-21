import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadAgentSources } from '@/lib/data/agent-home';
import { buildAttention } from '@/lib/domain/agent-home';
import { crmRows, parseCrmFilters, type CrmRow, type CrmVerification } from '@/lib/domain/athletes-crm';
import { AthletesCrm, CrmError, CrmNoAgency } from './AthletesCrm';

export const metadata: Metadata = { title: 'Mis atletas' };

/**
 * Prompt 6 · «Mis atletas», el CRM del agente. La proyección se calcula en el servidor con la sesión del agente
 * (RLS de su agencia y permisos de representación) y solo viajan al cliente los campos de CrmRow.
 */
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(['agent']);
  const filters = parseCrmFilters(await searchParams);
  let rows: CrmRow[] = [];
  let partial: string[] = [];
  let agency: { name: string; verified: boolean } | null = null;
  let state: 'ok' | 'no_agency' | 'error' = 'ok';
  try {
    const src = await loadAgentSources(session.userId);
    if (!src) state = 'no_agency';
    else {
    agency = src.agency;
    partial = src.partial;
    const ids = [...new Set(src.entries.map((e) => e.athleteId))];
    // Resumen de verificación desde el directorio: cada bloque sale NULL/false si el atleta no lo comparte.
    const { data: dir } = ids.length
      ? await (await createClient()).from('athlete_directory').select('user_id, has_verified_stats, has_video').in('user_id', ids.slice(0, 1000))
      : { data: [] };
    const verification: CrmVerification[] = ((dir ?? []) as { user_id: string; has_verified_stats: boolean | null; has_video: boolean | null }[])
      .map((d) => ({ athleteId: d.user_id, verifiedStats: !!d.has_verified_stats, video: !!d.has_video }));
    rows = crmRows(src.entries, src.input, buildAttention(src.input), verification);
    }
  } catch {
    state = 'error';
  }
  if (state === 'no_agency') return <CrmNoAgency />;
  if (state === 'error') return <CrmError />;
  return <AthletesCrm rows={rows} initial={filters} agency={agency} partial={partial} />;
}
