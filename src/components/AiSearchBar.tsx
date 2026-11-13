'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Button, inputClass } from '@/components/ui';

/** Búsqueda en lenguaje natural → filtros visibles y editables (la IA no decide por ti). */
export function AiSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/gala-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'search', messages: [{ role: 'user', content: q.slice(0, 500) }] }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se ha podido interpretar la búsqueda.');
      setNote(json.explanation);
      router.push(json.url);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={run} className="rounded-[var(--radius-card)] border border-brass/40 bg-surface p-3">
      <div className="flex gap-2">
        <span className="hidden items-center pl-1 text-brass sm:flex"><Icon name="spark" /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ej.: bases de 2027 con vídeo, nota mínima 3.0, que quieran D2 o NAIA" aria-label="Búsqueda con Gala IA" className={inputClass} />
        <Button type="submit" disabled={busy}>{busy ? 'Buscando…' : 'Buscar con IA'}</Button>
      </div>
      {note && <p className="mt-2 px-1 text-xs text-muted">{note} · Puedes ajustar los filtros abajo.</p>}
    </form>
  );
}
