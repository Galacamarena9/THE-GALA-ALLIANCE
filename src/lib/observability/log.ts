/**
 * Prompt 19 · Logs estructurados (una línea JSON por evento) sin datos personales.
 * Se redactan emails, teléfonos, tokens y claves aunque lleguen por error en un mensaje.
 * Sin proveedor externo configurado, va a la salida estándar (la recogen Vercel/Netlify/Supabase).
 */
export type Level = 'debug' | 'info' | 'warn' | 'error';

const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/\+?\d[\d\s().-]{7,}\d/g, '[phone]'],
  [/\b(sk|pk|rk|whsec|sb)_[A-Za-z0-9_]{8,}\b/g, '[secret]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, '[jwt]'],
  [/\b[0-9a-f]{32,}\b/gi, '[token]'],
];

export function redact(value: string): string {
  return PATTERNS.reduce((s, [re, rep]) => s.replace(re, rep), value);
}

const SAFE_KEYS = new Set(['event', 'route', 'method', 'status', 'durationMs', 'requestId', 'digest', 'routeType', 'outcome', 'type', 'code', 'feature', 'count']);

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): string {
  const out: Record<string, unknown> = { ts: new Date().toISOString(), level, event };
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    // Solo campos conocidos; el resto se marca como omitido (evita volcar objetos con datos personales).
    if (!SAFE_KEYS.has(k) && k !== 'message') { out[k] = '[omitted]'; continue; }
    out[k] = typeof v === 'string' ? redact(v).slice(0, 500) : typeof v === 'number' || typeof v === 'boolean' ? v : '[omitted]';
  }
  const line = JSON.stringify(out);
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
  return line;
}
