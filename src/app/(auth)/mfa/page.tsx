import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MfaChallenge } from './MfaChallenge';
import { safeRedirectPath } from '@/lib/domain/safe-path';

export const metadata: Metadata = { title: 'Código de verificación', robots: { index: false } };

const safeNext = (next: string | undefined) => safeRedirectPath(next, '/app');

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-3xl text-paper">Verificación en dos pasos</h1>
      <p className="mb-8 mt-3 text-sm text-muted">Abre tu app de autenticación (Google Authenticator, 1Password, Authy…) y escribe el código de 6 cifras.</p>
      <MfaChallenge next={safeNext(next)} />
    </>
  );
}
