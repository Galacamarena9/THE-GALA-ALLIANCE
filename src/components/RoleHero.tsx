import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { AppRole } from '@/lib/types';
import { CountUp } from '@/components/CountUp';

/**
 * Cabecera de inicio por rol: foto ilustrativa, saludo, siguiente paso en lima y cifras reales.
 * Mismo lenguaje visual que el inicio del agente para que toda la app se sienta una.
 */
interface Stat { label: string; value: number; suffix?: string; note?: string; href?: string }
interface Shortcut { href: string; title: string; text: string }

const LEAD: Partial<Record<AppRole, string>> = {
  athlete: 'Tus opciones reales en EE. UU., paso a paso y sin promesas.',
  parent: 'Acompaña el proceso de tu hijo o hija con datos claros y control de su privacidad.',
  university: 'Encuentra talento internacional verificado y gestiona vuestras candidaturas.',
  coach: 'Talento comparable de cualquier país, en un solo escaparate.',
  brand: 'Colaboraciones con atletas mayores de edad, con contrato y entregables claros.',
  admin: 'Verificaciones, denuncias y salud de la plataforma.',
};

export const ROLE_SHORTCUTS: Partial<Record<AppRole, Shortcut[]>> = {
  athlete: [
    { href: '/app/athlete/passport', title: 'Mi Passport', text: 'Lo que ven las universidades' },
    { href: '/app/opportunities', title: 'Becas', text: 'Ofertas con sello de confianza' },
    { href: '/app/share', title: 'Compartir mi perfil', text: 'Enlace privado para coaches' },
  ],
  parent: [
    { href: '/app/family', title: 'Panel familiar', text: 'Lo que necesita tu aprobación' },
    { href: '/app/universities', title: 'Universidades', text: 'Datos oficiales y coste real' },
    { href: '/app/calculator', title: 'Coste a 4 años', text: 'Con viajes, seguro y subidas' },
  ],
  university: [
    { href: '/app/discover', title: 'Escaparate', text: 'Talento filtrable y comparable' },
    { href: '/app/applications', title: 'Candidatos', text: 'Cinco fases, notas privadas' },
    { href: '/app/opportunities/new', title: 'Publicar beca', text: 'Sale al pasar los controles' },
  ],
  coach: [
    { href: '/app/discover', title: 'Escaparate', text: 'Talento filtrable y comparable' },
    { href: '/app/lists', title: 'Listas', text: 'Atletas que sigues' },
    { href: '/app/applications', title: 'Candidatos', text: 'Cinco fases, notas privadas' },
  ],
  brand: [
    { href: '/app/campaigns?view=mine', title: 'Mis campañas', text: 'Candidaturas y entregables' },
    { href: '/app/discover', title: 'Escaparate', text: 'Solo atletas mayores de edad' },
    { href: '/app/lists', title: 'Listas', text: 'Atletas que te interesan' },
  ],
};

export function RoleHero({ role, firstName, status, next, stats }: { role: AppRole; firstName: string; status: string; next?: { label: string; href: string }; stats: Stat[] }) {
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  return (
    <section className="rise-in relative overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
      <div className="court-lines absolute inset-0 opacity-[0.07]" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(55%_90%_at_90%_10%,rgb(201_162_74/0.22),transparent_70%)]" aria-hidden />
      <div className="grain absolute inset-0" aria-hidden />
      <div className="relative p-6 sm:p-8 lg:p-10">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-lavender backdrop-blur">
          <span className="live-dot" aria-hidden /> {status}
        </p>
        <h1 className="font-display text-4xl font-bold uppercase leading-none text-white sm:text-[52px]">{greeting}, <em>{firstName}</em>.</h1>
        <p className="mt-3 max-w-xl text-[15px] text-lavender">{LEAD[role]}</p>
        {next && (
          <Link href={next.href} className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-night transition-transform hover:-translate-y-0.5">
            {next.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        {stats.length > 0 && (
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl">
            {stats.map((s) => (
              <div key={s.label} className={`relative rounded-2xl bg-white/10 px-4 py-3 backdrop-blur transition-colors ${s.href ? 'hover:bg-white/20' : ''}`}>
                <dt className="text-xs text-lavender">{s.href ? <Link href={s.href} className="after:absolute after:inset-0">{s.label}</Link> : s.label}</dt>
                <dd className="font-display text-[34px] font-bold leading-none text-white"><CountUp value={s.value} />{s.suffix}</dd>
                {s.note && <dd className="mt-1 text-xs text-lavender/80">{s.note}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

export function ShortcutTiles({ items }: { items: Shortcut[] }) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3">
      {items.map((s, i) => (
        <li key={s.href} className="bg-ink">
          <Link href={s.href} className="group flex h-full min-h-36 flex-col p-5 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass">
            <span className="font-display text-sm text-brass" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <span className="mt-4 flex items-center justify-between gap-3">
              <span className="font-display text-3xl leading-none text-paper">{s.title}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-paper transition-all group-hover:translate-x-1 group-hover:text-brass" aria-hidden />
            </span>
            <span className="mt-2 block text-sm text-muted">{s.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
