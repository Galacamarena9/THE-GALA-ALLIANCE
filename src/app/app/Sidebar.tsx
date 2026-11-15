'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { NavIcon } from '@/components/NavIcon';
import { cx } from '@/components/ui';
import type { NavItem, NavSection } from '@/lib/domain/navigation';

export function useActiveHref(items: NavItem[]) {
  const pathname = usePathname();
  const search = useSearchParams();
  const current = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;
  // Activo = coincidencia exacta (con query) o, si no hay, el prefijo más largo.
  const exact = items.find((i) => i.href === current);
  const prefix = [...items]
    .filter((i) => !i.href.includes('?'))
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => (i.href === '/app' ? pathname === '/app' : pathname === i.href || pathname.startsWith(`${i.href}/`)));
  return (exact ?? prefix)?.href;
}

function Item({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        title={item.desc}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all duration-200',
          active ? 'bg-brass/10 font-semibold text-brass' : 'text-muted hover:translate-x-0.5 hover:bg-ink hover:text-paper',
        )}
      >
        {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brass" aria-hidden />}
        <span className={cx('transition-colors', active ? 'text-brass' : 'text-faint group-hover:text-brass')}><NavIcon name={item.icon} /></span>
        {item.label}
      </Link>
    </li>
  );
}

function Section({ section, active, onNavigate }: { section: NavSection; active?: string; onNavigate?: () => void }) {
  const containsActive = section.items.some((i) => i.href === active);
  const [open, setOpen] = useState(!section.collapsed || containsActive);
  const [showMore, setShowMore] = useState(section.items.some((i) => i.more && i.href === active));
  const main = section.items.filter((i) => !i.more);
  const extra = section.items.filter((i) => i.more);
  const single = section.items.length === 1 && section.title === 'Inicio';

  if (single) {
    return <ul><Item item={section.items[0]} active={active === section.items[0].href} onNavigate={onNavigate} /></ul>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group mb-1.5 flex w-full items-center justify-between rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-faint transition-colors hover:text-muted"
      >
        <span>{section.title}</span>
        <span className="flex items-center gap-1.5">
          {!open && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] tracking-normal text-muted">{section.items.length}</span>}
          <ChevronDown className={cx('h-3.5 w-3.5 transition-transform duration-200', open ? '' : '-rotate-90')} aria-hidden />
        </span>
      </button>
      {open && (
        <ul className="space-y-0.5">
          {main.map((item) => <Item key={item.href} item={item} active={active === item.href} onNavigate={onNavigate} />)}
          {showMore && extra.map((item) => <Item key={item.href} item={item} active={active === item.href} onNavigate={onNavigate} />)}
          {extra.length > 0 && (
            <li>
              <button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-xs text-faint transition-colors hover:text-brass">
                <ChevronDown className={cx('h-4 w-4 transition-transform', showMore ? 'rotate-180' : '')} aria-hidden />
                {showMore ? 'Ver menos' : `Ver más (${extra.length})`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Barra lateral: lo esencial siempre visible, grupos plegables y "Ver más" para lo secundario. */
export function Sidebar({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const active = useActiveHref(sections.flatMap((s) => s.items));
  return (
    <nav aria-label="Servicios" className="space-y-5">
      {sections.map((section) => <Section key={section.title} section={section} active={active} onNavigate={onNavigate} />)}
    </nav>
  );
}
