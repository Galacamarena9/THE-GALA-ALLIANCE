import { requireAdmin } from '@/lib/admin-guard';

/**
 * Todo /app/admin/* exige rol admin y doble factor verificado en esta sesión (aal2).
 * Cada página vuelve a llamar a `requireAdmin(<su ruta>)` para que el reto MFA devuelva a la pantalla de origen.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
