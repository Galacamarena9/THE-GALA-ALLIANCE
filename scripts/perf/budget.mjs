// Prompt 18 · Presupuesto de rendimiento del navegador. Falla el CI si el JS o el CSS que descarga el usuario
// crecen por encima del límite. Se mide comprimido (gzip), que es lo que viaja por la red.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = { largestChunkKB: 120, totalJsKB: 750, totalCssKB: 45 };
const dir = '.next/static';
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let files;
try { files = walk(dir); } catch { console.error('✗ No hay build: ejecuta npm run build antes.'); process.exit(1); }
const gz = (f) => gzipSync(readFileSync(f)).length / 1024;
const js = files.filter((f) => f.endsWith('.js')).map((f) => ({ f, kb: gz(f) })).sort((a, b) => b.kb - a.kb);
const css = files.filter((f) => f.endsWith('.css')).map((f) => ({ f, kb: gz(f) }));
const totalJs = js.reduce((a, b) => a + b.kb, 0);
const totalCss = css.reduce((a, b) => a + b.kb, 0);
const problems = [];
if (js[0] && js[0].kb > BUDGET.largestChunkKB) problems.push(`Chunk más grande ${js[0].kb.toFixed(0)} KB > ${BUDGET.largestChunkKB} KB (${js[0].f})`);
if (totalJs > BUDGET.totalJsKB) problems.push(`JS total ${totalJs.toFixed(0)} KB > ${BUDGET.totalJsKB} KB`);
if (totalCss > BUDGET.totalCssKB) problems.push(`CSS total ${totalCss.toFixed(0)} KB > ${BUDGET.totalCssKB} KB`);
if (problems.length) { console.error(`✗ Presupuesto de rendimiento superado:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`✓ Rendimiento dentro del presupuesto: JS ${totalJs.toFixed(0)}/${BUDGET.totalJsKB} KB, chunk máx. ${(js[0]?.kb ?? 0).toFixed(0)}/${BUDGET.largestChunkKB} KB, CSS ${totalCss.toFixed(0)}/${BUDGET.totalCssKB} KB (gzip).`);
