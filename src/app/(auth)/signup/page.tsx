import type { Metadata } from 'next';
import { ACTORS } from '@/lib/domain/roles';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const actor = ACTORS.find((a) => a.role === role);
  return (
    <>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-brass">{actor ? actor.label : 'Crear cuenta'}</p>
      <h1 className="text-3xl text-paper">{actor ? actor.promise : 'Empieza en menos de un minuto'}</h1>
      <p className="mb-8 mt-3 text-sm text-muted">Gratis para atletas y familias.</p>
      <SignupForm role={actor?.role} />
    </>
  );
}
