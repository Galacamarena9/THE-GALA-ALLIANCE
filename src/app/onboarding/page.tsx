import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { afterSignupPath } from '@/lib/domain/safe-path';
import { Logo } from '@/components/Logo';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { roleHome } from '@/lib/domain/roles';
import type { Sport, SportPosition } from '@/lib/types';
import { OnboardingForm } from './OnboardingForm';
import { ONBOARDING_COPY } from './copy';
import { getLocale } from '@/lib/i18n/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export async function generateMetadata(): Promise<Metadata> {
  return { title: ONBOARDING_COPY[await getLocale()].metaTitle };
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ role?: string; invite?: string; team?: string; add?: string; next?: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login?next=/onboarding');
  const { role, invite, team, add, next } = await searchParams;
  // Con ?add=1 un usuario existente añade otro perfil (p. ej. coach que también es agente).
  if (session.onboardingCompleted && add !== '1') redirect(roleHome(session.primaryRole));
  const supabase = await createClient();
  const locale = await getLocale();
  const t = ONBOARDING_COPY[locale];
  const [{ data: sports }, { data: positions }] = await Promise.all([
    supabase.from('sports').select('id, name_es, name_en').eq('active', true).order('name_es'),
    supabase.from('sport_positions').select('id, sport_id, code, name_es, name_en').order('id'),
  ]);

  return (
    <div className="paper-grain min-h-dvh">
      <header className="flex items-center justify-between px-5 py-6 sm:px-8">
        <Logo href="/onboarding" />
        <LanguageSwitcher current={locale} />
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-5 pb-20 pt-4 sm:px-8">
        <p className="text-[13px] font-semibold text-brass">{t.hello(session.displayName)}</p>
        <h1 className="mt-2 text-4xl text-paper">{add === '1' ? t.titleAdd : t.title}</h1>
        <p className="mt-3 text-muted">{t.intro}</p>
        <OnboardingForm
          locale={locale}
          initialRole={role}
          invite={invite}
          team={team}
          next={afterSignupPath(next) ?? undefined}
          existingRoles={session.roles}
          isMinor={session.isMinor}
          sports={((sports ?? []) as (Sport & { name_en?: string })[]).map((sp) => ({ ...sp, name_es: locale === 'en' ? sp.name_en ?? sp.name_es : sp.name_es }))}
          positions={((positions ?? []) as (SportPosition & { name_en?: string })[]).map((po) => ({ ...po, name_es: locale === 'en' ? po.name_en ?? po.name_es : po.name_es }))}
        />
      </main>
    </div>
  );
}
