/** Token del captcha enviado por el formulario (undefined si el captcha no está activado). */
export function captchaToken(formData: FormData): string | undefined {
  const t = formData.get('cf-turnstile-response');
  return typeof t === 'string' && t.length > 0 ? t : undefined;
}
