import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Building2, ChevronDown, CircleCheck, GraduationCap, Handshake, Megaphone, ShieldCheck, Sparkles, Star, Trophy, Users,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { Reveal } from '@/components/Reveal';
import { HeroAudience } from '@/components/landing/HeroAudience';
import { OptionsQuiz } from '@/components/landing/OptionsQuiz';
import { ProductTour } from '@/components/landing/ProductTour';
import { Timeline } from '@/components/landing/Timeline';
import { ACTORS } from '@/lib/domain/roles';
import { PLANS, VISIBILITY_PROMISE } from '@/content/plans';

/** La foto del hero solo se usa si está en /public (se añade aparte); si no, fondo de rejilla y halos. */
const DESTINATIONS = [
  { tag: 'Atletas', title: 'Talento', text: 'Perfiles verificables con vídeo, estadísticas y notas.', img: '/media/hero-athletes.webp', href: '/para/atletas' },
  { tag: 'Estados Unidos', title: 'Universidades', text: 'Tu deporte, tu próxima universidad y su coste real.', img: '/media/university-campus.webp', href: '/para/universidades' },
  { tag: 'Internacional', title: 'Clubes', text: 'Clubes y coaches: talento comparable, más allá de las fronteras.', img: '/media/club-training.webp', href: '/para/coaches' },
];

const ROLE_ICON: Record<string, typeof Users> = { athlete: GraduationCap, parent: Users, university: Building2, coach: Trophy, agent: Handshake, brand: Megaphone };
const ROLE_TITLE: Record<string, string> = { athlete: 'Soy atleta', parent: 'Soy familia', university: 'Soy universidad', coach: 'Soy coach o club', agent: 'Soy agente', brand: 'Soy marca' };

const SPORTS = ['Baloncesto', 'Fútbol', 'Tenis', 'Atletismo', 'Natación', 'Voleibol', 'Golf', 'Remo', 'Hockey', 'Softball', 'Béisbol', 'Pádel', 'Waterpolo', 'Lacrosse', 'Triatlón', 'Esgrima'];

/** Comparativa general (cada agencia es distinta). */
const COMPARE: { row: string; gala: string; agency: string; alone: string; galaOk: boolean }[] = [
  { row: 'Precio publicado antes de empezar', gala: 'Sí: 0 € para atletas', agency: 'Normalmente en una llamada', alone: 'Gratis', galaOk: true },
  { row: 'Pagar para salir más arriba', gala: 'Nunca', agency: 'Depende del paquete', alone: 'No aplica', galaOk: true },
  { row: 'Solo organizaciones verificadas', gala: 'Sí, por dominio oficial', agency: 'Depende', alone: 'No', galaOk: true },
  { row: 'Coste real y riesgos de cada oferta', gala: 'Calculadora, sello y memo', agency: 'Depende', alone: 'Lo calculas tú', galaOk: true },
  { row: 'La familia aprueba los contactos con menores', gala: 'Siempre', agency: 'Depende', alone: 'No', galaOk: true },
  { row: 'Tus datos: descarga y borrado cuando quieras', gala: 'Sí, autoservicio', agency: 'Depende', alone: 'No aplica', galaOk: true },
  { row: 'Acompañamiento personal 1:1', gala: 'Opcional (Signature)', agency: 'Sí', alone: 'No', galaOk: true },
];

const STATS = [
  { Icon: Star, value: '0 €', label: 'Para atletas, siempre' },
  { Icon: Users, value: '6', label: 'Perfiles conectados en una red' },
  { Icon: ShieldCheck, value: '5 niveles', label: 'Sello de confianza en cada beca' },
  { Icon: BadgeCheck, value: 'Oficial', label: 'Fuente visible en cada dato' },
];

/** Los tres fallos del sistema actual (tesis del TFG) y cómo los corrige la plataforma. */
const FAILURE_IMG = ['/media/hero-athletes-sm.webp', '/media/university-campus-sm.webp', '/media/club-training-sm.webp'];
const ROLE_IMG: Record<string, string> = { athlete: '/media/hero-athletes.webp', parent: '/media/university-campus-sm.webp', university: '/media/arena-bg.webp', coach: '/media/club-training-sm.webp', agent: '/media/agent-workspace-sm.webp', brand: '/media/hero-bg-poster.jpg' };

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
  const family = PLANS.filter((p) => p.audience === 'athlete' || p.audience === 'family');
  return (
    <div className="relative">
      <PublicHeader />

      <main id="main-content">
        {/* HERO: vídeo a sangre con velo Noche y selector de perfil */}
        <section aria-label="Presentación" className="relative flex min-h-[min(88vh,820px)] items-center overflow-hidden bg-night text-white">
          <div className="absolute inset-0" aria-hidden>
            {/* Vídeo decorativo sin sonido (0,45 MB). Con "reducir movimiento" se muestra solo la imagen fija. */}
            <video className="hero-video h-full w-full object-cover" src="/media/hero-bg.mp4" poster="/media/hero-bg-poster.jpg" autoPlay muted loop playsInline preload="metadata" />
            <div className="hero-shade absolute inset-0" />
          </div>
          <HeroAudience />
        </section>

        {/* Franja de confianza + deportes en movimiento */}
        <section aria-label="Confianza" className="border-y border-line/50 bg-surface/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 lg:grid-cols-4">
            {STATS.map(({ Icon, value, label }, i) => (
              <Reveal key={label} delay={i * 80} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brass/10"><Icon className="h-5 w-5 text-brass" aria-hidden /></span>
                <span><span className="block font-display text-xl font-bold text-paper">{value}</span><span className="block text-xs text-muted">{label}</span></span>
              </Reveal>
            ))}
          </div>
          <div className="relative overflow-hidden border-t border-line/40 py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" aria-hidden>
            <div className="marquee flex w-max gap-10 text-sm font-semibold uppercase tracking-[0.2em] text-faint">
              {[...SPORTS, ...SPORTS].map((s, i) => <span key={i} className="flex items-center gap-10">{s}<span className="text-brass/50">✦</span></span>)}
            </div>
          </div>
        </section>

        {/* DESTINOS: tarjetas con imagen (las fotos son ilustrativas) */}
        <section aria-labelledby="destinos-title" className="px-6 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brass">El marketplace</p>
                <h2 id="destinos-title" className="mt-1 font-display text-4xl font-bold uppercase text-paper md:text-5xl">¿Cuál es tu próximo destino?</h2>
              </div>
              <Link href="/signup" className="text-sm font-semibold text-brass hover:underline">Crear cuenta gratis</Link>
            </div>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {DESTINATIONS.map((d, i) => (
                <li key={d.title} className={`rise-in rise-in-${i + 1}`}>
                  <Link href={d.href} className="hover-lift group relative block h-80 overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- imagen local optimizada (WebP) */}
                    <img src={d.img} srcSet={`${d.img.replace('.webp', '-sm.webp')} 720w, ${d.img} 1280w`} sizes="(min-width: 768px) 33vw, 100vw" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                    <div className="tile-shade absolute inset-0" aria-hidden />
                    <span className="absolute left-4 top-4 rounded-md bg-night/80 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-lime backdrop-blur">{d.tag}</span>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h3 className="font-display text-3xl font-bold uppercase leading-none">{d.title}</h3>
                      <p className="mt-2 text-sm text-lavender">{d.text}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Imágenes ilustrativas: no son atletas ni centros reales de la plataforma.</p>
          </div>
        </section>

        {/* FUNDADORA: la historia real detrás de la plataforma (fotos de Gala, sin logos ni terceros reconocibles) */}
        <section aria-labelledby="fundadora-title" className="relative overflow-hidden bg-night text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- fondo decorativo local */}
          <img src="/media/arena-bg.webp" alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/40" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
            <div className="rise-in">
              <p className="text-sm font-semibold text-lime">Quién está detrás</p>
              <h2 id="fundadora-title" className="mt-2 font-display text-4xl font-bold uppercase leading-none md:text-6xl">
                Creada por una exjugadora NCAA D-I
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-lavender">
                Soy Gala. Jugué al baloncesto en la NCAA División I con beca completa en Estados Unidos. Sé lo que se siente al salir a una pista así, y lo difícil que es llegar cuando no tienes contactos.
              </p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-lavender">
                Por eso existe The Gala Alliance: para que llegar dependa de tu nivel y de tu esfuerzo, no de a quién conoces.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center rounded-xl bg-lime px-7 text-sm font-bold text-night transition-transform hover:-translate-y-0.5 focus-visible:outline-lime">Crear mi perfil gratis</Link>
                <Link href="/precios" className="inline-flex h-12 items-center rounded-xl border border-white/30 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-lime">Trabajar con Gala</Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <figure className="hover-lift overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-premium)] ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto local optimizada */}
                <img src="/media/founder-portrait.webp" srcSet="/media/founder-portrait-sm.webp 720w, /media/founder-portrait.webp 1300w" sizes="(min-width: 1024px) 560px, 100vw" alt="Gala, fundadora de The Gala Alliance, concentrada en la pista antes de un tiro libre" loading="lazy" className="aspect-[6/5] w-full object-cover object-top" />
              </figure>
              <figure className="absolute -bottom-10 -left-6 hidden w-56 overflow-hidden rounded-xl shadow-[var(--shadow-premium)] ring-4 ring-night sm:block">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto local optimizada */}
                <img src="/media/founder-entrance-sm.webp" alt="Gala saltando a la pista en la presentación de un partido" loading="lazy" className="aspect-[3/2] w-full object-cover" />
              </figure>
              <span className="absolute -right-2 -top-3 rounded-full bg-lime px-3 py-1.5 font-display text-sm font-bold uppercase text-night shadow-lg">NCAA D-I</span>
            </div>
          </div>
        </section>

        {/* TEST de opciones: el gancho de captación */}
        <section id="test" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-trust/30 bg-trust/10 px-3 py-1 text-[13px] font-semibold text-ok"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Gratis · 60 segundos</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">¿Tienes opciones de beca? <span className="text-brass">Descúbrelo ahora.</span></h2>
              <p className="mt-4 max-w-md leading-relaxed text-muted">Cuatro preguntas y te decimos dónde encajarías, qué te haría subir de nivel y tu siguiente paso. Sin registrarte.</p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                {['Sin email ni datos personales', 'Basado en cómo funcionan las divisiones NCAA, NAIA y JUCO', 'Después, universidades reales para tu perfil'].map((t) => <li key={t} className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-ok" aria-hidden />{t}</li>)}
              </ul>
            </Reveal>
            <Reveal delay={120}><OptionsQuiz /></Reveal>
          </div>
        </section>

        {/* POR QUÉ: bloque Noche con foto de estadio; cada fallo es una tarjeta con foto y su arreglo en lima. */}
        <section className="relative overflow-hidden bg-night px-6 py-24 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- fondo decorativo local */}
          <img src="/media/arena-bg.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-night via-night/80 to-night" aria-hidden />
          <div className="relative mx-auto max-w-6xl">
            <Reveal className="mb-14 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div>
                <p className="mb-4 text-sm font-semibold text-lime">Por qué Gala Alliance</p>
                <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] text-white md:text-7xl">El reclutamiento ya no es un acto de fe</h2>
              </div>
              <p className="text-base leading-relaxed text-lavender lg:pb-2">Tres fallos del sistema actual que dejan fuera a atletas con nivel. Y lo que cambia la plataforma en cada uno.</p>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3">
              {FAILURES.map((f, i) => (
                <Reveal key={f.n} delay={i * 120} className="h-full">
                  <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white/[0.06] ring-1 ring-white/10 backdrop-blur transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.1] hover:ring-lime/40">
                    <div className="relative h-44 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local */}
                      <img src={FAILURE_IMG[i]} alt="" aria-hidden className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0" />
                      <span className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" aria-hidden />
                      <span className="absolute bottom-2 left-5 font-display text-7xl font-bold leading-none text-white/90 [-webkit-text-stroke:1px_rgb(200_240_60)] [color:transparent] transition-colors duration-500 group-hover:[color:rgb(200_240_60)]">{f.n}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-2xl font-bold uppercase leading-tight text-white">{f.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-lavender">{f.today}</p>
                      <div className="mt-auto pt-6">
                        <div className="rounded-2xl bg-lime px-4 py-4 text-sm leading-relaxed text-night transition-transform duration-500 group-hover:-translate-y-1">
                          <p className="mb-1 text-xs font-bold">Con Gala</p>
                          {f.fix}
                        </div>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-xs text-lavender/70">Imágenes ilustrativas.</p>
          </div>
        </section>

        {/* PRODUCTO */}
        <section id="producto" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-14 max-w-3xl">
              <p className="mb-3 text-sm font-semibold text-brass">El producto</p>
              <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Míralo por dentro antes de registrarte</h2>
            </Reveal>
            <Reveal><ProductTour /></Reveal>
          </div>
        </section>

        {/* CÓMO FUNCIONA: calendario por curso, sobre una franja de pista. */}
        <section id="como-funciona" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
              <Reveal variant="left" className="relative min-h-[320px] overflow-hidden rounded-[var(--radius-card)] bg-night">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local */}
                <img src="/media/club-training.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-80" />
                <div className="tile-shade absolute inset-0" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 p-7">
                  <p className="mb-3 text-sm font-semibold text-lime">Cómo funciona</p>
                  <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] text-white md:text-6xl">Qué hacer en cada curso</h2>
                  <p className="mt-3 max-w-sm text-sm text-lavender">Pulsa tu etapa. La plataforma te lo recuerda con fechas según tu promoción.</p>
                </div>
              </Reveal>
              <Reveal delay={120} className="flex flex-col justify-center rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7">
                <Timeline />
                <ButtonLink href="/signup" className="group mt-8 h-12 self-start px-8 font-semibold">Empezar gratis ahora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
              </Reveal>
            </div>
          </div>
        </section>

        {/* COMPARATIVA */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-3 font-display text-5xl font-bold uppercase leading-none text-paper md:text-6xl">Gala frente a las alternativas</h2>
              <p className="mx-auto max-w-xl text-sm text-muted">Lo que cambia respecto a una agencia tradicional o a hacerlo por tu cuenta.</p>
            </Reveal>
            <Reveal>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-elevated)]">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-surface">
                      <th scope="col" className="p-4 text-left text-xs font-normal text-faint"><span className="sr-only">Aspecto</span></th>
                      <th scope="col" className="bg-night p-4 text-left"><span className="flex items-center gap-2 font-bold text-white"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-lime text-xs font-black text-night">G</span>The Gala Alliance</span></th>
                      <th scope="col" className="p-4 text-left font-semibold text-muted">Agencia tradicional</th>
                      <th scope="col" className="p-4 text-left font-semibold text-muted">Por tu cuenta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((c) => (
                      <tr key={c.row} className="border-t border-line transition-colors hover:bg-surface-2">
                        <th scope="row" className="p-4 text-left font-normal text-paper">{c.row}</th>
                        <td className="bg-night p-4"><span className="flex items-start gap-2 font-semibold text-white"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />{c.gala}</span></td>
                        <td className="p-4 text-muted">{c.agency}</td>
                        <td className="p-4 text-muted">{c.alone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-center text-xs text-faint">Comparativa general: cada agencia trabaja de forma distinta.</p>
            </Reveal>
          </div>
        </section>

        {/* PARA QUIÉN: un mosaico de fotos, una por perfil. */}
        <section id="para-quien" className="scroll-mt-20 bg-surface-2/60 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Seis perfiles, una sola red</h2>
              <p className="max-w-sm text-sm text-muted">Cada uno con su espacio y sus herramientas. Elige el tuyo.</p>
            </Reveal>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ACTORS.map((a, i) => {
                const Icon = ROLE_ICON[a.role] ?? Users;
                return (
                  <Reveal key={a.role} as="li" delay={(i % 3) * 90} className={a.role === 'athlete' ? 'sm:col-span-2 lg:col-span-1 lg:row-span-2' : a.role === 'brand' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                    <Link href={`/para/${a.slug}`} className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-[var(--radius-card)] bg-night p-6 text-white ${a.role === 'athlete' ? 'min-h-[300px] lg:min-h-[100%]' : a.role === 'brand' ? 'min-h-[220px]' : 'min-h-[260px]'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local */}
                      <img src={ROLE_IMG[a.role] ?? '/media/arena-bg-sm.webp'} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-110" />
                      <span className="tile-shade absolute inset-0" aria-hidden />
                      <span className="relative mb-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur transition-colors duration-300 group-hover:bg-lime group-hover:text-night"><Icon className="h-5 w-5" aria-hidden /></span>
                      <span className="relative mt-16">
                        <span className="block font-display text-3xl font-bold uppercase leading-none">{ROLE_TITLE[a.role] ?? a.plural}</span>
                        <span className="mt-2 block text-sm text-lavender">{a.promise}</span>
                        <span className="mt-0 grid grid-rows-[0fr] transition-all duration-500 group-hover:mt-3 group-hover:grid-rows-[1fr] group-focus-visible:mt-3 group-focus-visible:grid-rows-[1fr]">
                          <span className="overflow-hidden">
                            {a.services.slice(0, 3).map((x) => <span key={x} className="flex items-start gap-2 py-0.5 text-xs text-white/90"><CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime" aria-hidden />{x}</span>)}
                          </span>
                        </span>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-lime">Ver lo que incluye <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-faint">Imágenes ilustrativas.</p>
          </div>
        </section>

        {/* PLANES */}
        <section className="border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-3 font-display text-5xl font-bold uppercase leading-none text-paper md:text-6xl">Precios claros, sin llamadas comerciales</h2>
              <p className="mx-auto max-w-2xl text-sm text-muted">{VISIBILITY_PROMISE}</p>
            </Reveal>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {family.map((p, i) => (
                <Reveal key={p.code} as="li" delay={i * 80}>
                  <div className={`relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${p.highlight ? 'animate-pulse-glow border-brass/40 bg-brass/[0.06]' : 'border-line bg-surface hover:border-brass/30'}`}>
                    {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brass px-3 py-0.5 text-xs font-semibold text-ink">Más elegido</span>}
                    <p className="text-sm font-semibold text-paper">{p.name}</p>
                    <p className="mt-2 font-display text-3xl font-bold text-paper">{p.price}</p>
                    <p className="text-xs text-faint">{p.priceNote}</p>
                    <p className="mt-3 text-sm text-muted">{p.pitch}</p>
                    <ul className="mt-4 space-y-1.5">
                      {p.includes.slice(0, 3).map((x) => <li key={x} className="flex items-start gap-2 text-xs text-muted"><CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" aria-hidden />{x}</li>)}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </ul>
            <Reveal className="mt-10 text-center">
              <ButtonLink href="/precios" variant="secondary" className="px-8">Ver todos los planes</ButtonLink>
            </Reveal>
          </div>
        </section>

        {/* CONFIANZA: bloque Noche con la promesa de seguridad en grande. */}
        <section className="px-6 py-20">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-card)] bg-night px-6 py-14 text-white sm:px-12">
            <div className="court-lines absolute inset-0 opacity-40" aria-hidden />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:items-center">
              <Reveal>
                <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime text-night"><ShieldCheck className="h-7 w-7" aria-hidden /></span>
                <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] md:text-6xl">Hecha para menores, familias y datos reales</h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-lavender">Protección de datos, verificación y transparencia no son extras: están en la base de la plataforma.</p>
              </Reveal>
              <ul className="grid gap-3 sm:grid-cols-2">
                {TRUST.map((t, i) => (
                  <Reveal key={t} as="li" delay={i * 80}>
                    <div className="flex h-full gap-3 rounded-2xl bg-white/[0.07] p-4 text-sm leading-relaxed text-white/90 ring-1 ring-white/10 transition-colors duration-300 hover:bg-white/[0.12] hover:ring-lime/40"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />{t}</div>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* PREGUNTAS: titular grande a la izquierda y respuestas a la derecha. */}
        <section className="px-6 py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="mb-3 text-sm font-semibold text-brass">Preguntas frecuentes</p>
              <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Resolvemos tus dudas</h2>
              <p className="mt-4 max-w-sm text-muted">Lo que más nos preguntan atletas y familias. ¿Falta la tuya? Pregúntale a Gala IA dentro de la app.</p>
            </Reveal>
            <div className="space-y-3">
              {FAQ.map(([q, a], i) => (
                <Reveal key={q} delay={i * 60}>
                  <details className="group rounded-2xl border border-line bg-surface px-5 transition-all duration-300 open:border-brass/40 open:shadow-[var(--shadow-elevated)] hover:border-brass/30">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold text-paper [&::-webkit-details-marker]:hidden">
                      {q}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 transition-all duration-300 group-open:rotate-180 group-open:bg-brass group-open:text-white"><ChevronDown className="h-4 w-4" aria-hidden /></span>
                    </summary>
                    <p className="pb-5 text-sm leading-relaxed text-muted">{a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL: vídeo a sangre, como la cabecera, para cerrar con energía. */}
        <section className="relative overflow-hidden bg-night px-6 py-28 text-white">
          <video className="hero-video absolute inset-0 h-full w-full object-cover opacity-50" src="/media/hero-bg.mp4" poster="/media/hero-bg-poster.jpg" autoPlay muted loop playsInline aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-night/40" aria-hidden />
          <Reveal className="relative mx-auto max-w-3xl text-center">
            <h2 className="font-display text-6xl font-bold uppercase leading-[0.9] md:text-8xl">Tu beca empieza aquí</h2>
            <p className="mx-auto mt-5 max-w-md text-base text-lavender">Unos minutos para crear tu Passport. Cero coste para atletas.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup?role=athlete" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-10 text-sm font-bold text-night transition-transform hover:-translate-y-0.5">Crear mi Passport gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
              <Link href="#test" className="inline-flex h-12 items-center rounded-xl px-8 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10">Hacer el test primero</Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Barra fija en móvil: la acción principal siempre a mano. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 p-3 backdrop-blur-xl md:hidden">
        <div className="flex gap-2">
          <Link href="#test" className="flex-1 rounded-xl border border-line-strong py-3 text-center text-sm text-paper">Hacer el test</Link>
          <Link href="/signup?role=athlete" className="btn-shine flex-1 rounded-xl bg-brass py-3 text-center text-sm font-bold text-ink">Crear Passport</Link>
        </div>
      </div>

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
      <div className="pb-20 md:pb-0"><PublicFooter /></div>
    </div>
  );
}
