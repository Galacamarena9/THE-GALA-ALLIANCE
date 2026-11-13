'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NavSection } from '@/lib/domain/navigation';
import { Sidebar } from './Sidebar';

export function MobileNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-sidebar"
        className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-paper"
      >
        Menú
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-black/60" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div id="mobile-sidebar" className="absolute inset-y-0 left-0 w-[84%] max-w-xs overflow-y-auto border-r border-line bg-ink p-4">
            <button onClick={() => setOpen(false)} className="mb-4 text-sm text-muted">Cerrar ✕</button>
            <Sidebar key={pathname} sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
