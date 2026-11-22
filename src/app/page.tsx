import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Briefcase, FileText, GraduationCap, HeartHandshake, Lock, Shield, User, Users, Video,
} from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { siteUrl } from '@/lib/env';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { BRAND } from '@/content/brand';
import { PLANS } from '@/content/plans';

/*
 * Portada «Editorial premium» (reforma 180°, 22-nov-2026).
 * Objetivo: entender en 5 segundos qué es Gala y para quién. Una frase, un botón («¿Quién eres?»),
 * cinco papeles con una promesa cada uno, tres pasos, tres garantías y precios públicos.
 */

const ACTOR_CARDS = [
  { Icon: User, name: 'Atleta', promise: 'Consigue tu beca o tu equipo.', cta: 'Crear mi perfil gratis', href: '/signup?role=athlete' },
  { Icon: Users, name: 'Familia', promise: 'El coste real de cada opción, y nada sin tu permiso.', cta: 'Entrar como familia', href: '/signup?role=parent' },
  { Icon: Briefcase, name: 'Agente', promise: 'Todos tus atletas y sus procesos en un solo sitio.', cta: 'Abrir mi agencia', href: '/para/agentes' },
  { Icon: Shield, name: 'Club o academia', promise: 'Llena tus pruebas con jugadores que sí quieren venir.', cta: 'Registrar mi club', href: '/para/coaches' },
  { Icon: GraduationCap, name: 'Universidad', promise: 'Talento internacional con datos que puedes comprobar.', cta: 'Registrar mi universidad', href: '/para/universidades' },
];

const STEPS = [
  { n: '1', title: 'Un perfil fiable', text: 'El atleta lo crea una vez. Cada dato dice su origen: verificado, documentado o declarado.' },
  { n: '2', title: 'El encaje, explicado', text: 'Gala Match dice por qué encaja una oportunidad y qué falta. No es un ranking de talento.' },
  { n: '3', title: 'El proceso, hasta el final', text: 'Mensajes, documentos, pruebas y ofertas en un mismo hilo. Cada parte ve solo lo suyo.' },
];

const TRUST = [
  { Icon: BadgeCheck, title: 'Solo publican organizaciones verificadas', text: 'Con su dominio oficial, antes de publicar o contactar.' },
  { Icon: HeartHandshake, title: 'Los menores, siempre con su familia', text: 'Privados para anónimos, marcas y agentes. La familia aprueba cada contacto.' },
  { Icon: Lock, title: 'Tus datos, solo con tu permiso', text: 'Decides quién ve qué y hasta cuándo. Descarga y borrado cuando quieras.' },
];

const FAQ: [string, string][] = [
  ['¿Cuánto cuesta?', 'Para atletas es gratis para siempre. Las familias pueden contratar servicios de pago único y las agencias tienen planes mensuales. Todos los precios están publicados.'],
  ['¿Pagar da más visibilidad?', 'No. Nadie compra prioridad: el orden depende del encaje con lo que busca cada organización.'],
  ['¿Garantizáis una beca o un contrato?', 'No, y desconfía de quien lo haga. Organizamos la información y el proceso; la decisión es de la organización y de la familia.'],
  ['¿Es seguro para menores?', 'Sí, por diseño: perfiles privados, contacto solo de organizaciones verificadas, la familia siempre en el circuito y sin publicidad perfilada.'],
];

function firstPrice(audience: string) {
  return PLANS.find((p) => p.audience === audience && /\d/.test(p.price))?.price;
}

export default function Home() {
  const familyFrom = firstPrice('family');
  const agentFrom = firstPrice('agent');
  return (
    <div className="relative bg-ink">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, url: siteUrl(), description: BRAND.secondary, slogan: BRAND.claim }} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: siteUrl(), inLanguage: 'es' }} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }} />
      <PublicHeader />

      <main id="main-content" className="pt-16">
        {/* 1 · La idea en 5 segundos */}
        <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pb-28 lg:pt-24">
          <div>
            <p className="eyebrow text-gold">La red de oportunidades del deporte</p>
            <h1 id="hero-title" className="mt-5 text-[2.6rem] leading-[1.06] text-paper sm:text-6xl lg:text-[4rem]">
              Becas, fichajes y pruebas. Con perfiles <em>verificados</em>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              El atleta crea un perfil fiable una vez. Universidades, clubes y agentes verificados lo encuentran, y todos llevan el proceso en el mismo sitio.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#para-quien" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-6 font-semibold text-ink transition-opacity hover:opacity-90">
                Empieza: ¿quién eres? <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link href="/precios" className="inline-flex min-h-12 items-center rounded-full border border-line-strong bg-surface px-6 font-semibold text-paper transition-colors hover:border-paper">
                Ver precios
              </Link>
            </div>
          </div>

          <figure aria-label="Ejemplo de perfil verificado" className="m-0 rounded-[var(--radius-card)] border border-line bg-surface p-7 shadow-[var(--shadow-premium)] sm:p-8">
            <figcaption className="text-xs font-medium text-faint">Ejemplo ilustrativo · atleta ficticia</figcaption>
            <div className="mt-6 flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-night font-display text-xl text-lime" aria-hidden>LM</span>
              <div>
                <p className="font-display text-2xl text-paper">Lucía M.</p>
                <p className="text-sm text-muted">Base · 2008 · Baloncesto · España</p>
              </div>
            </div>
            <ul className="mt-7 divide-y divide-line border-y border-line">
              <ProofRow label="12,4 puntos por partido" badge="Verificado por su club" Icon={BadgeCheck} ok />
              <ProofRow label="Nota media 8,6" badge="Documentado" Icon={FileText} />
              <ProofRow label="Partido completo en vídeo" badge="Subido" Icon={Video} ok />
            </ul>
            <p className="mt-6 text-sm text-paper">Encaja con <strong>3 universidades</strong> y <strong>1 prueba de club</strong></p>
          </figure>
        </section>

        {/* 2 · ¿Quién eres? */}
        <section id="para-quien" aria-labelledby="quien-title" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 lg:py-24">
          <p className="eyebrow text-gold">Elige tu papel</p>
          <h2 id="quien-title" className="mt-3 text-4xl text-paper sm:text-5xl">¿Quién eres?</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ACTOR_CARDS.map(({ Icon, name, promise, cta, href }) => (
              <li key={name}>
                <Link href={href} className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-colors hover:border-paper">
                  <Icon className="h-6 w-6 text-paper" strokeWidth={1.4} aria-hidden />
                  <h3 className="mt-6 font-display text-xl font-medium text-paper">{name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{promise}</p>
                  <span className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-paper">
                    {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">¿Eres una marca? <Link href="/para/marcas" className="font-semibold text-paper underline underline-offset-4">Colaboraciones con atletas mayores de edad</Link>.</p>
        </section>

        {/* 3 · Cómo funciona */}
        <section id="como-funciona" aria-labelledby="pasos-title" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 lg:py-24">
          <p className="eyebrow text-gold">Cómo funciona</p>
          <h2 id="pasos-title" className="mt-3 text-4xl text-paper sm:text-5xl">Tres pasos. Para todos.</h2>
          <ol className="mt-10 grid gap-10 border-t border-line pt-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="font-display text-4xl text-gold" aria-hidden>{s.n}</span>
                <h3 className="mt-4 font-display text-2xl font-medium text-paper">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4 · Confianza */}
        <section aria-labelledby="confianza-title" className="bg-night text-[#f6f3ec]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 id="confianza-title" className="sr-only">Seguridad y confianza</h2>
            <ul className="grid gap-10 md:grid-cols-3">
              {TRUST.map(({ Icon, title, text }) => (
                <li key={title} className="flex items-start gap-4">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-lime" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="font-display text-xl leading-snug">{title}</p>
                    <p className="mt-2 text-sm text-[#cfc9bb]">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/seguridad" className="mt-10 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-lime">
              Cómo protegemos a menores y datos <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* 5 · Precios públicos */}
        <section aria-labelledby="precios-title" className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 lg:py-28">
          <p className="eyebrow text-gold">Precios públicos</p>
          <h2 id="precios-title" className="mt-4 text-3xl leading-tight text-paper sm:text-5xl">
            Gratis para atletas.{agentFrom ? <> Agencias desde {agentFrom}.</> : null}
          </h2>
          <p className="mt-5 text-muted">
            {familyFrom ? <>Servicios para familias desde {familyFrom}, pago único. </> : null}Sin llamadas comerciales ni letra pequeña.
          </p>
          <Link href="/precios" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-6 font-semibold text-ink transition-opacity hover:opacity-90">
            Ver todos los planes <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>

        {/* 6 · Preguntas frecuentes */}
        <section aria-labelledby="faq-title" className="border-t border-line">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 id="faq-title" className="text-3xl text-paper sm:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-8 divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-paper">
                    {q}<span className="text-xl text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function ProofRow({ label, badge, Icon, ok }: { label: string; badge: string; Icon: typeof BadgeCheck; ok?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-4">
      <span className="font-medium text-paper">{label}</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-ok/10 text-ok' : 'bg-surface-2 text-muted'}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />{badge}
      </span>
    </li>
  );
}
