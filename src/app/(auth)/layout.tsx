import { Logo } from '@/components/Logo';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale}>
      <div className="paper-grain flex min-h-dvh flex-col" lang={locale}>
        <header className="px-5 py-6 sm:px-8">
          <Logo />
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:pt-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </I18nProvider>
  );
}
