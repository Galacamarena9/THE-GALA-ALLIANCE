'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search, Sparkles } from 'lucide-react';
import { NavIcon } from '@/components/NavIcon';
import type { NavSection } from '@/lib/domain/navigation';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Buscador de funciones (Ctrl/⌘ + K): encuentra cualquier servicio por nombre o por lo que hace. */
export function CommandPalette({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title }))), [sections]);
  const results = useMemo(() => {
    const t = norm(q.trim());
    return t ? items.filter((i) => norm(`${i.label} ${i.desc ?? ''} ${i.section}`).includes(t)) : items;
  }, [q, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 0); }, [open]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2 rounded-xl border border-line bg-surface/70 px-3 text-left text-[13px] text-faint transition-colors hover:border-brass/40 hover:text-muted md:flex"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1">Buscar una función: becas, documentos, mensajes…</span>
        <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 text-xs text-faint">Ctrl K</kbd>
      </button>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface md:hidden" aria-label="Buscar una función">
        <Search className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar una función">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Cerrar" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[var(--shadow-premium)]">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-4 w-4 text-faint" aria-hidden />
              <input
                ref={input}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (sel < results.length) go(results[sel].href);
                    else go(`/app/ia?q=${encodeURIComponent(q)}`);
                  }
                }}
                placeholder="¿Qué quieres hacer? Ej.: subir documentos, comparar ofertas…"
                className="h-12 flex-1 bg-transparent text-sm text-paper placeholder:text-faint focus:outline-none"
                aria-label="Buscar"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
              {results.map((r, i) => (
                <li key={r.href} role="option" aria-selected={i === sel}>
                  <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(r.href)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === sel ? 'bg-brass/10' : ''}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brass"><NavIcon name={r.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-paper">{r.label} <span className="text-xs text-faint">· {r.section}</span></span>
                      {r.desc && <span className="block truncate text-xs text-muted">{r.desc}</span>}
                    </span>
                    {i === sel && <CornerDownLeft className="h-4 w-4 text-faint" aria-hidden />}
                  </button>
                </li>
              ))}
              {q.trim() && (
                <li role="option" aria-selected={sel === results.length}>
                  <button type="button" onMouseEnter={() => setSel(results.length)} onClick={() => go(`/app/ia?q=${encodeURIComponent(q)}`)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${sel === results.length ? 'bg-brass/10' : ''}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brass/15 text-brass"><Sparkles className="h-4 w-4" aria-hidden /></span>
                    <span className="text-sm text-paper">Preguntar a Gala IA: «{q}»</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
