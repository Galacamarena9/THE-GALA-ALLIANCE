import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, BadgeCheck, HeartHandshake, Lock, Play } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/env';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { BRAND } from '@/content/brand';
import { PLANS } from '@/content/plans';
import { CountUp, DrawLine, MotionRoot, ParallaxMedia, Rise, Tilt, WordsIn } from '@/components/landing/elite/Motion';

/*
 * Portada «Élite deportiva» (identidad v4, 22-nov-2026).
 * Negro de estadio, marfil y oro; titulares en Anton con la palabra clave en Fraunces itálica.
 * Imagen real (vídeo nocturno de pista y fotos de la fundadora en la NCAA), rejilla rota y movimiento con intención.
 * Todo el movimiento se apaga con «reducir movimiento».
 */

const ROLES = [
  { key: 'agente', name: 'Agente', kicker: 'Para agencias', promise: 'Todos tus atletas, procesos y familias en un solo sitio.', cta: 'Ver la demo', href: '/demo/agente', img: '/media/agent-workspace.webp' },
  { key: 'atleta', name: 'Atleta', kicker: 'Gratis siempre', promise: 'Un perfil verificado que abre puertas.', cta: 'Crear mi perfil', href: '/signup?role=athlete', img: '/media/founder-portrait.webp' },
  { key: 'familia', name: 'Familia', kicker: 'Con tu permiso', promise: 'El coste real de cada opción. Nada sin tu firma.', cta: 'Entrar como familia', href: '/signup?role=parent', img: '/media/hero-athletes.webp' },
  { key: 'club', name: 'Club', kicker: 'Clubes y academias', promise: 'Pruebas llenas de jugadores que sí quieren venir.', cta: 'Registrar mi club', href: '/para/coaches', img: '/media/club-training.webp' },
  { key: 'universidad', name: 'Universidad', kicker: 'NCAA y Europa', promise: 'Talento internacional con datos comprobables.', cta: 'Registrar mi universidad', href: '/para/universidades', img: '/media/university-campus.webp' },
];

const STEPS = [
  { n: '01', title: 'Perfil verificado', text: 'El atleta lo crea una vez. Cada dato dice de dónde sale: verificado por el club, documentado o declarado.' },
  { n: '02', title: 'Oportunidades con sentido', text: 'Becas, pruebas y fichajes que encajan de verdad, con el porqué explicado. Nadie compra visibilidad.' },
  { n: '03', title: 'Hasta la firma', text: 'Mensajes, documentos, pruebas y ofertas en un mismo hilo. Cada parte ve solo lo suyo.' },
];

const TRUST = [
  { Icon: HeartHandshake, title: 'Menores protegidos', text: 'Perfiles privados y la familia siempre en el circuito.' },
  { Icon: BadgeCheck, title: 'Solo organizaciones verificadas', text: 'Dominio oficial comprobado antes de contactar.' },
  { Icon: Lock, title: 'Tú decides quién ve qué', text: 'Permisos con fecha de caducidad. Descarga y borrado cuando quieras.' },
];

const TICKER = ['Baloncesto', 'Fútbol', 'Atletismo', 'Tenis', 'Voleibol', 'Natación', 'Becas NCAA', 'Fichajes', 'Pruebas'];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre. Las agencias tienen planes mensuales con precio fundador y las familias pueden contratar servicios de pago único. Todos los precios están publicados.'],
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
          {/* 1 · Portada: vídeo real, titular de campaña */}
          <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden">
            <ParallaxMedia className="-z-10">
              <video className="hero-video h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/media/hero-bg-poster.jpg" aria-hidden>
                <source src="/media/hero-bg.mp4" type="video/mp4" />
              </video>
            </ParallaxMedia>
            <div className="elite-hero-shade absolute inset-0 -z-10" aria-hidden />
            <div className="grain absolute inset-0 -z-10" aria-hidden />

            <div className="mx-auto w-full max-w-7xl px-5 pb-14 pt-32 sm:px-8 lg:pb-20">
              <Rise y={12}>
                <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-brass">
                  <span className="h-px w-10 bg-brass" aria-hidden /> Reclutamiento deportivo · España → el mundo
                </p>
              </Rise>
              <h1 id="hero-title" className="mt-6 max-w-[13ch] text-[clamp(3.4rem,10vw,9rem)] leading-[0.88] text-paper">
                <WordsIn parts={['El talento no se encuentra. Se', { em: 'representa.' }]} />
              </h1>
              <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <Rise delay={0.7}>
                  <p className="max-w-xl text-lg leading-relaxed text-paper/80 sm:text-xl">
                    La plataforma con la que agencias, familias y clubes llevan el camino de cada atleta: del primer vídeo a la firma.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a href="#para-quien" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-brass px-8 text-[15px] font-bold text-night">
                      <span className="relative z-10">Empezar gratis</span>
                      <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                    </a>
                    <Link href="/demo/agente" className="group inline-flex min-h-14 items-center gap-3 rounded-full border border-paper/30 px-7 text-[15px] font-semibold text-paper backdrop-blur-sm transition-colors hover:border-brass hover:text-brass">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-paper/10 transition-colors group-hover:bg-brass group-hover:text-night"><Play className="h-3 w-3 fill-current" aria-hidden /></span>
                      Ver la demo
                    </Link>
                  </div>
                </Rise>
                <Rise delay={0.9} className="hidden lg:block">
                  <dl className="grid grid-cols-3 gap-8 border-l border-paper/20 pl-8 text-paper">
                    <Stat value={<CountUp to={5} />} label="perfiles, una red" />
                    <Stat value={<CountUp to={30} />} label="días gratis" />
                    <Stat value={<>0 €</>} label="para atletas" />
                  </dl>
                </Rise>
              </div>
            </div>
          </section>

          {/* 2 · Cinta de deportes */}
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

          {/* 3 · ¿Quién eres? */}
          <section id="para-quien" aria-labelledby="quien-title" className="mx-auto max-w-7xl scroll-mt-20 px-5 pb-24 pt-28 sm:px-8 lg:pb-32 lg:pt-36">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Rise>
                <p className="eyebrow text-brass">Elige tu papel</p>
                <h2 id="quien-title" className="mt-4 text-[clamp(3rem,8vw,6.5rem)] text-paper">¿Quién <em>eres</em>?</h2>
              </Rise>
              <Rise delay={0.15}><p className="max-w-sm text-muted">Cinco papeles, una misma red. Cada uno ve lo que necesita y nada más.</p></Rise>
            </div>

            <ul className="mt-14 grid gap-4 md:grid-cols-6 lg:grid-rows-[300px_300px]">
              {ROLES.map((r, i) => (
                <li key={r.key} className={i === 0 ? 'md:col-span-6 lg:col-span-3 lg:row-span-2' : 'md:col-span-3 lg:col-span-3 xl:col-span-3'}>
                  <Rise delay={i * 0.06} className="h-full">
                    <Tilt className="h-full">
                      <Link href={r.href} className={`role-card group relative flex h-full flex-col justify-end overflow-hidden rounded-[22px] border border-line ${i === 0 ? 'min-h-[440px]' : 'min-h-[300px]'}`}>
                        <img src={r.img} srcSet={`${r.img.replace('.webp', '-sm.webp')} 720w, ${r.img} 1600w`} sizes="(min-width: 1024px) 40vw, 100vw" alt="" aria-hidden loading="lazy" decoding="async" className="photo-grade absolute inset-0 -z-0 h-full w-full object-cover opacity-75 grayscale-[35%] transition-all duration-700 group-hover:scale-105 group-hover:opacity-90 group-hover:grayscale-0" />
                        <span className="tile-elite absolute inset-0" aria-hidden />
                        <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-brass transition-transform duration-500 group-hover:scale-x-100" aria-hidden />
                        <div className="relative p-6 sm:p-8">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass">{r.kicker}</p>
                          <h3 className={`mt-2 font-display text-paper ${i === 0 ? 'text-6xl sm:text-7xl' : 'text-5xl'}`}>{r.name}</h3>
                          <p className={`mt-3 max-w-sm text-paper/80 ${i === 0 ? 'text-lg' : 'text-sm'}`}>{r.promise}</p>
                          <span className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-paper transition-colors group-hover:text-brass">
                            {r.cta} <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                          </span>
                        </div>
                      </Link>
                    </Tilt>
                  </Rise>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">¿Eres una marca? <Link href="/para/marcas" className="font-semibold text-paper underline decoration-brass underline-offset-4">Colaboraciones con atletas mayores de edad</Link>.</p>
          </section>

          {/* 4 · Fundadora: la esencia */}
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
                    Hecha por alguien que ya <em>recorrió</em> el camino.
                  </h2>
                </Rise>
                <Rise delay={0.2}>
                  <p className="mt-8 max-w-lg text-lg leading-relaxed text-paper/80">
                    Gala jugó al baloncesto en la NCAA División I con beca completa. Sabe lo que cuesta que alguien te vea, lo que pesan los papeles y lo sola que se siente una familia en el proceso.
                  </p>
                  <p className="mt-4 max-w-lg text-lg leading-relaxed text-paper/80">
                    The Gala Alliance es la herramienta que le habría gustado tener: honesta, ordenada y del lado del atleta.
                  </p>
                </Rise>
                <Rise delay={0.3}>
                  <p className="mt-10 font-serif text-3xl italic text-brass">— Gala</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.28em] text-muted">Fundadora · ex jugadora NCAA D-I</p>
                </Rise>
              </div>
            </div>
          </section>

          {/* 5 · Cómo funciona */}
          <section id="como-funciona" aria-labelledby="pasos-title" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 lg:py-36">
            <Rise>
              <p className="eyebrow text-brass">Cómo funciona</p>
              <h2 id="pasos-title" className="mt-4 text-[clamp(3rem,8vw,6.5rem)] text-paper">Tres pasos. <em>Cero</em> humo.</h2>
            </Rise>
            <DrawLine className="mt-14" />
            <ol className="grid gap-14 pt-12 md:grid-cols-3 md:gap-10">
              {STEPS.map((s, i) => (
                <li key={s.n}>
                  <Rise delay={i * 0.12}>
                    <span className="block font-display text-[7rem] leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-brass)]" aria-hidden>{s.n}</span>
                    <h3 className="mt-4 font-display text-4xl text-paper">{s.title}</h3>
                    <p className="mt-4 max-w-sm leading-relaxed text-muted">{s.text}</p>
                  </Rise>
                </li>
              ))}
            </ol>
          </section>

          {/* 6 · Confianza */}
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

          {/* 7 · Precio fundador */}
          <section aria-labelledby="precios-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-36">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-end">
              <Rise>
                <p className="eyebrow text-brass">Precio fundador · agencias</p>
                <h2 id="precios-title" className="mt-4 text-[clamp(3rem,8vw,6.5rem)] text-paper">Entra <em>ahora</em>. Quédate con el precio.</h2>
                <p className="mt-6 max-w-md text-lg text-muted">30 días gratis. El precio fundador se mantiene mientras sigas suscrito. Para atletas, gratis siempre.</p>
              </Rise>
              <div className="grid gap-4 sm:grid-cols-2">
                {[{ name: 'Agente', price: solo, note: 'Tú y tus atletas' }, { name: 'Agencia', price: team, note: 'Tu equipo completo' }].map((p, i) => (
                  <Rise key={p.name} delay={i * 0.12}>
                    <Tilt>
                      <div className={`relative overflow-hidden rounded-[22px] border p-8 ${i === 1 ? 'border-brass/60 bg-gradient-to-b from-brass/[0.14] to-transparent' : 'border-line bg-surface'}`}>
                        {i === 1 ? <span className="absolute right-5 top-5 rounded-full bg-brass px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-night">Más elegido</span> : null}
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{p.name}</p>
                        <p className="mt-6 font-display text-8xl leading-none text-paper">
                          {p.price !== null ? <CountUp to={p.price} /> : '—'}<span className="ml-1 text-3xl text-brass">€</span>
                        </p>
                        <p className="mt-2 text-sm text-muted">al mes · {p.note}</p>
                      </div>
                    </Tilt>
                  </Rise>
                ))}
                <Rise delay={0.3} className="sm:col-span-2">
                  <Link href="/precios" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-paper hover:text-brass">
                    Ver todos los planes <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Rise>
              </div>
            </div>
          </section>

          {/* 8 · Preguntas frecuentes */}
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

          {/* 9 · Cierre */}
          <section aria-labelledby="cierre-title" className="relative isolate overflow-hidden">
            <ParallaxMedia className="-z-10">
              <img src="/media/club-training.webp" alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" />
            </ParallaxMedia>
            <div className="absolute inset-0 -z-10 bg-night/80" aria-hidden />
            <div className="grain absolute inset-0 -z-10" aria-hidden />
            <div className="mx-auto max-w-7xl px-5 py-32 text-center sm:px-8 lg:py-44">
              <Rise>
                <h2 id="cierre-title" className="mx-auto max-w-[14ch] text-[clamp(3.4rem,10vw,9rem)] leading-[0.9] text-paper">Tu próximo fichaje empieza <em>hoy</em>.</h2>
              </Rise>
              <Rise delay={0.2}>
                <div className="mt-12 flex flex-wrap justify-center gap-3">
                  <a href="#para-quien" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-brass px-9 text-[15px] font-bold text-night">
                    <span className="relative z-10">Empezar gratis</span><ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </a>
                  <Link href="/demo/agente" className="inline-flex min-h-14 items-center rounded-full border border-paper/30 px-8 text-[15px] font-semibold text-paper transition-colors hover:border-brass hover:text-brass">Ver la demo</Link>
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

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-5xl leading-none text-paper">{value}</dd>
      <dd className="mt-2 text-[11px] uppercase tracking-[0.22em] text-paper/60" aria-hidden>{label}</dd>
    </div>
  );
}
