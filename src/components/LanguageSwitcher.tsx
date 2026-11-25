'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { setLocale } from '@/app/actions/locale';
import type { Locale } from '@/lib/i18n/locale';

/** Selector de idioma (castellano / English). Sin JavaScript también funciona: es un formulario. */
export function LanguageSwitcher({ current, className = '' }: { current: Locale; className?: string }) {
  const path = usePathname();
  const qs = useSearchParams()?.toString();
  const back = qs ? `${path}?${qs}` : path;
  return (
    <form action={setLocale} className={`inline-flex items-center gap-1 text-xs ${className}`} aria-label={current === 'en' ? 'Language' : 'Idioma'}>
      <input type="hidden" name="back" value={back} />
      {([['es', 'ES', 'Castellano'], ['en', 'EN', 'English']] as const).map(([code, short, name]) => (
        <button
          key={code}
          type="submit"
          name="lang"
          value={code}
          lang={code}
          aria-pressed={current === code}
          className={`rounded-lg px-2 py-1 font-semibold transition-colors ${current === code ? 'bg-brass/15 text-brass' : 'text-faint hover:text-paper'}`}
        >
          {short}<span className="sr-only"> · {name}</span>
        </button>
      ))}
    </form>
  );
}
