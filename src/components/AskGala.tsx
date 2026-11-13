'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Button, cx, inputClass } from '@/components/ui';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  '¿Qué documentos necesito para la NCAA desde España?',
  '¿Qué me falta para que un coach se fije en mí?',
  '¿En qué se diferencian la D1, la D2 y la NAIA?',
  '¿Cómo comparo dos ofertas de beca?',
];

/** Convierte rutas internas (/app/...) en enlaces y respeta los saltos de línea. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\/app\/[\w\-/?=&.]+|https:\/\/[^\s)]+)/g);
  return (
    <p className="whitespace-pre-line">
      {parts.map((p, i) =>
        p.startsWith('/app/') ? <Link key={i} href={p} className="text-brass underline">{p}</Link>
        : p.startsWith('https://') ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-brass underline">{p}</a>
        : <span key={i}>{p}</span>,
      )}
    </p>
  );
}

export function AskGala({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: 'user', content: q.slice(0, 2000) }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/gala-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'chat', messages: next.slice(-12) }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'No se ha podido responder.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: 'assistant', content: acc }]);
        endRef.current?.scrollIntoView({ block: 'nearest' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-brass"><Icon name="spark" /><span className="font-display text-lg text-paper">Pregunta a Gala IA</span></div>
      {messages.length > 0 && (
        <div className={cx('mb-4 space-y-3 overflow-y-auto pr-1', compact ? 'max-h-80' : 'max-h-[55vh]')} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={cx('rounded-xl px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'ml-8 bg-brass/15 text-paper' : 'mr-8 border border-line bg-ink/60 text-paper')}>
              {m.content ? <Rich text={m.content} /> : <span className="text-faint">Pensando…</span>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.slice(0, compact ? 2 : 4).map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-strong px-3 py-1.5 text-left text-xs text-muted hover:border-brass hover:text-paper">{s}</button>
          ))}
        </div>
      )}
      {error && <p className="mb-2 text-sm text-danger" role="alert">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="Escribe tu pregunta sobre becas, documentos, el proceso…" aria-label="Pregunta para Gala IA" className={inputClass} />
        <Button type="submit" disabled={busy || !input.trim()}>{busy ? '…' : 'Preguntar'}</Button>
      </form>
      <p className="mt-2 text-[11px] text-faint">Gala IA puede equivocarse: comprueba lo importante en la fuente oficial. No sustituye asesoramiento legal ni migratorio. No guardamos tus conversaciones.</p>
    </div>
  );
}
