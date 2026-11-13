import { existsSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Bot, Building2, Calculator, ChevronDown, CircleCheck, Columns3, FileText,
  GraduationCap, Handshake, IdCard, Megaphone, LayoutGrid, MessageSquare, Scale, School, ShieldCheck, Sparkles, Star, Trophy, Users,
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
const HERO_IMAGE = '/images/hero-athletes.webp';
const hasHeroImage = existsSync(path.join(process.cwd(), 'public', HERO_IMAGE));

const TOOLS = [
  { Icon: IdCard, title: 'Opportunity Passport', text: 'Vídeo, estadísticas, notas e idiomas en un perfil comparable.' },
  { Icon: LayoutGrid, title: 'Escaparate de atletas', text: 'Filtros por deporte, posición, año, división y nota.' },
  { Icon: Trophy, title: 'Becas con sello', text: 'Confianza en 5 niveles y señales de alarma en cada oferta.' },
  { Icon: School, title: 'Universidades oficiales', text: 'Datos del U.S. Department of Education con su fuente.' },
  { Icon: Columns3, title: 'Comparador', text: 'Hasta 5 universidades u ofertas lado a lado.' },
  { Icon: Calculator, title: 'Coste real', text: 'Cuánto cuesta de verdad, a 4 años, con viajes y seguro.' },
  { Icon: FileText, title: 'Centro de documentos', text: 'Checklist con fechas según tu promoción, privado.' },
  { Icon: GraduationCap, title: 'Academia SAT/TOEFL', text: 'Práctica tipo examen con fechas oficiales.' },
  { Icon: Bot, title: 'Gala IA', text: 'Resuelve dudas del proceso a cualquier hora.' },
  { Icon: MessageSquare, title: 'Mensajes seguros', text: 'Con menores, la familia aprueba y ve el hilo.' },
  { Icon: Users, title: 'Portal de clubes', text: 'Roster, estadísticas confirmadas y colocaciones.' },
  { Icon: Scale, title: 'Memo de decisión', text: 'La opción más sólida, riesgos y preguntas pendientes.' },
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
        {/* HERO con selector de perfil */}
        <section aria-label="Presentación" className="relative -mt-16 flex min-h-[min(94vh,900px)] items-center overflow-hidden pt-16">
          <div className="absolute inset-0" aria-hidden>
            {hasHeroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={HERO_IMAGE} alt="" width={1920} height={1080} className="h-full w-full object-cover" fetchPriority="high" />
            ) : (
              <>
                <div className="bg-grid absolute inset-0" />
                <div className="glow-gold absolute -right-40 top-10 h-[620px] w-[620px]" />
                <div className="glow-trust absolute -bottom-40 left-1/3 h-[520px] w-[520px]" />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/30" />
            {[12, 28, 46, 63, 78, 90].map((l, i) => (
              <span key={l} className="particle hidden md:block" style={{ left: `${l}%`, top: `${18 + ((i * 23) % 60)}%`, animationDelay: `${i * 0.7}s` }} />
            ))}
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

        {/* TEST de opciones: el gancho de captación */}
        <section id="test" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-trust/30 bg-trust/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ok"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Gratis · 60 segundos</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">¿Tienes opciones de beca? <span className="text-brass">Descúbrelo ahora.</span></h2>
              <p className="mt-4 max-w-md leading-relaxed text-muted">Cuatro preguntas y te decimos dónde encajarías, qué te haría subir de nivel y tu siguiente paso. Sin registrarte.</p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                {['Sin email ni datos personales', 'Basado en cómo funcionan las divisiones NCAA, NAIA y JUCO', 'Después, universidades reales para tu perfil'].map((t) => <li key={t} className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-ok" aria-hidden />{t}</li>)}
              </ul>
            </Reveal>
            <Reveal delay={120}><OptionsQuiz /></Reveal>
          </div>
        </section>

        {/* POR QUÉ */}
        <section className="border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-16 max-w-3xl text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Por qué Gala Alliance</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-paper md:text-5xl">El reclutamiento internacional <span className="text-brass">ya no tiene que ser un acto de fe.</span></h2>
              <p className="text-sm leading-relaxed text-muted md:text-base">Tres fallos del sistema actual, y cómo los corrige la plataforma.</p>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3">
              {FAILURES.map((f, i) => (
                <Reveal key={f.n} delay={i * 100} className="h-full">
                  <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brass/40 hover:shadow-[var(--shadow-elevated)]">
                    <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brass/10 font-display text-lg font-bold text-brass">{f.n}</span>
                    <h3 className="mb-3 text-lg font-bold leading-snug text-paper">{f.title}</h3>
                    <p className="mb-5 text-sm leading-relaxed text-muted">{f.today}</p>
                    <p className="mt-auto border-t border-line pt-4 text-sm leading-relaxed text-paper/85"><span className="font-semibold text-ok">Con Gala:</span> {f.fix}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PRODUCTO */}
        <section id="producto" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-14 max-w-3xl">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">El producto</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">Míralo por dentro <span className="text-brass">antes de registrarte.</span></h2>
            </Reveal>
            <Reveal><ProductTour /></Reveal>
          </div>
        </section>

        {/* CÓMO FUNCIONA: calendario por curso */}
        <section id="como-funciona" className="scroll-mt-20 border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Cómo funciona</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-paper md:text-5xl">Qué hacer <span className="text-brass">en cada curso.</span></h2>
              <p className="text-sm leading-relaxed text-muted md:text-base">Pulsa tu etapa. La plataforma te lo recuerda con fechas según tu promoción.</p>
            </Reveal>
            <Reveal><Timeline /></Reveal>
            <Reveal className="mt-12 text-center">
              <ButtonLink href="/signup" className="group h-12 px-10 font-semibold">Empezar gratis ahora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
            </Reveal>
          </div>
        </section>

        {/* COMPARATIVA */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Gala frente a las alternativas</h2>
              <p className="mx-auto max-w-xl text-sm text-muted">Lo que cambia respecto a una agencia tradicional o a hacerlo por tu cuenta.</p>
            </Reveal>
            <Reveal>
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-surface">
                      <th scope="col" className="p-4 text-left text-xs font-normal text-faint"><span className="sr-only">Aspecto</span></th>
                      <th scope="col" className="border-x border-brass/30 bg-brass/10 p-4 text-left"><span className="flex items-center gap-2 font-bold text-paper"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-brass text-[11px] font-black text-ink">G</span>The Gala Alliance</span></th>
                      <th scope="col" className="p-4 text-left font-semibold text-muted">Agencia tradicional</th>
                      <th scope="col" className="p-4 text-left font-semibold text-muted">Por tu cuenta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((c) => (
                      <tr key={c.row} className="border-t border-line">
                        <th scope="row" className="p-4 text-left font-normal text-paper">{c.row}</th>
                        <td className="border-x border-brass/30 bg-brass/[0.06] p-4"><span className="flex items-start gap-2 font-medium text-paper"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{c.gala}</span></td>
                        <td className="p-4 text-muted">{c.agency}</td>
                        <td className="p-4 text-muted">{c.alone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-center text-[11px] text-faint">Comparativa general: cada agencia trabaja de forma distinta.</p>
            </Reveal>
          </div>
        </section>

        {/* HERRAMIENTAS */}
        <section className="border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Todo lo que necesitas, en una sola plataforma.</h2>
              <p className="mx-auto max-w-md text-sm text-muted">No son promesas: es lo que ya puedes usar al crear tu cuenta.</p>
            </Reveal>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {TOOLS.map(({ Icon, title, text }, i) => (
                <Reveal key={title} as="li" variant="scale" delay={(i % 4) * 60}>
                  <div className="group h-full rounded-xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brass/40">
                    <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 transition-colors group-hover:bg-brass/15"><Icon className="h-4 w-4 text-paper/70 group-hover:text-brass" aria-hidden /></span>
                    <h3 className="mb-0.5 text-sm font-semibold text-paper">{title}</h3>
                    <p className="text-xs leading-relaxed text-muted">{text}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* PARA QUIÉN */}
        <section id="para-quien" className="scroll-mt-20 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Seis perfiles, una sola red.</h2>
              <p className="mx-auto max-w-md text-sm text-muted">Cada uno con su espacio y sus herramientas.</p>
            </Reveal>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ACTORS.map((a, i) => {
                const Icon = ROLE_ICON[a.role] ?? Users;
                const featured = a.role === 'athlete';
                return (
                  <Reveal key={a.role} as="li" delay={(i % 3) * 80}>
                    <Link href={`/para/${a.slug}`} className={`group block h-full rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] ${featured ? 'border-brass/30 bg-brass/[0.07] hover:border-brass/50' : 'border-line bg-surface hover:border-brass/30'}`}>
                      <div className="mb-3 flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${featured ? 'bg-brass/20' : 'bg-surface-2'}`}><Icon className={`h-5 w-5 ${featured ? 'text-brass' : 'text-paper/70'}`} aria-hidden /></span>
                        <h3 className="text-base font-bold text-paper">{ROLE_TITLE[a.role] ?? a.plural}</h3>
                      </div>
                      <p className="mb-4 text-sm text-muted">{a.promise}</p>
                      <ul className="space-y-1.5">
                        {a.services.slice(0, 4).map((x) => (
                          <li key={x} className="flex items-start gap-2 text-xs text-muted"><CircleCheck className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${featured ? 'text-brass' : 'text-faint'}`} aria-hidden />{x}</li>
                        ))}
                      </ul>
                      <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brass">Ver lo que incluye <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden /></span>
                    </Link>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>

        {/* PLANES */}
        <section className="border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Precios claros. <span className="text-brass">Sin llamadas comerciales.</span></h2>
              <p className="mx-auto max-w-2xl text-sm text-muted">{VISIBILITY_PROMISE}</p>
            </Reveal>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {family.map((p, i) => (
                <Reveal key={p.code} as="li" delay={i * 80}>
                  <div className={`relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${p.highlight ? 'animate-pulse-glow border-brass/40 bg-brass/[0.06]' : 'border-line bg-surface hover:border-brass/30'}`}>
                    {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brass px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">Más elegido</span>}
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

        {/* CONFIANZA */}
        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
            <Reveal>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-trust/30 bg-trust/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ok"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Confianza y seguridad</p>
              <h2 className="text-3xl font-bold text-paper md:text-4xl">Hecha para menores, familias y datos reales.</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">Protección de datos, verificación y transparencia no son extras: están en la base de la plataforma.</p>
            </Reveal>
            <ul className="grid gap-3 sm:grid-cols-2">
              {TRUST.map((t, i) => (
                <Reveal key={t} as="li" delay={i * 70}>
                  <div className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-muted"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{t}</div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* PREGUNTAS */}
        <section className="border-t border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-2xl">
            <Reveal className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Resolvemos tus <span className="text-brass">dudas</span></h2>
              <p className="text-muted">Lo que más nos preguntan atletas y familias.</p>
            </Reveal>
            <div className="space-y-2">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-xl border border-line bg-surface px-5 transition-colors open:border-brass/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-paper transition-colors hover:text-brass [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative overflow-hidden px-6 py-28">
          <div className="glow-gold pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2" aria-hidden />
          <Reveal className="relative mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold leading-tight text-paper md:text-5xl">Tu beca empieza<br /><span className="text-gold-gradient">aquí.</span></h2>
            <p className="mx-auto mb-8 max-w-md text-sm text-muted">Unos minutos para crear tu Passport. Cero coste para atletas.</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup?role=athlete" className="group h-12 px-10 font-bold">Crear mi Passport gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
              <ButtonLink href="#test" variant="secondary" className="h-12 px-8">Hacer el test primero</ButtonLink>
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
