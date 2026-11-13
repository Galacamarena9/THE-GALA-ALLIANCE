import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { roleHome } from '@/lib/domain/roles';
import type { Sport, SportPosition } from '@/lib/types';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: '¿Qué te trae por aquí?' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ role?: string; invite?: string; team?: string; add?: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login?next=/onboarding');
  const { role, invite, team, add } = await searchParams;
  // Con ?add=1 un usuario existente añade otro perfil (p. ej. coach que también es agente).
  if (session.onboardingCompleted && add !== '1') redirect(roleHome(session.primaryRole));
  const supabase = await createClient();
  const [{ data: sports }, { data: positions }] = await Promise.all([
    supabase.from('sports').select('id, name_es').eq('active', true).order('name_es'),
    supabase.from('sport_positions').select('id, sport_id, code, name_es').order('id'),
  ]);

  return (
    <div className="paper-grain min-h-dvh">
      <header className="px-5 py-6 sm:px-8">
        <Logo href="/onboarding" />
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-4 sm:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brass">Hola, {session.displayName}</p>
        <h1 className="mt-2 text-4xl text-paper">{add === '1' ? 'Añadir otro perfil' : '¿Qué te trae por aquí?'}</h1>
        <p className="mt-3 text-muted">Elige cómo vas a usar la plataforma. Podrás añadir más perfiles después.</p>
        <OnboardingForm
          initialRole={role}
          invite={invite}
          team={team}
          existingRoles={session.roles}
          isMinor={session.isMinor}
          sports={(sports ?? []) as Sport[]}
          positions={(positions ?? []) as SportPosition[]}
        />
      </main>
    </div>
  );
}
