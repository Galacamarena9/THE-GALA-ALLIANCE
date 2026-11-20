// Comprueba que ningún secreto llega al navegador ni al repositorio.
// Uso: node scripts/check-secrets.mjs  (tras `npm run build` revisa también el bundle del cliente).
// Falla si encuentra: claves de servicio/secretas, variables NEXT_PUBLIC_ con nombre de secreto,
// o patrones de claves reales (Stripe, Resend, Anthropic, JWT con rol service_role).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SECRET_NAMES = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY', 'RESEND_API_KEY', 'COLLEGE_SCORECARD_API_KEY', 'CONSENT_IP_SALT'];
const VALUE_PATTERNS = [
  ['clave secreta de Stripe', /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/],
  ['secreto de webhook de Stripe', /\bwhsec_[A-Za-z0-9]{16,}/],
  ['clave de Resend', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/],
  ['clave de Anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['clave secreta de Supabase', /\bsb_secret_[A-Za-z0-9_-]{16,}/],
];

/** JWT cuyo payload declara "role":"service_role" (la antigua clave de servicio de Supabase). */
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
function hasServiceRoleJwt(text) {
  for (const m of text.matchAll(JWT)) {
    try { if (JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role === 'service_role') return true; } catch { /* no es un JWT */ }
  }
  return false;
}

const problems = [];

// 1) Repositorio: ningún valor secreto versionado.
const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter((f) => !/\.(png|jpe?g|webp|gif|ico|woff2?|pdf|mp4)$/i.test(f) && f !== 'scripts/check-secrets.mjs');
for (const f of tracked) {
  if (!existsSync(f) || statSync(f).size > 2_000_000) continue;
  const text = readFileSync(f, 'utf8');
  for (const [label, re] of VALUE_PATTERNS) if (re.test(text)) problems.push(`${f}: posible ${label} versionada`);
  if (hasServiceRoleJwt(text)) problems.push(`${f}: JWT service_role versionado`);
  if (/^\.env(\..+)?$/.test(f.split('/').pop()) && !f.endsWith('.env.example')) problems.push(`${f}: fichero .env versionado`);
}

// 2) Código: ninguna variable pública con nombre de secreto; ningún secreto leído en componentes de cliente.
for (const f of tracked.filter((x) => /^src\/.*\.(tsx?|mjs)$/.test(x))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PRIVATE|WEBHOOK)[A-Z_]*/g)) problems.push(`${f}: ${m[0]} sería pública`);
  if (/^['"]use client['"]/.test(text.trimStart())) {
    for (const n of SECRET_NAMES) if (text.includes(n)) problems.push(`${f}: componente de cliente lee ${n}`);
  }
}

// 3) Bundle del navegador (si existe la build).
const staticDir = '.next/static';
if (existsSync(staticDir)) {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(staticDir).filter((p) => p.endsWith('.js'))) {
    const text = readFileSync(f, 'utf8');
    for (const n of SECRET_NAMES) if (text.includes(n)) problems.push(`${f}: el bundle del cliente menciona ${n}`);
    for (const [label, re] of VALUE_PATTERNS) if (re.test(text)) problems.push(`${f}: el bundle del cliente contiene una ${label}`);
    if (hasServiceRoleJwt(text)) problems.push(`${f}: el bundle del cliente contiene un JWT service_role`);
  }
} else {
  console.log('(sin .next/static: se omite la revisión del bundle; ejecuta tras `npm run build`)');
}

if (problems.length) {
  console.error(`✗ Secretos expuestos (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('✓ Ningún secreto en el repositorio, en variables públicas ni en el bundle del navegador.');
