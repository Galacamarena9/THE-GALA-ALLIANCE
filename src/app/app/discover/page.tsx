import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import type { Division } from '@/lib/types';
import { AthleteCard, type DirectoryRow } from '@/components/AthleteCard';
import { EmptyState, Notice, PageHeader, inputClass } from '@/components/ui';
import { saveAthlete } from '@/app/actions/lists';
import { AiSearchBar } from '@/components/AiSearchBar';
import { SaveSearchForm } from '@/components/growth';

export const metadata: Metadata = { title: 'Descubrir talento' };

const PAGE_SIZE = 24;
const DIVISIONS = Object.keys(DIVISION_LABEL) as Division[];

type Search = { sport?: string; position?: string; grad?: string; division?: string; gpa?: string; video?: string; q?: string; page?: string };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireSession();
  const canSave = session.roles.some((r) => ['university', 'coach', 'agent', 'brand', 'admin'].includes(r));
  const sp = await searchParams;
  const supabase = await createClient();
  const catalog = await loadCatalog();
  const page = Math.max(1, Number(sp.page) || 1);

  const { data: orgs } = await supabase
    .from('organization_members')
    .select('organizations(type, verification_status)')
    .eq('user_id', session.userId);
  const verifiedRecruiter = (orgs ?? []).some((m) => {
    const o = m.organizations as unknown as { type: string; verification_status: string } | null;
    return o?.verification_status === 'verified' && ['university', 'college', 'club', 'academy'].includes(o.type);
  });

  // Filtros en el servidor. La RLS (security_invoker) decide qué filas existen para este usuario.
  let query = supabase
    .from('athlete_directory')
    .select('*', { count: 'exact' })
    .eq('open_to_opportunities', true)
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (sp.sport) query = query.eq('sport_id', sp.sport);
  if (sp.position && /^\d+$/.test(sp.position)) query = query.or(`primary_position_id.eq.${sp.position},secondary_position_id.eq.${sp.position}`);
  if (sp.grad && /^\d{4}$/.test(sp.grad)) query = query.eq('graduation_year', Number(sp.grad));
  if (sp.division && DIVISIONS.includes(sp.division as Division)) query = query.contains('target_divisions', [sp.division]);
  if (sp.video === '1') query = query.eq('has_video', true);
  if (sp.q) query = query.ilike('display_name', `%${sp.q.replace(/[%_,()]/g, '').slice(0, 60)}%`);

  let gpaNote: string | null = null;
  if (sp.gpa && /^\d(\.\d{1,2})?$/.test(sp.gpa)) {
    // Solo filtra sobre académicos que el atleta comparte contigo.
    const { data: ids } = await supabase.from('athlete_academics').select('athlete_id').gte('gpa_4', Number(sp.gpa)).limit(1000);
    query = query.in('user_id', (ids ?? []).map((r) => r.athlete_id));
    gpaNote = 'El filtro de nota solo incluye atletas que comparten su bloque académico contigo.';
  }

  const [{ data, count, error }, { data: saved }] = await Promise.all([
    query,
    supabase.from('saved_athletes').select('athlete_id').eq('owner_id', session.userId),
  ]);
  const rows = (data ?? []) as DirectoryRow[];
  const savedIds = new Set((saved ?? []).map((s) => s.athlete_id));
  const positionsForSport = catalog.positions.filter((p) => !sp.sport || p.sport_id === sp.sport);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const thisYear = new Date().getFullYear();
  const qs = (patch: Partial<Search>) => {
    const next = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        kicker="Escaparate"
        title="Talento con nivel, juegue donde juegue"
        description="Perfiles estructurados y comparables. Cada dato indica si es declarado, documentado o verificado. Prueba a describir lo que buscas a Gala IA."
      />
      {canSave && <div className="mb-5"><AiSearchBar /></div>}

      {(session.roles.includes('coach') || session.roles.includes('university')) && !verifiedRecruiter && (
        <div className="mb-5">
          <Notice>
            Tu organización está pendiente de verificación. Hasta entonces solo ves atletas mayores de edad. <Link href="/app/organization" className="underline">Ver estado</Link>
          </Notice>
        </div>
      )}
      {!verifiedRecruiter && !(session.roles.includes('coach') || session.roles.includes('university')) && (
        <div className="mb-5"><Notice tone="neutral">Por protección de menores, solo se muestran atletas mayores de edad que han elegido ser visibles.</Notice></div>
      )}

      <form method="get" className="mb-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-3 lg:grid-cols-7">
        <input name="q" defaultValue={sp.q} placeholder="Nombre" aria-label="Buscar por nombre" className={`${inputClass} lg:col-span-2`} />
        <select name="sport" defaultValue={sp.sport ?? ''} aria-label="Deporte" className={inputClass}>
          <option value="">Deporte</option>
          {catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
        </select>
        <select name="position" defaultValue={sp.position ?? ''} aria-label="Posición" className={inputClass}>
          <option value="">Posición</option>
          {positionsForSport.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
        </select>
        <select name="grad" defaultValue={sp.grad ?? ''} aria-label="Año de graduación" className={inputClass}>
          <option value="">Graduación</option>
          {Array.from({ length: 6 }, (_, i) => thisYear + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select name="division" defaultValue={sp.division ?? ''} aria-label="División objetivo" className={inputClass}>
          <option value="">División</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{DIVISION_LABEL[d]}</option>)}
        </select>
        <select name="gpa" defaultValue={sp.gpa ?? ''} aria-label="Nota mínima" className={inputClass}>
          <option value="">GPA mín.</option>
          {['2.3', '2.5', '3.0', '3.5'].map((g) => <option key={g} value={g}>≥ {g}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="video" value="1" defaultChecked={sp.video === '1'} className="accent-[var(--color-brass)]" /> Solo con vídeo
        </label>
        <div className="flex gap-2 lg:col-span-2 lg:justify-end">
          <Link href="/app/discover" className="rounded-lg px-4 py-2.5 text-sm text-muted hover:text-paper">Limpiar</Link>
          <button className="rounded-lg bg-brass px-4 py-2.5 text-sm font-medium text-ink hover:bg-brass-soft">Buscar</button>
        </div>
      </form>

      {canSave && (
        <div className="mb-4">
          <SaveSearchForm filters={Object.fromEntries((['sport', 'position', 'grad', 'division', 'gpa', 'video', 'q'] as const).filter((k) => sp[k]).map((k) => [k, String(sp[k])]))} />
        </div>
      )}
      {gpaNote && <p className="mb-4 text-xs text-faint">{gpaNote}</p>}
      {error && <Notice tone="danger">No se ha podido cargar el directorio.</Notice>}
      <p className="mb-4 text-sm text-muted">{count ?? 0} atleta(s)</p>

      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <li key={a.user_id}>
              <AthleteCard
                a={a}
                sportName={catalog.sports.find((s) => s.id === a.sport_id)?.name_es}
                positionName={catalog.positions.find((p) => p.id === a.primary_position_id)?.name_es}
                footer={
                  !canSave ? undefined : savedIds.has(a.user_id) ? (
                    <span className="text-xs text-ok">✓ En tu shortlist</span>
                  ) : (
                    <form action={saveAthlete}>
                      <input type="hidden" name="athlete_id" value={a.user_id} />
                      <button className="w-full rounded-lg border border-line-strong py-2 text-sm text-paper hover:border-brass">Guardar en shortlist</button>
                    </form>
                  )
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Sin resultados con estos filtros">Prueba a quitar algún filtro. Solo aparecen atletas que están abiertos a oportunidades y comparten su perfil contigo.</EmptyState>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="text-brass hover:underline">← Anterior</Link>}
          <span className="text-muted">Página {page} de {totalPages}</span>
          {page < totalPages && <Link href={qs({ page: String(page + 1) })} className="text-brass hover:underline">Siguiente →</Link>}
        </nav>
      )}
    </>
  );
}
