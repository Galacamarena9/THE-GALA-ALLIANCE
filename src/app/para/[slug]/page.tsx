import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { notFound } from 'next/navigation';
import { ACTORS, actorBySlug } from '@/lib/domain/roles';
import { ButtonLink } from '@/components/ui';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { PLANS } from '@/content/plans';

/** Qué problema del sistema actual resolvemos para cada actor (tesis del TFG, en lenguaje de producto). */
const PAIN: Record<string, { problem: string; answer: string }> = {
  atletas: { problem: 'Hoy, si no vas con la selección, no juegas los mejores campeonatos o no tienes un agente con contactos, eres invisible.', answer: 'Tu Passport te pone delante de universidades verificadas por tu nivel real, con datos comparables y el encaje explicado.' },
  familias: { problem: 'Un proceso opaco, en otro idioma, con costes que nadie explica y agencias que cobran miles de euros por información.', answer: 'El proceso paso a paso, el coste neto real de cada opción y control total sobre la privacidad de tu hijo o hija.' },
  universidades: { problem: 'Encontrar talento internacional depende de intermediarios y de perfiles que no se pueden comparar ni verificar.', answer: 'Perfiles estructurados con el origen de cada dato, matching por beca y un pipeline propio, sin intermediarios.' },
  coaches: { problem: 'Horas viendo vídeos sueltos sin contexto académico ni económico.', answer: 'Búsqueda por deporte, posición, año, nota y vídeo, shortlists privadas y Gala IA para buscar en lenguaje natural.' },
  agentes: { problem: 'Llevas cada atleta y cada universidad entre hojas de cálculo, emails y WhatsApp, y los procesos se olvidan.', answer: 'Un tablero con cada proceso, quién lo lleva y qué toca hacer, compartido con tu equipo y, si quieres, con el atleta. Con agencia verificada y siempre con su consentimiento.' },
  marcas: { problem: 'Encontrar atletas auténticos con los que colaborar de forma transparente es caro y lento.', answer: 'Publica ofertas con condiciones claras y recibe candidaturas de atletas mayores de edad.' },
};

/** Foto de la banda «Estadio» por público (solo fotos propias de /public/media). */
const PARA_PHOTO: Record<string, string> = {
  atletas: '/media/hero-athletes-sm.webp', familias: '/media/founder-entrance-sm.webp', universidades: '/media/university-campus-sm.webp',
  coaches: '/media/club-training-sm.webp', agentes: '/media/agent-workspace-sm.webp', marcas: '/media/arena-bg-sm.webp',
};

export function generateStaticParams() {
  return ACTORS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = actorBySlug(slug);
  return { title: a ? `Para ${a.plural.toLowerCase()}` : 'The Gala Alliance', description: a?.promise };
}

export default async function ForActorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = actorBySlug(slug);
  if (!a) notFound();
  const pain = PAIN[slug];
  const agentPlan = PLANS.find((p) => p.code === 'agent_solo');
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <PageHeader kicker={`Para ${a.plural.toLowerCase()}`} title={a.promise} photo={PARA_PHOTO[slug] ?? '/media/hero-athletes-sm.webp'} />
        <div className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2">
          <div className="bg-ink p-7"><p className="text-xs uppercase tracking-wide text-faint">Hoy</p><p className="mt-2 text-lg text-muted">{pain.problem}</p></div>
          <div className="bg-surface p-7"><p className="text-xs uppercase tracking-wide text-brass">Con The Gala Alliance</p><p className="mt-2 text-lg text-paper">{pain.answer}</p></div>
        </div>
        <h2 className="mt-14 text-2xl text-paper">Tu espacio incluye</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {a.services.map((s) => <li key={s} className="rounded-xl border border-line bg-surface p-4 text-paper">{s}</li>)}
        </ul>
        {slug === 'agentes' && agentPlan && (
          <p className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-paper">
            <strong className="font-semibold">{agentPlan.name}: {agentPlan.price}</strong>{agentPlan.priceNote ? ` · ${agentPlan.priceNote}` : ''}. Sin comisiones ni cobro por contactar. <a href="/precios" className="font-semibold underline underline-offset-4">Ver todos los planes</a>
          </p>
        )}
        <p className="mt-6 text-sm text-muted">Además, como todos los usuarios: escaparate de atletas, becas y oportunidades, directorio de universidades con datos oficiales, centro de información, calculadora de becas, mensajes seguros, Actualidad y Gala IA.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={slug === 'agentes' ? '/signup?role=agent&plan=agent_solo' : `/signup?role=${a.role}`} className="px-6 py-3">Crear cuenta de {a.label.toLowerCase()}</ButtonLink>
          {slug === 'agentes' && <ButtonLink href="/demo/agente" variant="secondary" className="px-6 py-3">Ver la demo sin registrarte</ButtonLink>}
          <ButtonLink href="/guia" variant="secondary" className="px-6 py-3">Leer la guía</ButtonLink>
        </div>
      </main>
      <PublicFooter audience={slug === 'agentes' ? 'agent' : 'athlete'} />
    </>
  );
}
