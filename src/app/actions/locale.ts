'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n/locale';
import { safeRedirectPath } from '@/lib/domain/safe-path';

/** Guarda el idioma elegido con el selector y vuelve a la misma página. */
export async function setLocale(formData: FormData) {
  const lang = formData.get('lang');
  if (isLocale(lang)) {
    (await cookies()).set(LOCALE_COOKIE, lang, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: false });
  }
  redirect(safeRedirectPath(String(formData.get('back') ?? ''), '/'));
}
