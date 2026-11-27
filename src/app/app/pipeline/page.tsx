import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { CASE_PHASES, isCaseStale, cycleOptions, canWrite, stageLabel } from '@/lib/domain/agency-cases';
import { isOverdue } from '@/lib/domain/portfolio';
import { OpenCaseForm } from '@/components/agency/CaseForms';
import { PipelineBoard } from '@/components/agency/PipelineBoard';
import { loadNextActions } from '@/lib/data/next-actions';
import { ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader, inputClass } from '@/components/ui';
import { getT } from '@/lib/i18n/server-t';

export const metadata: Metadata = { title: 'Procesos de recruiting' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function PipelinePage({ searchParams }: { searchParams: SP }) {
  const session = await requireSession(['agent']);
  const sp = await searchParams;
  const tx = await getT();
  const view = one(sp.view) === 'table' ? 'table' : 'board';
  const athleteFilter = one(sp.athlete);
  const ownerFilter = one(sp.owner);
  const data = await loadAgencyCases(session.userId);

  if (!data.agencies.length) {
    return (
      <>
        <PageHeader kicker="Agencia" title="Procesos" description="Cada atleta con cada universidad, en un solo sitio." />
        <EmptyState title="Primero, tu agencia" action={<ButtonLink href="/app/organization">Crear o unirme a una agencia</ButtonLink>}>
          Los procesos pertenecen a una agencia verificada, no a una persona. Así el equipo comparte la información y nada se pierde si alguien se va.
        </EmptyState>
      </>
    );
  }

  const supabase = await createClient();
  const { data: sports } = await supabase.from('sports').select('id, name_es').eq('active', true).order('name_es');
  const sportName = new Map(((sports ?? []) as { id: string; name_es: string }[]).map((s) => [s.id, s.name_es]));

  const writable = data.agencies.filter((a) => canWrite(data.myRole.get(a.id)));
  const cases = data.cases.filter((c) => (!athleteFilter || c.athleteId === athleteFilter) && (!ownerFilter || c.ownerId === ownerFilter));
  const actions = await loadNextActions(session.userId, cases);
  const open = data.cases.filter((c) => c.stage !== 'closed' && c.stage !== 'committed');
  const stale = open.filter((c) => isCaseStale(c)).length;
  const overdue = open.filter((c) => isOverdue(c.nextActionDue)).length;
  const committed = data.cases.filter((c) => c.stage === 'committed').length;
  const allMembers = [...new Map([...data.members.values()].flat().map((m) => [m.userId, m])).values()];
  const athletes = [...new Map(data.athletes.map((a) => [a.id, a])).values()];
  const q = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(view === 'table' ? { view } : {}), ...(athleteFilter ? { athlete: athleteFilter } : {}), ...(ownerFilter ? { owner: ownerFilter } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <>
      <PageHeader
        kicker="Agencia · De la introducción a la firma"
        title={<>Cada paso <em>cuenta</em></>}
        description="Cada atleta con cada universidad y temporada: en qué fase está, quién lo lleva y qué toca hacer."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/app/contacts" variant="ghost">Universidades y coaches</ButtonLink>
            <ButtonLink href="/app/pipeline/team" variant="ghost">Equipo</ButtonLink>
            <ButtonLink href="/api/agency/export" variant="ghost" prefetch={false}>Exportar CSV</ButtonLink>
          </div>
        }
      />

      {one(sp.movido) && (
        <div className="mb-4"><Notice tone="danger">{one(sp.movido) === 'sin_permiso' ? tx('No se ha movido: tu rol en la agencia no permite cambiar la fase de este proceso.') : tx('No se ha podido mover el proceso. Inténtalo de nuevo; si se repite, ábrelo y cambia la fase desde su ficha.')}</Notice></div>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Abiertos', v: open.length },
          { k: 'Acción vencida', v: overdue, warn: overdue > 0 },
          { k: `Sin movimiento en 14 días`, v: stale, warn: stale > 0 },
          { k: 'Comprometidos', v: committed },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-xs text-faint">{s.k}</dt>
            <dd className={`mt-1 font-display text-3xl font-bold ${s.warn ? 'text-danger' : 'text-paper'}`}>{s.v}</dd>
          </div>
        ))}
      </dl>

      <details className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-5" open={!data.cases.length}>
        <summary className="cursor-pointer font-display text-xl font-bold uppercase text-paper">Abrir un proceso</summary>
        <div className="mt-4">
          {!writable.length ? (
            <p className="text-sm text-muted">Tu rol en la agencia es de solo lectura. Pide a un administrador que lo cambie si necesitas abrir procesos.</p>
          ) : !athletes.length ? (
            <p className="text-sm text-muted">
              Todavía no hay atletas que hayan aceptado tu representación. Los procesos solo se abren con su permiso: <Link href="/app/portfolio" className="text-brass underline">envía una propuesta desde Cartera</Link>.
            </p>
          ) : (
            <OpenCaseForm
              agencies={writable.map((a) => ({ id: a.id, name: a.name }))}
              athletes={athletes}
              contacts={data.contacts.map((c) => ({ id: c.id, name: `${c.name} · ${c.institutionName}`, agencyId: c.agencyId }))}
              sports={[...sportName].map(([id, name]) => ({ id, name }))}
              cycles={cycleOptions()}
            />
          )}
        </div>
      </details>

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        {view === 'table' && <input type="hidden" name="view" value="table" />}
        <label className="text-xs text-faint">Atleta
          <select name="athlete" defaultValue={athleteFilter} className={`${inputClass} mt-1 py-1.5`}>
            <option value="">Todos</option>
            {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-faint">Responsable
          <select name="owner" defaultValue={ownerFilter} className={`${inputClass} mt-1 py-1.5`}>
            <option value="">Todos</option>
            {allMembers.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
        </label>
        <button className="rounded-lg border border-line-strong px-3 py-2 text-sm text-paper hover:border-brass">Filtrar</button>
        <div className="ml-auto flex rounded-full border border-line p-1 text-sm" role="group" aria-label="Vista">
          <Link href={`/app/pipeline${q({ view: '' })}`} aria-pressed={view === 'board'} className={`rounded-full px-3 py-1 ${view === 'board' ? 'bg-night text-lime' : 'text-muted'}`}>Tablero</Link>
          <Link href={`/app/pipeline${q({ view: 'table' })}`} aria-pressed={view === 'table'} className={`rounded-full px-3 py-1 ${view === 'table' ? 'bg-night text-lime' : 'text-muted'}`}>Tabla</Link>
        </div>
      </form>

      {!cases.length ? (
        <EmptyState title="Ningún proceso todavía">
          Abre el primero: un atleta, una universidad y una temporada. A partir de ahí, cada cambio de fase queda registrado con fecha y autor.
        </EmptyState>
      ) : (
        <PipelineBoard cases={cases} view={view} sportName={sportName} actions={actions} canMove={new Set(writable.map((a) => a.id))} />
      )}

      <Card className="mt-8">
        <CardTitle kicker={tx('Las 5 fases')}>{tx('Cómo se mueve un proceso')}</CardTitle>
        <p className="mb-4 text-sm text-muted">{tx('El tablero muestra las 5 fases. Dentro de cada una, el proceso avanza por pasos más finos, que cambias desde la ficha del proceso.')}</p>
        <ol className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {CASE_PHASES.map((p, i) => (
            <li key={p.id}>
              <p className="flex gap-2"><span className="font-display font-bold text-brass">{i + 1}</span><span className="font-semibold text-paper">{tx(p.label)}</span></p>
              <p className="mt-1 text-muted">{tx(p.hint)}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-faint" aria-label={`${tx('Pasos de')} ${tx(p.label)}`}>
                {p.stages.map((id) => <li key={id}>· {tx(stageLabel(id))}</li>)}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-faint">{tx('Un proceso cerrado o en pausa sale del tablero y conserva todo su historial.')}</p>
      </Card>
    </>
  );
}
