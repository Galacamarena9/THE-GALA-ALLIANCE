import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/env';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BookOpen, Calculator, ChevronDown, Eye, FileLock2, IdCard, Lock, MessagesSquare, Scale, ShieldCheck, Sparkles, Target, UserCheck,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { Reveal } from '@/components/Reveal';
import { GalaPassport, PROVENANCE, type Provenance } from '@/components/landing/GalaPassport';
import { LiveMatch } from '@/components/landing/LiveMatch';
import { NetworkGraph } from '@/components/landing/NetworkGraph';
import { OptionsQuiz } from '@/components/landing/OptionsQuiz';
import { ProductTour } from '@/components/landing/ProductTour';
import { ACTORS } from '@/lib/domain/roles';
import { MATCH_AREA_LABEL } from '@/lib/domain/match';
import { BRAND, VERTICALS, VERTICAL_STATUS_LABEL } from '@/content/brand';

/*
 * Home "Carbon" (rediseño completo, noviembre 2026).
 * Jerarquía: HERO → LA RED → PASSPORT → OPORTUNIDADES → GALA MATCH / IA → CÓMO FUNCIONA → SEIS ACTORES → CONFIANZA → FUNDADORA → CTA.
 * Ritmo carbón / blanco; un solo color de marca (Gala Volt) para las acciones.
 */

const ROLE_TITLE: Record<string, string> = { athlete: 'Atletas', parent: 'Familias', university: 'Universidades', coach: 'Clubes y coaches', agent: 'Agentes', brand: 'Marcas' };
const ROLE_IMG: Record<string, string> = { athlete: '/media/hero-athletes-sm.webp', parent: '/media/university-campus-sm.webp', university: '/media/arena-bg.webp', coach: '/media/club-training-sm.webp', agent: '/media/agent-workspace-sm.webp', brand: '/media/hero-bg-poster.jpg' };
const VERTICAL_IMG: Record<string, string> = { college: '/media/university-campus.webp', clubs: '/media/club-training.webp', brands: '/media/hero-bg-poster.jpg', events: '/media/arena-bg.webp' };

/** Cifras de producto (hechos del producto, no métricas de uso). */
const FACTS = [
  { n: '4', l: 'caminos: universidad, clubes, marcas y eventos' },
  { n: '6', l: 'actores conectados en una red' },
  { n: '3', l: 'niveles de procedencia en cada dato' },
  { n: '0 €', l: 'para atletas. Siempre.' },
];

const SPORTS = ['Baloncesto', 'Tenis', 'Fútbol', 'Atletismo', 'Natación', 'Voleibol', 'Golf', 'Remo', 'Pádel', 'Waterpolo'];

const STEPS = [
  { n: '01', Icon: IdCard, title: 'Crea tu Passport', text: 'Vídeo, estadísticas, notas e idiomas. Gratis.' },
  { n: '02', Icon: Target, title: 'Recibe matches explicados', text: 'Por qué encajas y qué te falta, con organizaciones verificadas.' },
  { n: '03', Icon: MessagesSquare, title: 'Gestiona tu proceso', text: 'Candidaturas, mensajes y plazos. Con menores, la familia aprueba.' },
];

const TOOLS = [
  { Icon: Sparkles, name: 'Test de opciones', href: '#test' },
  { Icon: Calculator, name: 'Coste real', href: '/calculadora' },
  { Icon: BookOpen, name: 'Guía del proceso', href: '/guia' },
];

const TRUST = [
  { Icon: Lock, title: 'Menores, privados', text: 'Nunca visibles para anónimos, marcas ni agentes. La familia aprueba cada contacto.' },
  { Icon: UserCheck, title: 'Organizaciones verificadas', text: 'Con su dominio oficial antes de publicar o contactar.' },
  { Icon: ShieldCheck, title: 'Sello de confianza', text: 'Cada oportunidad, con 5 niveles de verificación y señales de alarma.' },
  { Icon: Eye, title: 'Tú decides quién ve qué', text: 'Visibilidad por bloque, descarga de datos y borrado.' },
  { Icon: Scale, title: 'Normas NCAA integradas', text: 'Ninguna universidad D-I o D-II te escribe antes de la fecha permitida.' },
  { Icon: FileLock2, title: 'Sin ranking de pago', text: 'Nadie compra prioridad. El orden depende del encaje.' },
];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre: Passport, oportunidades, candidaturas y recibir contacto. Las familias que quieren ayuda experta pueden contratar servicios de pago único; las organizaciones tienen sus propios planes.'],
  ['¿Pagar da más visibilidad?', 'No. Ningún plan compra prioridad ni "destacados". El orden depende del encaje con lo que busca cada organización.'],
  ['¿Garantizáis una beca o un contrato?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la organización y de la familia. Si hoy no hay oportunidades reales para ti, te lo decimos.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados para anónimos, marcas y agentes; contacto solo de organizaciones verificadas y con la familia en el circuito; sin publicidad perfilada.'],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-5 flex items-center gap-3 text-brass"><span className="h-px w-8 bg-current" aria-hidden />{children}</p>;
}

export default function Home() {
  return (
    <div className="carbon relative">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, url: siteUrl(), description: BRAND.secondary, slogan: BRAND.claim }} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: siteUrl(), inLanguage: 'es' }} />
      <PublicHeader />

      <main id="main-content">
        {/* 1 · HERO */}
        <section aria-labelledby="hero-title" className="relative flex min-h-[100svh] flex-col overflow-hidden">
          <div className="absolute inset-0" aria-hidden>
            <video className="hero-video h-full w-full object-cover opacity-60" src="/media/hero-bg.mp4" poster="/media/hero-bg-poster.jpg" autoPlay muted loop playsInline preload="metadata" />
            <div className="hero-carbon absolute inset-0" />
          </div>

          <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-5 pb-10 pt-32 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:pt-28">
            <div className="rise-in">
              <p className="eyebrow mb-7 flex items-center gap-2.5 text-white/75"><span className="live-dot" aria-hidden />{BRAND.network}</p>
              <h1 id="hero-title" className="display-xl text-white">
                Un perfil.<br /><span className="text-lime">Todas tus</span><br /><span className="text-lime">oportunidades.</span>
              </h1>
              <p className="mt-7 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">Universidad, clubes, marcas y eventos. Con un Passport verificable y el encaje explicado.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup?role=athlete" className="btn-shine group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-lime px-8 text-[15px] font-bold text-[#0a0a0c] transition-transform hover:-translate-y-0.5">
                  Crear mi Passport <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link href="/oportunidades" className="inline-flex h-14 items-center justify-center gap-2 rounded-full px-8 text-[15px] font-semibold text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/10">
                  Explorar oportunidades
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[430px] rise-in rise-in-2">
              <GalaPassport className="passport-tilt" caption={false} />
              <div className="glass float-slow absolute -left-20 -top-6 hidden items-center gap-2.5 rounded-2xl px-4 py-3 text-xs xl:flex" aria-hidden>
                <span className="font-display text-2xl font-bold text-lime">92%</span><span className="leading-tight text-white/80">Match<br />State University</span>
              </div>
              <div className="glass float-slow absolute -right-10 -bottom-2 hidden items-center gap-2 rounded-2xl px-4 py-3 text-xs text-white/85 [animation-delay:1.5s] xl:flex" aria-hidden>
                <span className="prov prov-club text-lime" />Puntos confirmados por el club
              </div>
              <p className="mt-4 text-center text-[11px] text-white/60">Ejemplo ilustrativo · atleta ficticia</p>
            </div>
          </div>

          {/* Cifras de producto como elemento gráfico */}
          <div className="relative border-t hairline bg-black/30 backdrop-blur-md">
            <dl className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
              {FACTS.map((f, i) => (
                <div key={f.n} className={`flex items-baseline gap-3 border-white/10 py-5 ${i % 2 ? 'border-l pl-5' : ''} ${i === 2 ? 'lg:border-l lg:pl-5' : ''} ${i === 0 ? '' : 'lg:pl-6'}`}>
                  <dt className="sr-only">{f.l}</dt>
                  <dd className="whitespace-nowrap font-display text-4xl font-bold leading-none text-white md:text-5xl" aria-hidden>{f.n}</dd>
                  <dd className="text-xs leading-snug text-white/70">{f.l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2 · LA RED */}
        <section id="para-quien" aria-labelledby="red-title" className="scroll-mt-16 px-5 py-28 sm:px-8 md:py-40">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-16 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div>
                <Eyebrow>The Sports Opportunity Network</Eyebrow>
                <h2 id="red-title" className="display-lg">Una red.<br /><span className="text-faint">Seis actores.</span></h2>
              </div>
              <p className="max-w-sm text-base text-muted lg:justify-self-end">Atleta, familia, universidad, club, agente y marca, conectados por datos verificados. Toca un actor.</p>
            </Reveal>
            <Reveal><NetworkGraph /></Reveal>
          </div>
        </section>

        {/* 3 · OPPORTUNITY PASSPORT */}
        <section aria-labelledby="passport-title" className="relative overflow-hidden border-y hairline bg-[#060607] px-5 py-28 sm:px-8 md:py-40">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full glow-trust opacity-40" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
            <Reveal variant="scale" className="order-2 mx-auto w-full max-w-[440px] lg:order-1">
              <GalaPassport />
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <Eyebrow>{BRAND.passport}</Eyebrow>
              <h2 id="passport-title" className="display-lg">Tu carrera,<br />en una tarjeta.</h2>
              <p className="mt-6 max-w-md text-lg text-muted">Cada dato lleva su origen. Así una universidad sabe en qué confiar al primer vistazo.</p>
              <ul className="mt-10 divide-y divide-line border-y border-line">
                {(['club', 'doc', 'self'] as Provenance[]).map((k) => (
                  <li key={k} className="flex items-center justify-between gap-4 py-4">
                    <span className="flex items-center gap-3 text-base font-semibold text-paper"><span className={`prov h-3.5 w-3.5 ${PROVENANCE[k].cls}`} aria-hidden />{PROVENANCE[k].label}</span>
                    <span className="text-right text-sm text-faint">{k === 'club' ? 'Lo confirma tu club' : k === 'doc' ? 'Con documento adjunto' : 'Lo indicas tú'}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup?role=athlete" className="group mt-10 inline-flex h-14 items-center gap-2 rounded-full bg-lime px-8 text-[15px] font-bold text-[#0a0a0c] transition-transform hover:-translate-y-0.5">
                Crear mi Passport gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* 4 · OPORTUNIDADES */}
        <section id="oportunidades" aria-labelledby="oportunidades-title" className="scroll-mt-16 py-28 md:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <Eyebrow>Oportunidades reales</Eyebrow>
                <h2 id="oportunidades-title" className="display-lg">Cuatro<br />caminos.</h2>
              </div>
              <Link href="/oportunidades" className="group inline-flex items-center gap-2 text-sm font-semibold text-paper hover:text-brass">Ver el marketplace <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden /></Link>
            </Reveal>
          </div>
          <ul className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:px-8 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 [scrollbar-width:none]">
            {VERTICALS.map((v, i) => (
              <Reveal key={v.key} as="li" delay={i * 80} className="w-[78vw] max-w-[340px] shrink-0 snap-start lg:w-auto lg:max-w-none">
                <Link href={v.href} className="group relative flex aspect-[3/4.2] flex-col justify-end overflow-hidden rounded-[24px] bg-surface p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local */}
                  <img src={VERTICAL_IMG[v.key]} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-700 group-hover:scale-[1.06]" />
                  <span className="tile-carbon absolute inset-0" aria-hidden />
                  <span className="absolute left-5 right-5 top-5 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-white/70">0{i + 1}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${v.status === 'live' ? 'bg-lime text-[#0a0a0c]' : 'bg-white/15 text-white'}`}>{VERTICAL_STATUS_LABEL[v.status]}</span>
                  </span>
                  <span className="relative">
                    <span className="block font-display text-4xl font-bold uppercase leading-[0.9] text-white">{v.name}</span>
                    <span className="mt-3 block text-sm text-white/75">{v.text}</span>
                    <span className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors group-hover:bg-lime group-hover:text-[#0a0a0c]"><ArrowRight className="h-4 w-4" aria-hidden /></span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
          <p className="mx-auto mt-4 max-w-7xl px-5 text-xs text-faint sm:px-8">Solo publican organizaciones verificadas. Imágenes ilustrativas.</p>
        </section>

        {/* 5 · GALA MATCH / IA */}
        <section aria-labelledby="match-title" className="border-t hairline px-5 py-28 sm:px-8 md:py-40">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
              <Reveal>
                <Eyebrow>Gala Match</Eyebrow>
                <h2 id="match-title" className="display-lg">El encaje,<br /><span className="text-brass">explicado.</span></h2>
                <p className="mt-6 max-w-md text-lg text-muted">Sin cajas negras: por qué encajas, qué te falta y con cuántos datos se ha calculado.</p>
                <ul className="mt-8 flex flex-wrap gap-2">
                  {Object.values(MATCH_AREA_LABEL).map((a) => <li key={a} className="rounded-full border border-line-strong px-4 py-2 text-sm text-paper">{a}</li>)}
                </ul>
              </Reveal>
              <Reveal delay={120} className="min-w-0"><LiveMatch /></Reveal>
            </div>

            {/* La plataforma por dentro */}
            <Reveal className="mt-24">
              <p className="eyebrow mb-6 text-faint">La plataforma por dentro</p>
              <ProductTour />
            </Reveal>
          </div>
        </section>

        {/* 6 · CÓMO FUNCIONA (blanco) */}
        <section id="como-funciona" aria-labelledby="pasos-title" className="light-scope scroll-mt-16 px-5 py-28 sm:px-8 md:py-40">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-16">
              <Eyebrow>Cómo funciona</Eyebrow>
              <h2 id="pasos-title" className="display-lg">Tres pasos.</h2>
            </Reveal>
            <ol className="grid border-t border-paper md:grid-cols-3">
              {STEPS.map(({ n, Icon, title, text }, i) => (
                <Reveal key={n} as="li" delay={i * 100} className={`py-8 md:px-8 md:py-10 ${i > 0 ? 'border-t border-line md:border-l md:border-t-0' : 'md:pl-0'}`}>
                  <span className="font-display text-7xl font-bold leading-none text-paper md:text-8xl" aria-hidden>{n}</span>
                  <h3 className="mt-6 flex items-center gap-2 text-xl font-bold text-paper"><Icon className="h-5 w-5 text-brass" aria-hidden />{title}</h3>
                  <p className="mt-2 max-w-xs text-muted">{text}</p>
                </Reveal>
              ))}
            </ol>

            {/* Prueba sin registro */}
            <div id="test" className="mt-20 grid scroll-mt-24 items-center gap-12 rounded-[28px] bg-[#0a0a0c] p-6 text-white sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:p-14">
              <div className="carbon bg-transparent">
                <p className="eyebrow mb-4 text-lime">Gratis · sin registro · 60 s</p>
                <h3 className="font-display text-5xl font-bold uppercase leading-[0.9] text-white md:text-6xl">¿Tienes opciones en EE. UU.?</h3>
                <p className="mt-4 max-w-sm text-white/70">Cuatro preguntas: dónde encajarías y tu siguiente paso.</p>
                <ul className="mt-8 flex flex-wrap gap-2">
                  {TOOLS.map(({ Icon, name, href }) => (
                    <li key={name}><Link href={href} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white transition-colors hover:border-lime hover:text-lime"><Icon className="h-4 w-4" aria-hidden />{name}</Link></li>
                  ))}
                  <li><Link href="/herramientas" className="inline-flex items-center gap-1 px-2 py-2 text-sm text-white/70 underline-offset-4 hover:underline">Todas <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link></li>
                </ul>
              </div>
              <div className="carbon min-w-0 bg-transparent"><OptionsQuiz /></div>
            </div>
          </div>
        </section>

        {/* 7 · SEIS ACTORES */}
        <section aria-labelledby="actores-title" className="px-5 py-28 sm:px-8 md:py-40">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-14">
              <Eyebrow>Para cada actor</Eyebrow>
              <h2 id="actores-title" className="display-lg">Elige tu<br />espacio.</h2>
            </Reveal>
            <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
              {ACTORS.map((a, i) => (
                <Reveal key={a.role} as="li" delay={(i % 3) * 80} className={i === 0 ? 'col-span-2 lg:col-span-1 lg:row-span-2' : i === ACTORS.length - 1 ? 'col-span-2 lg:col-span-3' : ''}>
                  <Link href={`/para/${a.slug}`} className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-[24px] bg-surface p-5 md:p-6 ${i === 0 ? 'min-h-[320px] lg:min-h-full' : 'min-h-[200px] md:min-h-[260px]'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local */}
                    <img src={ROLE_IMG[a.role] ?? '/media/arena-bg-sm.webp'} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.06]" />
                    <span className="tile-carbon absolute inset-0" aria-hidden />
                    <span className="relative">
                      <span className="flex items-end justify-between gap-3">
                        <span className="font-display text-2xl font-bold uppercase leading-none text-white sm:text-3xl md:text-4xl [overflow-wrap:anywhere]">{ROLE_TITLE[a.role] ?? a.plural}</span>
                        <ArrowUpRight className="h-5 w-5 shrink-0 text-white/70 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime" aria-hidden />
                      </span>
                      <span className="mt-2 hidden text-sm text-white/75 sm:block">{a.promise}</span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* 8 · CONFIANZA (blanco) */}
        <section aria-labelledby="confianza-title" className="light-scope px-5 py-28 sm:px-8 md:py-40">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <Eyebrow>Trust &amp; Safety</Eyebrow>
                <h2 id="confianza-title" className="display-lg">Seguro<br />por diseño.</h2>
              </div>
              <Link href="/seguridad" className="group inline-flex items-center gap-2 text-sm font-semibold text-paper hover:text-brass">Nuestros compromisos <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
            </Reveal>
            <ul className="grid gap-px overflow-hidden rounded-[24px] bg-line sm:grid-cols-2 lg:grid-cols-3">
              {TRUST.map(({ Icon, title, text }, i) => (
                <Reveal key={title} as="li" delay={(i % 3) * 70} className="bg-surface p-7 md:p-9">
                  <Icon className="h-6 w-6 text-brass" aria-hidden />
                  <h3 className="mt-6 text-lg font-bold text-paper">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* 9 · FUNDADORA */}
        <section aria-labelledby="fundadora-title" className="relative overflow-hidden px-5 py-28 sm:px-8 md:py-40">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
            <Reveal className="relative mx-auto w-full max-w-md lg:max-w-none">
              <figure className="overflow-hidden rounded-[28px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto local optimizada */}
                <img src="/media/founder-portrait.webp" srcSet="/media/founder-portrait-sm.webp 720w, /media/founder-portrait.webp 1300w" sizes="(min-width: 1024px) 560px, 100vw" alt="Gala, fundadora de The Gala Alliance, concentrada en la pista antes de un tiro libre" loading="lazy" className="aspect-[4/5] w-full object-cover object-top grayscale-[35%]" />
              </figure>
              <span className="absolute -right-3 top-6 rotate-3 rounded-full bg-lime px-4 py-2 font-display text-base font-bold uppercase text-[#0a0a0c]">NCAA D-I</span>
            </Reveal>
            <Reveal delay={100}>
              <Eyebrow>Quién está detrás</Eyebrow>
              <h2 id="fundadora-title" className="display-lg">Creada por<br />una exjugadora<br /><span className="text-brass">NCAA D-I.</span></h2>
              <blockquote className="mt-8 max-w-lg border-l-2 border-brass pl-6 text-xl leading-relaxed text-paper">
                «Jugué con beca completa en Estados Unidos. Sé lo difícil que es llegar sin contactos. Esto existe para que dependa de tu nivel, no de a quién conoces.»
              </blockquote>
              <p className="mt-4 pl-6 text-sm text-faint">Gala · fundadora</p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center rounded-full bg-lime px-7 text-sm font-bold text-[#0a0a0c] transition-transform hover:-translate-y-0.5">Crear mi perfil gratis</Link>
                <Link href="/precios" className="inline-flex h-12 items-center rounded-full px-7 text-sm font-semibold text-paper ring-1 ring-line-strong transition-colors hover:bg-surface">Trabajar con Gala</Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Preguntas frecuentes (compactas) */}
        <section aria-labelledby="faq-title" className="border-t hairline px-5 py-24 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <h2 id="faq-title" className="font-display text-4xl font-bold uppercase leading-none text-paper md:text-5xl">Preguntas</h2>
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-lg font-semibold text-paper [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-faint transition-transform duration-300 group-open:rotate-180 group-open:text-brass" aria-hidden />
                  </summary>
                  <p className="pb-6 pr-8 leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 10 · CTA FINAL */}
        <section aria-labelledby="cta-title" className="relative overflow-hidden bg-lime px-5 py-28 text-[#0a0a0c] sm:px-8 md:py-40">
          <div className="relative mx-auto max-w-7xl">
            <h2 id="cta-title" className="display-xl">One profile.<br />Every<br />opportunity.</h2>
            <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <p className="max-w-md text-lg">Si hoy no hay oportunidades reales para ti, te lo diremos claro y te diremos qué mejorar.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/signup?role=athlete" className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#0a0a0c] px-9 text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-[#0a0a0c]">
                  Crear mi Passport <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link href="/oportunidades" className="inline-flex h-14 items-center justify-center rounded-full px-8 text-[15px] font-semibold ring-1 ring-[#0a0a0c]/40 transition-colors hover:bg-[#0a0a0c]/10 focus-visible:outline-[#0a0a0c]">Explorar oportunidades</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Cinta de deportes */}
        <div className="overflow-hidden border-b hairline py-5" aria-hidden>
          <div className="ticker flex w-max gap-12 font-display text-2xl font-bold uppercase text-faint">
            {[...SPORTS, ...SPORTS].map((s, i) => <span key={i} className="flex items-center gap-12">{s}<span className="text-brass">/</span></span>)}
          </div>
        </div>
      </main>

      {/* Barra fija en móvil */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 p-3 backdrop-blur-xl md:hidden">
        <div className="flex gap-2">
          <Link href="/oportunidades" className="flex-1 rounded-full border border-line-strong py-3 text-center text-sm text-paper">Oportunidades</Link>
          <Link href="/signup?role=athlete" className="flex-1 rounded-full bg-lime py-3 text-center text-sm font-bold text-[#0a0a0c]">Crear mi Passport</Link>
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
