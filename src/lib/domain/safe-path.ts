/**
 * Redirecciones internas seguras (evita open redirects vía ?next=).
 * Solo rutas propias: empiezan por una barra, sin `//`, sin `\` (los navegadores la convierten en `/`),
 * sin `..` y con caracteres de ruta y query simples.
 */
const SAFE_PATH = /^\/[A-Za-z0-9_\-./]*(\?[A-Za-z0-9_\-=&%.]*)?$/;

export function safeRedirectPath(next: string | null | undefined, fallback = '/app'): string {
  if (!next || next.length > 300) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || next.includes('..')) return fallback;
  return SAFE_PATH.test(next) ? next : fallback;
}

/** Destinos a los que se vuelve tras crear la cuenta (invitaciones y la app). Si no, ninguno. */
const AFTER_SIGNUP = ['/invite', '/join', '/roster', '/difusion', '/oportunidades', '/precios', '/app'];
export function afterSignupPath(next: string | null | undefined): string | null {
  const p = safeRedirectPath(next, '');
  return p && AFTER_SIGNUP.some((root) => p === root || p.startsWith(`${root}/`) || p.startsWith(`${root}?`)) ? p : null;
}
