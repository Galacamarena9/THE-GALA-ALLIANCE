'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { makeT, type T } from './t';

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Lleva el idioma de la petición a los componentes de cliente de la app y ajusta `<html lang>` al idioma de la
 * pantalla (el layout raíz deja `es` fijo para no volver dinámicas las páginas estáticas, que solo existen en castellano).
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = locale;
    return () => { root.lang = previous || DEFAULT_LOCALE; };
  }, [locale]);
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}
export function useLocale(): Locale { return useContext(Ctx); }
export function useT(): T {
  const locale = useContext(Ctx);
  return useMemo(() => makeT(locale), [locale]);
}
