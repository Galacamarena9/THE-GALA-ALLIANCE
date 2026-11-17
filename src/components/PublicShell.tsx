import Link from 'next/link';
import { ArrowRight, BadgeCheck, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import { MobileMenu } from '@/components/PublicMobileMenu';
import { ACTORS } from '@/lib/domain/roles';
import { BRAND } from '@/content/brand';

/** Navegación pública (Master Plan 2.0): Oportunidades · Para quién · Herramientas · Recursos · Precios · Seguridad. */
const NAV = [
  { href: '/oportunidades', label: 'Oportunidades' },
  { href: '/herramientas', label: 'Herramientas' },
  { href: '/guia', label: 'Recursos' },
  { href: '/precios', label: 'Precios' },
  { href: '/seguridad', label: 'Seguridad' },
];

/** Cabecera pública fija con desenfoque, como en la versión de Lovable. */
export function PublicHeader() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-brass/20 bg-ink/85 backdrop-blur-xl">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-brass focus:px-4 focus:py-2 focus:text-sm focus:text-ink">
          Saltar al contenido
        </a>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Principal" className="hidden flex-1 justify-center md:flex">
            <ul className="flex items-center gap-1">
              <li>
                <Link href={NAV[0].href} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-paper">{NAV[0].label}</Link>
              </li>
              <li className="group relative">
                <Link href="/#para-quien" className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-paper group-focus-within:text-paper">
                  Para quién <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" aria-hidden />
                </Link>
                {/* Desplegable accesible con ratón y teclado (focus-within), sin JavaScript. */}
                <div className="invisible absolute left-1/2 top-full z-50 w-[520px] -translate-x-1/2 pt-2 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="grid grid-cols-2 gap-1 rounded-2xl border border-line-strong bg-surface p-2 shadow-[var(--shadow-premium)]">
                    {ACTORS.map((a) => (
                      <li key={a.role}>
                        <Link href={`/para/${a.slug}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-brass/10">
                          <span className="block text-sm font-semibold text-paper">{a.plural}</span>
                          <span className="line-clamp-1 block text-xs text-muted">{a.promise}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
              {NAV.slice(1).map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-paper">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <ButtonLink href="/login" variant="ghost" className="h-9 px-3 text-[13px]">Iniciar sesión</ButtonLink>
            <ButtonLink href="/signup" className="h-9 px-4 text-[13px] font-bold">Crear Passport</ButtonLink>
          </div>
          <MobileMenu items={[...NAV, { href: '/inversores', label: 'Inversores' }, ...ACTORS.map((a) => ({ href: `/para/${a.slug}`, label: `Para ${a.plural.toLowerCase()}` }))]} />
        </div>
      </header>
      <div className="h-16" aria-hidden />
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line/60 bg-ink">
      <div className="border-b border-line/40">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <div>
            <h3 className="mb-1 text-lg font-bold text-paper">Empieza hoy, es gratis para atletas</h3>
            <p className="text-sm text-muted">Tu Passport en minutos. La visibilidad nunca se paga.</p>
          </div>
          <ButtonLink href="/signup?role=athlete" className="group px-6">
            Crear mi Passport <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </ButtonLink>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-6 py-14 md:grid-cols-5 md:gap-8">
        <div className="col-span-2 md:col-span-2">
          <Logo />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brass">{BRAND.network}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{BRAND.secondary}</p>
        </div>
        <nav aria-label="Para quién">
          <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-paper">Para</h4>
          <ul className="space-y-2.5 text-sm">
            {ACTORS.map((a) => (
              <li key={a.role}><Link href={`/para/${a.slug}`} className="text-muted transition-colors hover:text-brass">{a.plural}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Recursos">
          <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-paper">Recursos</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/oportunidades" className="text-muted transition-colors hover:text-brass">Oportunidades</Link></li>
            <li><Link href="/herramientas" className="text-muted transition-colors hover:text-brass">Herramientas gratuitas</Link></li>
            <li><Link href="/guia" className="text-muted transition-colors hover:text-brass">Guía oficial del proceso</Link></li>
            <li><Link href="/#test" className="text-muted transition-colors hover:text-brass">Test de opciones</Link></li>
            <li><Link href="/seguridad" className="text-muted transition-colors hover:text-brass">Seguridad y confianza</Link></li>
            <li><Link href="/calculadora" className="text-muted transition-colors hover:text-brass">Calculadora de coste real</Link></li>
            <li><Link href="/precios" className="text-muted transition-colors hover:text-brass">Planes y precios</Link></li>
            <li><Link href="/inversores" className="text-muted transition-colors hover:text-brass">Inversores</Link></li>
            <li><Link href="/signup" className="text-muted transition-colors hover:text-brass">Crear cuenta</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-paper">Legal</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/legal/privacidad" className="text-muted transition-colors hover:text-brass">Privacidad</Link></li>
            <li><Link href="/legal/terminos" className="text-muted transition-colors hover:text-brass">Términos</Link></li>
            <li><Link href="/legal/cookies" className="text-muted transition-colors hover:text-brass">Cookies</Link></li>
            <li><Link href="/legal/proteccion-menores" className="text-muted transition-colors hover:text-brass">Protección de menores</Link></li>
            <li><Link href="/legal/normas" className="text-muted transition-colors hover:text-brass">Normas de la comunidad</Link></li>
            <li><Link href="/legal/aviso-legal" className="text-muted transition-colors hover:text-brass">Aviso legal</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-5 text-xs text-faint md:flex-row">
          <p>© {new Date().getFullYear()} The Gala Alliance · No garantizamos admisión, becas, contratos ni resultados.</p>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brass" aria-hidden />RGPD</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brass" aria-hidden />Menores protegidos por diseño</span>
            <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-brass" aria-hidden />Organizaciones verificadas</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
