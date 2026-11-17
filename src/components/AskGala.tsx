'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Button, cx, inputClass } from '@/components/ui';
import { confirmAiProposal, sendAiFeedback } from '@/app/actions/ai';

type Source = { label: string; url: string; reviewed?: string; stale?: boolean; internal?: boolean };
type Proposal = { kind: 'add_to_pipeline' | 'create_task' | 'open_page'; label: string; href?: string; target_kind?: 'institution' | 'opportunity'; target_id?: string; title?: string; due_date?: string };
type Draft = { tone: string; subject?: string; body: string };
type Answer = { text: string; status?: string; sources: Source[]; proposals: Proposal[]; drafts: Draft[]; requestId?: string; mode?: string; error?: string };
type Msg = { role: 'user'; content: string } | { role: 'assistant'; content: string; a: Answer };

const SUGGESTIONS: Record<string, string[]> = {
  default: ['¿Qué hago ahora para avanzar?', '¿Qué me falta en el Passport?', '¿Qué documentos pide la NCAA a un internacional?', '¿Cómo comparo dos ofertas de beca?'],
  process: ['¿Qué procesos necesitan atención?', '¿Qué plazos tengo esta semana?', 'Redacta un email al coach para enviarle mi vídeo', '¿Cómo calculo el coste neto de una oferta?'],
  match: ['¿Por qué tengo este porcentaje de match?', 'Recomiéndame universidades con oportunidades activas', '¿Qué puedo mejorar para encajar mejor?', '¿Qué significa la confianza del match?'],
};

/** Negritas **x**, rutas internas y enlaces oficiales; el resto, texto plano (nunca HTML del modelo). */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\/app\/[\w\-/?=&.]+|\/guia\/[\w-]+|https:\/\/[^\s)]+)/g);
  return (
    <p className="whitespace-pre-line">
      {parts.map((p, i) =>
        p.startsWith('**') ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        : p.startsWith('/app/') || p.startsWith('/guia/') ? <Link key={i} href={p} className="text-brass underline">{p}</Link>
        : p.startsWith('https://') ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-brass underline">{p}</a>
        : <span key={i}>{p}</span>,
      )}
    </p>
  );
}

function ProposalButton({ p }: { p: Proposal }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  if (p.kind === 'open_page' && p.href) return <Link href={p.href} className="inline-flex min-h-10 items-center rounded-full border border-brass/50 px-4 text-xs font-semibold text-brass hover:bg-brass/10">{p.label} →</Link>;
  if (state === 'done') return <span className="text-xs font-semibold text-ok" role="status">✓ {msg}</span>;
  if (state === 'confirm' || state === 'busy' || state === 'error') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-paper">
        ¿Confirmas «{p.label}»?
        <button disabled={state === 'busy'} onClick={async () => {
          setState('busy');
          const r = await confirmAiProposal({ kind: p.kind as 'add_to_pipeline' | 'create_task', target_kind: p.target_kind, target_id: p.target_id, title: p.title, due_date: p.due_date, confirmed: true });
          setMsg(r.message ?? ''); setState(r.ok ? 'done' : 'error');
        }} className="rounded-full bg-brass px-3 py-1 font-semibold text-ink">{state === 'busy' ? '…' : 'Sí, hacerlo'}</button>
        <button onClick={() => setState('idle')} className="text-muted underline">Cancelar</button>
        {state === 'error' && <span className="text-danger" role="alert">{msg || 'No se ha podido.'}</span>}
      </span>
    );
  }
  return <button onClick={() => setState('confirm')} className="inline-flex min-h-10 items-center rounded-full border border-line-strong px-4 text-xs font-semibold text-paper hover:border-brass hover:text-brass">{p.label}</button>;
}

function Drafts({ items }: { items: Draft[] }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const d = items[i];
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface p-3">
      <div role="tablist" aria-label="Tono del borrador" className="mb-2 flex gap-1">
        {items.map((x, k) => <button key={k} role="tab" aria-selected={k === i} onClick={() => { setI(k); setCopied(false); }} className={cx('rounded-full px-3 py-1 text-xs font-semibold', k === i ? 'bg-brass/15 text-brass' : 'text-muted hover:text-paper')}>{x.tone}</button>)}
      </div>
      {d.subject && <p className="text-xs text-muted">Asunto: <span className="text-paper">{d.subject}</span></p>}
      <p className="mt-1 whitespace-pre-line text-sm text-paper">{d.body}</p>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={async () => { await navigator.clipboard.writeText(`${d.subject ? `${d.subject}\n\n` : ''}${d.body}`); setCopied(true); }} className="text-xs font-semibold text-brass">{copied ? '✓ Copiado' : 'Copiar'}</button>
        <span className="text-[11px] text-faint">Borrador: revísalo y envíalo tú. Gala no envía nada en tu nombre.</span>
      </div>
    </div>
  );
}

function Feedback({ requestId }: { requestId: string }) {
  const [sent, setSent] = useState<0 | 1 | -1>(0);
  if (sent) return <span className="text-[11px] text-faint">Gracias por tu opinión.</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-faint">¿Te ha servido?
      <button aria-label="Útil" onClick={() => { setSent(1); void sendAiFeedback({ requestId, rating: 1, reason: 'helpful' }); }} className="rounded px-1.5 py-0.5 hover:text-paper">👍</button>
      <button aria-label="No útil" onClick={() => { setSent(-1); void sendAiFeedback({ requestId, rating: -1, reason: 'not_useful' }); }} className="rounded px-1.5 py-0.5 hover:text-paper">👎</button>
    </span>
  );
}

export function AskGala({ compact = false, initialQuestion = '', context = 'default' }: { compact?: boolean; initialQuestion?: string; context?: 'default' | 'process' | 'match' }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const page = usePathname();

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    const history = [...messages, { role: 'user' as const, content: q.slice(0, 2000) }];
    let a: Answer = { text: '', sources: [], proposals: [], drafts: [] };
    const paint = () => setMessages([...history, { role: 'assistant', content: a.text, a: { ...a } }]);
    paint();
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/gala-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', page: page?.slice(0, 120), messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content || '…' })) }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'No se ha podido responder.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'meta') a = { ...a, requestId: ev.requestId, mode: ev.mode };
          else if (ev.type === 'text') a = { ...a, text: a.text + ev.delta, status: undefined };
          else if (ev.type === 'status') a = { ...a, status: ev.text };
          else if (ev.type === 'sources') a = { ...a, sources: ev.items };
          else if (ev.type === 'proposals') a = { ...a, proposals: ev.items };
          else if (ev.type === 'drafts') a = { ...a, drafts: ev.items };
          else if (ev.type === 'error') a = { ...a, error: ev.message };
          paint();
        }
        endRef.current?.scrollIntoView({ block: 'nearest' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setMessages(history.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = SUGGESTIONS[context] ?? SUGGESTIONS.default;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-brass"><Icon name="spark" /><span className="font-display text-lg text-paper">Pregunta a Gala IA</span></div>
      {messages.length > 0 && (
        <div className={cx('mb-4 space-y-3 overflow-y-auto pr-1', compact ? 'max-h-96' : 'max-h-[60vh]')} aria-live="polite">
          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="ml-8 rounded-xl bg-brass/15 px-4 py-3 text-sm leading-relaxed text-paper">{m.content}</div>
          ) : (
            <div key={i} className="mr-4 rounded-xl border border-line bg-ink/60 px-4 py-3 text-sm leading-relaxed text-paper">
              {m.a.text ? <Rich text={m.a.text} /> : <span className="text-faint">{m.a.status ?? 'Pensando…'}</span>}
              {m.a.status && m.a.text && <p className="mt-1 text-xs text-faint">{m.a.status}</p>}
              {m.a.error && <p className="mt-2 text-xs text-danger" role="alert">{m.a.error}</p>}
              {m.a.drafts.length > 0 && <Drafts items={m.a.drafts} />}
              {m.a.proposals.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.a.proposals.map((p, k) => <ProposalButton key={k} p={p} />)}</div>}
              {m.a.sources.length > 0 && (
                <div className="mt-3 border-t border-line pt-2">
                  <p className="text-[11px] font-semibold text-faint">Fuentes</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {m.a.sources.map((s) => (
                      <li key={s.url}>
                        {s.internal ? <Link href={s.url} className="text-brass underline">{s.label}</Link> : <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brass underline">{s.label}</a>}
                        {s.reviewed && <span className={cx('ml-1', s.stale ? 'text-warn' : 'text-faint')}>· revisado {s.reviewed}{s.stale ? ' (revisión pendiente)' : ''}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.a.requestId && !busy && <div className="mt-2"><Feedback requestId={m.a.requestId} /></div>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.slice(0, compact ? 2 : 4).map((s) => (
            <button key={s} onClick={() => ask(s)} className="min-h-9 rounded-full border border-line-strong px-3 py-1.5 text-left text-xs text-muted hover:border-brass hover:text-paper">{s}</button>
          ))}
        </div>
      )}
      {error && <p className="mb-2 text-sm text-danger" role="alert">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="Pregunta sobre tu proceso, universidades, plazos… (ES/EN)" aria-label="Pregunta para Gala IA" className={inputClass} />
        <Button type="submit" disabled={busy || !input.trim()}>{busy ? '…' : 'Preguntar'}</Button>
      </form>
      <p className="mt-2 text-xs text-faint">Gala IA usa tus datos de Gala y la guía con fuentes oficiales. Puede equivocarse: comprueba lo importante. No es asesoramiento legal ni migratorio. No guardamos el texto de tus conversaciones.</p>
    </div>
  );
}
