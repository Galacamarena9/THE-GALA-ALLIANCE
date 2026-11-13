import { existsSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Bot, Building2, Calculator, ChevronDown, CircleCheck, Columns3, Eye, FileText,
  GraduationCap, Handshake, IdCard, Megaphone, LayoutGrid, Lock, MessageSquare, Scale, School, Search, ShieldCheck, Sparkles, Star, Trophy, Users,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { Reveal } from '@/components/Reveal';
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
  const family = PLANS.filter((p) => p.audience === 'athlete' || p.audience === 'family');
  return (
    <div className="relative">
      <PublicHeader />

      <main id="main-content">
        {/* HERO */}
        <section aria-label="Presentación" className="relative -mt-16 flex min-h-[min(92vh,880px)] items-center overflow-hidden pt-16">
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

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.25fr_1fr]">
            <div className="max-w-3xl space-y-7">
              <p className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/75 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-trust" aria-hidden /> La red de confianza para becas deportivas en EE. UU.
              </p>
              <h1 className="animate-fade-in-up text-4xl font-bold leading-[1.05] tracking-tight text-white [animation-delay:80ms] md:text-6xl lg:text-[4.25rem]">
                Si tienes nivel, tienes que poder optar. <span className="text-gold-gradient">Tengas o no los contactos.</span>
              </h1>
              <p className="animate-fade-in-up max-w-2xl text-base leading-relaxed text-white/65 [animation-delay:160ms] md:text-lg">
                Tu perfil deportivo y académico, visible para universidades y clubes verificados. Coste real, plazos y documentos en un solo lugar.{' '}
                <strong className="text-white/90">Como un LinkedIn del deporte, pero pensado para conseguir la beca.</strong>
              </p>
              <div className="animate-fade-in-up flex flex-col items-start gap-3 pt-1 [animation-delay:240ms] sm:flex-row">
                <ButtonLink href="/signup?role=athlete" className="group h-12 px-8 text-sm font-bold">
                  Crea tu Passport gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/para/universidades" variant="secondary" className="h-12 border-white/20 px-8 text-sm text-white/85 hover:bg-white/5">
                  Soy universidad o club
                </ButtonLink>
              </div>
              <ul className="animate-fade-in-up flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs text-white/55 [animation-delay:320ms]">
                <li className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" aria-hidden />Gratis para atletas</li>
                <li className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Solo organizaciones verificadas</li>
                <li className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden />Menores protegidos por diseño</li>
              </ul>
            </div>

            {/* Vista previa del producto: un Passport de ejemplo con sello y encaje. */}
            <div className="relative hidden lg:block" aria-label="Ejemplo de Passport">
              <div className="animate-float rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[var(--shadow-premium)] backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brass to-brass-deep font-display text-xl font-bold text-ink">LM</span>
                  <div>
                    <p className="font-display text-lg font-bold text-paper">Lucía M.</p>
                    <p className="text-xs text-muted">Baloncesto · Base · Promoción 2027</p>
                  </div>
                  <span className="ml-auto rounded-full border border-trust/40 bg-trust/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ok">Verificado</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[['14,2', 'Puntos'], ['8,7', 'Nota media'], ['C1', 'Inglés']].map(([v, l]) => (
                    <div key={l} className="rounded-xl border border-line bg-ink/60 p-3"><p className="font-display text-lg font-bold text-paper">{v}</p><p className="text-[10px] text-faint">{l}</p></div>
                  ))}
                </div>
                <div className="mt-5 space-y-2">
                  {[['State University · NCAA D-I', 'Encaje alto', 'ok'], ['Lakeside College · NAIA', 'Encaje medio', 'brass']].map(([u, f, t]) => (
                    <div key={u} className="flex items-center justify-between rounded-xl border border-line bg-ink/40 px-3 py-2.5 text-xs">
                      <span className="text-paper">{u}</span>
                      <span className={t === 'ok' ? 'text-ok' : 'text-brass'}>{f}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-faint">Sello</span>
                  {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= 4 ? 'bg-brass' : 'bg-line'}`} />)}
                  <span className="text-xs font-bold text-paper">4/5</span>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-surface/90 px-4 py-3 shadow-[var(--shadow-elevated)] backdrop-blur-xl [animation-delay:1.2s] animate-float">
                <Eye className="h-5 w-5 text-brass" aria-hidden />
                <div className="text-xs"><p className="font-semibold text-paper">Universidad verificada</p><p className="text-faint">quiere contactar contigo</p></div>
              </div>
              <p className="mt-10 text-center text-[11px] text-faint">Ejemplo ilustrativo</p>
            </div>
          </div>
        </section>

        {/* CIFRAS */}
        <section className="border-y border-line/50 px-6 py-14">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map(({ Icon, value, label }, i) => (
              <Reveal key={label} delay={i * 80} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2"><Icon className="h-[18px] w-[18px] text-brass" aria-hidden /></div>
                <p className="font-display text-2xl font-bold tracking-tight text-paper md:text-3xl">{value}</p>
                <p className="mt-1 text-xs text-muted">{label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* POR QUÉ */}
        <section className="px-6 py-24">
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
                    <div className="mb-5 flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brass/10 font-display text-lg font-bold text-brass">{f.n}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-faint">Hoy</span>
                    </div>
                    <h3 className="mb-3 text-lg font-bold leading-snug text-paper">{f.title}</h3>
                    <p className="mb-5 text-sm leading-relaxed text-muted">{f.today}</p>
                    <p className="mt-auto border-t border-line pt-4 text-sm leading-relaxed text-paper/85"><span className="font-semibold text-trust">Con Gala:</span> {f.fix}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-20 border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Cómo funciona</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-paper md:text-5xl">De perfil a <span className="text-brass">beca firmada</span> en 4 pasos.</h2>
              <p className="text-sm leading-relaxed text-muted md:text-base">Sin pagar por visibilidad, sin intermediarios opacos y con la familia siempre informada.</p>
            </Reveal>
            <ol className="space-y-4">
              {STEPS.map(([title, text], i) => {
                const icons = [IdCard, Search, MessageSquare, Scale];
                const Icon = icons[i];
                return (
                  <Reveal key={title} as="li" variant="left" delay={i * 90}>
                    <div className="group relative flex items-start gap-6 overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-brass/10 to-transparent p-6 transition-all hover:border-brass/40 md:p-7">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink transition-transform group-hover:scale-105"><Icon className="h-6 w-6 text-paper/85" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brass">Paso {i + 1}</p>
                        <h3 className="mb-2 text-lg font-bold leading-snug text-paper md:text-xl">{title}</h3>
                        <p className="text-sm leading-relaxed text-muted">{text}</p>
                      </div>
                      <span className="hidden font-display text-5xl font-black text-line-strong/70 md:block" aria-hidden>0{i + 1}</span>
                    </div>
                  </Reveal>
                );
              })}
            </ol>
            <Reveal className="mt-12 text-center">
              <ButtonLink href="/signup" className="group h-12 px-10 font-semibold">Empezar gratis ahora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
            </Reveal>
          </div>
        </section>

        {/* HERRAMIENTAS */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Herramientas que funcionan hoy.</h2>
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
        <section id="para-quien" className="scroll-mt-20 bg-surface/50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">¿Quién eres? Tenemos un espacio para ti.</h2>
              <p className="mx-auto max-w-md text-sm text-muted">Seis perfiles en la misma red, cada uno con sus herramientas.</p>
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
                        {a.services.slice(0, 4).map((s) => (
                          <li key={s} className="flex items-start gap-2 text-xs text-muted"><CircleCheck className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${featured ? 'text-brass' : 'text-faint'}`} aria-hidden />{s}</li>
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
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold text-paper md:text-4xl">Gratis para atletas. <span className="text-brass">Ayuda experta para quien la quiera.</span></h2>
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
        <section className="border-y border-line/50 bg-surface/40 px-6 py-20">
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

        {/* CTA FINAL */}
        <section className="relative overflow-hidden px-6 py-28">
          <div className="glow-gold pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2" aria-hidden />
          <Reveal className="relative mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold leading-tight text-paper md:text-5xl">Tu beca empieza<br /><span className="text-gold-gradient">aquí.</span></h2>
            <p className="mx-auto mb-8 max-w-md text-sm text-muted">Unos minutos para crear tu Passport. Cero coste para atletas.</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup?role=athlete" className="group h-12 px-10 font-bold">Crear mi Passport gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
              <ButtonLink href="/guia" variant="secondary" className="h-12 px-8">Leer la guía primero</ButtonLink>
            </div>
          </Reveal>
        </section>

        {/* PREGUNTAS */}
        <section className="px-6 pb-24">
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
