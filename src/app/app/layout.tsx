import { Suspense } from 'react';
import Link from 'next/link';
import { Bell, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { requireSession } from '@/lib/session';
import { roleLabel } from '@/lib/domain/roles';
import { navModeFor } from '@/lib/domain/navigation';
import { loadPortfolio } from '@/lib/data/portfolio';
import { signOut } from '@/app/actions/auth';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { CommandPalette, type SearchEntity } from './CommandPalette';
import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';
import { createClient } from '@/lib/supabase/server';
import { enforceMfaChallenge } from '@/lib/mfa';
import { getLocale } from '@/lib/i18n/server';
import { localizeMode } from '@/lib/domain/navigation';

/** Perfil "público" de cada tipo de usuario (lo que ven los demás). */
function profileHref(roles: string[]) {
  if (roles.includes('athlete')) return '/app/athlete/passport';
  if (roles.includes('parent')) return '/app/family';
  if (roles.some((r) => ['university', 'coach', 'agent', 'brand'].includes(r))) return '/app/organization';
  return '/app/settings';
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await enforceMfaChallenge('/app');
  const supabase = await createClient();
  // Staff de clubes y academias: su barra inferior lleva «Trials» en lugar de «Pipeline» (sigue en «Más»).
  const staff = session.roles.some((r) => r === 'coach' || r === 'university') && !session.roles.includes('athlete');
  const clubStaff = staff && ((await supabase.from('organization_members').select('organizations(type)').eq('user_id', session.userId).limit(10)).data ?? [])
    .some((m) => ['club', 'academy'].includes((m.organizations as unknown as { type: string } | null)?.type ?? ''));
  // Un modo por actor (Agent OS, Athlete OS, University OS, Operaciones, familia, marca).
  const primary = session.primaryRole ?? session.roles[0];
  const locale = await getLocale();
  const mode = localizeMode(navModeFor({ roles: session.roles, primaryRole: primary, isMinor: session.isMinor, clubStaff }), locale);
  const moreLabel = locale === 'en' ? 'More' : 'Más';
  // Búsqueda global del agente: sus atletas por nombre (misma proyección y RLS que la cartera; nada más).
  const people: SearchEntity[] = mode.id === 'agent'
    ? [...new Map((await loadPortfolio(session.userId)).entries.map((e) => [e.athleteId, e])).values()].map((e) => ({
        href: `/app/portfolio/${e.athleteId}`, label: e.name, kind: 'Atleta',
        desc: [e.sportName, e.positionName, e.graduationYear, e.status === 'active' ? 'Representado' : null].filter(Boolean).join(' · '),
      }))
    : [];
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .is('read_at', null);

  return (
    <div className="min-h-dvh" lang={locale}>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <div className="w-auto shrink-0 lg:w-[232px]"><Logo href="/app" /></div>
          <div className="flex flex-1 justify-end md:justify-start">
            <CommandPalette mode={mode} people={people} />
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/app/ia" className="btn-shine hidden items-center gap-1.5 rounded-xl border border-brass/40 bg-brass/10 px-3 py-1.5 text-[13px] font-medium text-brass transition-all hover:bg-brass/20 sm:inline-flex">
              <Sparkles className="h-4 w-4" aria-hidden /> Gala IA
            </Link>
            <Link href="/app/notifications" className="relative rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-paper" aria-label={locale === 'en' ? (unread ? `Notifications: ${unread} unread` : 'Notifications') : unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}>
              <Bell className="h-5 w-5" aria-hidden strokeWidth={1.8} />
              {!!unread && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-brass px-1 text-center text-xs font-bold leading-4 text-ink">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <UserMenu name={session.displayName} roles={session.roles.map(roleLabel).join(' · ')} profileHref={profileHref(session.roles)} signOut={signOut} locale={locale} />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Tablet: raíl compacto de iconos con los mismos destinos. */}
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[72px] shrink-0 border-r border-line bg-surface py-4 md:block lg:hidden" aria-label="Navegación compacta">
          <Suspense><Sidebar mode={mode} compact moreLabel={moreLabel} /></Suspense>
        </aside>
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[260px] shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-6 lg:block">
          <Suspense><Sidebar mode={mode} moreLabel={moreLabel} /></Suspense>
          <div className="mx-3 mt-8 rounded-2xl border border-line bg-ink p-4">
            <p className="text-sm font-bold text-paper">¿No sabes por dónde empezar?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Pulsa <kbd className="rounded border border-line-strong px-1 text-xs">Ctrl K</kbd> y escribe lo que quieres hacer, o pregunta a Gala IA.</p>
          </div>
        </aside>
        <main id="main-content" className="min-w-0 flex-1 px-5 pb-28 pt-6 sm:px-8 md:pb-12 lg:px-10">
          <div className="mx-auto max-w-6xl"><Suspense><Breadcrumbs mode={mode} /></Suspense>{children}</div>
        </main>
      </div>
      <Suspense><MobileNav mode={mode} /></Suspense>
    </div>
  );
}
