import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseEnv } from '@/lib/env';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa SIEMPRE la clave publicable: la autorización real la hace la RLS de Postgres.
 * Nunca uses aquí la service role key.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component (solo lectura). El proxy ya refresca la sesión.
        }
      },
    },
  });
}
