import type { Metadata } from 'next';
import { ACTORS } from '@/lib/domain/roles';
import { SignupForm } from './SignupForm';
import { RefCapture } from '@/components/RefCapture';
import { afterSignupPath } from '@/lib/domain/safe-path';

export const metadata: Metadata = { title: 'Crear cuenta' };

/** Lo que cuesta empezar, dicho a cada papel (sin letra pequeña). */
const TAGLINE: Record<string, string> = {
  athlete: 'Gratis para siempre: tu perfil, las oportunidades y recibir contacto.',
  parent: 'Gratis. Los servicios de acompañamiento son opcionales y de pago único.',
  agent: 'Empieza gratis con tu agencia. Sin comisiones ni cobro por contactar.',
  coach: 'Gratis durante el piloto para clubes y academias.',
  university: 'Gratis durante el piloto para universidades.',
  brand: 'Colaboraciones solo con atletas mayores de edad.',
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  const actor = ACTORS.find((a) => a.role === role);
  return (
    <>
      <p className="mb-2 text-[13px] font-semibold text-brass">{actor ? actor.label : 'Crear cuenta'}</p>
      <h1 className="text-3xl text-paper">{actor ? actor.promise : 'Empieza en menos de un minuto'}</h1>
      <p className="mb-8 mt-3 text-sm text-muted">{TAGLINE[actor?.role ?? ''] ?? 'Gratis para atletas y familias.'}</p>
      <RefCapture />
      <SignupForm role={actor?.role} next={afterSignupPath(next) ?? undefined} />
    </>
  );
}
