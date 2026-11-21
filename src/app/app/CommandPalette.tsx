'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search, Sparkles } from 'lucide-react';
import { NavIcon } from '@/components/NavIcon';
import type { NavItem, NavMode } from '@/lib/domain/navigation';

/** Resultado de búsqueda global: una función de la plataforma o una persona/entidad del usuario (p. ej. sus atletas). */
export interface SearchEntity { href: string; label: string; desc?: string; kind: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Búsqueda global (Ctrl/⌘ + K): tus atletas por nombre (agente) y cualquier función del modo por nombre o por lo
 * que hace. Solo aparecen destinos del modo del usuario y entidades que el servidor ya le permite ver.
 */
export function CommandPalette({ mode, people = [] }: { mode: NavMode; people?: SearchEntity[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    const out: (Pick<NavItem, 'href' | 'label' | 'desc'> & { icon: NavItem['icon']; section: string })[] = [];
    const seen = new Set<string>();
    const add = (i: NavItem, section: string) => { if (!seen.has(i.href)) { seen.add(i.href); out.push({ ...i, section }); } };
    for (const p of mode.primary) { add(p, mode.label); p.children?.forEach((c) => add(c, p.label)); }
    mode.more.forEach((i) => add(i, 'Más'));
    mode.extra.forEach((i) => add(i, 'Herramientas'));
    return [...people.map((p) => ({ href: p.href, label: p.label, desc: p.desc, icon: 'user' as const, section: p.kind })), ...out];
  }, [mode, people]);
  const results = useMemo(() => {
    const t = norm(q.trim());
    return (t ? items.filter((i) => norm(`${i.label} ${i.desc ?? ''} ${i.section}`).includes(t)) : items).slice(0, 40);
  }, [q, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Foco: al abrir va al campo; al cerrar vuelve a donde estaba (teclado y lectores de pantalla).
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) { opener.current = document.activeElement as HTMLElement | null; setTimeout(() => input.current?.focus(), 0); }
    else opener.current?.focus?.();
  }, [open]);

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
        <span className="flex-1">{people.length ? 'Buscar atleta o función…' : 'Buscar una función: becas, documentos, mensajes…'}</span>
        <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 text-xs text-faint">Ctrl K</kbd>
      </button>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface md:hidden" aria-label="Buscar">
        <Search className="h-5 w-5" aria-hidden />
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
                placeholder={people.length ? 'Nombre de un atleta o lo que quieres hacer…' : '¿Qué quieres hacer? Ej.: subir documentos, comparar ofertas…'}
                className="h-12 flex-1 bg-transparent text-sm text-paper placeholder:text-faint focus:outline-none"
                aria-label="Buscar"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={`palette-opt-${sel}`}
              />
            </div>
            <ul id="palette-results" className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Resultados">
              {results.map((r, i) => (
                <li key={r.href} id={`palette-opt-${i}`} role="option" aria-selected={i === sel}>
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
                <li id={`palette-opt-${results.length}`} role="option" aria-selected={sel === results.length}>
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
