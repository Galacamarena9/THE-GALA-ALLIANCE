// Check ligero de CI (sin base de datos): el ERD y el catálogo de datos no se quedan atrás de las migraciones.
//  1. Toda tabla creada en supabase/migrations está catalogada (y viceversa).
//  2. Nombres en snake_case; dominio, clasificación y decisión válidos.
//  3. Toda tabla aparece en su fichero docs/erd/<dominio>.md (ERD regenerado).
//  4. Exportación RGPD: lo marcado `export: true` está en src/lib/privacy/export-tables.ts y al revés;
//     los datos personales o sensibles que no se exportan explican por qué.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAINS, TABLES } from './catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const errors = [];

const migDir = join(root, 'supabase', 'migrations');
const created = new Set();
const dropped = new Set();
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(migDir, f), 'utf8').replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)) { created.add(m[1].toLowerCase()); dropped.delete(m[1].toLowerCase()); }
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+rename\s+to\s+([a-z_][a-z0-9_]*)/gi)) {
    if (created.delete(m[1].toLowerCase())) created.add(m[2].toLowerCase());
  }
  for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([^;]+);/gi)) {
    for (const t of m[1].split(',')) { const n = t.trim().replace(/^public\./, '').replace(/\s+cascade$/i, ''); created.delete(n); dropped.add(n); }
  }
}

for (const t of created) if (!TABLES[t]) errors.push(`Tabla nueva sin catalogar: \`${t}\` → añádela a scripts/erd/catalog.mjs y ejecuta \`npm run erd\`.`);
for (const t of Object.keys(TABLES)) if (!created.has(t)) errors.push(`El catálogo documenta \`${t}\`, pero ninguna migración la crea (¿renombrada o eliminada?).`);

const CLS = ['public', 'internal', 'personal', 'sensitive'];
const exportSrc = readFileSync(join(root, 'src/lib/privacy/export-tables.ts'), 'utf8');
const exported = new Set([...exportSrc.matchAll(/table: '([a-z_]+)'/g)].map((m) => m[1]));
const embedded = new Set([...exportSrc.matchAll(/([a-z_]+)\(\*\)/g)].map((m) => m[1]));

for (const [t, m] of Object.entries(TABLES)) {
  if (!/^[a-z][a-z0-9_]*$/.test(t)) errors.push(`\`${t}\`: los nombres de tabla van en snake_case.`);
  if (!DOMAINS[m.domain]) errors.push(`\`${t}\`: dominio desconocido «${m.domain}».`);
  if (!CLS.includes(m.cls)) errors.push(`\`${t}\`: clasificación inválida «${m.cls}».`);
  if (!/^(KEEP|MERGE → .+|RENAME → .+|DEPRECATE|REVIEW)/.test(m.decision ?? '')) errors.push(`\`${t}\`: decisión inválida «${m.decision}».`);
  const inExport = exported.has(t) || embedded.has(t);
  if (m.export && !inExport) errors.push(`\`${t}\` está marcada para exportación RGPD pero no está en src/lib/privacy/export-tables.ts.`);
  if (!m.export && inExport) errors.push(`\`${t}\` se exporta pero el catálogo no lo indica (export: true).`);
  if (['personal', 'sensitive'].includes(m.cls) && !m.export && !m.noExport) errors.push(`\`${t}\` es ${m.cls} y no se exporta: añade \`noExport\` con el motivo o \`export: true\`.`);
  const doc = join(root, 'docs', 'erd', `${m.domain}.md`);
  if (!existsSync(doc) || !readFileSync(doc, 'utf8').includes(`| \`${t}\` |`)) errors.push(`\`${t}\` no aparece en docs/erd/${m.domain}.md → ejecuta \`npm run erd\`.`);
}
for (const t of exported) if (!TABLES[t]) errors.push(`export-tables.ts exporta \`${t}\`, que no existe en el catálogo.`);
if (!existsSync(join(root, 'docs', 'erd', '00-MASTER.md'))) errors.push('Falta docs/erd/00-MASTER.md → ejecuta `npm run erd`.');

if (errors.length) {
  console.error(`✗ ERD / catálogo de datos desactualizado (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`✓ ERD al día: ${created.size} tablas catalogadas en ${Object.keys(DOMAINS).length} dominios; exportación RGPD coherente (${exported.size} secciones).`);
