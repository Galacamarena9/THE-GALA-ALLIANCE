import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { must, bestEffort, WriteFailedError } from './must.ts';

/**
 * Fase 3 de la auditoría (H3): una escritura cuyo resultado se descarta («await supabase.from(x).update(...);»)
 * puede fallar sin que nadie se entere y el usuario cree que se guardó. Esta prueba recorre el código del servidor
 * y falla si encuentra una escritura así: hay que envolverla en must() o bestEffort(), o mirar su { error }.
 */
const WRITE = /\.(insert|update|upsert|delete)\(|\.rpc\(|\.storage\.from\([^)]*\)\.remove\(/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

/** Quita comentarios y el contenido de las cadenas (conserva longitudes y saltos de línea). */
function blank(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && src[i + 1] === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === "'" || c === '"' || c === '`') {
      out += c; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        out += src[i] === '\n' ? '\n' : (c === '`' && (src[i] === '$' || src[i] === '{' || src[i] === '}') ? src[i] : 'x');
        i++;
      }
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Final de la sentencia que empieza en i: el primer «;» (o cierre de bloque) a profundidad 0. */
function statementEnd(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (depth === 0) return j; depth--; }
    else if (c === ';' && depth === 0) return j;
  }
  return s.length;
}

export function uncheckedWrites(src: string): number[] {
  const s = blank(src);
  const lines: number[] = [];
  for (const m of s.matchAll(/(?<![\w.$])await\s+/g)) {
    let k = m.index! - 1;
    while (k >= 0 && /\s/.test(s[k])) k--;
    const prev = k >= 0 ? s[k] : ';';
    if (!';{})'.includes(prev)) continue; // asignado, devuelto o pasado a must()/bestEffort()
    if (prev === ')') {
      // Solo «if (...) await x;» / «while (...) await x;»: el resto son llamadas cuyo valor se usa.
      let d = 0; let kk = k;
      for (; kk >= 0; kk--) { if (s[kk] === ')') d++; else if (s[kk] === '(' && --d === 0) break; }
      if (!/\b(if|while|for)\s*$/.test(s.slice(Math.max(0, kk - 8), kk))) continue;
    }
    const expr = s.slice(m.index! + m[0].length, statementEnd(s, m.index! + m[0].length));
    if (/^\s*(Promise\.all|logEvent|must|bestEffort)\b/.test(expr)) continue;
    if (WRITE.test(expr) && /^\s*\(?\s*(await\s+)?(supabase|db|admin|\(await createClient\(\)\)|m)\b/.test(expr)) {
      lines.push(s.slice(0, m.index!).split('\n').length);
    }
  }
  return lines;
}

test('detector: encuentra la escritura descartada y respeta las comprobadas', () => {
  const bad = `async function a() {\n  const supabase = x;\n  await supabase.from('t').update({ a: 1 }).eq('id', 1);\n}`;
  assert.deepEqual(uncheckedWrites(bad), [3]);
  const ok = `async function a() {\n  const { error } = await supabase.from('t').update({ a: 1 });\n  must(await supabase.rpc('f'), 'rpc.f');\n  bestEffort(await db.from('l').insert({}), 'l');\n  // await supabase.from('t').delete();\n  const s = 'await supabase.from(1).delete();';\n}`;
  assert.deepEqual(uncheckedWrites(ok), []);
  assert.deepEqual(uncheckedWrites(`if (x) await supabase.from('t').delete().eq('id', 1);`), [1]);
});

test('ninguna escritura del servidor descarta su error (usa must, bestEffort o { error })', () => {
  const offenders: string[] = [];
  for (const f of files(join(process.cwd(), 'src', 'app'))) {
    const src = readFileSync(f, 'utf8');
    if (!/['"]use server['"]/.test(src) && !f.includes(`${join('src', 'app', 'api')}`)) continue;
    for (const line of uncheckedWrites(src)) offenders.push(`${f.slice(process.cwd().length + 1)}:${line}`);
  }
  assert.deepEqual(offenders, [], `Escrituras sin comprobar:\n${offenders.join('\n')}`);
});

test('must corta la acción con un error genérico; bestEffort solo registra', () => {
  const errOrig = console.error; const logged: string[] = []; console.error = (m: string) => { logged.push(m); };
  try {
    assert.throws(() => must({ error: { message: 'boom' } }, 't.update'), (e) => e instanceof WriteFailedError && e.message === 'write_failed:t.update');
    assert.deepEqual(must({ error: null, data: 1 }, 't.update'), { error: null, data: 1 });
    bestEffort({ error: { message: 'meh' } }, 'log.insert');
    assert.equal(logged.length, 2);
    assert.match(logged[1], /best-effort-failed\] log\.insert/);
  } finally { console.error = errOrig; }
});
