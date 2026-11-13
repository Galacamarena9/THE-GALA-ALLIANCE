import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types';
import { ageOn, ADULT_AGE } from '@/lib/domain/age';

export interface SessionContext {
  userId: string;
  email: string | null;
  displayName: string;
  primaryRole: AppRole | null;
  roles: AppRole[];
  onboardingCompleted: boolean;
  isMinor: boolean;
  age: number | null;
}

/** Contexto del usuario autenticado, cacheado por petición. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('display_name, primary_role, onboarding_completed').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('private_profile_data').select('date_of_birth').eq('user_id', user.id).maybeSingle(),
  ]);

  const age = priv?.date_of_birth ? ageOn(priv.date_of_birth) : null;
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name || user.email?.split('@')[0] || 'Miembro',
    primaryRole: (profile?.primary_role as AppRole | null) ?? null,
    roles: (roles ?? []).map((r) => r.role as AppRole),
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    isMinor: age == null ? true : age < ADULT_AGE,
    age,
  };
});

/** Para páginas de /app: exige sesión y onboarding completado. */
export async function requireSession(allowed?: AppRole[]) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.onboardingCompleted) redirect('/onboarding');
  if (allowed && !session.roles.some((r) => allowed.includes(r) || r === 'admin')) redirect('/app');
  return session;
}
