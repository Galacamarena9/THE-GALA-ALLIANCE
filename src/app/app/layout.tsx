import { Suspense } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/Icon';
import { requireSession } from '@/lib/session';
import { ACTORS, roleLabel } from '@/lib/domain/roles';
import { sidebarFor } from '@/lib/domain/navigation';
import { signOut } from '@/app/actions/auth';
import { cx } from '@/components/ui';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/growth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const sections = sidebarFor(session.roles);
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .is('read_at', null);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Suspense><MobileNav sections={sections} /></Suspense>
            <Logo href="/app" />
          </div>
          {/* Portales por tipo de usuario: el tuyo resaltado; los demás explican qué ofrece ese lado. */}
          <nav aria-label="Portales" className="hidden xl:block">
            <ul className="flex items-center gap-1">
              {ACTORS.map((a) => {
                const mine = session.roles.includes(a.role);
                return (
                  <li key={a.role}>
                    <Link
                      href={`/app/portal/${a.slug}`}
                      className={cx(
                        'rounded-full px-3 py-1.5 text-[13px] transition-colors',
                        mine ? 'bg-brass/15 text-brass' : 'text-muted hover:bg-surface hover:text-paper',
                      )}
                    >
                      {a.plural}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/app/ia" className="hidden items-center gap-1.5 rounded-full border border-brass/50 px-3 py-1.5 text-[13px] text-brass hover:bg-brass/10 sm:inline-flex">
              <Icon name="spark" className="h-4 w-4" /> Gala IA
            </Link>
            <span className="hidden text-right text-xs leading-tight md:block">
              <span className="block text-paper">{session.displayName}</span>
              <span className="text-faint">{session.roles.map(roleLabel).join(' · ')}</span>
            </span>
            <div className="hidden lg:block"><ThemeToggle /></div>
            <Link href="/app/notifications" className="relative rounded-lg p-1.5 text-muted hover:bg-surface hover:text-paper" aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}>
              <Icon name="bell" className="h-5 w-5" />
              {!!unread && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brass px-1 text-center text-[10px] font-semibold leading-4 text-ink">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <form action={signOut}>
              <button className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface hover:text-paper">Salir</button>
            </form>
          </div>
        </div>
        <nav aria-label="Portales" className="overflow-x-auto border-t border-line px-3 xl:hidden">
          <ul className="flex gap-1 py-1.5">
            {ACTORS.map((a) => (
              <li key={a.role}>
                <Link
                  href={`/app/portal/${a.slug}`}
                  className={cx('block whitespace-nowrap rounded-full px-3 py-1 text-xs', session.roles.includes(a.role) ? 'bg-brass/15 text-brass' : 'text-muted')}
                >
                  {a.plural}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="flex">
        <aside className="sticky top-[61px] hidden h-[calc(100dvh-61px)] w-64 shrink-0 overflow-y-auto border-r border-line px-3 py-6 lg:block">
          <Suspense><Sidebar sections={sections} /></Suspense>
        </aside>
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
