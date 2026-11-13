'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { cx } from '@/components/ui';
import type { NavSection } from '@/lib/domain/navigation';

export function Sidebar({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const current = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;

  // Activo = coincidencia exacta (con query) o, si no hay, el prefijo más largo.
  const all = sections.flatMap((s) => s.items);
  const exact = all.find((i) => i.href === current);
  const prefix = [...all]
    .filter((i) => !i.href.includes('?'))
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => (i.href === '/app' ? pathname === '/app' : pathname === i.href || pathname.startsWith(`${i.href}/`)));
  const active = exact ?? prefix;

  return (
    <nav aria-label="Servicios" className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-faint">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = active?.href === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-surface-2 text-paper' : 'text-muted hover:bg-surface hover:text-paper',
                    )}
                  >
                    <span className={isActive ? 'text-brass' : 'text-faint'}><Icon name={item.icon} /></span>
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
