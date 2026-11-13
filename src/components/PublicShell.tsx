import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import { ACTORS } from '@/lib/domain/roles';

/** Cabecera pública: secciones por tipo de usuario + servicios comunes. */
export function PublicHeader() {
  return (
    <header className="relative z-10 border-b border-line/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo />
        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="flex items-center gap-1 text-[13px]">
            {ACTORS.map((a) => (
              <li key={a.role}><Link href={`/para/${a.slug}`} className="rounded-full px-3 py-1.5 text-muted hover:bg-surface hover:text-paper">{a.plural}</Link></li>
            ))}
            <li className="mx-1 h-4 w-px bg-line-strong" aria-hidden />
            <li><Link href="/guia" className="rounded-full px-3 py-1.5 text-muted hover:bg-surface hover:text-paper">Guía</Link></li>
            <li><Link href="/calculadora" className="rounded-full px-3 py-1.5 text-muted hover:bg-surface hover:text-paper">Calculadora</Link></li>
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" className="px-3">Entrar</ButtonLink>
          <ButtonLink href="/signup" className="whitespace-nowrap px-3 sm:px-4">Crear cuenta</ButtonLink>
        </div>
      </div>
      <nav aria-label="Secciones" className="overflow-x-auto border-t border-line/60 px-3 lg:hidden">
        <ul className="flex gap-1 py-2 text-xs">
          {ACTORS.map((a) => <li key={a.role}><Link href={`/para/${a.slug}`} className="block whitespace-nowrap rounded-full px-3 py-1 text-muted">{a.plural}</Link></li>)}
          <li><Link href="/guia" className="block rounded-full px-3 py-1 text-muted">Guía</Link></li>
          <li><Link href="/calculadora" className="block rounded-full px-3 py-1 text-muted">Calculadora</Link></li>
        </ul>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm text-faint sm:grid-cols-3 sm:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs">La plataforma de confianza para el reclutamiento deportivo internacional.</p>
        </div>
        <nav aria-label="Para quién">
          <p className="mb-2 text-paper">Para</p>
          <ul className="space-y-1.5">{ACTORS.map((a) => <li key={a.role}><Link href={`/para/${a.slug}`} className="hover:text-paper">{a.plural}</Link></li>)}</ul>
        </nav>
        <nav aria-label="Legal">
          <p className="mb-2 text-paper">Legal y confianza</p>
          <ul className="space-y-1.5">
            <li><Link href="/legal/privacidad" className="hover:text-paper">Privacidad</Link></li>
            <li><Link href="/legal/terminos" className="hover:text-paper">Términos</Link></li>
            <li><Link href="/legal/cookies" className="hover:text-paper">Cookies</Link></li>
            <li><Link href="/legal/proteccion-menores" className="hover:text-paper">Protección de menores</Link></li>
            <li><Link href="/legal/normas" className="hover:text-paper">Normas de la comunidad</Link></li>
            <li><Link href="/legal/aviso-legal" className="hover:text-paper">Aviso legal</Link></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-line py-5 text-center text-xs text-faint">© {new Date().getFullYear()} The Gala Alliance · No garantizamos admisión, becas ni resultados.</p>
    </footer>
  );
}
