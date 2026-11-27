import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n/client';
import { publicMeta } from '@/lib/seo/page-meta';
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
 * Portada v6 «Estadio» (26-nov-2026): marketplace deportivo claro con foto de estadio, verde césped y flúor; mismo contenido que la v5.
 * Portada «La alianza» (v5, 23-nov-2026): la misión de la v1, el negro y oro de la v4 y el puente Europa → NCAA.
 * El agente es el protagonista; el atleta, el centro. Sin fotos de stock: vídeo real, ilustración propia y la fundadora.
 * Negro de estadio, marfil y oro; titulares en Anton con la palabra clave en Fraunces itálica.
 * Imagen real (vídeo nocturno de pista y fotos de la fundadora en la NCAA), rejilla rota y movimiento con intención.
 * Todo el movimiento se apaga con «reducir movimiento».
 */

const ROLES = [
  { key: 'atleta', name: 'Atleta', kicker: 'Gratis siempre', promise: 'Un Passport verificado que abre puertas a este lado del Atlántico y al otro.', cta: 'Crear mi perfil', href: '/signup?role=athlete' },
  { key: 'familia', name: 'Familia', kicker: 'Con tu firma', promise: 'El coste real de cada opción y nada sin vuestro permiso.', cta: 'Entrar como familia', href: '/signup?role=parent' },
  { key: 'club', name: 'Club', kicker: 'Clubes y academias', promise: 'Confirma los datos de tus jugadores y lleva sus pruebas.', cta: 'Registrar mi club', href: '/para/clubes' },
  { key: 'universidad', name: 'Universidad', kicker: 'Programas NCAA', promise: 'Talento europeo con datos comprobables y una agencia verificada al otro lado.', cta: 'Registrar mi universidad', href: '/para/universidades' },
];

const AGENT_POINTS = [
  { n: '01', title: '¿Para quién buscas?', text: 'Eliges al atleta y ves las becas y pruebas que encajan, por qué encajan y qué falta saber.' },
  { n: '02', title: 'Cada proceso, en 5 fases', text: 'Introducción, evaluación, visita o prueba, oferta y decisión. Cada tarjeta dice qué toca, a quién le toca y para cuándo.' },
  { n: '03', title: 'Una bandeja con contexto', text: 'Cada atleta y, si es menor, su familia en el mismo hilo, con la fase y los documentos al lado.' },
  { n: '04', title: 'Papeles sin sustos', text: 'Expediente traducido, inglés, elegibilidad y visado: qué falta y para qué proceso.' },
];

const TRUST = [
  { Icon: HeartHandshake, title: 'Menores protegidos', text: 'Perfiles privados y la familia siempre en el circuito.' },
  { Icon: BadgeCheck, title: 'Solo organizaciones verificadas', text: 'Dominio oficial comprobado antes de contactar.' },
  { Icon: Lock, title: 'Tú decides quién ve qué', text: 'Permisos con fecha de caducidad. Descarga y borrado cuando quieras.' },
];

const MARKET = [
  { org: 'NCAA D1', title: 'Beca de fútbol masculino', meta: 'Universidad de ejemplo · Mediocentro · 2027', value: '18.000 US$/año', tag: 'Beca', img: '/media/university-campus-sm.webp' },
  { org: 'Club verificado', title: 'Prueba de selección · Showcase', meta: 'Valencia · Baloncesto · Sub-18', value: 'Gratis', tag: '12 plazas', img: '/media/club-training-sm.webp' },
  { org: 'NCAA D2', title: 'Beca parcial de baloncesto femenino', meta: 'College de ejemplo · Base · 2027', value: '12.000 US$/año', tag: 'Beca', img: '/media/founder-entrance-sm.webp' },
];

const APP_STATS = [
  { n: 12, label: 'atletas', hot: false },
  { n: 4, label: 'necesitan atención', hot: true },
  { n: 7, label: 'ofertas que encajan', hot: false },
  { n: 2, label: 'ofertas vivas', hot: false },
];

const APP_TASKS = [
  { when: '3 días', tone: 'hot', title: 'Oferta de Harbor Tech caduca', meta: 'Sofía Martín · 18.000 US$/año', cta: 'Revisar oferta' },
  { when: 'Vencido', tone: 'late', title: 'Pedir el expediente traducido', meta: 'Marcos Jiménez · College de ejemplo', cta: 'Hacer tarea' },
  { when: 'Mañana', tone: 'calm', title: 'Llamada con el assistant coach', meta: 'Marcos Jiménez · 18:00', cta: 'Abrir proceso' },
];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre. Las agencias tienen planes mensuales con precio fundador y las familias pueden contratar servicios de pago único. Todos los precios están publicados.'],
  ['¿Es solo para la NCAA?', 'La NCAA es nuestro foco, y también hay NAIA, JUCO, clubes y academias europeas. El mismo Passport sirve para todos.'],
  ['¿Pagar da más visibilidad?', 'No. Nadie compra prioridad: el orden depende del encaje con lo que busca cada organización.'],
  ['¿Usar una agencia afecta a la elegibilidad NCAA?', 'Puede, si el acuerdo está mal planteado. Por eso en The Gala Alliance cada agencia confirma que sus tarifas no dependen de conseguir una beca ni de su importe, y el atleta solo la autoriza a compartir su perfil y acompañarle. Somos software: no representamos a atletas. Ante la duda, consultad con el departamento de cumplimiento de la universidad.'],
  ['¿Garantizáis una beca o un contrato?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la organización y de la familia.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados, contacto solo de organizaciones verificadas, la familia siempre en el circuito y sin publicidad perfilada.'],
];

/** Fuente pública de las cifras de la NCAA (QA web #15: cifra con fuente, fuente enlazada). */
const NCAA_SOURCE = 'https://www.ncaa.org/news/2025/3/18/media-center-march-madness-across-the-world-ncaa-basketballs-global-impact.aspx';

export const metadata: Metadata = publicMeta({
  title: BRAND.metaTitle,
  description: BRAND.metaDescription,
  path: '/',
  absolute: true,
});

/** Precio de lista y precio fundador de un plan de agente, leídos del catálogo por su nombre interno (en castellano, nunca traducido). */
function agentPrices(name: string) {
  const plan = PLANS.find((x) => x.audience === 'agent' && x.name === name);
  const list = Number.parseInt(plan?.price ?? '', 10);
  const founder = Number.parseInt(/fundador:\s*(\d+)/.exec(plan?.priceNote ?? '')?.[1] ?? '', 10);
  return { list: Number.isFinite(list) ? list : null, founder: Number.isFinite(founder) ? founder : null };
}

export default async function Home() {
  const tx = await getT();
  const solo = agentPrices('Agente');
  const team = agentPrices('Agencia');
  return (
    <I18nProvider locale={tx.locale}>
    <MotionRoot>
      <div className="relative overflow-x-clip bg-ink" lang={tx.locale}>
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, url: siteUrl(), description: BRAND.secondary, slogan: BRAND.claim }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: siteUrl(), inLanguage: tx.locale }} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: tx(q), acceptedAnswer: { '@type': 'Answer', text: tx(a) } })) }} />
        <PublicHeader locale={tx.locale} />

        <main id="main-content">
          {/* 0 · Barra en vivo (v6 «Estadio») */}
          <div className="bg-night text-[13px] font-bold">
            <div className="mx-auto flex max-w-7xl items-center gap-8 overflow-hidden whitespace-nowrap px-5 py-2.5 sm:px-8">
              <span className="inline-flex items-center gap-2 text-lime"><span className="live-dot" aria-hidden />{tx('EN VIVO · becas y pruebas de organizaciones verificadas')}</span>
              <span className="hidden text-[#cfe3d9] md:inline">{tx('Perfiles validados por su club')}</span>
              <span className="hidden text-[#cfe3d9] lg:inline">{tx('Gratis para atletas, familias y clubes')}</span>
            </div>
          </div>

          {/* 1 · Portada: calcada del artboard C «Estadio» (26-nov-2026) */}
          <section aria-labelledby="hero-title" className="mx-auto max-w-7xl px-3 pt-3 sm:px-8 sm:pt-5">
            <div className="relative isolate overflow-hidden rounded-[24px] bg-night lg:min-h-[540px]">
              <img src="/media/club-training.webp" srcSet="/media/club-training-sm.webp 720w, /media/club-training.webp 1280w" sizes="(min-width: 1280px) 1280px, 100vw" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" fetchPriority="high" />
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(11_61_46/0.94)_0%,rgb(11_61_46/0.78)_45%,rgb(11_61_46/0)_75%)] max-lg:bg-[linear-gradient(180deg,rgb(11_61_46/0.75)_0%,rgb(11_61_46/0.95)_65%)]" aria-hidden />
              <div className="max-w-[900px] px-6 pb-32 pt-10 text-white sm:px-14 sm:pt-14 lg:pb-14">
                <Rise y={12}>
                  <p className="inline-block -skew-x-[10deg] bg-lime px-3 py-1.5 text-[13px] font-extrabold uppercase text-night">{tx('Europa → NCAA')}</p>
                </Rise>
                <h1 id="hero-title" className="night-scope mt-5 text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.95] text-white">
                  <span className="sr-only">{tx('Si tienes nivel, tienes que poder optar.')}</span>
                  <span aria-hidden><WordsIn parts={[tx('Si tienes nivel, tienes que poder'), { em: tx('optar.') }]} /></span>
                </h1>
                <Rise delay={0.6}>
                  <p className="mt-5 max-w-[540px] text-lg leading-relaxed text-[#dcebe3]">
                    {tx('El marketplace que conecta a atletas europeos con universidades de EE. UU., con agencias y familias en el mismo equipo.')}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link href="/para/agentes" className="inline-flex min-h-[52px] items-center rounded-full bg-lime px-6 text-[15px] font-extrabold text-night transition-transform hover:-translate-y-0.5">{tx('Soy agencia')}</Link>
                    <Link href="/signup?role=athlete" className="inline-flex min-h-[52px] items-center rounded-full bg-white px-6 text-[15px] font-extrabold text-night transition-transform hover:-translate-y-0.5">{tx('Soy atleta · gratis')}</Link>
                    <Link href="/demo/agente" className="group inline-flex min-h-[52px] items-center gap-2 rounded-full border-[1.5px] border-white/50 px-5 text-[15px] font-bold text-white transition-colors hover:border-white">
                      {tx('Ver la demo')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </div>
                  <div className="night-scope mt-5 w-fit"><MotionToggle /></div>
                </Rise>
              </div>
              <dl className="absolute bottom-5 right-5 flex gap-6 rounded-2xl bg-surface px-5 py-3.5 text-paper sm:bottom-7 sm:right-7">
                <div><dt className="sr-only">{tx('Deportes')}</dt><dd className="font-display text-[34px] leading-none">3</dd><dd className="text-xs text-faint">{tx('deportes')}</dd></div>
                <div><dt className="sr-only">{tx('Actores')}</dt><dd className="font-display text-[34px] leading-none">6</dd><dd className="text-xs text-faint">{tx('actores')}</dd></div>
                <div><dt className="sr-only">{tx('Precio')}</dt><dd className="font-display text-[34px] leading-none text-night">0 €</dd><dd className="text-xs text-faint">{tx('atletas y clubes')}</dd></div>
              </dl>
            </div>
          </section>

          {/* 2 · Mercado abierto (ejemplos ilustrativos), como en el artboard C */}
          <section aria-labelledby="mercado-title">
            <div className="mx-auto max-w-7xl px-5 pt-10 sm:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 id="mercado-title" className="text-[clamp(1.9rem,3vw,2.6rem)] leading-none text-paper">{tx('Mercado abierto')}</h2>
                <ul className="flex flex-wrap gap-2 text-[13px] font-bold" aria-label={tx('Filtrar por deporte')}>
                  <li><Link href="/oportunidades" className="inline-flex min-h-10 items-center rounded-[10px] bg-night px-3.5 text-lime">{tx('Todas')}</Link></li>
                  <li><Link href="/oportunidades?sport=basketball" className="inline-flex min-h-10 items-center rounded-[10px] bg-surface px-3.5 text-paper hover:bg-surface-2">{tx('Baloncesto')}</Link></li>
                  <li><Link href="/oportunidades?sport=football" className="inline-flex min-h-10 items-center rounded-[10px] bg-surface px-3.5 text-paper hover:bg-surface-2">{tx('Fútbol')}</Link></li>
                  <li><Link href="/oportunidades?sport=tennis" className="inline-flex min-h-10 items-center rounded-[10px] bg-surface px-3.5 text-paper hover:bg-surface-2">{tx('Tenis')}</Link></li>
                </ul>
              </div>
              <ul className="mt-5 grid gap-[18px] md:grid-cols-3">
                {MARKET.map((o, i) => (
                  <li key={o.title}>
                    <Rise delay={i * 0.08} className="hover-lift h-full overflow-hidden rounded-[18px] bg-surface">
                      <img src={o.img} alt="" loading="lazy" className="h-[150px] w-full object-cover" />
                      <div className="p-4">
                        <div className="flex justify-between gap-2 text-xs font-extrabold uppercase text-night"><span>{tx(o.org)}</span><span className="shrink-0 rounded-md bg-lime px-2 py-0.5">{tx(o.tag)}</span></div>
                        <h3 className="mt-1.5 text-[17px] font-extrabold text-paper">{tx(o.title)}</h3>
                        <p className="text-[13px] text-muted">{tx(o.meta)}</p>
                        <p className="mt-3 font-display text-[22px] leading-none text-paper">{tx(o.value)}</p>
                      </div>
                    </Rise>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">{tx('Ejemplos ilustrativos: las ofertas reales las publican organizaciones verificadas dentro de la plataforma.')}</p>
            </div>
          </section>

          {/* 3 · Dentro de la app (agencia), como en el artboard C. Datos de ejemplo. */}
          <section aria-labelledby="app-title" className="mx-auto max-w-7xl px-5 pt-10 sm:px-8">
            <div className="grid gap-6 rounded-[24px] bg-surface p-6 lg:grid-cols-[1fr_1.6fr]">
              <div>
                <p className="text-xs font-extrabold uppercase text-night">{tx('Dentro de la app · Agencia')} <span className="ml-1 font-semibold normal-case text-faint">({tx('datos de ejemplo')})</span></p>
                <h2 id="app-title" className="mt-2 text-[clamp(1.9rem,3vw,2.4rem)] leading-none text-paper">{tx('Hola, Carlos')}</h2>
                <dl className="mt-4 grid grid-cols-2 gap-2.5">
                  {APP_STATS.map((st) => (
                    <div key={st.label} className={`rounded-[14px] p-3 ${st.hot ? 'bg-night' : 'bg-ink'}`}>
                      <dd className={`font-display text-3xl leading-none ${st.hot ? 'text-lime' : 'text-paper'}`}>{st.n}</dd>
                      <dt className={`text-xs ${st.hot ? 'text-[#cfe3d9]' : 'text-muted'}`}>{tx(st.label)}</dt>
                    </div>
                  ))}
                </dl>
              </div>
              <ul>
                {APP_TASKS.map((t, i) => (
                  <li key={t.title} className={`flex flex-wrap items-center gap-3.5 py-3.5 ${i < APP_TASKS.length - 1 ? 'border-b border-line' : ''}`}>
                    <span className={`rounded-md px-2 py-1 font-display text-[13px] ${t.tone === 'hot' ? 'bg-lime text-night' : t.tone === 'late' ? 'bg-[#fde2dc] text-[#a3321c]' : 'bg-ink text-paper'}`}>{tx(t.when)}</span>
                    <div className="min-w-0 flex-1"><p className="font-extrabold text-paper">{tx(t.title)}</p><p className="text-[13px] text-muted">{tx(t.meta)}</p></div>
                    <Link href="/demo/agente" className={`inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-bold ${t.tone === 'hot' ? 'bg-night text-white' : 'border-[1.5px] border-line-strong text-paper'}`}>{tx(t.cta)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 3 · El momento: datos de la NCAA */}
          <section aria-labelledby="momento-title" className="mx-auto max-w-7xl px-5 pb-20 pt-24 sm:px-8 lg:pb-28 lg:pt-28">
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
            <p className="mt-10 text-xs text-faint">{tx('Fuente:')}{' '}<a href={NCAA_SOURCE} className="underline underline-offset-2 hover:text-paper" rel="noopener" target="_blank">{tx('NCAA, «March Madness across the world: NCAA basketball’s global impact» (18 de marzo de 2025)')}</a>.</p>
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
                    <span className="block font-display text-6xl leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-brass)]" aria-hidden>{p.n}</span>
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
                    <p className="mt-2 font-display text-6xl leading-none text-paper">{p.price.founder !== null ? <CountUp to={p.price.founder} /> : '—'}<span className="ml-1 text-2xl text-gold">€</span><span className="ml-1 text-sm font-sans normal-case text-muted">{tx('/mes')}</span></p>
                    {p.price.list !== null ? <p className="mt-1 text-sm text-faint"><s>{p.price.list} €</s> {tx('precio de lista')}</p> : null}
                  </div>
                ))}
                <Link href="/signup?role=agent&plan=agent_solo" className="btn-sweep group inline-flex min-h-14 items-center gap-3 rounded-full bg-pop px-8 text-[15px] font-bold text-paper">
                  <span className="relative z-10">{tx('Probar 30 días gratis')}</span><ArrowRight className="relative z-10 h-4 w-4" aria-hidden />
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
                <h2 id="cierre-title" className="mx-auto max-w-[15ch] text-[clamp(2.4rem,6.5vw,5.6rem)] leading-[0.92] text-white night-scope">{tx('El talento ya está en Europa. Que lo')}{' '}<em>{tx('vean')}</em>.</h2>
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
