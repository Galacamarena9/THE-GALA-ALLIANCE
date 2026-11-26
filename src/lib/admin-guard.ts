import 'server-only';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { requireAdminMfa } from '@/lib/mfa';

/**
 * Guarda única de administración (pantallas /app/admin/* y server actions de admin):
 * sesión con rol `admin` Y doble factor verificado en esta sesión (aal2). Sin aal2 → reto o alta del segundo factor.
 * `next` es a dónde volver tras meter el código.
 */
export async function requireAdmin(next = '/app/admin') {
  const session = await requireSession(['admin']);
  if (!session.roles.includes('admin')) redirect('/app/sin-acceso');
  await requireAdminMfa(next);
  return session;
}
