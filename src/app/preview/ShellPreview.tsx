import { Suspense } from 'react';
import { Logo } from '@/components/Logo';
import { navModeFor } from '@/lib/domain/navigation';
import type { AppRole } from '@/lib/types';
import { Sidebar } from '@/app/app/Sidebar';
import { MobileNav } from '@/app/app/MobileNav';
import { CommandPalette, type SearchEntity } from '@/app/app/CommandPalette';
import { Breadcrumbs } from '@/app/app/Breadcrumbs';

/** Shell de la app (barra lateral, raíl de tablet, móvil, búsqueda y migas) con datos ficticios: pruebas de teclado y diseño. */
export function ShellPreview({ role, people = [] }: { role: AppRole; people?: SearchEntity[] }) {
  const mode = navModeFor({ roles: [role], primaryRole: role });
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <div className="w-auto shrink-0 lg:w-[232px]"><Logo href="#" /></div>
          <div className="flex flex-1 justify-end md:justify-start"><CommandPalette mode={mode} people={people} /></div>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[72px] shrink-0 border-r border-line bg-surface py-4 md:block lg:hidden" aria-label="Navegación compacta">
          <Suspense><Sidebar mode={mode} compact /></Suspense>
        </aside>
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[260px] shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-6 lg:block">
          <Suspense><Sidebar mode={mode} /></Suspense>
        </aside>
        <main id="main-content" className="min-w-0 flex-1 px-5 pb-28 pt-6 sm:px-8 md:pb-12 lg:px-10">
          <Suspense><Breadcrumbs mode={mode} /></Suspense>
          <h1 className="font-display text-[40px] font-bold uppercase leading-none text-paper">{mode.label}</h1>
          <p className="mt-2 text-sm text-muted">Shell de ejemplo (datos ficticios): {mode.primary.length} destinos{mode.more.length ? ' + Más' : ''}.</p>
        </main>
      </div>
      <Suspense><MobileNav mode={mode} /></Suspense>
    </div>
  );
}
