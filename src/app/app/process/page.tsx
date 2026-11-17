import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { managedAthletes } from '@/lib/data/family';
import { loadPipeline } from '@/lib/data/pipeline';
import { ButtonLink, Card, EmptyState, Notice, PageHeader } from '@/components/ui';
import { PipelineView, type PipelineFilters } from '@/components/pipeline/PipelineView';
import { TaskForm } from '@/components/pipeline/PipelineForms';
import { AskGala } from '@/components/AskGala';

export const metadata: Metadata = { title: 'Mi pipeline' };

type SP = { a?: string; view?: string; stage?: string; kind?: string; urgent?: string; archived?: string; sort?: string };

export default async function ProcessPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  if (!athletes.length) {
    return (<><PageHeader kicker="Recruiting" title="Mi pipeline" /><EmptyState title="Vincula primero a tu hijo o hija" action={<ButtonLink href="/app/family">Ir a Familia</ButtonLink>} /></>);
  }
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  let rows: Awaited<ReturnType<typeof loadPipeline>> | null = null;
  try { rows = await loadPipeline(athlete.id); } catch { rows = null; }
  const f: PipelineFilters = {
    view: sp.view === 'list' || sp.archived ? 'list' : 'board',
    stage: sp.stage, kind: sp.kind === 'institution' || sp.kind === 'opportunity' ? sp.kind : undefined,
    urgent: sp.urgent === '1', archived: sp.archived === '1',
    sort: (['updated', 'deadline', 'name'] as const).find((s) => s === sp.sort) ?? 'urgency',
  };
  const params = { a: athletes.length > 1 ? athlete.id : undefined, view: sp.view, stage: sp.stage, kind: sp.kind, urgent: sp.urgent, archived: sp.archived, sort: sp.sort };

  return (
    <>
      <PageHeader
        kicker="Recruiting"
        title="Mi pipeline"
        description="Cada universidad y oportunidad que sigues, en qué punto está y qué toca hacer. Lo que hace la organización llega solo; lo demás lo registras tú."
        action={<ButtonLink href="/app/match" variant="secondary">Añadir desde Gala Match</ButtonLink>}
      />
      {athletes.length > 1 && (
        <nav aria-label="Atleta" className="mb-4 flex flex-wrap gap-2">
          {athletes.map((a) => <Link key={a.id} href={`/app/process?a=${a.id}`} aria-current={a.id === athlete.id ? 'page' : undefined} className={`rounded-full border px-3 py-1 text-xs font-semibold ${a.id === athlete.id ? 'border-brass text-brass' : 'border-line text-muted'}`}>{a.name}</Link>)}
        </nav>
      )}
      {rows == null ? (
        <Notice tone="danger">No hemos podido cargar tu pipeline. <Link href="/app/process" className="font-semibold underline">Reintentar</Link></Notice>
      ) : rows.length === 0 ? (
        <EmptyState title="Tu pipeline está vacío" action={<ButtonLink href="/app/match">Ver mis matches</ButtonLink>}>
          Guarda universidades u oportunidades desde Gala Match o el directorio y aparecerán aquí. Cuando te presentes a una oportunidad, su proceso se crea solo.
        </EmptyState>
      ) : (
        <PipelineView rows={rows} f={f} athlete={athlete.id} params={params} editable={athlete.canEdit} />
      )}
      {session.roles.includes('athlete') && (
        <details className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <summary className="cursor-pointer font-semibold text-brass">Pregunta a Gala sobre tu pipeline</summary>
          <div className="mt-4"><AskGala compact context="process" /></div>
        </details>
      )}
      {athlete.canEdit && (
        <Card className="mt-6">
          <h2 className="mb-3 font-display text-lg font-bold text-paper">Tarea general</h2>
          <TaskForm athlete={athlete.id} />
        </Card>
      )}
    </>
  );
}
