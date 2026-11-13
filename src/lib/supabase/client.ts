'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Cliente del navegador (clave publicable). Solo para subir archivos a Storage: la RLS decide quién puede. */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
