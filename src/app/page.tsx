import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BadgeCheck, HeartHandshake, Lock } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/env';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { BRAND } from '@/content/brand';
import { PLANS } from '@/content/plans';
import { CountUp, DrawLine, MotionRoot, ParallaxMedia, Rise, WordsIn } from '@/components/landing/elite/Motion';
import { BridgeMap, BridgePassport } from '@/components/landing/bridge/BridgeMap';
import { AllianceNetwork } from '@/components/landing/bridge/AllianceNetwork';
import { AgentConsole } from '@/components/landing/bridge/AgentConsole';

/*
 * Portada «La alianza» (v5, 23-nov-2026): la misión de la v1, el negro y oro de la v4 y el puente Europa → NCAA.
 * El agente es el protagonista; el atleta, el centro. Sin fotos de stock: vídeo real, ilustración propia y la fundadora.
 * Negro de estadio, marfil y oro; titulares en Anton con la palabra clave en Fraunces itálica.
 * Imagen real (vídeo nocturno de pista y fotos de la fundadora en la NCAA), rejilla rota y movimiento con intención.
 * Todo el movimiento se apaga con «reducir movimiento».
 */

const ROLES = [
  { key: 'atleta', name: 'Atleta', kicker: 'Gratis siempre', promise: 'Un Passport verificado que abre puertas a este lado del Atlántico y al otro.', cta: 'Crear mi perfil', href: '/signup?role=athlete' },
  { key: 'familia', name: 'Familia', kicker: 'Con tu firma', promise: 'El coste real de cada opción y nada sin vuestro permiso.', cta: 'Entrar como familia', href: '/signup?role=parent' },
  { key: 'club', name: 'Club', kicker: 'Clubes y academias', promise: 'Confirma los datos de tus jugadores y lleva sus pruebas.', cta: 'Registrar mi club', href: '/para/coaches' },
  { key: 'universidad', name: 'Universidad', kicker: 'Programas NCAA', promise: 'Talento europeo con datos comprobables y un agente al otro lado.', cta: 'Registrar mi universidad', href: '/para/universidades' },
];

const AGENT_POINTS = [
  { n: '01', title: '¿Para quién buscas?', text: 'Eliges al atleta y ves las becas y pruebas que encajan, por qué encajan y qué falta saber.' },
  { n: '02', title: 'Cada proceso, en 5 fases', text: 'De la introducción a la firma. Cada tarjeta dice qué toca, a quién le toca y para cuándo.' },
  { n: '03', title: 'Una bandeja con contexto', text: 'Atleta, familia y universidad en un mismo hilo, con la fase y los documentos al lado.' },
  { n: '04', title: 'Papeles sin sustos', text: 'Expediente traducido, inglés, elegibilidad y visado: qué falta y para qué proceso.' },
];

const TRUST = [
  { Icon: HeartHandshake, title: 'Menores protegidos', text: 'Perfiles privados y la familia siempre en el circuito.' },
  { Icon: BadgeCheck, title: 'Solo organizaciones verificadas', text: 'Dominio oficial comprobado antes de contactar.' },
  { Icon: Lock, title: 'Tú decides quién ve qué', text: 'Permisos con fecha de caducidad. Descarga y borrado cuando quieras.' },
];

const TICKER = ['Valencia → NCAA D-I', 'Belgrado → D-II', 'Madrid → NAIA', 'Kaunas → NCAA D-I', 'Lisboa → JUCO', 'Atenas → NCAA D-I', 'París → D-II'];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre. Las agencias tienen planes mensuales con precio fundador y las familias pueden contratar servicios de pago único. Todos los precios están publicados.'],
  ['¿Es solo para la NCAA?', 'La NCAA es nuestro foco, y también hay NAIA, JUCO, clubes y academias europeas. El mismo Passport sirve para todos.'],
  ['¿Pagar da más visibilidad?', 'No. Nadie compra prioridad: el orden depende del encaje con lo que busca cada organización.'],
  ['¿Garantizáis una beca o un contrato?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la organización y de la familia.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados, contacto solo de organizaciones verificadas, la familia siempre en el circuito y sin publicidad perfilada.'],
];

function priceNumber(name: string) {
  const p = PLANS.find((x) => x.audience === 'agent' && x.name === name)?.price ?? '';
  const n = Number.parseInt(p, 10);
  return Number.isFinite(n) ? n : null;
}

export default function Home() {
  const solo = priceNumber('Agente');
  const team = priceNumber('Agencia');
  return (
    <MotionRoot>
      <div className="relative overflow-x-clip bg-ink">
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, url: siteUrl(), description: BRAND.secondary, slogan: BRAND.claim }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: siteUrl(), inLanguage: 'es' }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }} />
        <PublicHeader overlay />

        <main id="main-content">
          {/* 1 · Portada: la misión y el puente Europa → NCAA */}
          <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
            <ParallaxMedia className="-z-10">
              <video className="hero-video h-full w-full object-cover opacity-50" autoPlay muted loop playsInline preload="metadata" poster="/media/hero-bg-poster.jpg" aria-hidden>
                <source src="/media/hero-bg.mp4" type="video/mp4" />
              </video>
            </ParallaxMedia>
            <div className="elite-hero-shade absolute inset-0 -z-10" aria-hidden />
            <div className="bg-gradient-to-r from-ink via-ink/85 to-ink/40 absolute inset-0 -z-10" aria-hidden />
            <div className="grain absolute inset-0 -z-10" aria-hidden />

            <div className="mx-auto grid min-h-[100svh] w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-32 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-20">
              <div>
                <Rise y={12}>
                  <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-brass">
                    <span className="h-px w-10 bg-brass" aria-hidden /> Europa → NCAA · Reclutamiento deportivo
                  </p>
                </Rise>
                <h1 id="hero-title" className="mt-6 text-[clamp(2.9rem,6.2vw,5.6rem)] leading-[0.9] text-paper">
                  <WordsIn parts={['Si tienes nivel, tienes que poder', { em: 'optar.' }]} />
                </h1>
                <Rise delay={0.6}>
                  <p className="mt-4 font-serif text-[clamp(1.6rem,3vw,2.4rem)] italic leading-tight text-paper/75">Tengas o no los contactos.</p>
                </Rise>
                <Rise delay={0.75}>
                  <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/80">
                    The Gala Alliance une a atletas europeos, familias, clubes y universidades de la NCAA, y le da al agente el sistema para llevar cada fichaje del primer vídeo a la firma.
                  </p>
                  <div className="mt-9 flex flex-wrap gap-3">
                    <Link href="/demo/agente" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-brass px-8 text-[15px] font-bold text-night">
                      <span className="relative z-10">Soy agente · ver la demo</span>
                      <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                    </Link>
                    <Link href="/signup?role=athlete" className="inline-flex min-h-14 items-center gap-3 rounded-full border border-paper/30 px-7 text-[15px] font-semibold text-paper backdrop-blur-sm transition-colors hover:border-brass hover:text-brass">
                      Soy atleta · gratis
                    </Link>
                  </div>
                  <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-paper/60">
                    <span>Gratis para atletas</span><span>Precios publicados</span><span>Menores protegidos por diseño</span>
                  </p>
                </Rise>
              </div>
              <Rise delay={0.5} className="relative pb-6 sm:pb-24 lg:scale-110 lg:origin-left">
                <BridgeMap />
                <BridgePassport className="relative mx-auto -mt-6 sm:absolute sm:-bottom-24 sm:left-0 sm:mt-0 lg:-left-6" />
              </Rise>
            </div>
          </section>

          {/* 2 · Cinta de rutas */}
          <div className="relative z-10 -mt-px -rotate-[1.2deg] scale-[1.03] border-y border-brass-deep/50 bg-brass py-4 text-night" aria-hidden>
            <div className="flex w-max marquee">
              {[0, 1].map((k) => (
                <ul key={k} className="flex shrink-0 items-center">
                  {TICKER.map((t) => (
                    <li key={t} className="flex items-center font-display text-2xl tracking-[0.04em] sm:text-3xl">
                      <span className="px-6">{t}</span><span className="text-night/40">✦</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>

          {/* 3 · El momento: datos de la NCAA */}
          <section aria-labelledby="momento-title" className="mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 lg:pb-28 lg:pt-36">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-end">
              <Rise>
                <p className="eyebrow text-brass">El momento es ahora</p>
                <h2 id="momento-title" className="mt-4 text-[clamp(2.8rem,7vw,6rem)] text-paper">Europa ya es la <em>cantera</em> de la NCAA.</h2>
              </Rise>
              <Rise delay={0.15}>
                <p className="max-w-lg text-lg leading-relaxed text-muted">Cada temporada llegan más europeos a las universidades de EE. UU. Lo difícil no es el talento: es que alguien lo vea, lo ordene y lo lleve hasta la firma.</p>
              </Rise>
            </div>
            <DrawLine className="mt-14" />
            <ul className="grid gap-12 pt-12 md:grid-cols-3">
              <li><Rise className="flex flex-col"><p className="mt-3 max-w-[26ch] text-sm text-muted">europeos en el baloncesto NCAA División I (2024-25)</p><p className="order-first font-display text-[clamp(5rem,10vw,8rem)] leading-none text-paper"><CountUp to={879} /></p></Rise></li>
              <li><Rise delay={0.1} className="flex flex-col"><p className="mt-3 max-w-[26ch] text-sm text-muted">más que en 2009-10, cuando eran 291</p><p className="order-first font-display text-[clamp(5rem,10vw,8rem)] leading-none text-brass">×3</p></Rise></li>
              <li><Rise delay={0.2} className="flex flex-col"><p className="mt-3 max-w-[26ch] text-sm text-muted">deportistas internacionales compiten hoy en la NCAA</p><p className="order-first font-display text-[clamp(5rem,10vw,8rem)] leading-none text-paper">25.000</p></Rise></li>
            </ul>
            <p className="mt-10 text-xs text-faint">Fuente: NCAA, «March Madness across the world» (marzo de 2025) y datos de participación internacional. La cifra de 25.000 es aproximada.</p>
          </section>

          {/* 4 · La alianza: todos conectados alrededor del atleta */}
          <section aria-labelledby="alianza-title" className="relative isolate overflow-hidden bg-night">
            <div className="court-lines absolute inset-0 -z-10 opacity-[0.05]" aria-hidden />
            <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
              <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
                <div>
                  <Rise><p className="eyebrow text-brass">La alianza</p></Rise>
                  <Rise delay={0.1}><h2 id="alianza-title" className="mt-4 text-[clamp(2.8rem,6.5vw,5.5rem)] text-paper">Todos conectados. El atleta en el <em>centro</em>.</h2></Rise>
                  <Rise delay={0.2}>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/80">Hoy cada parte trabaja por su lado: el club tiene los datos, la familia las dudas, la universidad la beca y el agente, veinte chats abiertos.</p>
                    <p className="mt-4 max-w-md text-lg leading-relaxed text-paper/80">Aquí comparten un mismo perfil verificado y un mismo proceso. Cada uno ve solo lo suyo.</p>
                  </Rise>
                </div>
                <Rise delay={0.15}><AllianceNetwork /></Rise>
              </div>
            </div>
          </section>

          {/* 5 · Para agentes: el protagonista */}
          <section id="agentes" aria-labelledby="agentes-title" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 lg:py-36">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <Rise>
                <p className="eyebrow text-brass">Para agentes y agencias</p>
                <h2 id="agentes-title" className="mt-4 max-w-[16ch] text-[clamp(3rem,7.5vw,6.5rem)] text-paper">Tu agencia, de Europa a la <em>NCAA</em>.</h2>
              </Rise>
              <Rise delay={0.15}><p className="max-w-sm text-lg text-muted">Un solo sitio para tus atletas, sus familias, las universidades y cada papel. Lo que hoy llevas en hojas de cálculo y WhatsApp.</p></Rise>
            </div>
            <Rise delay={0.1} className="mt-14"><AgentConsole /></Rise>
            <ol className="mt-16 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
              {AGENT_POINTS.map((p, i) => (
                <li key={p.n}>
                  <Rise delay={i * 0.08}>
                    <span className="block font-display text-6xl leading-none text-transparent [-webkit-text-stroke:1.2px_var(--color-brass)]" aria-hidden>{p.n}</span>
                    <h3 className="mt-4 font-display text-3xl text-paper">{p.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted">{p.text}</p>
                  </Rise>
                </li>
              ))}
            </ol>
            <div className="mt-20 grid gap-6 rounded-[22px] border border-brass/40 bg-gradient-to-br from-brass/[0.10] to-transparent p-8 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <p className="eyebrow text-brass">Precio fundador</p>
                <p className="mt-3 font-display text-4xl text-paper sm:text-5xl">30 días gratis. El precio se queda <em>contigo</em>.</p>
                <p className="mt-3 text-muted">Se mantiene mientras sigas suscrito. Para atletas, gratis siempre.</p>
              </div>
              <div className="flex flex-wrap items-end gap-8 lg:justify-end">
                {[{ name: 'Agente', price: solo }, { name: 'Agencia', price: team }].map((p) => (
                  <div key={p.name}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">{p.name}</p>
                    <p className="mt-2 font-display text-6xl leading-none text-paper">{p.price !== null ? <CountUp to={p.price} /> : '—'}<span className="ml-1 text-2xl text-brass">€</span><span className="ml-1 text-sm font-sans normal-case text-muted">/mes</span></p>
                  </div>
                ))}
                <Link href="/demo/agente" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-brass px-8 text-[15px] font-bold text-night">
                  <span className="relative z-10">Ver la demo</span><ArrowRight className="relative z-10 h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          {/* 6 · Fundadora: la esencia */}
          <section aria-labelledby="origen-title" className="relative isolate overflow-hidden bg-night">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-32">
              <Rise className="relative">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] sm:aspect-[5/4] lg:aspect-[4/5]">
                  <img src="/media/founder-entrance.webp" alt="Gala, fundadora de The Gala Alliance, saltando a la pista en un partido de la NCAA" loading="lazy" className="h-full w-full object-cover object-[30%_center]" />
                  <span className="absolute inset-0 bg-gradient-to-t from-night via-transparent to-transparent" aria-hidden />
                  <span className="grain absolute inset-0" aria-hidden />
                </div>
                <p className="absolute -bottom-6 -right-2 font-display text-[clamp(5rem,14vw,11rem)] leading-none text-transparent [-webkit-text-stroke:1px_rgb(230_207_143/0.55)] sm:-right-8" aria-hidden>D1</p>
              </Rise>
              <div>
                <Rise><p className="eyebrow text-brass">Por qué existe</p></Rise>
                <Rise delay={0.1}>
                  <h2 id="origen-title" className="mt-5 text-[clamp(2.8rem,6.5vw,5.5rem)] text-paper">
                    Yo hice este <em>camino</em>. Sola.
                  </h2>
                </Rise>
                <Rise delay={0.2}>
                  <p className="mt-8 max-w-lg text-lg leading-relaxed text-paper/80">
                    Salí de España para jugar al baloncesto en la NCAA División I con beca completa. Sé lo que cuesta que alguien te vea desde el otro lado del Atlántico, lo que pesan los papeles y lo sola que se siente una familia en el proceso.
                  </p>
                  <p className="mt-4 max-w-lg text-lg leading-relaxed text-paper/80">
                    The Gala Alliance es lo que me habría gustado tener: una alianza honesta entre todos los que ayudan a un atleta a llegar.
                  </p>
                </Rise>
                <Rise delay={0.3}>
                  <p className="mt-10 font-serif text-3xl italic text-brass">— Gala</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.28em] text-muted">Fundadora · ex jugadora NCAA D-I</p>
                </Rise>
              </div>
            </div>
          </section>

          {/* 7 · El resto de la alianza */}
          <section id="para-quien" aria-labelledby="quien-title" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
            <Rise>
              <p className="eyebrow text-brass">Para toda la alianza</p>
              <h2 id="quien-title" className="mt-4 text-[clamp(2.8rem,6.5vw,5.5rem)] text-paper">Cada uno, en su <em>sitio</em>.</h2>
            </Rise>
            <ul className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((r, i) => (
                <li key={r.key} className="bg-ink">
                  <Link href={r.href} className="group flex h-full min-h-[280px] flex-col p-7 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass">
                    <span className="font-display text-sm text-brass">{String(i + 1).padStart(2, '0')}</span>
                    <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">{r.kicker}</p>
                    <h3 className="mt-2 font-display text-5xl text-paper">{r.name}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-paper/75">{r.promise}</p>
                    <span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-6 text-sm font-bold text-paper transition-colors group-hover:text-brass">
                      {r.cta} <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">¿Eres una marca? <Link href="/para/marcas" className="font-semibold text-paper underline decoration-brass underline-offset-4">Colaboraciones con atletas mayores de edad</Link>.</p>
          </section>

          {/* 8 · Confianza */}
          <section aria-labelledby="confianza-title" className="diagonal-top relative bg-surface">
            <div className="mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 lg:pb-24 lg:pt-32">
              <h2 id="confianza-title" className="sr-only">Seguridad y confianza</h2>
              <ul className="grid gap-10 md:grid-cols-3">
                {TRUST.map(({ Icon, title, text }, i) => (
                  <li key={title}>
                    <Rise delay={i * 0.1} className="flex items-start gap-5">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-brass/40 text-brass"><Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /></span>
                      <div>
                        <p className="font-display text-2xl text-paper">{title}</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                      </div>
                    </Rise>
                  </li>
                ))}
              </ul>
              <Link href="/seguridad" className="mt-12 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brass hover:underline hover:underline-offset-4">
                Cómo protegemos a menores y datos <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          {/* 9 · Preguntas frecuentes */}
          <section aria-labelledby="faq-title" className="border-t border-line">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-28">
              <h2 id="faq-title" className="text-5xl text-paper sm:text-6xl">Preguntas <em>claras</em></h2>
              <div className="divide-y divide-line border-y border-line">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group py-6">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-paper">
                      {q}<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong text-brass transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="mt-3 max-w-2xl leading-relaxed text-muted">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* 10 · Cierre */}
          <section aria-labelledby="cierre-title" className="relative isolate overflow-hidden bg-night">
            <div className="court-lines absolute inset-0 -z-10 opacity-[0.06]" aria-hidden />
            <div className="grain absolute inset-0 -z-10" aria-hidden />
            <div className="mx-auto max-w-7xl px-5 py-32 text-center sm:px-8 lg:py-44">
              <Rise>
                <h2 id="cierre-title" className="mx-auto max-w-[15ch] text-[clamp(3.2rem,9vw,8rem)] leading-[0.9] text-paper">El talento ya está en Europa. Que lo <em>vean</em>.</h2>
              </Rise>
              <Rise delay={0.2}>
                <div className="mt-12 flex flex-wrap justify-center gap-3">
                  <Link href="/demo/agente" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-brass px-9 text-[15px] font-bold text-night">
                    <span className="relative z-10">Soy agente · ver la demo</span><ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link href="/signup?role=athlete" className="inline-flex min-h-14 items-center rounded-full border border-paper/30 px-8 text-[15px] font-semibold text-paper transition-colors hover:border-brass hover:text-brass">Soy atleta · gratis</Link>
                </div>
              </Rise>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </MotionRoot>
  );
}
