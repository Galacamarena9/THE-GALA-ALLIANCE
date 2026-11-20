'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Compass, FileText, GitBranch, Home, LayoutGrid, ListChecks, Menu, MessageSquare, ShieldCheck, Trophy, Wallet, X } from 'lucide-react';
import type { NavSection } from '@/lib/domain/navigation';
import { cx } from '@/components/ui';
import { Sidebar } from './Sidebar';

const TABS = [
  { href: '/app', label: 'Inicio', Icon: Home },
  { href: '/app/discover', label: 'Escaparate', Icon: LayoutGrid },
  { href: '/app/opportunities', label: 'Becas', Icon: Trophy },
  { href: '/app/inbox', label: 'Mensajes', Icon: MessageSquare },
];
/** Staff de universidades y clubes: lo que un coach usa a diario, a un toque (Descubrir ↔ Shortlists ↔ Pipeline). */
const STAFF_TABS = [
  { href: '/app/recruit', label: 'Inicio', Icon: Home, exact: true },
  { href: '/app/recruit/discover', label: 'Descubrir', Icon: Compass },
  { href: '/app/recruit/shortlists', label: 'Shortlists', Icon: ListChecks },
  { href: '/app/recruit/candidates', label: 'Pipeline', Icon: GitBranch },
];
/** Clubes y academias: el día a día es Descubrir ↔ Shortlists ↔ Trials (el pipeline queda en «Más»). */
const CLUB_TABS = [
  { href: '/app/recruit', label: 'Inicio', Icon: Home, exact: true },
  { href: '/app/recruit/discover', label: 'Descubrir', Icon: Compass },
  { href: '/app/recruit/shortlists', label: 'Shortlists', Icon: ListChecks },
  { href: '/app/recruit/trials', label: 'Trials', Icon: CalendarCheck },
];

/** Familias: hoy → coste → documentos → seguridad (mensajes). No es el panel del atleta en pequeño. */
const FAMILY_TABS = [
  { href: '/app/family', label: 'Hoy', Icon: Home, exact: true },
  { href: '/app/family/costs', label: 'Costes', Icon: Wallet },
  { href: '/app/requests', label: 'Documentos', Icon: FileText },
  { href: '/app/family/safety', label: 'Seguridad', Icon: ShieldCheck },
];

/** Móvil: barra inferior tipo app (como LinkedIn) + menú completo en panel lateral. */
export function MobileNav({ sections, staff = false, family = false }: { sections: NavSection[]; staff?: false | 'club' | 'university'; family?: boolean }) {
  const tabs = staff === 'club' ? CLUB_TABS : staff ? STAFF_TABS : family ? FAMILY_TABS : TABS;
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
    <div className="lg:hidden">
      <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <ul className="grid grid-cols-5">
          {tabs.map(({ href, label, Icon, ...rest }) => {
            const exact = href === '/app' || ('exact' in rest && rest.exact);
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} className={cx('flex flex-col items-center gap-1 py-2.5 text-xs', active ? 'text-brass' : 'text-muted')} aria-current={active ? 'page' : undefined}>
                  <Icon className="h-5 w-5" aria-hidden strokeWidth={1.8} />
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-sidebar" className="flex w-full flex-col items-center gap-1 py-2.5 text-xs text-muted">
              <Menu className="h-5 w-5" aria-hidden strokeWidth={1.8} />
              {staff ? 'Más' : 'Todo'}
            </button>
          </li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Todas las funciones">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div id="mobile-sidebar" className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto border-r border-line bg-ink p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-paper">Todas las funciones</p>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <Sidebar sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
