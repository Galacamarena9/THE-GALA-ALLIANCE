import { createClient } from '@supabase/supabase-js';
import { log } from '@/lib/observability/log';

/**
 * Prompt 19 · Comprobación de salud para monitores externos (UptimeRobot, Better Stack…).
 * Sin datos ni secretos: solo si la app responde y si la base de datos contesta, y cuánto tarda.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let db: 'ok' | 'down' | 'not_configured' = 'not_configured';
  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await supabase.rpc('flag_enabled', { p_key: 'gala_ai' }).abortSignal(AbortSignal.timeout(3000));
      db = error ? 'down' : 'ok';
    } catch { db = 'down'; }
  }
  const status = db === 'down' ? 503 : 200;
  const durationMs = Date.now() - started;
  if (status !== 200) log('error', 'health_degraded', { status, durationMs });
  return Response.json(
    { status: status === 200 ? 'ok' : 'degraded', db, durationMs, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.COMMIT_REF?.slice(0, 7) ?? 'local' },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
