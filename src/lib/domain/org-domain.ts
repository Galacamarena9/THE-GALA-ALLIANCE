/**
 * Verificación de organizaciones: ¿el dominio del email de quien la solicita es el de su web oficial?
 * Solo cuenta el mismo host o un subdominio con punto (`deportes.harvard.edu` ↔ `harvard.edu`).
 * `fakeharvard.edu` NO coincide con `harvard.edu` (antes se comparaba con `endsWith` sin punto).
 */
const clean = (d: string) => d.trim().toLowerCase().replace(/^@+/, '').replace(/\.+$/, '').replace(/^www\./, '');

export function emailDomainMatchesWebsite(emailDomain: string | null | undefined, websiteHost: string | null | undefined): boolean | null {
  if (!emailDomain || !websiteHost) return null;
  const email = clean(emailDomain);
  const web = clean(websiteHost);
  if (!email || !web || !web.includes('.')) return false;
  return email === web || email.endsWith(`.${web}`);
}
