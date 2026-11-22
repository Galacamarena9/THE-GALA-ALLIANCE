// Diagnóstico de arquitectura (SOLO LECTURA). Monta el esquema real (stub + migraciones) en una base temporal,
// lo analiza y la borra. No toca ninguna base de datos existente ni producción.
// Uso: DATABASE_URL=postgres://postgres@localhost:5433/postgres node scripts/erd/diagnose.mjs [--json]
//
// Con --sql <fichero> ejecuta además las comprobaciones de datos (huérfanos, duplicados) contra la base indicada,
// también en solo lectura (transacción READ ONLY). Para staging: DATABASE_URL=<staging> node scripts/erd/diagnose.mjs --data-only
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/postgres';
const asJson = process.argv.includes('--json');
const dataOnly = process.argv.includes('--data-only');

/** Comprobaciones de datos: cada una devuelve filas problemáticas (0 = sano). Solo SELECT. */
export const DATA_CHECKS = [
  ['Miembros de organización duplicados (activos)', `select organization_id, user_id, count(*) from organization_members group by 1, 2 having count(*) > 1`],
  ['Atleta repetido en una shortlist', `select shortlist_id, athlete_id, count(*) from org_shortlist_members group by 1, 2 having count(*) > 1`],
  ['Candidaturas duplicadas atleta + oportunidad', `select athlete_id, opportunity_id, count(*) from applications group by 1, 2 having count(*) > 1`],
  ['Representaciones activas duplicadas agencia + atleta', `select agency_id, athlete_id, count(*) from agent_representations where status = 'active' group by 1, 2 having count(*) > 1`],
  ['Programa de candidato de otra organización', `select c.id from org_candidates c join org_programs p on p.id = c.program_id where p.organization_id <> c.organization_id`],
  ['Proceso de agencia sobre atleta sin representación', `select rc.id from recruiting_cases rc where not exists (select 1 from agent_representations r where r.agency_id = rc.agency_id and r.athlete_id = rc.athlete_id)`],
  ['Documentos sin archivo desde hace más de 7 días', `select id from athlete_documents where uploaded_at is null and created_at < now() - interval '7 days'`],
  ['Oportunidades publicadas de organización no verificada', `select o.id from opportunities o join organizations g on g.id = o.organization_id where o.status = 'published' and g.verification_status <> 'verified'`],
  ['Menores descubribles sin vínculo familiar aprobado', `select s.athlete_id from athlete_discovery_settings s where s.mode <> 'off' and public.is_minor(s.athlete_id) and not exists (select 1 from parent_athlete_links l where l.athlete_id = s.athlete_id and l.status = 'approved')`],
];

async function withTempSchema(fn) {
  const name = `gala_diag_${Date.now()}`;
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
    return await fn(db);
  } finally {
    await db.end();
    await admin.query(`drop database ${name}`);
    await admin.end();
  }
}

const q = async (db, sql) => (await db.query(sql)).rows;

async function schemaChecks(db) {
  const out = {};
  out.tables = Number((await q(db, `select count(*) n from pg_tables where schemaname = 'public'`))[0].n);
  out.rlsOff = await q(db, `select relname t from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
  out.noPolicies = await q(db, `select c.relname t from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid) order by 1`);
  // Columnas *_id uuid sin FK (posible relación sin integridad).
  out.idWithoutFk = await q(db, `
    select c.table_name t, c.column_name col from information_schema.columns c
    join information_schema.tables tb using (table_schema, table_name)
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.column_name like '%\\_id' and c.data_type = 'uuid'
      and not exists (
        select 1 from pg_constraint con join pg_class cl on cl.oid = con.conrelid
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
        where con.contype in ('f', 'p') and cl.relname = c.table_name and cl.relnamespace = 'public'::regnamespace and a.attname = c.column_name)
    order by 1, 2`);
  // Texto que nombra una organización/universidad en vez de referenciarla.
  out.nameAsText = await q(db, `select table_name t, column_name col from information_schema.columns
    where table_schema = 'public' and data_type = 'text' and column_name ~ '(university|institution|organization|org|club|agency|school)_name$' order by 1, 2`);
  // Cascadas: tablas que se borran al borrar una organización / un perfil (para revisar pérdidas masivas).
  out.cascadeFromOrg = await q(db, `select cl.relname t, a.attname col from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid join pg_class f on f.oid = con.confrelid
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f' and f.relname = 'organizations' and con.confdeltype = 'c' and cl.relnamespace = 'public'::regnamespace order by 1`);
  out.cascadeFromOpportunity = await q(db, `select cl.relname t from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid join pg_class f on f.oid = con.confrelid
    where con.contype = 'f' and f.relname = 'opportunities' and con.confdeltype = 'c' and cl.relnamespace = 'public'::regnamespace order by 1`);
  // Estados: columnas status sin check (texto libre).
  out.statusWithoutCheck = await q(db, `select c.table_name t, c.column_name col from information_schema.columns c
    join information_schema.tables tb using (table_schema, table_name)
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.column_name in ('status', 'stage', 'state') and c.data_type = 'text'
      and not exists (select 1 from pg_constraint con join pg_class cl on cl.oid = con.conrelid
        where con.contype = 'c' and cl.relname = c.table_name and cl.relnamespace = 'public'::regnamespace and pg_get_constraintdef(con.oid) ilike '%' || c.column_name || '%')
    order by 1`);
  // Valores de estado: mismo concepto con nombres distintos (active / enabled / open...).
  out.statusVocab = await q(db, `select regexp_replace(pg_get_constraintdef(con.oid), '.*ARRAY\\[(.*)\\].*', '\\1') vals, cl.relname t
    from pg_constraint con join pg_class cl on cl.oid = con.conrelid
    where con.contype = 'c' and cl.relnamespace = 'public'::regnamespace and pg_get_constraintdef(con.oid) ~* '\\m(status|stage)\\M.*ARRAY' order by 2`);
  out.enums = await q(db, `select t.typname e, string_agg(x.enumlabel, ', ' order by x.enumsortorder) vals from pg_type t join pg_enum x on x.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' group by 1 order by 1`);
  out.secDefinerAnon = await q(db, `select p.proname f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute') order by 1`);
  out.wideTables = await q(db, `select table_name t, count(*)::int n from information_schema.columns c join information_schema.tables tb using (table_schema, table_name)
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' group by 1 having count(*) >= 25 order by 2 desc`);
  out.withoutUpdatedAt = Number((await q(db, `select count(*) n from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    and not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'updated_at')`))[0].n);
  out.notesTables = (await q(db, `select tablename t from pg_tables where schemaname = 'public' and tablename ~ '(note|notes)$' order by 1`)).map((r) => r.t);
  out.invitationTables = (await q(db, `select tablename t from pg_tables where schemaname = 'public' and tablename ~ 'invit' order by 1`)).map((r) => r.t);
  out.offerTables = (await q(db, `select tablename t from pg_tables where schemaname = 'public' and tablename ~ 'offer' order by 1`)).map((r) => r.t);
  out.taskTables = (await q(db, `select tablename t from pg_tables where schemaname = 'public' and tablename ~ 'task' order by 1`)).map((r) => r.t);
  out.eventTables = (await q(db, `select tablename t from pg_tables where schemaname = 'public' and tablename ~ '(event|events|log|logs|activity|history)$' order by 1`)).map((r) => r.t);
  return out;
}

async function dataChecks(db) {
  const res = [];
  await db.query('begin read only');
  try {
    for (const [name, sql] of DATA_CHECKS) {
      try { res.push({ name, rows: (await db.query(sql)).rowCount }); } catch (e) { res.push({ name, error: String(e.message).slice(0, 120) }); }
    }
  } finally { await db.query('rollback'); }
  return res;
}

if (dataOnly) {
  const db = new pg.Client({ connectionString: baseUrl });
  await db.connect();
  const r = await dataChecks(db);
  await db.end();
  console.log(asJson ? JSON.stringify(r, null, 2) : r.map((x) => `${x.error ? '?' : x.rows ? '✗' : '✓'} ${x.name}: ${x.error ?? x.rows}`).join('\n'));
} else {
  const report = await withTempSchema(async (db) => ({ schema: await schemaChecks(db), data: await dataChecks(db) }));
  console.log(JSON.stringify(report, null, asJson ? 2 : 0));
}
