import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { actorBySlug } from '@/lib/domain/roles';
import { ButtonLink, Card, Notice, PageHeader } from '@/components/ui';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: actorBySlug(slug)?.plural ?? 'Portal' };
}

/** Portal de cada tipo de usuario: si es el tuyo, te lleva a tu espacio; si no, explica ese lado de la plataforma. */
export default async function PortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = actorBySlug(slug);
  if (!actor) notFound();
  const session = await requireSession();
  if (session.roles.includes(actor.role)) redirect(actor.home);

  const canAdd = !(actor.adultsOnly && session.isMinor);

  return (
    <>
      <PageHeader kicker={`Portal · ${actor.plural}`} title={actor.promise} />
      <Card>
        <p className="mb-4 text-sm text-muted">Lo que encuentran aquí:</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {actor.services.map((s) => (
            <li key={s} className="flex gap-3 text-paper"><span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-brass" aria-hidden />{s}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {canAdd ? (
            <ButtonLink href={`/onboarding?add=1&role=${actor.role}`}>Añadir perfil de {actor.label.toLowerCase()}</ButtonLink>
          ) : (
            <Notice tone="neutral">Este portal no está disponible para tu tipo de cuenta.</Notice>
          )}
          <ButtonLink href="/app" variant="ghost">Volver al inicio</ButtonLink>
        </div>
      </Card>
    </>
  );
}
