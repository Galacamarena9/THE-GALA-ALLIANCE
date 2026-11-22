import pg from 'pg'; import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
// Huella del esquema (columnas, funciones y políticas de public) tras aplicar las migraciones del repositorio.
// Uso: npm run schema:fingerprint  → docs/supabase/schema-fingerprint.json
// Sirve para comparar un proyecto remoto con el repositorio sin copiar SQL a mano (ver docs/supabase/migrations.md §4).
const upto = Number(process.argv[2] ?? 1e9);
const a=new pg.Client({connectionString:'postgres://postgres@localhost:5433/postgres'}); await a.connect();
const n='snap_'+Date.now(); await a.query(`create database ${n}`);
const d=new pg.Client({connectionString:`postgres://postgres@localhost:5433/${n}`}); await d.connect();
try { await d.query(readFileSync('supabase/tests/supabase_stub.sql','utf8'));
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().slice(0, upto);
for (const f of files) await d.query(readFileSync('supabase/migrations/'+f,'utf8'));
const q = (s) => d.query(s).then(r=>r.rows);
const cols = await q(`select table_name k, md5(string_agg(column_name||':'||data_type||':'||is_nullable, ',' order by column_name)) h from information_schema.columns where table_schema='public' group by 1`);
const funcs = await q(`select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' k, md5(regexp_replace(p.prosrc,'\\s+',' ','g')) h from pg_proc p where p.pronamespace='public'::regnamespace`);
const pols = await q(`select tablename||':'||policyname k, md5(cmd||coalesce(qual,'')||'|'||coalesce(with_check,'')||array_to_string(roles,',')) h from pg_policies where schemaname='public'`);
const short = (rows) => Object.fromEntries(rows.map((r) => [r.k.split('(')[0], r.h.slice(0, 6)]).sort());
writeFileSync('docs/supabase/schema-fingerprint.json', JSON.stringify({ migrations: files.length, last: files.at(-1), columns: short(cols), functions: short(funcs), policies: short(pols) }, null, 1) + '\n');
console.log(cols.length, funcs.length, pols.length, files.at(-1));
} finally { await d.end(); await a.query(`drop database ${n}`); await a.end(); }
