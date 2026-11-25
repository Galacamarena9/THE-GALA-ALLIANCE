import Link from 'next/link';
import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { getT } from '@/lib/i18n/server-t';
import { roleLabel } from '@/lib/domain/roles';

export const metadata: Metadata = { title: 'Sin acceso' };

/**
 * Sin acceso (fase 7, U4): antes, entrar en una sección de otro tipo de cuenta devolvía al inicio sin decir nada.
 * Ahora se explica por qué y qué hacer. No revela qué hay en la sección.
 */
export default async function NoAccessPage() {
  const session = await requireSession();
  const tx = await getT();
  const roles = session.roles.filter((r) => r !== 'admin').map((r) => tx(roleLabel(r))).join(', ');
  return (
    <section aria-labelledby="no-access-title" className="mx-auto max-w-lg py-16 text-center">
      <p className="font-display text-6xl font-bold leading-none text-brass" aria-hidden>403</p>
      <h1 id="no-access-title" className="mt-4 font-display text-3xl font-bold uppercase text-paper">{tx('Esta sección no es para tu cuenta')}</h1>
      <p className="mt-3 text-muted">
        {tx('Cada tipo de cuenta ve sus herramientas. Tu cuenta es de:')} <strong className="text-paper">{roles || tx('sin tipo')}</strong>.
      </p>
      <p className="mt-2 text-muted">{tx('Si crees que deberías entrar (por ejemplo, porque te han invitado a una organización), revisa la invitación o escríbenos.')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/app" className="inline-flex h-11 items-center rounded-xl bg-brass px-6 text-sm font-semibold text-ink hover:bg-brass-soft">{tx('Ir a mi inicio')}</Link>
        <Link href="/app/support" className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-6 text-sm font-semibold text-paper hover:border-brass/40">{tx('Escribir a soporte')}</Link>
      </div>
    </section>
  );
}
