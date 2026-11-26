import { I18nProvider } from '@/lib/i18n/client';
import { getT } from '@/lib/i18n/server-t';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BadgeCheck, HeartHandshake, Lock } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/env';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { BRAND } from '@/content/brand';
import { PLANS } from '@/content/plans';
import { CountUp, DrawLine, MotionRoot, ParallaxMedia, Rise, WordsIn } from '@/components/landing/elite/Motion';
import { AllianceNetwork } from '@/components/landing/bridge/AllianceNetwork';
import { AgentConsole } from '@/components/landing/bridge/AgentConsole';
import { MotionToggle } from '@/components/landing/bridge/MotionToggle';

/*
 * Portada v6 «Pista» (26-nov-2026): marketplace deportivo claro, azul pista y naranja balón; mismo contenido que la v5.
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
  { key: 'universidad', name: 'Universidad', kicker: 'Programas NCAA', promise: 'Talento europeo con datos comprobables y una agencia verificada al otro lado.', cta: 'Registrar mi universidad', href: '/para/universidades' },
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

const MARKET = [
  { org: 'NCAA D1 · Universidad de ejemplo', title: 'Beca de fútbol masculino', meta: 'Mediocentro · Promoción 2027', value: 'Hasta 18.000 US$/año', tag: 'Beca', img: '/media/university-campus-sm.webp' },
  { org: 'Club verificado · Valencia', title: 'Prueba de selección · Showcase', meta: 'Baloncesto · Sub-18 · 12 plazas', value: 'Gratis', tag: 'Prueba', img: '/media/club-training-sm.webp' },
  { org: 'NCAA D2 · College de ejemplo', title: 'Beca parcial de baloncesto femenino', meta: 'Base · Promoción 2027', value: 'Hasta 12.000 US$/año', tag: 'Beca', img: '/media/arena-bg-sm.webp' },
];

const TICKER = ['Valencia → NCAA D-I', 'Belgrado → D-II', 'Madrid → NAIA', 'Kaunas → NCAA D-I', 'Lisboa → JUCO', 'Atenas → NCAA D-I', 'París → D-II'];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre. Las agencias tienen planes mensuales con precio fundador y las familias pueden contratar servicios de pago único. Todos los precios están publicados.'],
  ['¿Es solo para la NCAA?', 'La NCAA es nuestro foco, y también hay NAIA, JUCO, clubes y academias europeas. El mismo Passport sirve para todos.'],
  ['¿Pagar da más visibilidad?', 'No. Nadie compra prioridad: el orden depende del encaje con lo que busca cada organización.'],
  ['¿Usar una agencia afecta a la elegibilidad NCAA?', 'Puede, si el acuerdo está mal planteado. Por eso en The Gala Alliance cada agencia confirma que sus tarifas no dependen de conseguir una beca ni de su importe, y el atleta solo la autoriza a compartir su perfil y acompañarle. Somos software: no representamos a atletas. Ante la duda, consultad con el departamento de cumplimiento de la universidad.'],
  ['¿Garantizáis una beca o un contrato?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la organización y de la familia.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados, contacto solo de organizaciones verificadas, la familia siempre en el circuito y sin publicidad perfilada.'],
];

function priceNumber(name: string) {
  const p = PLANS.find((x) => x.audience === 'agent' && x.name === name)?.price ?? '';
  const n = Number.parseInt(p, 10);
  return Number.isFinite(n) ? n : null;
}

export default async function Home() {
  const tx = await getT();
  const solo = priceNumber(tx('Agente'));
  const team = priceNumber(tx('Agencia'));
  return (
    <I18nProvider locale={tx.locale}>
    <MotionRoot>
      <div className="relative overflow-x-clip bg-ink" lang={tx.locale}>
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, url: siteUrl(), description: BRAND.secondary, slogan: BRAND.claim }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: siteUrl(), inLanguage: tx.locale }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: tx(q), acceptedAnswer: { '@type': 'Answer', text: tx(a) } })) }} />
        <PublicHeader overlay locale={tx.locale} />

        <main id="main-content">
          {/* 1 · Portada: la misión, en claro y con energía de marketplace deportivo (v5 «Pista») */}
          <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-surface">
            <div className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full border-[56px] border-brass/[0.06]" aria-hidden />
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-36">
              <div>
                <Rise y={12}>
                  <p className="inline-flex items-center gap-2 rounded-full bg-brass/10 px-4 py-2 text-[13px] font-bold text-brass">
                    <span className="live-dot" aria-hidden />{tx('Europa → NCAA · baloncesto, fútbol y tenis')}
                  </p>
                </Rise>
                <h1 id="hero-title" className="mt-6 text-[clamp(3.2rem,7vw,6.4rem)] leading-[0.9] text-paper">
                  <span className="sr-only">{tx('Si tienes nivel, tienes que poder optar.')}</span>
                  <span aria-hidden><WordsIn parts={[tx('Si tienes nivel, tienes que poder'), { em: tx('optar.') }]} /></span>
                </h1>
                <Rise delay={0.6}>
                  <p className="mt-4 text-[clamp(1.25rem,2.2vw,1.6rem)] font-semibold leading-tight text-paper/70">{tx('Tengas o no los contactos.')}</p>
                </Rise>
                <Rise delay={0.75}>
                  <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                    {tx('The Gala Alliance une a atletas europeos, familias, clubes y universidades de la NCAA, y le da al agente el sistema para llevar cada fichaje del primer vídeo a la firma.')}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/demo/agente" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-brass px-8 text-[15px] font-bold text-white">
                      <span className="relative z-10">{tx('Soy agente · ver la demo')}</span>
                      <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                    </Link>
                    <Link href="/signup?role=athlete" className="inline-flex min-h-14 items-center gap-3 rounded-full bg-paper px-7 text-[15px] font-bold text-white transition-colors hover:bg-paper/85">
                      {tx('Soy atleta · gratis')}
                    </Link>
                  </div>
                  <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                    <div><dt className="sr-only">{tx('Deportes')}</dt><dd className="font-display text-4xl leading-none text-paper">3</dd><dd className="mt-1 text-[13px] text-faint">{tx('deportes en el piloto')}</dd></div>
                    <div><dt className="sr-only">{tx('Actores')}</dt><dd className="font-display text-4xl leading-none text-paper">6</dd><dd className="mt-1 text-[13px] text-faint">{tx('actores en una plataforma')}</dd></div>
                    <div><dt className="sr-only">{tx('Precio')}</dt><dd className="font-display text-4xl leading-none text-pop">0 €</dd><dd className="mt-1 text-[13px] text-faint">{tx('para atletas y clubes')}</dd></div>
                  </dl>
                  <div className="mt-6"><MotionToggle /></div>
                </Rise>
              </div>
              <Rise delay={0.4} className="relative mx-auto h-[420px] w-full max-w-xl sm:h-[520px]">
                <div className="absolute inset-y-0 left-6 right-0 overflow-hidden rounded-[28px] [clip-path:polygon(12%_0,100%_0,100%_100%,0_100%)] sm:left-10">
                  <img src="/media/hero-athletes.webp" alt="" className="h-full w-full object-cover" />
                </div>
                <div className="bridge-card absolute bottom-6 left-0 w-[min(300px,80%)] rounded-2xl bg-surface p-4 shadow-[var(--shadow-premium)]">
                  <div className="flex items-center justify-between text-xs"><span className="font-bold text-brass">{tx('NUEVA OFERTA')}</span><span className="text-faint">{tx('Ejemplo')}</span></div>
                  <p className="mt-2 font-bold text-paper">{tx('Beca parcial · NCAA D2')}</p>
                  <p className="text-[13px] text-faint">{tx('Baloncesto femenino · Base · 2027')}</p>
                  <div className="mt-3 h-2 rounded-full bg-brass/10"><div className="h-2 w-[86%] rounded-full bg-gradient-to-r from-brass to-pop" /></div>
                  <p className="mt-1.5 text-xs text-muted">{tx('Encaje 86 % con tu perfil')}</p>
                </div>
                <p className="absolute -right-2 top-6 -rotate-3 rounded-xl bg-pop px-3 py-2 font-display text-lg text-paper shadow-[var(--shadow-elevated)]">{tx('Perfil verificado')} ✓</p>
              </Rise>
            </div>
          </section>

          {/* 2 · Cinta de rutas */}
          <div className="relative z-10 -mt-px -rotate-[1.2deg] scale-[1.03] bg-brass py-4 text-white" aria-hidden>
            <div className="flex w-max marquee">
              {[0, 1].map((k) => (
                <ul key={k} className="flex shrink-0 items-center">
                  {TICKER.map((t) => (
                    <li key={t} className="flex items-center font-display text-2xl tracking-[0.02em] sm:text-3xl">
                      <span className="px-6">{tx(t)}</span><span className="text-pop">✦</span>
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
                <p className="eyebrow text-brass">{tx('El momento es ahora')}</p>
                <h2 id="momento-title" className="mt-4 text-[clamp(2.8rem,7vw,6rem)] text-paper">{tx('Europa ya es la')}{' '}<em>{tx('cantera')}</em>{' '}{tx('de la NCAA.')}</h2>
              </Rise>
              <Rise delay={0.15}>
                <p className="max-w-lg text-lg leading-relaxed text-muted">{tx('Cada temporada llegan más europeos a las universidades de EE. UU. Lo difícil no es el talento: es que alguien lo vea, lo ordene y lo lleve hasta la firma.')}</p>
              </Rise>
            </div>
            <DrawLine className="mt-14" />
            <ul className="grid gap-12 pt-12 md:grid-cols-3">
              <li><Rise><p className="font-display text-[clamp(5rem,10vw,8rem)] leading-none text-paper"><CountUp to={879} /></p><p className="mt-3 max-w-[26ch] text-sm text-muted">{tx('europeos en el baloncesto NCAA División I (2024-25)')}</p></Rise></li>
              <li><Rise delay={0.1}><p className="font-display text-[clamp(5rem,10vw,8rem)] leading-none text-brass"><span aria-hidden>×3</span><span className="sr-only">{tx('El triple')}</span></p><p className="mt-3 max-w-[26ch] text-sm text-muted">{tx('que en 2009-10, cuando eran 291')}</p></Rise></li>
              <li><Rise delay={0.2}><p className="font-display text-[clamp(5rem,10vw,8rem)] leading-none text-paper">1.ª</p><p className="mt-3 max-w-[26ch] text-sm text-muted">{tx('Europa es la región fuera de EE. UU. que más jugadores aporta al baloncesto de División I')}</p></Rise></li>
            </ul>
            <p className="mt-10 text-xs text-faint">{tx('Fuente: NCAA, «March Madness across the world: NCAA basketball’s global impact» (18 de marzo de 2025).')}</p>
          </section>

          {/* 3b · El mercado: así se ven las oportunidades (ejemplos ilustrativos) */}
          <section aria-labelledby="mercado-title" className="bg-surface">
            <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <Rise>
                  <p className="eyebrow text-brass">{tx('El mercado')}</p>
                  <h2 id="mercado-title" className="mt-3 text-[clamp(2.6rem,5.5vw,4.4rem)] text-paper">{tx('Oportunidades')}{' '}<em>{tx('abiertas')}</em></h2>
                </Rise>
                <Link href="/oportunidades" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-bold text-paper transition-colors hover:border-brass hover:text-brass">{tx('Ver todas')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
              <ul className="mt-10 grid gap-5 md:grid-cols-3">
                {MARKET.map((o, i) => (
                  <li key={o.title}>
                    <Rise delay={i * 0.08} className="hover-lift h-full overflow-hidden rounded-[20px] border border-line bg-surface">
                      <div className="relative h-40">
                        <img src={o.img} alt="" loading="lazy" className="h-full w-full object-cover" />
                        <span className="absolute left-3 top-3 rounded-full bg-surface px-3 py-1 text-xs font-bold text-paper">{tx(o.org)}</span>
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-paper">{tx(o.title)}</h3>
                        <p className="mt-0.5 text-[13px] text-faint">{tx(o.meta)}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="font-display text-2xl text-paper">{tx(o.value)}</span>
                          <span className="rounded-full bg-brass/10 px-3 py-1 text-xs font-bold text-brass">{tx(o.tag)}</span>
                        </div>
                      </div>
                    </Rise>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-faint">{tx('Ejemplos ilustrativos: las ofertas reales las publican organizaciones verificadas dentro de la plataforma.')}</p>
            </div>
          </section>

          {/* 4 · La alianza: todos conectados alrededor del atleta */}
          <section aria-labelledby="alianza-title" className="night-scope relative isolate overflow-hidden bg-night">
            <div className="court-lines absolute inset-0 -z-10 opacity-[0.05]" aria-hidden />
            <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
              <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
                <div>
                  <Rise><p className="eyebrow text-brass">{tx('La alianza')}</p></Rise>
                  <Rise delay={0.1}><h2 id="alianza-title" className="mt-4 text-[clamp(2.8rem,6.5vw,5.5rem)] text-paper">{tx('Todos conectados. El atleta en el')}{' '}<em>{tx('centro')}</em>.</h2></Rise>
                  <Rise delay={0.2}>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/80">{tx('Hoy cada parte trabaja por su lado: el club tiene los datos, la familia las dudas, la universidad la beca y el agente, veinte chats abiertos.')}</p>
                    <p className="mt-4 max-w-md text-lg leading-relaxed text-paper/80">{tx('Aquí comparten un mismo perfil verificado y un mismo proceso. Cada uno ve solo lo suyo.')}</p>
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
                <p className="eyebrow text-brass">{tx('Para agentes y agencias')}</p>
                <h2 id="agentes-title" className="mt-4 max-w-[16ch] text-[clamp(3rem,7.5vw,6.5rem)] text-paper">{tx('Tu agencia, de Europa a la')}{' '}<em>NCAA</em>.</h2>
              </Rise>
              <Rise delay={0.15}><p className="max-w-sm text-lg text-muted">{tx('Un solo sitio para tus atletas, sus familias, las universidades y cada papel. Lo que hoy llevas en hojas de cálculo y WhatsApp.')}</p></Rise>
            </div>
            <Rise delay={0.1} className="night-scope mt-14 rounded-2xl"><AgentConsole /></Rise>
            <ol className="mt-16 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
              {AGENT_POINTS.map((p, i) => (
                <li key={p.n}>
                  <Rise delay={i * 0.08}>
                    <span className="block font-display text-6xl leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-pop)]" aria-hidden>{p.n}</span>
                    <h3 className="mt-4 font-display text-3xl text-paper">{tx(p.title)}</h3>
                    <p className="mt-3 leading-relaxed text-muted">{tx(p.text)}</p>
                  </Rise>
                </li>
              ))}
            </ol>
            <div className="mt-20 grid gap-6 rounded-[24px] bg-surface-2 p-8 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <p className="eyebrow text-brass">{tx('Precio fundador')}</p>
                <p className="mt-3 font-display text-4xl text-paper sm:text-5xl">{tx('−40 % de por vida para las')}{' '}<em>{tx('15 primeras')}</em>.</p>
                <p className="mt-3 text-muted">{tx('Agente 47 €/mes y Agencia 119 €/mes mientras sigas suscrito, en lugar de 79 € y 199 €. 30 días gratis. Para atletas, gratis siempre.')}</p>
              </div>
              <div className="flex flex-wrap items-end gap-8 lg:justify-end">
                {[{ name: 'Agente', price: solo }, { name: 'Agencia', price: team }].map((p) => (
                  <div key={p.name}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">{tx(p.name)}</p>
                    <p className="mt-2 font-display text-6xl leading-none text-paper">{p.price !== null ? <CountUp to={p.price} /> : '—'}<span className="ml-1 text-2xl text-pop">€</span><span className="ml-1 text-sm font-sans normal-case text-muted">{tx('/mes')}</span></p>
                  </div>
                ))}
                <Link href="/demo/agente" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-pop px-8 text-[15px] font-bold text-paper">
                  <span className="relative z-10">{tx('Ver la demo')}</span><ArrowRight className="relative z-10 h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          {/* 6 · Fundadora: la esencia */}
          <section aria-labelledby="origen-title" className="relative isolate overflow-hidden bg-surface-2">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-32">
              <Rise className="relative">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] sm:aspect-[5/4] lg:aspect-[4/5]">
                  <img src="/media/founder-entrance.webp" alt={tx('Gala, fundadora de The Gala Alliance, saltando a la pista en un partido de la NCAA')} loading="lazy" className="h-full w-full object-cover object-[30%_center]" />
                  <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-surface/95 px-4 py-3 shadow-[var(--shadow-elevated)]">
                    <div><p className="text-xs text-faint">{tx('Fundadora · ex jugadora NCAA D-I')}</p><p className="font-bold text-paper">{tx('Gala · University of Evansville')}</p></div>
                    <span className="font-display text-2xl text-brass">D1</span>
                  </div>
                </div>
              </Rise>
              <div>
                <Rise><p className="eyebrow text-brass">{tx('Por qué existe')}</p></Rise>
                <Rise delay={0.1}>
                  <h2 id="origen-title" className="mt-5 text-[clamp(2.8rem,6.5vw,5.5rem)] text-paper">
                    {tx('Yo hice este')}{' '}<em>{tx('camino')}</em>{tx('. Sola.')}
                  </h2>
                </Rise>
                <Rise delay={0.2}>
                  <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted">
                    {tx('Salí de España para jugar al baloncesto en la NCAA División I con beca completa. Sé lo que cuesta que alguien te vea desde el otro lado del Atlántico, lo que pesan los papeles y lo sola que se siente una familia en el proceso.')}
                  </p>
                  <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">
                    {tx('The Gala Alliance es lo que me habría gustado tener: una alianza honesta entre todos los que ayudan a un atleta a llegar.')}
                  </p>
                </Rise>
                <Rise delay={0.3}>
                  <p className="mt-10 font-display text-3xl text-brass">{tx('— Gala')}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.28em] text-muted">{tx('Fundadora · ex jugadora NCAA D-I')}</p>
                </Rise>
              </div>
            </div>
          </section>

          {/* 7 · El resto de la alianza */}
          <section id="para-quien" aria-labelledby="quien-title" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
            <Rise>
              <p className="eyebrow text-brass">{tx('Para toda la alianza')}</p>
              <h2 id="quien-title" className="mt-4 text-[clamp(2.8rem,6.5vw,5.5rem)] text-paper">{tx('Cada uno, en su')}{' '}<em>{tx('sitio')}</em>.</h2>
            </Rise>
            <ul className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((r, i) => (
                <li key={r.key} className="bg-surface">
                  <Link href={r.href} className="group flex h-full min-h-[280px] flex-col p-7 transition-colors hover:bg-brass/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass">
                    <span className="font-display text-sm text-brass">{String(i + 1).padStart(2, '0')}</span>
                    <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">{tx(r.kicker)}</p>
                    <h3 className="mt-2 font-display text-5xl text-paper">{tx(r.name)}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-paper/75">{tx(r.promise)}</p>
                    <span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-6 text-sm font-bold text-paper transition-colors group-hover:text-brass">
                      {tx(r.cta)} <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">{tx('¿Eres una marca?')}{' '}<Link href="/para/marcas" className="font-semibold text-paper underline decoration-brass underline-offset-4">{tx('Colaboraciones con atletas mayores de edad')}</Link>.</p>
          </section>

          {/* 8 · Confianza */}
          <section aria-labelledby="confianza-title" className="relative bg-surface-2">
            <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
              <h2 id="confianza-title" className="sr-only">{tx('Seguridad y confianza')}</h2>
              <ul className="grid gap-10 md:grid-cols-3">
                {TRUST.map(({ Icon, title, text }, i) => (
                  <li key={title}>
                    <Rise delay={i * 0.1} className="flex items-start gap-5">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-brass/40 text-brass"><Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /></span>
                      <div>
                        <h3 className="font-display text-2xl text-paper">{tx(title)}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted">{tx(text)}</p>
                      </div>
                    </Rise>
                  </li>
                ))}
              </ul>
              <Link href="/seguridad" className="mt-12 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brass hover:underline hover:underline-offset-4">
                {tx('Cómo protegemos a menores y datos')}{' '}<ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          {/* 9 · Preguntas frecuentes */}
          <section aria-labelledby="faq-title" className="border-t border-line">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-28">
              <h2 id="faq-title" className="text-5xl text-paper sm:text-6xl">{tx('Preguntas')}{' '}<em>{tx('claras')}</em></h2>
              <div className="divide-y divide-line border-y border-line">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group py-6">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-paper">
                      {tx(q)}<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong text-brass transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="mt-3 max-w-2xl leading-relaxed text-muted">{tx(a)}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* 10 · Cierre */}
          <section aria-labelledby="cierre-title" className="relative isolate overflow-hidden bg-brass">
            <div className="court-lines absolute inset-0 -z-10 opacity-[0.5]" aria-hidden />
            <div className="mx-auto max-w-7xl px-5 py-32 text-center sm:px-8 lg:py-44">
              <Rise>
                <h2 id="cierre-title" className="mx-auto max-w-[15ch] text-[clamp(3.2rem,9vw,8rem)] leading-[0.9] text-white [&_em]:text-pop">{tx('El talento ya está en Europa. Que lo')}{' '}<em>{tx('vean')}</em>.</h2>
              </Rise>
              <Rise delay={0.2}>
                <div className="mt-12 flex flex-wrap justify-center gap-3">
                  <Link href="/demo/agente" className="group inline-flex min-h-14 items-center gap-3 rounded-full bg-pop px-9 text-[15px] font-bold text-paper">
                    <span className="relative z-10">{tx('Soy agente · ver la demo')}</span><ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link href="/signup?role=athlete" className="inline-flex min-h-14 items-center rounded-full bg-white px-8 text-[15px] font-bold text-brass-deep transition-colors hover:bg-white/90">{tx('Soy atleta · gratis')}</Link>
                </div>
              </Rise>
            </div>
          </section>
        </main>

        <PublicFooter locale={tx.locale} />
      </div>
    </MotionRoot>
    </I18nProvider>
  );
}
