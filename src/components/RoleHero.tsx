import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { AppRole } from '@/lib/types';
import { CountUp } from '@/components/CountUp';

/**
 * Cabecera de inicio por rol: foto ilustrativa, saludo, siguiente paso en lima y cifras reales.
 * Mismo lenguaje visual que el inicio del agente para que toda la app se sienta una.
 */
interface Stat { label: string; value: number; suffix?: string; note?: string; href?: string }
interface Shortcut { href: string; title: string; text: string; img: string }

const HERO_IMG: Partial<Record<AppRole, string>> = {
  athlete: '/media/hero-athletes.webp',
  parent: '/media/university-campus.webp',
  university: '/media/university-campus.webp',
  coach: '/media/club-training.webp',
  brand: '/media/agent-workspace.webp',
  admin: '/media/arena-bg.webp',
};

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
    { href: '/app/athlete/passport', title: 'Mi Passport', text: 'Lo que ven las universidades', img: '/media/hero-athletes.webp' },
    { href: '/app/opportunities', title: 'Becas', text: 'Ofertas con sello de confianza', img: '/media/university-campus.webp' },
    { href: '/app/share', title: 'Compartir mi perfil', text: 'Enlace privado para coaches', img: '/media/club-training.webp' },
  ],
  parent: [
    { href: '/app/family', title: 'Panel familiar', text: 'Lo que necesita tu aprobación', img: '/media/hero-athletes.webp' },
    { href: '/app/universities', title: 'Universidades', text: 'Datos oficiales y coste real', img: '/media/university-campus.webp' },
    { href: '/app/calculator', title: 'Coste a 4 años', text: 'Con viajes, seguro y subidas', img: '/media/agent-workspace.webp' },
  ],
  university: [
    { href: '/app/discover', title: 'Escaparate', text: 'Talento filtrable y comparable', img: '/media/hero-athletes.webp' },
    { href: '/app/applications', title: 'Candidatos', text: 'Cinco fases, notas privadas', img: '/media/club-training.webp' },
    { href: '/app/opportunities/new', title: 'Publicar beca', text: 'Sale al pasar los controles', img: '/media/university-campus.webp' },
  ],
  coach: [
    { href: '/app/discover', title: 'Escaparate', text: 'Talento filtrable y comparable', img: '/media/hero-athletes.webp' },
    { href: '/app/lists', title: 'Listas', text: 'Atletas que sigues', img: '/media/club-training.webp' },
    { href: '/app/applications', title: 'Candidatos', text: 'Cinco fases, notas privadas', img: '/media/university-campus.webp' },
  ],
  brand: [
    { href: '/app/campaigns?view=mine', title: 'Mis campañas', text: 'Candidaturas y entregables', img: '/media/agent-workspace.webp' },
    { href: '/app/discover', title: 'Escaparate', text: 'Solo atletas mayores de edad', img: '/media/hero-athletes.webp' },
    { href: '/app/lists', title: 'Listas', text: 'Atletas que te interesan', img: '/media/club-training.webp' },
  ],
};

export function RoleHero({ role, firstName, status, next, stats }: { role: AppRole; firstName: string; status: string; next?: { label: string; href: string }; stats: Stat[] }) {
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  return (
    <section className="rise-in relative overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local (WebP) */}
      <img src={HERO_IMG[role] ?? '/media/arena-bg.webp'} alt="" aria-hidden className="photo-grade absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/25" aria-hidden />
      <div className="relative p-6 sm:p-8 lg:p-10">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-lavender backdrop-blur">
          <span className="live-dot" aria-hidden /> {status}
        </p>
        <h1 className="font-display text-4xl font-bold uppercase leading-none text-white sm:text-[52px]">{greeting}, <em>{firstName}</em></h1>
        <p className="mt-3 max-w-xl text-[15px] text-lavender">{LEAD[role]}</p>
        {next && (
          <Link href={next.href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-night transition-transform hover:-translate-y-0.5">
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
    <div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="tile-shade hover-lift group relative block h-36 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto ilustrativa local (WebP) */}
              <img src={s.img} srcSet={`${s.img.replace(".webp", "-sm.webp")} 720w, ${s.img} 1600w`} sizes="(min-width: 1024px) 30vw, 100vw" alt="" aria-hidden loading="lazy" decoding="async" className="photo-grade absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/40 to-transparent" aria-hidden />
              <span className="absolute bottom-3 left-4 right-4">
                <span className="block font-display text-xl font-bold uppercase leading-none text-white">{s.title}</span>
                <span className="mt-1 block text-xs text-lavender">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">Imágenes ilustrativas.</p>
    </div>
  );
}
