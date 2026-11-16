import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { stageLabel, canWrite, CASE_STAGES } from '@/lib/domain/agency-cases';
import { dueText, isOverdue, relativeTime } from '@/lib/domain/portfolio';
import { toggleShare, toggleTask } from '@/app/actions/agency-cases';
import { UpdateCaseForm, ActivityForm, TaskForm } from '@/components/agency/CaseForms';
import { Badge, Card, CardTitle, Notice, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Proceso' };

const KIND_LABEL: Record<string, string> = {
  stage_change: 'Cambio de fase', email: 'Email', call: 'Llamada', meeting: 'Reunión o visita', message: 'Mensaje', note: 'Nota interna',
};

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(['agent']);
  const { id } = await params;
  const data = await loadAgencyCases(session.userId);
  const c = data.cases.find((x) => x.id === id);
  if (!c) notFound();

  const supabase = await createClient();
  const [{ data: acts }, { data: tasks }] = await Promise.all([
    supabase.from('recruiting_case_activities').select('id, kind, from_stage, to_stage, body, occurred_on, actor_id, created_at')
      .eq('case_id', id).order('created_at', { ascending: false }).limit(200),
    supabase.from('recruiting_case_tasks').select('id, title, assignee_id, due_date, done, done_at, created_at')
      .eq('case_id', id).order('done').order('due_date', { ascending: true, nullsFirst: false }),
  ]);
  const members = data.members.get(c.agencyId) ?? [];
  const nameOf = new Map(members.map((m) => [m.userId, m.name]));
  const memberOpts = members.map((m) => ({ id: m.userId, name: m.name }));
  const contactOpts = data.contacts.filter((x) => x.agencyId === c.agencyId).map((x) => ({ id: x.id, name: `${x.name} · ${x.institutionName}` }));
  const contact = data.contacts.find((x) => x.id === c.contactId);
  const writable = canWrite(data.myRole.get(c.agencyId));
  const stageIdx = CASE_STAGES.findIndex((s) => s.id === c.stage);
  const representationActive = data.athletes.some((a) => a.id === c.athleteId && a.agencyId === c.agencyId);

  type Act = { id: string; kind: string; from_stage: string | null; to_stage: string | null; body: string | null; occurred_on: string; actor_id: string | null; created_at: string };
  type Task = { id: string; title: string; assignee_id: string | null; due_date: string | null; done: boolean };

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/app/pipeline" className="text-brass hover:underline">← Procesos</Link></p>
      <PageHeader
        kicker={`${c.cycle} · ${stageLabel(c.stage)}`}
        title={`${c.athleteName} · ${c.institutionName}`}
        description={<>Abierto el {c.createdAt.slice(0, 10)}. Responsable: {c.ownerName ?? 'sin asignar'}.{contact ? <> Contacto: {contact.name}{contact.roleTitle ? ` (${contact.roleTitle})` : ''}.</> : null}</>}
      />

      {!representationActive && (
        <div className="mb-6">
          <Notice tone="danger">El atleta ya no tiene una representación activa con tu agencia. El historial se conserva, pero no deberías avanzar este proceso en su nombre.</Notice>
        </div>
      )}

      <ol className="mb-8 flex gap-1 overflow-x-auto pb-1" aria-label="Fases">
        {CASE_STAGES.map((s, i) => (
          <li key={s.id} title={s.label} aria-current={s.id === c.stage ? 'step' : undefined}
            className={`h-2 min-w-6 flex-1 rounded-full ${s.id === 'closed' && c.stage === 'closed' ? 'bg-danger' : i <= stageIdx && c.stage !== 'closed' ? 'bg-brass' : 'bg-line'}`} />
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle kicker="Estado">Fase y próxima acción</CardTitle>
            {!writable && <p className="mb-3 text-sm text-muted">Tu rol es de solo lectura.</p>}
            <UpdateCaseForm c={c} members={memberOpts} contacts={contactOpts} disabled={!writable} />
          </Card>

          <Card>
            <CardTitle kicker="Historial">Lo que ha pasado</CardTitle>
            {writable && <div className="mb-5"><ActivityForm caseId={c.id} /></div>}
            <ol className="space-y-3 border-l border-line pl-4">
              {((acts ?? []) as Act[]).map((a) => (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${a.kind === 'stage_change' ? 'bg-brass' : a.kind === 'note' ? 'bg-faint' : 'bg-lime'}`} aria-hidden />
                  <p className="text-xs text-faint">
                    {KIND_LABEL[a.kind] ?? a.kind} · {a.kind === 'stage_change' ? relativeTime(a.created_at) : a.occurred_on} · {a.actor_id ? nameOf.get(a.actor_id) ?? 'Miembro' : 'Sistema'}
                  </p>
                  <p className="text-sm text-paper">
                    {a.kind === 'stage_change'
                      ? a.from_stage ? <>De «{stageLabel(a.from_stage)}» a «{stageLabel(a.to_stage ?? '')}»</> : <>Proceso abierto en «{stageLabel(a.to_stage ?? '')}»</>
                      : a.body}
                  </p>
                  {a.kind === 'stage_change' && a.body && <p className="text-xs text-muted">Motivo: {a.body}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle kicker="Tareas">Pendiente</CardTitle>
            <ul className="mb-4 space-y-2">
              {((tasks ?? []) as Task[]).map((t) => (
                <li key={t.id} className="flex items-start gap-3">
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="case_id" value={c.id} />
                    <input type="hidden" name="done" value={String(!t.done)} />
                    <button disabled={!writable} aria-label={t.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border ${t.done ? 'border-ok bg-ok text-white' : 'border-line-strong'}`}>
                      {t.done ? '✓' : ''}
                    </button>
                  </form>
                  <div className="min-w-0">
                    <p className={`text-sm ${t.done ? 'text-faint line-through' : 'text-paper'}`}>{t.title}</p>
                    <p className={`text-xs ${!t.done && isOverdue(t.due_date) ? 'text-danger' : 'text-faint'}`}>
                      {t.assignee_id ? nameOf.get(t.assignee_id) ?? 'Miembro' : 'Sin responsable'}{t.due_date ? ` · ${dueText(t.due_date)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
              {!tasks?.length && <li className="text-sm text-faint">No hay tareas.</li>}
            </ul>
            {writable && <TaskForm caseId={c.id} members={memberOpts} />}
          </Card>

          <Card>
            <CardTitle kicker="Transparencia">Qué ve el atleta</CardTitle>
            <p className="mb-3 text-sm text-muted">
              Si lo compartes, {c.athleteName} verá la universidad, la temporada, la fase y los cambios de fase con fecha. Nunca las notas internas, las interacciones ni las tareas.
            </p>
            <div className="flex items-center gap-3">
              <Badge tone={c.sharedWithAthlete ? 'ok' : 'neutral'}>{c.sharedWithAthlete ? 'Compartido' : 'Solo la agencia'}</Badge>
              {writable && (
                <form action={toggleShare}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="shared" value={String(!c.sharedWithAthlete)} />
                  <button className="text-sm font-semibold text-brass hover:underline">{c.sharedWithAthlete ? 'Dejar de compartir' : 'Compartir con el atleta'}</button>
                </form>
              )}
            </div>
          </Card>

          {c.nextAction && (
            <Card>
              <CardTitle kicker="Próximo paso">{c.nextAction}</CardTitle>
              <p className={`text-sm ${isOverdue(c.nextActionDue) ? 'text-danger' : 'text-muted'}`}>{c.nextActionDue ? dueText(c.nextActionDue) : 'Sin fecha'}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
