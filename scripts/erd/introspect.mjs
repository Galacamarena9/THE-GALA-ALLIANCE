// Carga supabase_stub + migraciones en una base temporal y devuelve el esquema real (tablas, columnas, FKs).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function introspect(baseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/postgres') {
  const name = `gala_erd_${Date.now()}`;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  const url = new URL(baseUrl); url.pathname = `/${name}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(readFileSync(join(root, 'supabase/tests/supabase_stub.sql'), 'utf8'));
    const dir = join(root, 'supabase/migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.query(readFileSync(join(dir, f), 'utf8'));
    const cols = (await db.query(`
      select c.table_name t, c.column_name n, c.data_type ty, c.udt_name udt, c.is_nullable = 'YES' nullable,
             exists (select 1 from information_schema.table_constraints tc join information_schema.key_column_usage k using (constraint_schema, constraint_name)
                     where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = 'public' and tc.table_name = c.table_name and k.column_name = c.column_name) pk
      from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE' order by c.table_name, c.ordinal_position`)).rows;
    const fks = (await db.query(`
      select cl.relname t, a.attname col, fcl.relname ft, fn.nspname fs, con.confdeltype del
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
      join pg_class fcl on fcl.oid = con.confrelid join pg_namespace fn on fn.oid = fcl.relnamespace
      join lateral unnest(con.conkey) with ordinality k(attnum, ord) on k.ord = 1
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      where con.contype = 'f' and n.nspname = 'public' order by 1, 2`)).rows;
    const rls = (await db.query(`select relname t, relrowsecurity r from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relkind='r'`)).rows;
    const tables = {};
    for (const c of cols) (tables[c.t] ??= { columns: [], fks: [], rls: false }).columns.push(c);
    for (const f of fks) tables[f.t]?.fks.push(f);
    for (const r of rls) if (tables[r.t]) tables[r.t].rls = r.r;
    return tables;
  } finally {
    await db.end();
    await admin.query(`drop database ${name}`);
    await admin.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t = await introspect();
  for (const [name, v] of Object.entries(t)) {
    console.log(`${name} [${v.rls ? 'rls' : 'NO-RLS'}] cols=${v.columns.length} :: ${v.fks.map((f) => `${f.col}->${f.fs === 'public' ? '' : f.fs + '.'}${f.ft}(${f.del})`).join(', ')}`);
  }
}
