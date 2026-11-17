import Link from 'next/link';
import {
  ArrowRight, Building2, ChevronDown, CircleCheck, GraduationCap, Handshake, IdCard, Megaphone, MessagesSquare, ShieldCheck, Sparkles, Target, Trophy, Users,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { Reveal } from '@/components/Reveal';
import { HeroAudience } from '@/components/landing/HeroAudience';
import { NetworkGraph } from '@/components/landing/NetworkGraph';
import { PassportPreview } from '@/components/landing/PassportPreview';
import { OptionsQuiz } from '@/components/landing/OptionsQuiz';
import { ProductTour } from '@/components/landing/ProductTour';
import { ACTORS } from '@/lib/domain/roles';
import { BRAND, VERTICALS, VERTICAL_STATUS_LABEL } from '@/content/brand';

const ROLE_ICON: Record<string, typeof Users> = { athlete: GraduationCap, parent: Users, university: Building2, coach: Trophy, agent: Handshake, brand: Megaphone };
const ROLE_TITLE: Record<string, string> = { athlete: 'Soy atleta', parent: 'Soy familia', university: 'Soy universidad', coach: 'Soy coach o club', agent: 'Soy agente', brand: 'Soy marca' };
const ROLE_IMG: Record<string, string> = { athlete: '/media/hero-athletes.webp', parent: '/media/university-campus-sm.webp', university: '/media/arena-bg.webp', coach: '/media/club-training-sm.webp', agent: '/media/agent-workspace-sm.webp', brand: '/media/hero-bg-poster.jpg' };
const VERTICAL_IMG: Record<string, string> = { college: '/media/university-campus.webp', clubs: '/media/club-training.webp', brands: '/media/hero-bg-poster.jpg', events: '/media/arena-bg.webp' };

const SPORTS = ['Baloncesto', 'Fútbol', 'Tenis', 'Atletismo', 'Natación', 'Voleibol', 'Golf', 'Remo', 'Hockey', 'Softball', 'Béisbol', 'Pádel', 'Waterpolo', 'Lacrosse', 'Triatlón', 'Esgrima'];

const STEPS = [
  { n: '01', Icon: IdCard, title: 'Crea tu Opportunity Passport', text: 'Vídeo, estadísticas, notas e idiomas. Cada dato dice si es declarado, documentado o verificado.' },
  { n: '02', Icon: Target, title: 'Recibe matches explicados', text: 'Oportunidades de organizaciones verificadas, con por qué encajas y qué te falta.' },
  { n: '03', Icon: MessagesSquare, title: 'Gestiona tu proceso', text: 'Candidaturas, mensajes y plazos en un solo sitio. Con menores, la familia aprueba cada contacto.' },
];

const PASSPORT_POINTS = [
  'Enlaces para compartirlo con coaches y ver quién lo abre, con privacidad por bloque',
  'Origen visible de cada dato: declarado, documentado o confirmado por el club',
  'Recruiting Readiness: qué completar primero y cuánto suma',
];

const TRUST = [
  'Perfiles de menores privados por defecto, nunca visibles para marcas ni agentes.',
  'Universidades, clubes, agencias y marcas verificadas con su dominio oficial antes de publicar o contactar.',
  'Cada oportunidad pasa controles automáticos y lleva un sello de confianza de 5 niveles con sus señales de alarma.',
  'Tus datos, tus reglas: visibilidad por bloque, descarga de datos y borrado.',
  'Normas NCAA integradas: una universidad D-I o D-II no puede escribirte antes de la fecha que marca tu curso.',
  'Colaboraciones con marcas solo para mayores de edad, con aviso NIL para atletas universitarios.',
];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre: Passport, oportunidades, candidaturas y recibir contacto. Las familias que quieren ayuda experta pueden contratar servicios de pago único; las organizaciones tienen sus propios planes.'],
  ['¿Pagar da más visibilidad?', 'No. Ningún plan compra prioridad ni "destacados". El orden depende del encaje con lo que busca cada organización.'],
  ['¿Garantizáis una beca o un contrato?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la organización y de la familia. Si hoy no hay oportunidades reales para ti, te lo decimos.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados para anónimos, marcas y agentes; contacto solo de organizaciones verificadas y con la familia en el circuito; sin publicidad perfilada.'],
];

export default function Home() {
  return (
    <div className="relative">
      <PublicHeader />

      <main id="main-content">
        {/* HERO: una promesa, selector de perfil y producto real a la vista. */}
        <section aria-label="Presentación" className="relative flex min-h-[min(88vh,820px)] items-center overflow-hidden bg-night text-white">
          <div className="absolute inset-0" aria-hidden>
            {/* Vídeo decorativo sin sonido (0,45 MB). Con "reducir movimiento" se muestra solo la imagen fija. */}
            <video className="hero-video h-full w-full object-cover" src="/media/hero-bg.mp4" poster="/media/hero-bg-poster.jpg" autoPlay muted loop playsInline preload="metadata" />
            <div className="hero-shade absolute inset-0" />
          </div>
          <HeroAudience />
        </section>

        {/* Deportes en movimiento */}
        <div className="relative overflow-hidden border-b border-line/50 bg-surface/40 py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" aria-hidden>
          <div className="marquee flex w-max gap-10 text-sm font-semibold uppercase tracking-[0.2em] text-faint">
            {[...SPORTS, ...SPORTS].map((s, i) => <span key={i} className="flex items-center gap-10">{s}<span className="text-brass/50">✦</span></span>)}
          </div>
        </div>

        {/* PRODUCTO: se ve por dentro sin registrarse. */}
        <section id="producto" aria-labelledby="producto-title" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 max-w-3xl">
              <p className="mb-3 text-sm font-semibold text-brass">El producto</p>
              <h2 id="producto-title" className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Míralo por dentro</h2>
            </Reveal>
            <Reveal><ProductTour /></Reveal>
          </div>
        </section>

        {/* CÓMO FUNCIONA: tres pasos. */}
        <section id="como-funciona" aria-labelledby="pasos-title" className="scroll-mt-20 bg-surface-2/60 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12">
              <p className="mb-3 text-sm font-semibold text-brass">Cómo funciona</p>
              <h2 id="pasos-title" className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Tres pasos</h2>
            </Reveal>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map(({ n, Icon, title, text }, i) => (
                <Reveal key={n} as="li" delay={i * 100}>
                  <div className="hover-lift flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass/10"><Icon className="h-5 w-5 text-brass" aria-hidden /></span>
                      <span className="font-display text-4xl font-bold text-brass" aria-hidden>{n}</span>
                    </div>
                    <h3 className="mt-6 text-lg font-bold text-paper">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* OPORTUNIDADES: las verticales reales de la plataforma. */}
        <section id="oportunidades" aria-labelledby="oportunidades-title" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-3 text-sm font-semibold text-brass">Oportunidades</p>
                <h2 id="oportunidades-title" className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Un perfil, cuatro caminos</h2>
              </div>
              <p className="max-w-sm text-sm text-muted">Solo publican organizaciones verificadas. Si un dato económico no está documentado, se muestra como «No indicado».</p>
            </Reveal>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VERTICALS.map((v, i) => (
                <Reveal key={v.key} as="li" delay={i * 80}>
                  <Link href={v.href} className="hover-lift group relative flex h-full min-h-[380px] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] bg-night p-6 text-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local */}
                    <img src={VERTICAL_IMG[v.key]} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.05]" />
                    <span className="tile-shade absolute inset-0" aria-hidden />
                    <span className="absolute left-5 top-5 flex gap-2">
                      <span className="rounded-md bg-night/80 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-lime backdrop-blur">{v.tag}</span>
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold backdrop-blur ${v.status === 'live' ? 'bg-white/90 text-night' : 'bg-white/15 text-white'}`}>{VERTICAL_STATUS_LABEL[v.status]}</span>
                    </span>
                    <span className="relative">
                      <span className="block font-display text-3xl font-bold uppercase leading-none">{v.name}</span>
                      <span className="mt-2 block text-sm text-lavender">{v.text}</span>
                      <span className="mt-4 flex flex-wrap gap-1.5">
                        {v.items.map((x) => <span key={x} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/90 ring-1 ring-white/15">{x}</span>)}
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Imágenes ilustrativas.</p>
          </div>
        </section>

        {/* PASSPORT + MATCH: la identidad y el encaje explicado. */}
        <section aria-labelledby="passport-title" className="relative overflow-hidden bg-night px-6 py-24 text-white">
          <div className="court-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <Reveal>
              <p className="mb-3 text-sm font-semibold text-lime">Opportunity Passport · Gala Match</p>
              <h2 id="passport-title" className="font-display text-5xl font-bold uppercase leading-[0.92] md:text-6xl">Tu identidad deportiva, con el encaje explicado</h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-lavender">Un solo perfil para universidades, clubes, agentes y marcas. Cada match dice por qué encajas, qué te falta y con qué datos se ha calculado. Sin cajas negras.</p>
              <ul className="mt-6 space-y-2.5">
                {PASSPORT_POINTS.map((t) => <li key={t} className="flex items-start gap-2.5 text-sm text-white/90"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />{t}</li>)}
              </ul>
              <Link href="/signup?role=athlete" className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-8 text-sm font-bold text-night transition-transform hover:-translate-y-0.5 focus-visible:outline-lime">Crear mi Passport <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
            </Reveal>
            <Reveal delay={120} className="mx-auto w-full max-w-md"><PassportPreview /></Reveal>
          </div>
        </section>

        {/* TEST de opciones: el gancho de captación */}
        <section id="test" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-trust/30 bg-trust/10 px-3 py-1 text-[13px] font-semibold text-ok"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Gratis · 60 segundos</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">¿Tienes opciones en EE. UU.? <span className="text-brass">Descúbrelo en 60 segundos.</span></h2>
              <p className="mt-4 max-w-md leading-relaxed text-muted">Cuatro preguntas y te decimos dónde encajarías, qué te haría subir de nivel y tu siguiente paso. Sin registrarte.</p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                {['Sin email ni datos personales', 'Basado en cómo funcionan las divisiones NCAA, NAIA y JUCO', 'Después, universidades reales para tu perfil'].map((t) => <li key={t} className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-ok" aria-hidden />{t}</li>)}
              </ul>
            </Reveal>
            <Reveal delay={120} className="min-w-0"><OptionsQuiz /></Reveal>
          </div>
        </section>

        {/* PARA QUIÉN: un mosaico de fotos, una por perfil. */}
        <section id="para-quien" className="scroll-mt-20 bg-surface-2/60 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h2 className="font-display text-5xl font-bold uppercase leading-[0.92] text-paper md:text-6xl">Una red, no seis productos</h2>
              <p className="max-w-sm text-sm text-muted">Toca un actor para ver qué aporta y a quién.</p>
            </Reveal>
            <Reveal className="mb-16"><NetworkGraph /></Reveal>
            <h3 className="mb-5 text-sm font-semibold text-brass">Elige tu espacio</h3>
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
            <h2 className="font-display text-6xl font-bold uppercase leading-[0.9] md:text-8xl">One profile. Every opportunity.</h2>
            <p className="mx-auto mt-5 max-w-md text-base text-lavender">Crea tu Passport gratis. Si hoy no hay ofertas reales que encajen contigo, te lo diremos claro y te diremos qué mejorar.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup?role=athlete" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-10 text-sm font-bold text-night transition-transform hover:-translate-y-0.5">Crear mi Passport <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
              <Link href="#test" className="inline-flex h-12 items-center rounded-xl px-8 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10">Hacer el test primero</Link>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Barra fija en móvil: la acción principal siempre a mano. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 p-3 backdrop-blur-xl md:hidden">
        <div className="flex gap-2">
          <Link href="#test" className="flex-1 rounded-xl border border-line-strong py-3 text-center text-sm text-paper">Hacer el test</Link>
          <Link href="/signup?role=athlete" className="btn-shine flex-1 rounded-xl bg-brass py-3 text-center text-sm font-bold text-ink">Crear mi Passport</Link>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'Organization', name: 'The Gala Alliance', slogan: BRAND.claim, description: BRAND.secondary },
              { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      <div className="pb-20 md:pb-0"><PublicFooter /></div>
    </div>
  );
}
