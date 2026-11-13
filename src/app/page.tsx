import Link from 'next/link';
import { ButtonLink } from '@/components/ui';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { ACTORS } from '@/lib/domain/roles';

/** Los tres fallos del sistema actual (tesis del TFG) y cómo los corrige la plataforma. */
const FAILURES = [
  {
    n: '01',
    title: 'Visibilidad que depende de contactos',
    today: 'Solo se ve a quien va con la selección, juega los mejores campeonatos o tiene un agente con buena agenda.',
    fix: 'Un Passport estructurado y comparable pone a cualquier atleta con nivel delante de universidades verificadas. El matching ordena por encaje real, no por fama.',
  },
  {
    n: '02',
    title: 'Asimetría de información',
    today: 'Cada actor sabe una parte: el atleta no conoce el coste real, la universidad no puede verificar los datos.',
    fix: 'Cada dato indica su origen (declarado, documentado o verificado), cada beca muestra el coste neto y solo publican organizaciones verificadas.',
  },
  {
    n: '03',
    title: 'Familias sin mapa',
    today: 'Un proceso opaco, en otro idioma, con agencias que cobran miles de euros por información que debería ser accesible.',
    fix: 'Guía con fuentes oficiales, roadmap según el curso, calculadora de coste real, panel familiar y Gala IA para resolver dudas a cualquier hora.',
  },
];

const SERVICES = [
  ['Escaparate de atletas', 'Perfiles filtrables por deporte, posición, año, división, nota y vídeo.'],
  ['Becas y oportunidades', 'Revisadas antes de publicarse, con encaje explicado y coste neto.'],
  ['Universidades', 'Directorio con datos oficiales del U.S. Department of Education, web, deportes, admisiones y campus virtual.'],
  ['Centro de información', 'Divisiones, requisitos, documentos, visado y lo que te vas a encontrar.'],
  ['Mensajes seguros', 'Solo organizaciones verificadas; con menores, la familia aprueba y ve la conversación.'],
  ['Gala IA', 'Tu asistente del proceso y buscador de talento en lenguaje natural.'],
];

const STEPS = [
  ['Crea tu Passport', 'Deporte, posición, vídeo, notas e idiomas en un perfil comparable. Gratis y con privacidad por bloques.'],
  ['Mira dónde encajas', 'Encaje explicado con universidades y becas revisadas, y el coste neto real para tu familia.'],
  ['Conecta con seguridad', 'Solo organizaciones verificadas pueden contactar. Con menores, la familia aprueba y ve la conversación.'],
  ['Decide con datos', 'Compara ofertas, sigue tus plazos y prepara SAT y TOEFL con la Academia.'],
];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre: perfil, escaparate, candidaturas y recibir contacto. Las familias que quieren ayuda experta pueden contratar servicios de pago único; las organizaciones tienen sus propios planes.'],
  ['¿Pagar da más visibilidad?', 'No. Ningún plan compra prioridad en el escaparate ni "destacados". El orden depende del encaje con lo que busca cada organización.'],
  ['¿Garantizáis una beca?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la universidad y de la familia.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados para anónimos, marcas y agentes; contacto solo de organizaciones verificadas y con la familia en el circuito; sin publicidad perfilada.'],
  ['¿Necesito el SAT o el TOEFL?', 'La NCAA no exige SAT/ACT desde 2023, pero muchas universidades piden un examen de inglés y algunas el SAT para admisión o becas académicas. La Academia te ayuda a prepararlos.'],
  ['¿De dónde salen los datos de las universidades?', 'Del College Scorecard del U.S. Department of Education y de las webs oficiales de cada universidad, siempre con la fuente y la fecha visibles.'],
];

const TRUST = [
  'Perfiles de menores privados por defecto, nunca visibles para marcas ni agentes.',
  'Universidades, clubes, agencias y marcas verificadas con su dominio oficial antes de publicar o contactar.',
  'Cada beca pasa controles automáticos antes de publicarse y lleva un sello de confianza de 5 niveles con sus señales de alarma.',
  'Tus datos, tus reglas: visibilidad por bloque, descarga de datos y borrado.',
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="paper-grain pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <PublicHeader />

      <main className="relative">
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-24">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.22em] text-brass">Reclutamiento deportivo internacional · EE. UU.</p>
          <h1 className="max-w-4xl text-[44px] leading-[1.04] text-paper sm:text-[72px]">
            Si tienes nivel, tienes que poder optar. <span className="italic text-brass">Tengas o no los contactos.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted">
            The Gala Alliance es la plataforma de confianza que conecta a atletas, familias, universidades, coaches, agentes y marcas con información verificable. Sin depender de quién te conoce.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/signup?role=athlete" className="px-6 py-3 text-[15px]">Crear mi Passport gratis</ButtonLink>
            <ButtonLink href="/para/universidades" variant="secondary" className="px-6 py-3 text-[15px]">Soy universidad o coach</ButtonLink>
            <ButtonLink href="/guia" variant="ghost" className="px-6 py-3 text-[15px]">Leer la guía →</ButtonLink>
          </div>
        </section>

        <section aria-labelledby="fallos" className="border-y border-line bg-surface/50">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 id="fallos" className="max-w-3xl text-3xl text-paper">Un sistema arcaico, tres fallos que corregimos</h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {FAILURES.map((f) => (
                <article key={f.n} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-ink p-6">
                  <p className="font-display text-sm italic text-brass">{f.n}</p>
                  <h3 className="mt-2 text-xl text-paper">{f.title}</h3>
                  <p className="mt-3 text-sm text-faint">Hoy: {f.today}</p>
                  <p className="mt-3 text-sm leading-relaxed text-paper">{f.fix}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="actores" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 id="actores" className="text-3xl text-paper">Seis actores, un mismo proceso</h2>
          <p className="mt-3 max-w-2xl text-muted">Cada uno tiene su espacio con lo que necesita para decidir, y todos comparten los mismos servicios básicos.</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ACTORS.map((a) => (
              <li key={a.role}>
                <Link href={`/para/${a.slug}`} className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-colors hover:border-brass/60">
                  <span className="font-display text-2xl text-paper">{a.plural}</span>
                  <span className="mt-3 text-sm leading-relaxed text-muted">{a.promise}</span>
                  <span className="mt-auto pt-5 text-xs font-medium text-brass opacity-80 group-hover:opacity-100">Ver su espacio →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-line bg-surface/50">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="text-3xl text-paper">Para todos, desde el primer día</h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map(([t, d]) => (
                <div key={t} className="bg-ink p-6"><h3 className="text-lg text-paper">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="como" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 id="como" className="text-3xl text-paper">Cómo funciona</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
                <p className="font-display text-sm italic text-brass">0{i + 1}</p>
                <h3 className="mt-2 text-lg text-paper">{t}</h3>
                <p className="mt-2 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/precios" variant="secondary">Ver planes y precios</ButtonLink>
            <span className="text-sm text-faint">Gratis para atletas, para siempre.</span>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-10 rounded-[var(--radius-card)] border border-brass/30 bg-surface p-8 sm:grid-cols-[1fr_1.2fr] sm:p-12">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brass">Confianza por diseño</p>
              <h2 className="mt-3 text-3xl text-paper">Pensada para familias con hijos menores</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                No vendemos becas garantizadas ni prioridad encubierta. Organizamos el proceso y la información; la decisión es siempre de la familia y de la universidad.
              </p>
              <Link href="/legal/proteccion-menores" className="mt-4 inline-block text-sm text-brass hover:underline">Cómo protegemos a los menores →</Link>
            </div>
            <ul className="space-y-4">
              {TRUST.map((t) => (
                <li key={t} className="flex gap-3 text-[15px] text-paper"><span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-brass" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </section>
        <section aria-labelledby="faq" className="mx-auto max-w-4xl px-5 pb-20 sm:px-8">
          <h2 id="faq" className="text-3xl text-paper">Preguntas frecuentes</h2>
          <div className="mt-8 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-6 py-4">
                <summary className="cursor-pointer list-none text-[15px] text-paper marker:hidden">
                  <span className="mr-2 text-brass group-open:hidden">+</span><span className="mr-2 hidden text-brass group-open:inline">−</span>{q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'Organization', name: 'The Gala Alliance', description: 'Plataforma de reclutamiento deportivo internacional y becas en Estados Unidos.' },
              { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      <PublicFooter />
    </div>
  );
}
