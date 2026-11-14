'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarClock, Lock, Pencil, Search, StickyNote, X } from 'lucide-react';
import type { FormState } from '@/app/actions/auth';
import { addAgencyNote, endRepresentation, updateAgencyNote } from '@/app/actions/portfolio';
import { Button, Notice, cx, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { filtersToQuery, SORT_LABEL, type PortfolioFilters, type PortfolioSort } from '@/lib/domain/portfolio';

// ─── Barra de filtros (estado en la URL, enlaces compartibles) ───────────────

export function PortfolioFilterBar({
  filters, sports, grads,
}: { filters: PortfolioFilters; sports: { id: string; name: string }[]; grads: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);
  const go = (patch: Partial<PortfolioFilters>) =>
    start(() => router.replace(`${pathname}${filtersToQuery(filters, patch)}`, { scroll: false }));

  // Búsqueda con pequeño retardo para no navegar en cada tecla.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { if (q.trim() !== filters.q) go({ q: q.trim() }); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const chips = [
    filters.q && { label: `“${filters.q}”`, clear: () => { setQ(''); go({ q: '' }); } },
    filters.sport && { label: sports.find((s) => s.id === filters.sport)?.name ?? filters.sport, clear: () => go({ sport: null }) },
    filters.grad && { label: `Promoción ${filters.grad}`, clear: () => go({ grad: null }) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const select = 'w-full rounded-xl border border-line-strong bg-ink/60 px-3 py-2.5 text-sm text-paper transition-colors hover:border-faint focus:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass/20 disabled:opacity-50';

  return (
    <div className={cx('space-y-3 transition-opacity', pending && 'opacity-70')}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_180px_190px_200px]">
        <label className="relative col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar en la cartera</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, deporte, posición o equipo…" className={cx(inputClass, 'pl-9')} />
        </label>
        <label>
          <span className="sr-only">Deporte</span>
          <select className={select} value={filters.sport ?? ''} onChange={(e) => go({ sport: e.target.value || null })} disabled={!sports.length}>
            <option value="">Deporte</option>
            {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Promoción</span>
          <select className={select} value={filters.grad ?? ''} onChange={(e) => go({ grad: e.target.value ? Number(e.target.value) : null })} disabled={!grads.length}>
            <option value="">Promoción</option>
            {grads.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="col-span-2 lg:col-span-1">
          <span className="sr-only">Ordenar</span>
          <select className={select} value={filters.sort} onChange={(e) => go({ sort: e.target.value as PortfolioSort })}>
            {(Object.keys(SORT_LABEL) as PortfolioSort[]).map((k) => <option key={k} value={k}>Orden: {SORT_LABEL[k]}</option>)}
          </select>
        </label>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-xs text-paper transition-colors hover:border-brass/50" aria-label={`Quitar filtro ${c.label}`}>
              {c.label} <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          <button type="button" onClick={() => { setQ(''); go({ q: '', sport: null, grad: null }); }} className="text-xs font-medium text-brass hover:underline">
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Nueva nota / seguimiento ───────────────────────────────────────────────

export function NoteComposer({ agencyId, athleteId }: { agencyId: string; athleteId: string }) {
  const [kind, setKind] = useState<'note' | 'follow_up'>('note');
  const formRef = useRef<HTMLFormElement>(null);
  const [len, setLen] = useState(0);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await addAgencyNote(prev, fd);
    if (res?.ok) { formRef.current?.reset(); setLen(0); }
    return res;
  }, undefined);

  return (
    <section className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
      <p className="mb-3 flex items-center gap-2 text-xs text-muted">
        <Lock className="h-3.5 w-3.5 text-brass" aria-hidden /> Privado: solo lo ve tu agencia, nunca el atleta.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink/60 p-1" role="radiogroup" aria-label="Tipo">
        {([['note', 'Nota', StickyNote], ['follow_up', 'Seguimiento', CalendarClock]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={kind === id}
            onClick={() => setKind(id)}
            className={cx('flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm transition-all', kind === id ? 'bg-surface-2 font-medium text-paper shadow-sm' : 'text-muted hover:text-paper')}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="agency_id" value={agencyId} />
        <input type="hidden" name="athlete_id" value={athleteId} />
        <input type="hidden" name="kind" value={kind} />
        <label className="block">
          <span className="sr-only">Contenido</span>
          <textarea
            name="body"
            rows={5}
            maxLength={5000}
            required
            onChange={(e) => setLen(e.target.value.length)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) formRef.current?.requestSubmit(); }}
            placeholder={kind === 'note' ? 'Conversaciones, contexto, impresiones…' : '¿Qué hay que hacer? Ej.: enviar vídeo al coach de USC'}
            className={cx(inputClass, 'resize-y')}
          />
        </label>
        {kind === 'follow_up' && (
          <label className="block text-xs text-muted">
            Fecha
            <input type="date" name="due_date" className={cx(inputClass, 'mt-1')} />
          </label>
        )}
        {state?.error && <Notice tone="danger">{state.error}</Notice>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] tabular-nums text-faint">{len}/5000 · Ctrl+Enter para guardar</span>
          <SubmitButton pendingText="Guardando…" className="px-3 py-2">{kind === 'note' ? 'Guardar nota' : 'Programar'}</SubmitButton>
        </div>
        {state?.ok && state.message && <p className="stamp-in text-xs font-medium text-ok" role="status">✓ {state.message}</p>}
      </form>
    </section>
  );
}

// ─── Editar nota en línea ───────────────────────────────────────────────────

export function NoteBody({ id, athleteId, body, done, canEdit }: { id: string; athleteId: string; body: string; done: boolean; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await updateAgencyNote(prev, fd);
    if (res?.ok) setEditing(false);
    return res;
  }, undefined);

  if (!editing) {
    return (
      <div className="group/body flex items-start gap-2">
        <p className={cx('mt-1 flex-1 whitespace-pre-wrap text-sm text-paper', done && 'text-muted line-through decoration-faint/60')}>{body}</p>
        {canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="mt-0.5 rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-paper" aria-label="Editar nota">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="athlete_id" value={athleteId} />
      <textarea name="body" defaultValue={body} rows={4} maxLength={5000} required className={inputClass} aria-label="Editar nota" autoFocus />
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex gap-2">
        <SubmitButton className="px-3 py-1.5">Guardar</SubmitButton>
        <Button type="button" variant="ghost" className="px-3 py-1.5" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

// ─── Confirmación en dos pasos (sin modales ni dependencias) ────────────────

export function ConfirmSubmit({
  label, confirmLabel, question, children, danger = false,
}: { label: string; confirmLabel: string; question: string; children: React.ReactNode; danger?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <Button type="button" variant={danger ? 'danger' : 'secondary'} className="px-3 py-2" onClick={() => setAsking(true)}>{label}</Button>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3 py-1.5 text-xs text-muted" role="alertdialog" aria-label={question}>
      {question}
      {children}
      <SubmitButton variant={danger ? 'danger' : 'primary'} className="px-2.5 py-1 text-xs" pendingText="…">{confirmLabel}</SubmitButton>
      <button type="button" onClick={() => setAsking(false)} className="text-xs text-faint hover:text-paper">Cancelar</button>
    </span>
  );
}

export function EndRepresentationForm({ id, agencyId, athleteId, from }: { id: string; agencyId: string; athleteId: string; from: 'requested' | 'active' }) {
  const [state, action] = useActionState<FormState, FormData>(endRepresentation, undefined);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <ConfirmSubmit
        danger={from === 'active'}
        label={from === 'requested' ? 'Retirar propuesta' : 'Finalizar representación'}
        confirmLabel="Confirmar"
        question={from === 'requested' ? '¿Retirar la propuesta?' : '¿Finalizar? El historial y las notas se conservan.'}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="agency_id" value={agencyId} />
        <input type="hidden" name="athlete_id" value={athleteId} />
        <input type="hidden" name="from" value={from} />
      </ConfirmSubmit>
      {state?.error && <p className="text-xs text-danger" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-xs text-ok" role="status">✓ {state.message}</p>}
    </form>
  );
}
