'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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

export function Sidebar({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const active = useActiveHref(sections.flatMap((s) => s.items));

  return (
    <nav aria-label="Servicios" className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = active === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.desc}
                    aria-current={isActive ? 'page' : undefined}
                    className={cx(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-all duration-200',
                      isActive ? 'bg-brass/10 font-medium text-paper' : 'text-muted hover:translate-x-0.5 hover:bg-surface hover:text-paper',
                    )}
                  >
                    {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brass" aria-hidden />}
                    <span className={cx('transition-colors', isActive ? 'text-brass' : 'text-faint group-hover:text-brass')}>
                      <NavIcon name={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
