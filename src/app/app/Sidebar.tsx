'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { NavIcon } from '@/components/NavIcon';
import { cx } from '@/components/ui';
import { flattenMode, type NavItem, type NavMode } from '@/lib/domain/navigation';

/** Entrada activa: coincidencia exacta (con query) o alias; si no, el prefijo más largo. */
export function useActiveHref(items: NavItem[]) {
  const pathname = usePathname();
  const search = useSearchParams();
  const current = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;
  const exact = items.find((i) => i.href === current) ?? items.find((i) => i.aliases?.includes(pathname));
  const prefix = [...items]
    .filter((i) => !i.href.includes('?'))
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => (i.href === '/app' ? pathname === '/app' : pathname === i.href || pathname.startsWith(`${i.href}/`)));
  return (exact ?? prefix)?.href;
}

/** ¿Este destino de primer nivel contiene la página actual (él mismo o una de sus vistas contextuales)? */
const contains = (top: NavItem, active?: string) => !!active && (top.href === active || !!top.children?.some((c) => c.href === active));

function Item({ item, active, exact = true, sub, compact, onNavigate }: { item: NavItem; active: boolean; exact?: boolean; sub?: boolean; compact?: boolean; onNavigate?: () => void }) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        title={compact ? item.label : item.desc}
        aria-label={compact ? item.label : undefined}
        aria-current={active ? (exact ? 'page' : 'true') : undefined}
        className={cx(
          'group relative flex items-center rounded-xl transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass',
          compact ? 'h-11 w-11 justify-center' : sub ? 'gap-2.5 py-1.5 pl-10 pr-3 text-[13px]' : 'gap-3 px-3 py-2 text-sm',
          active ? 'bg-lime font-bold text-night' : 'text-muted hover:bg-surface hover:text-paper',
        )}
      >
        
        {!sub && <span className={cx('transition-colors', active ? 'text-night' : 'text-faint group-hover:text-brass')}><NavIcon name={item.icon} /></span>}
        {!compact && item.label}
      </Link>
    </li>
  );
}

/**
 * Barra lateral por modo (Agent OS, Athlete OS, University OS, Operaciones…): pocos destinos de primer nivel;
 * las vistas contextuales del destino activo se despliegan debajo; «Más» plegado. `compact`: raíl de tablet.
 */
export function Sidebar({ mode, onNavigate, compact = false, moreLabel = 'Más' }: { mode: NavMode; onNavigate?: () => void; compact?: boolean; moreLabel?: string }) {
  const active = useActiveHref(flattenMode(mode));
  const moreActive = mode.more.some((i) => i.href === active);
  const [moreOpen, setMoreOpen] = useState(moreActive);

  return (
    <nav aria-label={`Navegación · ${mode.label}`} className={cx(compact ? 'flex flex-col items-center gap-1' : 'space-y-1')}>
      <ul className={cx(compact ? 'flex flex-col items-center gap-1' : 'space-y-0.5')}>
        {mode.primary.map((top) => {
          const here = contains(top, active);
          const subs = (top.children ?? []).filter((c, i, arr) => arr.findIndex((x) => x.href === c.href) === i);
          return (
            <li key={top.href}>
              <ul>
                <Item item={top} active={here} exact={top.href === active && !(top.children ?? []).some((c) => c.href === active)} compact={compact} onNavigate={onNavigate} />
                {here && !compact && subs.length > 1 && (
                  <li>
                    <ul className="mb-1 mt-0.5 space-y-0.5" aria-label={`Vistas de ${top.label}`}>
                      {subs.map((c) => <Item key={c.href} item={c} active={c.href === active} sub onNavigate={onNavigate} />)}
                    </ul>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>
      {mode.more.length > 0 && (
        <div className={cx(compact ? 'relative' : 'pt-3')}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-controls="nav-more"
            aria-label={compact ? moreLabel : undefined}
            className={cx(
              'flex items-center rounded-xl text-muted transition-colors hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass',
              compact ? 'h-11 w-11 justify-center' : 'w-full gap-3 px-3 py-2 text-sm',
              moreActive && 'font-semibold text-brass',
            )}
          >
            <span className="text-faint"><NavIcon name="more" /></span>
            {!compact && <span className="flex-1 text-left">{moreLabel}</span>}
            {!compact && <ChevronDown className={cx('h-4 w-4 transition-transform', moreOpen ? 'rotate-180' : '')} aria-hidden />}
          </button>
          {moreOpen && (
            <ul
              id="nav-more"
              className={cx(
                'space-y-0.5',
                compact ? 'absolute left-14 top-0 z-50 w-64 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-elevated)]' : 'mt-1',
              )}
            >
              {mode.more.map((i) => <Item key={i.href} item={i} active={i.href === active} onNavigate={() => { setMoreOpen(false); onNavigate?.(); }} />)}
            </ul>
          )}
        </div>
      )}
    </nav>
  );
}
