'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { flattenMode, type NavMode } from '@/lib/domain/navigation';
import { NavIcon } from '@/components/NavIcon';
import { cx } from '@/components/ui';
import { Sidebar, useActiveHref } from './Sidebar';

/** Móvil: barra inferior tipo app (como LinkedIn) + menú completo en panel lateral. */
export function MobileNav({ mode }: { mode: NavMode }) {
  const tabs = mode.tabs.slice(0, 4);
  const items = flattenMode(mode);
  const activeHref = useActiveHref(items);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="md:hidden">
      <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <ul className="grid grid-cols-5">
          {tabs.map((t) => {
            // Activa si la página actual es la pestaña o una de sus vistas contextuales.
            const top = mode.primary.find((p) => p.href === t.href);
            const active = activeHref === t.href || !!top?.children?.some((c) => c.href === activeHref);
            return (
              <li key={t.href}>
                <Link href={t.href} className={cx('flex min-h-[52px] flex-col items-center justify-center gap-1 py-2 text-xs', active ? 'font-semibold text-brass' : 'text-muted')} aria-current={active ? 'page' : undefined}>
                  <NavIcon name={t.icon} className="h-5 w-5" />
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-sidebar" className="flex w-full flex-col items-center gap-1 py-2.5 text-xs text-muted">
              <Menu className="h-5 w-5" aria-hidden strokeWidth={1.8} />
              Menú
            </button>
          </li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Todas las funciones">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div id="mobile-sidebar" className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto border-r border-line bg-ink p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-paper">{mode.label}</p>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <Sidebar mode={mode} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
