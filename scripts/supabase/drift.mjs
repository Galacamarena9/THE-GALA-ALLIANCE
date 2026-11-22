// Deriva de esquema (SOLO LECTURA sobre el remoto: solo se le pide la lista de tablas).
// Uso:
//   1. En el remoto (SQL editor o conector):
//      select string_agg(table_name, ' ' order by table_name) from information_schema.tables
//      where table_schema = 'public' and table_type = 'BASE TABLE';
//   2. Guarda el resultado en un archivo y ejecuta: npm run drift -- <archivo>
// Monta stub + migraciones en una base local temporal, migración a migración, y dice hasta cuál llega el
// remoto, qué tablas tiene el remoto que el repositorio no crea nunca (deriva) y cuántas faltan por aplicar.
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run drift -- <archivo con la lista de tablas del remoto>');
  process.exit(2);
}
const remote = readFileSync(file, 'utf8').trim().split(/\s+/).filter(Boolean);
const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/postgres';

const admin = new pg.Client({ connectionString: url });
await admin.connect();
const name = `drift_${Date.now()}`;
await admin.query(`create database ${name}`);
const db = new pg.Client({ connectionString: url.replace(/\/[^/]*$/, `/${name}`) });
await db.connect();
try {
  await db.query(readFileSync('supabase/tests/supabase_stub.sql', 'utf8'));
  let best = { i: -1, missing: remote.length, extra: 0 };
  let final;
  for (let i = 0; i < files.length; i++) {
    await db.query(readFileSync(join(dir, files[i]), 'utf8'));
    const { rows } = await db.query(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const local = new Set(rows.map((r) => r.table_name));
    const missing = remote.filter((t) => !local.has(t));
    const extra = [...local].filter((t) => !remote.includes(t));
    if (missing.length < best.missing || (missing.length === best.missing && extra.length < best.extra)) {
      best = { i, missing: missing.length, extra: extra.length, missingNames: missing };
    }
    final = { missing, extra };
  }
  console.log(`Remoto: ${remote.length} tablas · repositorio: ${files.length} migraciones`);
  console.log(`Punto más cercano: migración ${best.i + 1} (${files[best.i]})`);
  console.log(`  tablas del remoto que el repositorio no tiene en ese punto: ${best.missingNames?.join(', ') || 'ninguna'}`);
  console.log(`Migraciones locales posteriores (pendientes de aplicar): ${files.length - best.i - 1}`);
  console.log(`Con todas las migraciones: ${final.extra.length} tablas nuevas; tablas del remoto que desaparecen o nunca existieron: ${final.missing.join(', ') || 'ninguna'}`);
} finally {
  await db.end();
  await admin.query(`drop database ${name}`);
  await admin.end();
}
