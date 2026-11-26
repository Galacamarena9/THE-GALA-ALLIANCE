import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mfaStep, type Aal } from '@/lib/domain/mfa';

export async function getAal(): Promise<{ current: Aal; next: Aal }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: (data?.currentLevel as Aal) ?? null, next: (data?.nextLevel as Aal) ?? null };
}

/** Si la cuenta tiene doble factor y esta sesión aún no ha metido el código, pide el código. */
export async function enforceMfaChallenge(next: string) {
  const aal = await getAal();
  if (mfaStep({ ...aal, admin: false }) === 'challenge') redirect(`/mfa?next=${encodeURIComponent(next)}`);
}

/** Pantallas de administración: doble factor obligatorio y verificado en esta sesión. */
export async function requireAdminMfa(next = '/app/admin') {
  const step = mfaStep({ ...(await getAal()), admin: true });
  if (step === 'challenge') redirect(`/mfa?next=${encodeURIComponent(next)}`);
  if (step === 'enroll') redirect('/app/settings?mfa=required#doble-factor');
}
