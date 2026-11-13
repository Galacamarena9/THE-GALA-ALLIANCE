import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { COMMON_SERVICES, PERSONAL_SERVICES } from '@/lib/domain/navigation';
import { roleHome, roleLabel } from '@/lib/domain/roles';
import { Icon } from '@/components/Icon';
import { ButtonLink, Card, PageHeader } from '@/components/ui';
import { AskGala } from '@/components/AskGala';

export const metadata: Metadata = { title: 'Inicio' };

const COMMON_COPY: Record<string, string> = {
  '/app/inbox': 'Conversaciones seguras con universidades, coaches, agentes y marcas.',
  '/app/news': 'Comunicados oficiales, fichajes y cambios de normativa.',
  '/app/discover': 'Atletas con datos comparables. Filtra por deporte, posición, año, división o nota.',
  '/app/opportunities': 'Becas y plazas revisadas, de organizaciones verificadas.',
  '/app/universities': 'Directorio de universidades y colleges verificados.',
  '/app/guia': 'Becas, documentos, proceso, visado y lo que te vas a encontrar.',
  '/app/calculator': 'Coste real a 4 años y comparador de ofertas.',
  '/app/ia': 'Pregunta lo que quieras sobre el proceso. Respuestas con fuentes.',
};

export default async function HomePage() {
  const session = await requireSession();
  const primary = session.primaryRole ?? session.roles[0];

  return (
    <>
      <PageHeader
        kicker={session.roles.map(roleLabel).join(' · ')}
        title={`Hola, ${session.displayName.split(' ')[0]}`}
        description="Todo lo que necesitas para el proceso de becas en EE. UU., en un solo sitio."
        action={primary ? <ButtonLink href={roleHome(primary)}>Ir a mi espacio</ButtonLink> : undefined}
      />

      <Card className="mb-6 paper-grain">
        <AskGala compact />
      </Card>

      <section aria-labelledby="personal" className="mb-8">
        <h2 id="personal" className="mb-4 text-xl text-paper">Tu espacio</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {session.roles.flatMap((r) => PERSONAL_SERVICES[r]).filter((s, i, arr) => arr.findIndex((x) => x.href === s.href) === i).map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-paper transition-colors hover:border-brass/60">
                <span className="text-brass"><Icon name={s.icon} className="h-5 w-5" /></span>
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="comunes">
        <h2 id="comunes" className="mb-4 text-xl text-paper">Para todos</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMMON_SERVICES.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brass/60">
                <span className="flex items-center gap-2.5 text-paper"><span className="text-brass"><Icon name={s.icon} /></span>{s.label}</span>
                <span className="mt-2 text-sm text-muted">{COMMON_COPY[s.href]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
