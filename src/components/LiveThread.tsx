'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

/**
 * Escucha mensajes nuevos de una conversación y refresca la página al llegar.
 * La RLS de contact_messages decide qué eventos recibe cada persona.
 */
export function LiveThread({ requestId }: { requestId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`thread-${requestId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_messages', filter: `request_id=eq.${requestId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requestId, router]);
  return null;
}
