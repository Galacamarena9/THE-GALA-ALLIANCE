import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { managedAthletes } from '@/lib/data/family';
import { loadProcess } from '@/lib/data/pipeline';
import { loadAthleteContext, loadOneMatch } from '@/lib/data/gala-match';
import { describeConfidence, explainChange, parseSnapshot } from '@/lib/domain/gala-match/changes';
import { CONFIDENCE_LABEL } from '@/lib/domain/gala-match/engine';
import { DOC_CHECKLIST, DOC_KINDS } from '@/content/documents';
import { CHANNEL_LABEL, CLOSE_REASON, SOURCE_LABEL, STAGE_INFO, URGENCY_INFO, netCost, type Stage } from '@/lib/domain/pipeline';
import { usd } from '@/lib/domain/labels';
import { Badge, ButtonLink, Card, CardTitle, PageHeader } from '@/components/ui';
import { ContactForm, InteractionForm, NextActionForm, OfferForm, StageForm, TaskForm } from '@/components/pipeline/PipelineForms';
import { deleteContact, deleteEvent, deleteTask, setArchived, setOfferStatus, setProcessDocument, toggleTask } from '@/app/actions/pipeline';

export const metadata: Metadata = { title: 'Proceso' };

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const d = (s: string) => fmt.format(new Date(s.length === 10 ? `${s}T12:00:00` : s));
const DOC_TITLE = Object.fromEntries(DOC_CHECKLIST.map((x) => [x.kind, x.title])) as Record<string, string>;
const SOURCE_TONE = { user: 'neutral', platform: 'brass', organization: 'ok' } as const;
const APP_FOR_ATHLETE: Record<string, string> = {
  applied: 'Enviada', reviewed: 'Revisada por la organización', contacted: 'Te han contactado', information_requested: 'Te piden información',
  interview: 'Entrevista o llamada', tryout: 'Prueba', shortlist: 'En seguimiento por la organización', offer: 'Oferta', accepted: 'Aceptada',
  declined: 'No continúa', withdrawn: 'Retirada',
};

export default async function ProcessDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const athletes = await managedAthletes(session);
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  if (!athlete) notFound();
  const data = await loadProcess(athlete.id, id);
  if (!data) notFound();
  const { p, events, tasks, contacts, docs, vault, offers } = data;
  const A = athlete.id;
  const edit = athlete.canEdit;
  const u = URGENCY_INFO[p.urgency];
  const targetHref = p.target_kind === 'institution' ? `/app/universities/${p.target_id}` : `/app/opportunities/${p.target_id}`;
  const requested = new Set(docs.map((x) => x.kind));
  // Encaje actual (motor real) frente al congelado al guardar. Solo con la sesión del atleta: la familia puede no ver todos sus bloques.
  const ctx = session.userId === A ? await loadAthleteContext(A).catch(() => null) : null;
  const current = ctx ? await loadOneMatch(A, ctx.ctx, p.target_kind, p.target_id).catch(() => null) : null;
  const snap = parseSnapshot(p.match_snapshot);
  const change = current && snap ? explainChange(snap, current.m) : null;

  return (
    <>
      <p className="mb-2 text-sm"><Link href={`/app/process${athletes.length > 1 ? `?a=${A}` : ''}`} className="text-muted hover:text-brass">← Mi pipeline</Link></p>
      <PageHeader
        kicker={p.target_kind === 'institution' ? 'Universidad' : 'Oportunidad'}
        title={p.name}
        description={<>{p.sub && <span>{p.sub} · </span>}Etapa: <strong className="text-paper">{STAGE_INFO[p.status as Stage]?.label ?? p.status}</strong>{p.close_reason ? ` (${CLOSE_REASON[p.close_reason]})` : ''}{p.archived_at ? ' · Archivado' : ''}</>}
        action={<ButtonLink href={targetHref} variant="secondary">Ver ficha</ButtonLink>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {p.urgency !== 'done' && <Badge tone={u.tone}>{u.label}</Badge>}
        {p.urgencyReason && <span className="text-sm text-muted">{p.urgencyReason}</span>}
        {p.official_deadline && <Badge tone="brass">Plazo oficial: {d(p.official_deadline)}</Badge>}
        {p.org_verified && <Badge tone="ok">Publicada por organización verificada</Badge>}
        {p.application && <Badge>Candidatura: {APP_FOR_ATHLETE[p.application.status] ?? p.application.status}</Badge>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Siguiente paso: lo primero en móvil. */}
          <Card>
            <CardTitle kicker="Ahora">Siguiente paso</CardTitle>
            {p.next_action ? <p className="mb-3 text-sm text-paper">{p.next_action}{p.next_action_due ? <span className="text-muted"> · {d(p.next_action_due)}</span> : null}</p> : <p className="mb-3 text-sm text-muted">Sin siguiente paso. Define uno: es lo que mantiene vivo un proceso.</p>}
            {edit && <NextActionForm id={p.id} athlete={A} action={p.next_action} due={p.next_action_due} />}
          </Card>

          <Card>
            <CardTitle kicker="Plan">Tareas de este proceso</CardTitle>
            {tasks.length ? (
              <ul className="mb-4 space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                    {edit ? (
                      <form action={toggleTask}>
                        <input type="hidden" name="task" value={t.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><input type="hidden" name="done" value={t.done_at ? '0' : '1'} />
                        <button aria-label={t.done_at ? `Reabrir: ${t.title}` : `Marcar hecha: ${t.title}`} className={`grid h-6 w-6 place-items-center rounded-md border ${t.done_at ? 'border-brass bg-brass text-ink' : 'border-line'}`}>{t.done_at ? '✓' : ''}</button>
                      </form>
                    ) : <span className={`h-5 w-5 rounded border ${t.done_at ? 'bg-brass' : ''}`} aria-hidden />}
                    <span className={`flex-1 text-sm ${t.done_at ? 'text-muted line-through' : 'text-paper'}`}>{t.title}</span>
                    {t.due_date && <span className="text-xs text-muted">{d(t.due_date)}</span>}
                    {edit && (
                      <form action={deleteTask}><input type="hidden" name="task" value={t.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><button className="text-xs text-faint hover:text-danger" aria-label={`Eliminar tarea: ${t.title}`}>✕</button></form>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="mb-3 text-sm text-muted">Sin tareas todavía.</p>}
            {edit && <TaskForm id={p.id} athlete={A} />}
          </Card>

          <Card>
            <CardTitle kicker="Historial">Línea de tiempo</CardTitle>
            {edit && <details className="mb-4 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold text-brass">Registrar interacción o nota privada</summary><div className="mt-3"><InteractionForm id={p.id} athlete={A} /></div></details>}
            {events.length ? (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brass" aria-hidden />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-paper">{e.title}</p>
                      <Badge tone={SOURCE_TONE[e.source as keyof typeof SOURCE_TONE] ?? 'neutral'}>{SOURCE_LABEL[e.source] ?? e.source}</Badge>
                      {e.channel && <span className="text-xs text-muted">{CHANNEL_LABEL[e.channel]}</span>}
                      {e.kind === 'note' && <span className="text-xs text-muted">Nota privada</span>}
                    </div>
                    {e.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{e.body}</p>}
                    <p className="mt-0.5 text-xs text-faint"><time dateTime={e.occurred_at}>{d(e.occurred_at)}</time>
                      {edit && e.source === 'user' && (e.kind === 'note' || e.kind === 'interaction') && (
                        <form action={deleteEvent} className="ml-2 inline"><input type="hidden" name="event" value={e.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><button className="text-faint hover:text-danger">Eliminar</button></form>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted">Aún no hay actividad.</p>}
            <p className="mt-4 text-xs text-faint">«Organización» = lo hizo la universidad u organización en Gala. «Gala» = automático. «Tú» = lo registraste tú o tu familia. Tus notas nunca las ve la organización.</p>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Detalles del proceso">
          {edit && (
            <Card>
              <CardTitle kicker="Etapa">Mover proceso</CardTitle>
              <StageForm id={p.id} athlete={A} current={p.status} />
              <form action={setArchived} className="mt-3">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><input type="hidden" name="archive" value={p.archived_at ? '0' : '1'} />
                <button className="text-xs text-muted underline-offset-2 hover:text-paper hover:underline">{p.archived_at ? 'Recuperar del archivo' : 'Archivar (se conserva el historial)'}</button>
              </form>
            </Card>
          )}

          <Card>
            <CardTitle kicker="Gala Match">Tu encaje</CardTitle>
            {current ? (
              <p className="text-sm text-paper">
                Ahora: <strong>{current.m.score != null ? `${current.m.score}%` : 'sin porcentaje (faltan datos)'}</strong>
                <span className="text-muted"> · confianza {CONFIDENCE_LABEL[current.m.confidence].toLowerCase()}</span>
              </p>
            ) : session.userId !== A ? <p className="text-sm text-muted">El encaje actual solo lo calcula el atleta desde su cuenta.</p> : <p className="text-sm text-muted">No hay encaje actual disponible: la oportunidad puede haberse cerrado o faltan datos.</p>}
            {p.match_score_at_save != null && <p className="mt-1 text-xs text-muted">Al guardarlo: {p.match_score_at_save}% ({d(p.created_at)})</p>}
            {change && (
              <div className="mt-2 text-xs text-muted">
                {describeConfidence(change) && <p>{describeConfidence(change)}</p>}
                {change.reasons.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">{change.reasons.map((r) => <li key={r.factor}><span aria-hidden>{r.direction === 'up' ? '↑ ' : '↓ '}</span>{r.text}</li>)}</ul>
                ) : change.methodChanged ? <p>Actualizamos el método de cálculo; ningún dato concreto explica el cambio.</p> : null}
              </div>
            )}
            <p className="mt-2 text-[11px] text-faint">Compatibilidad con la información disponible. No es una probabilidad de admisión ni de beca.</p>
            {current && <Link href={`/app/match/${p.target_kind}/${p.target_id}`} className="mt-2 inline-block text-xs font-semibold text-brass hover:underline">Ver desglose →</Link>}
          </Card>

          <Card>
            <CardTitle kicker="Documentos">Checklist</CardTitle>
            {docs.length ? (
              <ul className="space-y-3">
                {docs.map((x) => {
                  const linked = vault.find((v) => v.id === x.document_id);
                  const options = vault.filter((v) => v.kind === x.kind);
                  return (
                    <li key={x.kind} className="rounded-xl border border-line p-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-paper">{DOC_TITLE[x.kind] ?? x.kind}</span>
                        <Badge tone={x.sent_at ? 'ok' : linked?.uploaded_at ? 'brass' : 'warn'}>{x.sent_at ? `Enviado ${d(x.sent_at)}` : linked?.uploaded_at ? 'Listo' : 'Falta'}</Badge>
                      </div>
                      {edit && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {options.length > 0 && (
                            <form action={setProcessDocument} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><input type="hidden" name="kind" value={x.kind} /><input type="hidden" name="op" value="link" />
                              <label className="sr-only" htmlFor={`doc-${x.kind}`}>Documento de tu bóveda</label>
                              <select id={`doc-${x.kind}`} name="document_id" defaultValue={x.document_id ?? ''} className="min-h-8 max-w-[160px] rounded-lg border border-line bg-ink/40 px-1 text-xs text-paper"><option value="">Elegir de tu bóveda</option>{options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select>
                              <button className="text-xs text-brass">OK</button>
                            </form>
                          )}
                          {options.length === 0 && <Link href="/app/documents" className="text-xs text-brass underline underline-offset-2">Subir a la bóveda</Link>}
                          <form action={setProcessDocument}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><input type="hidden" name="kind" value={x.kind} /><input type="hidden" name="op" value={x.sent_at ? 'unsent' : 'sent'} /><button className="text-xs text-muted hover:text-paper">{x.sent_at ? 'Desmarcar envío' : 'Marcar enviado'}</button></form>
                          <form action={setProcessDocument}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><input type="hidden" name="kind" value={x.kind} /><input type="hidden" name="op" value="remove" /><button className="text-xs text-faint hover:text-danger">Quitar</button></form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted">Añade lo que te pide esta universidad. Usamos los documentos de tu bóveda; nada se envía automáticamente.</p>}
            {edit && (
              <form action={setProcessDocument} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><input type="hidden" name="op" value="add" />
                <label className="sr-only" htmlFor="doc-add">Documento requerido</label>
                <select id="doc-add" name="kind" className="min-h-9 flex-1 rounded-lg border border-line bg-ink/40 px-2 text-xs text-paper">
                  {DOC_KINDS.filter((k) => !requested.has(k)).map((k) => <option key={k} value={k}>{DOC_TITLE[k] ?? (k === 'other' ? 'Otro documento' : k)}</option>)}
                </select>
                <button className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold text-paper hover:border-brass">Añadir</button>
              </form>
            )}
          </Card>

          <Card>
            <CardTitle kicker="Ofertas" action={offers.length > 1 || offers.length > 0 ? <Link href={`/app/offers${athletes.length > 1 ? `?a=${A}` : ''}`} className="text-sm font-semibold text-brass">Comparar</Link> : undefined}>Ofertas de este proceso</CardTitle>
            {offers.length ? (
              <ul className="mb-3 space-y-3">
                {offers.map((o) => {
                  const n = netCost(o);
                  return (
                    <li key={o.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-paper">{o.university_name}</span>
                        <Badge tone={o.source === 'organization' ? 'ok' : 'neutral'}>{o.source === 'organization' ? 'Registrada por la organización' : 'Registrada por ti'}</Badge>
                        <Badge tone={o.in_writing ? 'ok' : 'warn'}>{o.in_writing ? 'Por escrito' : 'Sin confirmar por escrito'}</Badge>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                        <dt className="text-muted">Coste anual</dt><dd className="text-paper">{o.annual_cost_usd != null ? usd(o.annual_cost_usd) : '—'}</dd>
                        <dt className="text-muted">Ayuda</dt><dd className="text-paper">{o.aid_amount_usd != null ? usd(o.aid_amount_usd) : '—'}{n.aidPending > 0 ? ' (no descontada)' : ''}</dd>
                        <dt className="text-muted">Coste neto</dt><dd className="font-semibold text-paper">{n.net != null ? usd(n.net) : 'Sin datos'}</dd>
                        {o.deadline && (<><dt className="text-muted">Responder antes de</dt><dd className="text-paper">{d(o.deadline)}</dd></>)}
                      </dl>
                      {edit && (
                        <form action={setOfferStatus} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="offer" value={o.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} />
                          <label className="sr-only" htmlFor={`os-${o.id}`}>Estado de la oferta</label>
                          <select id={`os-${o.id}`} name="status" defaultValue={o.status} className="min-h-8 rounded-lg border border-line bg-ink/40 px-2 text-xs text-paper"><option value="pending">Pendiente</option><option value="accepted">Aceptada</option><option value="declined">Rechazada</option><option value="expired">Caducada</option></select>
                          <button className="text-xs font-semibold text-brass">Guardar</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mb-3 text-sm text-muted">Sin ofertas registradas.</p>}
            {edit && <details><summary className="cursor-pointer text-sm font-semibold text-brass">Registrar una oferta</summary><div className="mt-3"><OfferForm id={p.id} athlete={A} defaultName={p.name} /></div></details>}
          </Card>

          <Card>
            <CardTitle kicker="Agenda privada">Contactos</CardTitle>
            {contacts.length ? (
              <ul className="mb-3 space-y-2 text-sm">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-paper">{c.name}{c.role ? <span className="text-muted"> · {c.role}</span> : null}</p><p className="truncate text-xs text-muted">{[c.email, c.phone].filter(Boolean).join(' · ')}</p></div>
                    {edit && <form action={deleteContact}><input type="hidden" name="contact" value={c.id} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="athlete" value={A} /><button className="text-xs text-faint hover:text-danger" aria-label={`Eliminar contacto ${c.name}`}>✕</button></form>}
                  </li>
                ))}
              </ul>
            ) : <p className="mb-3 text-sm text-muted">Guarda aquí a las personas con las que hablas (solo tú y tu familia lo veis).</p>}
            {edit && <details><summary className="cursor-pointer text-sm font-semibold text-brass">Añadir contacto</summary><div className="mt-3"><ContactForm id={p.id} athlete={A} /></div></details>}
          </Card>
        </aside>
      </div>
    </>
  );
}
