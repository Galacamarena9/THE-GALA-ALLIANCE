import type { Metadata } from 'next';
import {
  ArrowRight, BadgeCheck, Briefcase, Building2, CircleCheck, Coins, Database, GraduationCap, Layers, LineChart, Lock, Network,
  Rocket, Scale, ShieldCheck, Target, Workflow,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { ButtonLink } from '@/components/ui';
import { Reveal } from '@/components/Reveal';
import { getT } from '@/lib/i18n/server-t';
import { publicMeta } from '@/lib/seo/page-meta';

export async function generateMetadata(): Promise<Metadata> {
  const tx = await getT();
  return publicMeta({
    title: tx('Inversores'),
    description: tx('The Gala Alliance: el software de trabajo de las agencias que llevan talento europeo a la NCAA, sobre una red gratuita para atletas, familias y clubes. Modelo, ventajas y hoja de ruta.'),
    path: '/inversores',
    locale: tx.locale,
  });
}

/**
 * Tesis para inversores (QA web #14/#15): un solo mensaje (la agencia es el cliente que paga; atletas, familias y clubes
 * no pagan por estar) y solo afirmaciones que el producto respalda hoy. Nada de cifras sin fuente ni promesas de coste cero.
 */
const FAILURES = [
  { Icon: Scale, theory: 'Información asimétrica (Akerlof)', text: 'Universidades que no pueden verificar al atleta y familias que no ven el coste real: el mercado premia a quien tiene contactos, no a quien tiene nivel.' },
  { Icon: Coins, theory: 'Costes de transacción (Williamson)', text: 'Cada proceso exige coordinar a atleta, familia, club, agencia y universidad en otro idioma, con plazos opacos y la información repartida entre hojas de cálculo, emails y WhatsApp.' },
  { Icon: Network, theory: 'Mercado multilado (Rochet y Tirole)', text: 'Seis actores que se necesitan entre sí sin un lugar común de confianza: cada lado espera a que el otro esté para entrar.' },
  { Icon: GraduationCap, theory: 'Capacidades (Sen)', text: 'Talento que no llega a optar por falta de información, idioma o recursos: una pérdida para el atleta y para las universidades.' },
];

const MOAT = [
  { Icon: Briefcase, title: 'Hecho para el día a día de la agencia', text: 'Cartera importable desde Excel, procesos en 5 fases con próxima acción, tareas, bandeja y equipo con roles. La agencia lo paga porque le ahorra trabajo, no por aparecer.' },
  { Icon: ShieldCheck, title: 'Confianza como producto', text: 'Organizaciones verificadas por dominio oficial, sello de confianza en 5 niveles en cada beca y detector de señales de alarma.' },
  { Icon: Lock, title: 'Seguridad de menores por diseño', text: 'Permisos en la base de datos (no solo en la interfaz), circuito familiar y más de cien pruebas automáticas de acceso.' },
  { Icon: Database, title: 'Datos oficiales', text: 'Universidades con datos del U.S. Department of Education y fuente visible en cada cifra.' },
  { Icon: Workflow, title: 'Automatización donde aporta', text: 'La verificación por dominio, la publicación de ofertas que superan los controles, la ocultación preventiva por denuncias y la baja de cuenta funcionan solas. Lo que no supera las reglas y la decisión final de moderación pasan por una persona.' },
  { Icon: Scale, title: 'Cumplimiento NCAA y NIL integrado', text: 'La base de datos impide que una universidad D-I o D-II contacte antes de la ventana NCAA, y cada colaboración con marcas avisa de la declaración en NIL Go desde 600 $.' },
];

const REVENUE = [
  { who: 'Agencias de recruiting', what: 'Agency Core: cartera, procesos atleta-universidad, contactos de programas, tareas e historial en equipo', note: 'Agente 79 €/mes · Agencia 199 €/mes · desde 449 €/mes para grandes (precio fundador −40 % de por vida para las 15 primeras, 30 días de prueba). Producto construido; sin agencias de pago todavía. Sin comisiones ni cobro por contactar.' },
  { who: 'Familias', what: 'Servicios opcionales Core 247 € y Elite 497 € (pago único) · Signature a medida (1:1)', note: 'Crear la cuenta es gratis. El cobro online se activará cuando estén cerrados los textos legales.' },
  { who: 'Universidades y coaches', what: 'Recruit: gratis en el piloto', note: 'Hipótesis de suscripción anual, a validar con el piloto.' },
  { who: 'Academias y clubes', what: 'Portal de roster gratis en el piloto', note: 'Canal: un club trae a varios atletas a la vez.' },
  { who: 'Marcas', what: 'Campañas con atletas mayores de edad', note: 'Solo tras revisión legal de contratos, fiscalidad e inmigración.' },
];

const ROADMAP = [
  { phase: 'Ahora', title: 'Producto construido, en piloto', items: ['Plataforma de seis actores', 'Herramienta de trabajo para agencias (Agency Core) con 30 días de prueba', 'Integración de pagos preparada; cobro online pendiente de los textos legales', 'Documentación legal en revisión'] },
  { phase: '0–3 meses', title: 'Primeras agencias', items: ['Agencias piloto con su cartera real dentro', 'Academias y clubes como canal de atletas', 'North Star: procesos activos por agencia'] },
  { phase: '3–12 meses', title: 'Escala', items: ['Suscripción para universidades si el piloto la valida', 'Nuevos mercados y deportes', 'Campañas de marca con revisión legal'] },
];

export default async function InvestorsPage() {
  const tx = await getT();
  const email = process.env.NEXT_PUBLIC_INVESTOR_EMAIL;
  return (
    <div className="relative" lang={tx.locale}>
      <PublicHeader locale={tx.locale} />
      <main id="main-content">
        <section className="relative overflow-hidden px-6 pb-24 pt-20">
          <div className="bg-grid absolute inset-0" aria-hidden />
          <div className="glow-gold pointer-events-none absolute -right-40 -top-20 h-[620px] w-[620px]" aria-hidden />
          <div className="relative mx-auto max-w-5xl text-center">
            <p className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-4 py-1.5 text-xs font-medium text-brass"><LineChart className="h-3.5 w-3.5" aria-hidden /> {tx('Para inversores')}</p>
            <h1 className="animate-fade-in-up text-4xl font-bold leading-[1.05] tracking-tight text-paper [animation-delay:80ms] md:text-6xl">
              {tx('El sistema de trabajo de las agencias que llevan')}{' '}<span className="text-gold-gradient">{tx('talento europeo a la NCAA.')}</span>
            </h1>
            <p className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted [animation-delay:160ms] md:text-lg">
              {tx('Una red gratuita para atletas, familias y clubes, y un software de pago para las agencias que los acompañan: cartera, procesos con cada universidad y documentos en un solo sitio, con información verificable.')}
            </p>
            <div className="animate-fade-in-up mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
              {email ? (
                <ButtonLink href={`mailto:${email}?subject=The%20Gala%20Alliance%20%C2%B7%20Inversi%C3%B3n`} className="group h-12 px-8 font-bold">{tx('Hablar con la fundadora')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
              ) : (
                <ButtonLink href="/demo/agente" className="group h-12 px-8 font-bold">{tx('Ver la demo de agencia')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
              )}
              <ButtonLink href="/precios" variant="secondary" className="h-12 px-8">{tx('Ver el modelo de precios')}</ButtonLink>
            </div>
          </div>
        </section>

        <section className="border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-semibold text-muted">{tx('El problema')}</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">{tx('Un mercado con')}{' '}<span className="text-brass">{tx('fallos documentados.')}</span></h2>
              <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">{tx('La tesis nace de un trabajo académico sobre los fallos de mercado del reclutamiento deportivo internacional y de la experiencia de la fundadora como jugadora NCAA.')}</p>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2">
              {FAILURES.map(({ Icon, theory, text }, i) => (
                <Reveal key={theory} delay={i * 80}>
                  <article className="flex h-full gap-5 rounded-2xl border border-line bg-surface p-7 transition-all hover:border-brass/40">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brass/10"><Icon className="h-5 w-5 text-brass" aria-hidden /></span>
                    <div><h3 className="mb-2 text-lg font-bold text-paper">{tx(theory)}</h3><p className="text-sm leading-relaxed text-muted">{tx(text)}</p></div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-14 max-w-3xl text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-semibold text-muted">{tx('Por qué ganamos')}</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">{tx('Ventajas difíciles de copiar.')}</h2>
            </Reveal>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MOAT.map(({ Icon, title, text }, i) => (
                <Reveal key={title} as="li" delay={(i % 3) * 80}>
                  <div className="h-full rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brass/40 hover:shadow-[var(--shadow-elevated)]">
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2"><Icon className="h-5 w-5 text-brass" aria-hidden /></span>
                    <h3 className="mb-2 font-bold text-paper">{tx(title)}</h3>
                    <p className="text-sm leading-relaxed text-muted">{tx(text)}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-line/50 bg-surface/40 px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-12 text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-semibold text-muted">{tx('Modelo de ingresos')}</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">{tx('La agencia paga.')}{' '}<span className="text-brass">{tx('La visibilidad nunca se vende.')}</span></h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">{tx('Atletas, familias y clubes no pagan por estar ni por aparecer. Se cobra por herramientas de trabajo y servicios concretos, nunca por prioridad.')}</p>
            </Reveal>
            <div className="overflow-hidden rounded-2xl border border-line">
              {REVENUE.map((r, i) => (
                <Reveal key={r.who} delay={i * 70}>
                  <div className={`grid gap-2 p-6 md:grid-cols-[200px_1fr] ${i ? 'border-t border-line' : ''} bg-surface`}>
                    <p className="flex items-center gap-2 font-bold text-paper"><Building2 className="h-4 w-4 text-brass" aria-hidden />{tx(r.who)}</p>
                    <div><p className="text-sm text-paper/90">{tx(r.what)}</p><p className="mt-1 text-xs text-faint">{tx(r.note)}</p></div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-12 text-center">
              <p className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-semibold text-muted">{tx('Hoja de ruta')}</p>
              <h2 className="text-3xl font-bold tracking-tight text-paper md:text-5xl">{tx('Del producto a la')}{' '}<span className="text-brass">{tx('red.')}</span></h2>
            </Reveal>
            <ol className="grid gap-5 md:grid-cols-3">
              {ROADMAP.map((r, i) => (
                <Reveal key={r.phase} as="li" delay={i * 100}>
                  <div className={`h-full rounded-2xl border p-6 ${i === 0 ? 'border-brass/40 bg-brass/[0.06]' : 'border-line bg-surface'}`}>
                    <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-brass">{i === 0 ? <Rocket className="h-3.5 w-3.5" aria-hidden /> : <Target className="h-3.5 w-3.5" aria-hidden />}{tx(r.phase)}</p>
                    <h3 className="mb-4 text-lg font-bold text-paper">{tx(r.title)}</h3>
                    <ul className="space-y-2">{r.items.map((x) => <li key={x} className="flex items-start gap-2 text-sm text-muted"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{tx(x)}</li>)}</ul>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-line/50 bg-surface/40 px-6 py-24">
          <Reveal className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[minmax(0,320px)_1fr]">
            <figure className="relative mx-auto w-full max-w-[320px]">
              <div className="overflow-hidden rounded-3xl shadow-[var(--shadow-premium)] ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto local optimizada */}
                <img src="/media/founder-portrait-sm.webp" alt={tx('Gala, fundadora de The Gala Alliance, en la pista antes de un tiro libre')} loading="lazy" className="aspect-[4/5] w-full object-cover object-top" />
              </div>
              <span className="absolute -right-3 -top-3 rounded-full bg-lime px-3 py-1.5 font-display text-sm font-bold uppercase text-night shadow-lg">NCAA D-I</span>
            </figure>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-brass">{tx('La fundadora')}</p>
              <h2 className="text-2xl font-bold text-paper md:text-3xl">{tx('Gala vivió el problema desde dentro.')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {tx('Exjugadora de baloncesto NCAA División I con beca completa en la University of Evansville, graduada en International Business (Universitat de València y Newcastle University) y auditora. Conoce el proceso como atleta y el negocio como analista.')}
              </p>
              <ul className="mt-5 flex flex-wrap gap-2 text-xs">
                {['NCAA D-I', 'International Business', 'Auditoría'].map((t) => <li key={t} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-muted"><BadgeCheck className="h-3.5 w-3.5 text-brass" aria-hidden />{tx(t)}</li>)}
              </ul>
            </div>
          </Reveal>
        </section>

        <section className="relative overflow-hidden px-6 py-24">
          <div className="glow-gold pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[780px] -translate-x-1/2 -translate-y-1/2" aria-hidden />
          <Reveal className="relative mx-auto max-w-2xl text-center">
            <Layers className="mx-auto mb-5 h-8 w-8 text-brass" aria-hidden />
            <h2 className="text-3xl font-bold text-paper md:text-4xl">{tx('Mira el producto funcionando.')}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">{tx('Recorre el espacio de una agencia con datos de ejemplo, sin registrarte: tareas del día, procesos en 5 fases y cartera de atletas.')}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/demo/agente" className="group h-12 px-8 font-bold">{tx('Ver la demo de agencia')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></ButtonLink>
              {email && <ButtonLink href={`mailto:${email}`} variant="secondary" className="h-12 px-8">{tx('Escribir a la fundadora')}</ButtonLink>}
            </div>
          </Reveal>
        </section>
      </main>
      <PublicFooter locale={tx.locale} audience="agent" />
    </div>
  );
}
