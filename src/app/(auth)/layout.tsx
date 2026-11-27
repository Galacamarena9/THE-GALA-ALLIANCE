import { Logo } from '@/components/Logo';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';
import { makeT } from '@/lib/i18n/t';

/** Acceso (entrar, crear cuenta, contraseña): formulario a la izquierda y, en escritorio, panel «Estadio» con foto. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const tx = makeT(locale);
  return (
    <I18nProvider locale={locale}>
      <div className="flex min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" lang={locale}>
        <div className="paper-grain flex min-h-dvh w-full flex-col">
          <header className="px-5 py-6 sm:px-8">
            <Logo />
          </header>
          <main id="main-content" className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:pt-12 lg:items-center lg:pt-0">
            <div className="w-full max-w-md">{children}</div>
          </main>
        </div>
        <aside
          className="stadium m-4 hidden flex-col justify-between p-10 lg:flex xl:p-14"
          style={{ ['--stadium-photo' as string]: 'url(/media/hero-athletes.webp)' }}
          aria-label={tx('The Gala Alliance')}
        >
          <p className="stadium-tag self-start"><span>{tx('The Global Sports Opportunity Network')}</span></p>
          <div>
            <p className="font-display text-[3.2rem] leading-[0.92] text-white xl:text-[4rem]">
              {tx('Si tienes nivel, tienes que poder')} <em>{tx('optar.')}</em>
            </p>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">{tx('Tu Passport en minutos. La visibilidad nunca se paga.')}</p>
            <ul className="mt-8 flex flex-wrap gap-2.5 text-xs font-bold uppercase tracking-wide">
              {[tx('Organizaciones verificadas'), tx('Menores protegidos por diseño'), tx('RGPD')].map((s) => (
                <li key={s} className="rounded-full border border-line-strong bg-ink/50 px-3.5 py-1.5 text-paper backdrop-blur-sm">{s}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </I18nProvider>
  );
}
