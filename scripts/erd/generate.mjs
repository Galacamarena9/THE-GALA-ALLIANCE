// Genera docs/erd/*.md (Mermaid) a partir del esquema REAL (migraciones aplicadas en una base temporal)
// y del catálogo (scripts/erd/catalog.mjs). Uso: DATABASE_URL=postgres://… npm run erd
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { introspect } from './introspect.mjs';
import { DOMAINS, TABLES, DEFAULT_RETENTION } from './catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'docs', 'erd');
mkdirSync(out, { recursive: true });

const schema = await introspect();
const CLS = { public: 'Pública', internal: 'Interna', personal: 'Personal', sensitive: 'Sensible' };

const missing = Object.keys(schema).filter((t) => !TABLES[t]);
if (missing.length) throw new Error(`Tablas sin catalogar en scripts/erd/catalog.mjs: ${missing.join(', ')}`);

const type = (c) => (c.udt.startsWith('_') ? `${c.udt.slice(1)}_array` : c.udt).replace(/[^a-z0-9_]/gi, '_');
const ent = (t) => t.toUpperCase();
const fkCols = (t) => new Set(schema[t].fks.map((f) => f.col));

/** Qué le pasa a una fila de esta tabla cuando se borra la cuenta de una persona o una organización. */
function deleteBehaviour(t) {
  const parts = [];
  for (const f of schema[t].fks) {
    const target = f.fs === 'auth' ? 'auth.users' : f.ft;
    if (!['profiles', 'auth.users', 'athlete_profiles', 'organizations'].includes(target)) continue;
    const who = target === 'organizations' ? 'organización' : target === 'athlete_profiles' ? 'atleta' : 'persona';
    parts.push(f.del === 'c' ? `${who} (${f.col}) → se borra` : f.del === 'n' ? `${who} (${f.col}) → se anonimiza` : `${who} (${f.col}) → **BLOQUEA**`);
  }
  if (!parts.length) {
    const parents = schema[t].fks.filter((f) => f.del === 'c').map((f) => f.ft);
    return parents.length ? `En cascada con ${[...new Set(parents)].map((p) => `\`${p}\``).join(', ')}` : 'No depende de personas';
  }
  return parts.join('<br>');
}

const AUDIT_COL = /^(created_by|reviewed_by|verified_by|links_verified_by|invited_by|added_by|assigned_to|assigned_reviewer|owner_id|granted_by|revoked_by)$/;

function erBlock(tables, { attrs = true, core = false } = {}) {
  const set = new Set(tables);
  const lines = ['```mermaid', 'erDiagram'];
  const external = new Set();
  for (const t of tables) {
    for (const f of schema[t].fks) {
      const target = f.fs === 'auth' ? 'auth_users' : f.ft;
      if (core && (!set.has(target) || AUDIT_COL.test(f.col))) continue;
      if (target !== t && !set.has(target)) external.add(target);
      const col = schema[t].columns.find((c) => c.n === f.col);
      const card = col?.nullable ? '|o--o{' : '||--o{';
      lines.push(`  ${ent(target)} ${card} ${ent(t)} : "${f.col}"`);
    }
  }
  if (attrs) {
    for (const t of tables) {
      const fks = fkCols(t);
      lines.push(`  ${ent(t)} {`);
      for (const c of schema[t].columns) {
        const keys = [c.pk && 'PK', fks.has(c.n) && 'FK'].filter(Boolean).join(',');
        lines.push(`    ${type(c)} ${c.n}${keys ? ' ' + keys : ''}`);
      }
      lines.push('  }');
    }
  } else {
    for (const t of tables) if (!lines.some((l) => l.includes(` ${ent(t)} `) || l.endsWith(` ${ent(t)}`))) lines.push(`  ${ent(t)} { }`);
  }
  lines.push('```');
  return { text: lines.join('\n'), external: [...external].sort() };
}

const header = (title) => `<!-- Generado por scripts/erd/generate.mjs a partir de las migraciones. No editar a mano: \`npm run erd\`. -->\n# ${title}\n`;

// ------------------------------------------------------------------ Un fichero por dominio
const byDomain = {};
for (const [t, meta] of Object.entries(TABLES)) (byDomain[meta.domain] ??= []).push(t);

const domainDeps = {};
for (const [d, tables] of Object.entries(byDomain)) {
  tables.sort();
  const { text, external } = erBlock(tables);
  domainDeps[d] = new Set(external.map((e) => TABLES[e]?.domain).filter((x) => x && x !== d));
  const changes = tables.filter((t) => TABLES[t].decision !== 'KEEP');
  const md = [
    header(`${d.slice(0, 2)} · ${DOMAINS[d]}`),
    `Tablas: **${tables.length}** · RLS activada en ${tables.filter((t) => schema[t].rls).length}/${tables.length}.`,
    external.length ? `Se relaciona con: ${external.map((e) => `\`${e}\`${TABLES[e] ? ` (${TABLES[e].domain.slice(0, 2)})` : ''}`).join(', ')}.` : '',
    '',
    '## AS-IS · Modelo actual',
    '',
    text,
    '',
    '## Inventario',
    '',
    '| Tabla | Clasificación | Menores | Al borrar | Retención | Exportación RGPD | Decisión |',
    '|---|---|---|---|---|---|---|',
    ...tables.map((t) => {
      const m = TABLES[t];
      return `| \`${t}\` | ${CLS[m.cls]} | ${m.minors ? 'Sí' : '—'} | ${deleteBehaviour(t)} | ${m.retention ?? DEFAULT_RETENTION[m.cls]} | ${m.export ? 'Sí' : m.noExport ? `No: ${m.noExport}` : '—'} | ${m.decision} |`;
    }),
    '',
    ...tables.filter((t) => TABLES[t].note).map((t) => `- \`${t}\`: ${TABLES[t].note}`),
    '',
    '## TO-BE · Modelo objetivo',
    '',
    changes.length
      ? changes.map((t) => `- \`${t}\` → **${TABLES[t].decision}**. Plan: docs/DATA_ARCHITECTURE.md §6.`).join('\n')
      : 'Sin cambios estructurales: el dominio se mantiene tal cual (KEEP). Las mejoras se limitan a convenciones (§7).',
    '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));
  writeFileSync(join(out, `${d}.md`), md.join('\n'));
}

// ------------------------------------------------------------------ 00 · MASTER
const core = ['profiles', 'athlete_profiles', 'parent_athlete_links', 'institutions', 'organizations', 'organization_members', 'org_programs',
  'verification_requests', 'opportunities', 'applications', 'saved_items', 'org_candidates', 'org_shortlists', 'org_shortlist_members',
  'recruiting_needs', 'recruiting_cases', 'agent_representations', 'opportunity_registrations', 'program_enrollments', 'org_teams', 'contact_requests', 'club_roster'];
const coreEr = erBlock(core, { attrs: false, core: true });
const flow = ['```mermaid', 'flowchart LR'];
for (const d of Object.keys(DOMAINS)) flow.push(`  D${d.slice(0, 2)}["${d.slice(0, 2)} · ${DOMAINS[d]}<br>${byDomain[d].length} tablas"]`);
for (const [d, deps] of Object.entries(domainDeps)) for (const dep of [...deps].sort()) flow.push(`  D${d.slice(0, 2)} --> D${dep.slice(0, 2)}`);
flow.push('```');

const counts = Object.fromEntries(Object.keys(CLS).map((c) => [c, Object.values(TABLES).filter((m) => m.cls === c).length]));
const master = [
  header('00 · MASTER · Mapa de datos de The Gala Alliance'),
  `**${Object.keys(TABLES).length} tablas** en ${Object.keys(DOMAINS).length} dominios, todas con RLS (${Object.values(schema).filter((s) => s.rls).length}/${Object.keys(schema).length}).`,
  `Clasificación: ${Object.entries(counts).map(([c, n]) => `${CLS[c]} ${n}`).join(' · ')} · con posibles datos de menores: ${Object.values(TABLES).filter((m) => m.minors).length}.`,
  '',
  'Cómo leerlo: cada dominio tiene su fichero con el diagrama AS-IS (columnas reales), el inventario y el TO-BE. La arquitectura, las reglas y el plan están en [`docs/DATA_ARCHITECTURE.md`](../DATA_ARCHITECTURE.md).',
  '',
  '## Dominios y dependencias',
  '',
  'Una flecha A → B significa que tablas de A apuntan (FK) a tablas de B.',
  '',
  flow.join('\n'),
  '',
  '## Entidades núcleo',
  '',
  coreEr.text,
  '',
  '## Índice',
  '',
  '| Dominio | Tablas | Cambios previstos |',
  '|---|---|---|',
  ...Object.keys(DOMAINS).map((d) => `| [${d.slice(0, 2)} · ${DOMAINS[d]}](./${d}.md) | ${byDomain[d].length} | ${byDomain[d].filter((t) => TABLES[t].decision !== 'KEEP').map((t) => `\`${t}\``).join(', ') || '—'} |`),
  '',
];
writeFileSync(join(out, '00-MASTER.md'), master.join('\n'));
console.log(`ERD generado: ${Object.keys(DOMAINS).length + 1} ficheros en docs/erd`);
