'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { makeT, type T } from './t';

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

/** Lleva el idioma de la petición a los componentes de cliente de la app. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}
export function useLocale(): Locale { return useContext(Ctx); }
export function useT(): T {
  const locale = useContext(Ctx);
  return useMemo(() => makeT(locale), [locale]);
}
