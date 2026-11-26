import Link from 'next/link';
import { ArrowRight, BadgeCheck, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import { MobileMenu } from '@/components/PublicMobileMenu';
import { ACTORS } from '@/lib/domain/roles';
import { BRAND } from '@/content/brand';
import { ScrollSolid } from '@/components/landing/elite/Motion';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { makeT } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/locale';

/** Navegación pública (Master Plan 2.0): Oportunidades · Para quién · Herramientas · Recursos · Precios · Seguridad. */
const NAV = [
  { href: '/oportunidades', label: 'Oportunidades' },
  { href: '/herramientas', label: 'Herramientas' },
  { href: '/guia', label: 'Recursos' },
  { href: '/precios', label: 'Precios' },
  { href: '/seguridad', label: 'Seguridad' },
];

/**
 * Cabecera pública fija. Con `overlay` (portada) empieza transparente sobre la foto y se vuelve sólida al hacer scroll;
 * en el resto de páginas es sólida desde el principio y deja su hueco.
 */
/** `locale` solo en páginas traducidas (portada y precios); en el resto la cabecera sigue en castellano y sin selector. */
export function PublicHeader({ overlay = false, locale }: { overlay?: boolean; locale?: Locale }) {
  const tx = makeT(locale ?? 'es');
  const solid = 'border-b border-line/70 bg-ink/90 backdrop-blur-xl';
  return (
    <>
      <ScrollSolid className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500 ${overlay ? 'border-b border-transparent' : solid}`} solidClass={solid}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-brass focus:px-4 focus:py-2 focus:text-sm focus:text-ink">
          {tx('Saltar al contenido')}
        </a>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label={tx('Principal')} className="hidden flex-1 justify-center md:flex">
            <ul className="flex items-center gap-1">
              <li>
                <Link href={NAV[0].href} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-paper">{tx(NAV[0].label)}</Link>
              </li>
              <li className="group relative">
                <Link href="/#para-quien" className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-paper group-focus-within:text-paper">
                  {tx('Para quién')} <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" aria-hidden />
                </Link>
                {/* Desplegable accesible con ratón y teclado (focus-within), sin JavaScript. */}
                <div className="invisible absolute left-1/2 top-full z-50 w-[520px] -translate-x-1/2 pt-2 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="grid grid-cols-2 gap-1 rounded-2xl border border-line-strong bg-surface p-2 shadow-[var(--shadow-premium)]">
                    {ACTORS.map((a) => (
                      <li key={a.role}>
                        <Link href={`/para/${a.slug}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-brass/10">
                          <span className="block text-sm font-semibold text-paper">{tx(a.plural)}</span>
                          <span className="line-clamp-1 block text-xs text-muted">{tx(a.promise)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
              {NAV.slice(1).map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-paper">
                    {tx(n.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <ButtonLink href="/login" variant="ghost" className="h-9 px-3 text-[13px]">{tx('Iniciar sesión')}</ButtonLink>
            <ButtonLink href="/#para-quien" className="h-9 rounded-full px-5 text-[13px] font-bold">{tx('Empezar gratis')}</ButtonLink>
          </div>
          {locale && <LanguageSwitcher current={locale} />}
          <MobileMenu items={[...NAV.map((n) => ({ ...n, label: tx(n.label) })), { href: '/inversores', label: tx('Inversores') }, ...ACTORS.map((a) => ({ href: `/para/${a.slug}`, label: locale === 'en' ? `For ${tx(a.plural).toLowerCase()}` : `Para ${a.plural.toLowerCase()}` }))]} />
        </div>
      </ScrollSolid>
      {overlay ? null : <div className="h-16" aria-hidden />}
    </>
  );
}

/** Llamada final del pie según quién lee la página: en las páginas de agencias no se invita a crear un Passport de atleta. */
const FOOTER_CTA = {
  athlete: { title: 'Empieza hoy, es gratis para atletas', text: 'Tu Passport en minutos. La visibilidad nunca se paga.', href: '/signup?role=athlete', label: 'Crear mi Passport' },
  agent: { title: 'Lleva tu agencia con un solo sistema', text: '30 días gratis. Sin comisión por atleta ni por contactar. Cancelas cuando quieras.', href: '/signup?role=agent&plan=agent_solo', label: 'Probar 30 días gratis' },
} as const;

export function PublicFooter({ locale, audience = 'athlete' }: { locale?: Locale; audience?: keyof typeof FOOTER_CTA } = {}) {
  const tx = makeT(locale ?? 'es');
  const cta = FOOTER_CTA[audience];
  return (
    <footer className="border-t border-line/60 bg-ink">
      <div className="border-b border-line/40">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <div>
            <h3 className="mb-1 text-lg font-bold text-paper">{tx(cta.title)}</h3>
            <p className="text-sm text-muted">{tx(cta.text)}</p>
          </div>
          <ButtonLink href={cta.href} className="group px-6">
            {tx(cta.label)} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </ButtonLink>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-6 py-14 md:grid-cols-5 md:gap-8">
        <div className="col-span-2 md:col-span-2">
          <Logo />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brass">{tx(BRAND.network)}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{tx(BRAND.secondary)}</p>
        </div>
        <nav aria-label={tx('Para quién')}>
          <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-paper">{tx('Para')}</h4>
          <ul className="space-y-2.5 text-sm">
            {ACTORS.map((a) => (
              <li key={a.role}><Link href={`/para/${a.slug}`} className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx(a.plural)}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label={tx('Recursos')}>
          <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-paper">{tx('Recursos')}</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/oportunidades" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Oportunidades')}</Link></li>
            <li><Link href="/herramientas" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Herramientas gratuitas')}</Link></li>
            <li><Link href="/guia" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Guía oficial del proceso')}</Link></li>
            <li><Link href="/test-opciones" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Test de opciones')}</Link></li>
            <li><Link href="/seguridad" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Seguridad y confianza')}</Link></li>
            <li><Link href="/calculadora" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Calculadora de coste real')}</Link></li>
            <li><Link href="/precios" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Planes y precios')}</Link></li>
            <li><Link href="/inversores" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Inversores')}</Link></li>
            <li><Link href="/signup" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Crear cuenta')}</Link></li>
          </ul>
        </nav>
        <nav aria-label={tx('Legal')}>
          <h4 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-paper">{tx('Legal')}</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/legal/privacidad" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Privacidad')}</Link></li>
            <li><Link href="/legal/terminos" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Términos')}</Link></li>
            <li><Link href="/legal/cookies" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Cookies')}</Link></li>
            <li><Link href="/legal/proteccion-menores" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Protección de menores')}</Link></li>
            <li><Link href="/legal/normas" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Normas de la comunidad')}</Link></li>
            <li><Link href="/legal/aviso-legal" className="inline-block py-1 text-muted transition-colors hover:text-brass">{tx('Aviso legal')}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-5 text-xs text-faint md:flex-row">
          <p>© {new Date().getFullYear()} The Gala Alliance · {tx('No garantizamos admisión, becas, contratos ni resultados.')}</p>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brass" aria-hidden />{tx('RGPD')}</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brass" aria-hidden />{tx('Menores protegidos por diseño')}</span>
            <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-brass" aria-hidden />{tx('Organizaciones verificadas')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
