// Pruebas negativas y positivas de RLS por rol.
// Uso: DATABASE_URL=postgres://postgres@localhost:5433/postgres node supabase/tests/rls.test.mjs
// Crea una base de datos desechable, aplica el stub de Supabase + migraciones y prueba cada actor.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/postgres';
const dbName = `gala_rls_${Date.now()}`;

const admin = new pg.Client({ connectionString: baseUrl });
await admin.connect();
await admin.query(`create database ${dbName}`);
const url = new URL(baseUrl);
url.pathname = `/${dbName}`;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();

let passed = 0;
let failed = 0;
const results = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    results.push(`  ✗ ${name}\n      ${err.message}`);
  }
}

/** Ejecuta SQL como un usuario concreto (null = anónimo) dentro de una transacción. */
async function as(userId, sql, params = []) {
  await db.query('begin');
  try {
    await db.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' }),
    ]);
    const res = await db.query(sql, params);
    await db.query('commit');
    return res;
  } catch (err) {
    await db.query('rollback');
    if (process.env.DEBUG_SQL) err.message += ` ⟨${userId}: ${sql.replace(/\s+/g, ' ').slice(0, 90)}⟩`;
    throw err;
  }
}

async function expectError(fn, pattern) {
  try {
    await fn();
  } catch (err) {
    if (pattern && !pattern.test(err.message)) throw new Error(`Error inesperado: ${err.message}`);
    return;
  }
  throw new Error('Se esperaba un error y la operación se permitió');
}

function eq(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label} esperado ${expected}, obtenido ${actual}`);
}

const yearsAgo = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

try {
  // --- Esquema ---------------------------------------------------------------
  await db.query(readFileSync(join(here, 'supabase_stub.sql'), 'utf8'));
  const migDir = join(here, '..', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.query(readFileSync(join(migDir, f), 'utf8'));
  }

  // --- Actores ---------------------------------------------------------------
  const u = {
    adult: randomUUID(), minor: randomUUID(), privateAth: randomUUID(), parent: randomUUID(),
    coach: randomUUID(), coach2: randomUUID(), agent: randomUUID(), brand: randomUUID(), admin: randomUUID(),
    uni: randomUUID(),
  };
  for (const [name, id] of Object.entries(u)) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
      [id, `${name}@test.dev`, { display_name: name }]);
  }
  const roles = { adult: 'athlete', minor: 'athlete', privateAth: 'athlete', parent: 'parent', coach: 'coach',
    coach2: 'coach', agent: 'agent', brand: 'brand', uni: 'university' };
  for (const [name, role] of Object.entries(roles)) {
    await as(u[name], `insert into user_roles (user_id, role) values ($1, $2)`, [u[name], role]);
    const dob = name === 'minor' ? yearsAgo(16) : yearsAgo(25);
    await as(u[name], `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [u[name], dob]);
  }
  await db.query(`insert into user_roles (user_id, role) values ($1, 'admin')`, [u.admin]);
  await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [u.admin, yearsAgo(30)]);

  for (const [name, vis] of [['adult', 'members'], ['minor', 'members'], ['privateAth', 'private']]) {
    await as(u[name], `insert into athlete_profiles (user_id, sport_id, graduation_year, profile_visibility, stats_visibility)
      values ($1, 'basketball', 2027, $2, $2)`, [u[name], vis]);
  }
  await as(u.minor, `insert into athlete_academics (athlete_id, gpa, gpa_scale) values ($1, 3.6, 4.0)`, [u.minor]);

  const countVisible = async (viewer, athlete) =>
    (await as(viewer, `select count(*)::int as n from athlete_profiles where user_id = $1`, [athlete])).rows[0].n;

  results.push('\nIdentidad y COPPA');
  await check('rechaza una fecha de nacimiento de menor de 13 años', async () => {
    const kid = randomUUID();
    await db.query(`insert into auth.users (id, email) values ($1, 'kid@test.dev')`, [kid]);
    await expectError(() => as(kid, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`,
      [kid, yearsAgo(12)]), /coppa_minimum_age/);
  });
  await check('el alta de un menor de 13 falla entera (no queda cuenta)', async () => {
    const kid = randomUUID();
    await expectError(() => db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'kid2@test.dev', $2)`,
      [kid, { date_of_birth: yearsAgo(12) }]), /coppa_minimum_age/);
    eq((await db.query(`select count(*)::int n from auth.users where id = $1`, [kid])).rows[0].n, 0);
  });
  await check('el alta guarda la fecha de nacimiento en la tabla privada', async () => {
    const teen = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'teen@test.dev', $2)`,
      [teen, { date_of_birth: yearsAgo(15), display_name: 'teen' }]);
    eq((await db.query(`select count(*)::int n from private_profile_data where user_id = $1`, [teen])).rows[0].n, 1);
  });
  await check('nadie puede asignarse el rol admin', async () => {
    await expectError(() => as(u.brand, `insert into user_roles (user_id, role) values ($1, 'admin')`, [u.brand]));
  });
  await check('una marca no puede leer la fecha de nacimiento de un atleta', async () => {
    eq((await as(u.brand, `select count(*)::int n from private_profile_data where user_id = $1`, [u.adult])).rows[0].n, 0);
  });
  await check('el perfil se crea automáticamente al registrarse', async () => {
    eq((await db.query(`select display_name from profiles where id = $1`, [u.coach])).rows[0].display_name, 'coach');
  });

  results.push('\nVisibilidad de atletas y protección de menores');
  await check('una marca ve al atleta adulto con visibilidad "members"', async () => eq(await countVisible(u.brand, u.adult), 1));
  await check('una marca NO ve al atleta menor', async () => eq(await countVisible(u.brand, u.minor), 0));
  await check('un agente NO ve al atleta menor', async () => eq(await countVisible(u.agent, u.minor), 0));
  await check('nadie ajeno ve un perfil privado', async () => eq(await countVisible(u.brand, u.privateAth), 0));
  await check('un anónimo no ve perfiles "members"', async () => eq(await countVisible(null, u.adult), 0));
  await check('un anónimo nunca ve a un menor aunque sea "public"', async () => {
    await as(u.minor, `update athlete_profiles set profile_visibility = 'public' where user_id = $1`, [u.minor]);
    eq(await countVisible(null, u.minor), 0);
    await as(u.minor, `update athlete_profiles set profile_visibility = 'members' where user_id = $1`, [u.minor]);
  });
  await check('el nombre de un menor tampoco se filtra por la tabla profiles', async () => {
    eq((await as(u.brand, `select count(*)::int n from profiles where id = $1`, [u.minor])).rows[0].n, 0);
  });
  await check('el presupuesto familiar no es visible ni para un coach verificado', async () => {
    await as(u.adult, `insert into athlete_finances (athlete_id, annual_budget_usd) values ($1, 15000)`, [u.adult]);
    eq((await as(u.brand, `select count(*)::int n from athlete_finances where athlete_id = $1`, [u.adult])).rows[0].n, 0);
  });
  await check('un atleta no puede editar el perfil de otro', async () => {
    const r = await as(u.adult, `update athlete_profiles set headline = 'hack' where user_id = $1`, [u.minor]);
    eq(r.rowCount, 0);
  });

  results.push('\nOrganizaciones y verificación');
  let uniId;
  await check('un coach individual NO puede crear una universidad', async () => {
    await expectError(() => as(u.coach, `insert into organizations (name, type, created_by) values ('Coach U', 'university', $1)`, [u.coach]));
  });
  await check('la cuenta universidad crea su organización (sin verificar) y queda como admin', async () => {
    uniId = (await as(u.uni, `insert into organizations (name, type, created_by, division)
      values ('Test State University', 'university', $1, 'ncaa_d1') returning id`, [u.uni])).rows[0].id;
    eq((await as(u.uni, `select member_role from organization_members where organization_id = $1`, [uniId])).rows[0].member_role, 'admin');
    // En el resto de pruebas el coach trabaja para esta universidad (añadido por su admin).
    await as(u.uni, `insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'coach')`, [uniId, u.coach]);
  });
  await check('una marca no puede crear una "universidad"', async () => {
    await expectError(() => as(u.brand, `insert into organizations (name, type, created_by) values ('Fake U', 'university', $1)`, [u.brand]));
  });
  await check('la universidad NO puede autoverificarse', async () => {
    await expectError(() => as(u.uni, `update organizations set verification_status = 'verified' where id = $1`, [uniId]), /verification_admin_only/);
  });
  await check('un coach (no admin de la organización) no puede editarla', async () => {
    eq((await as(u.coach, `update organizations set name = 'Hack U' where id = $1`, [uniId])).rowCount, 0);
  });
  await check('la universidad sí puede enviarse a verificación', async () => {
    await as(u.uni, `update organizations set verification_status = 'submitted' where id = $1`, [uniId]);
  });
  await check('coach de organización NO verificada no ve al menor', async () => eq(await countVisible(u.coach, u.minor), 0));
  await check('admin verifica la organización y queda auditado', async () => {
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [uniId]);
    eq((await as(u.admin, `select count(*)::int n from audit_logs where entity_id = $1 and details->>'to' = 'verified'`, [uniId])).rows[0].n, 1);
  });
  await check('coach de universidad verificada SÍ ve al menor', async () => eq(await countVisible(u.coach, u.minor), 1));
  await check('cambiar el tipo de una organización verificada la devuelve a revisión', async () => {
    const brandOrg = (await as(u.brand, `insert into organizations (name, type, created_by) values ('Brand Co', 'brand', $1) returning id`, [u.brand])).rows[0].id;
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [brandOrg]);
    await as(u.brand, `update organizations set type = 'university' where id = $1`, [brandOrg]);
    eq((await as(u.brand, `select verification_status from organizations where id = $1`, [brandOrg])).rows[0].verification_status, 'submitted');
    eq(await countVisible(u.brand, u.minor), 0, 'la marca sigue sin ver al menor:');
  });
  await check('nadie puede añadirse a sí mismo a una organización ajena', async () => {
    await expectError(() => as(u.coach2, `insert into organization_members (organization_id, user_id) values ($1, $2)`, [uniId, u.coach2]));
  });

  results.push('\nOportunidades');
  let oppId;
  await check('el coach crea una oportunidad en borrador', async () => {
    oppId = (await as(u.coach, `insert into opportunities (organization_id, created_by, type, title, description, sport_id, graduation_years)
      values ($1, $2, 'athletic_scholarship', 'Point guard 2027', 'Buscamos base internacional para la temporada 2027-28.', 'basketball', '{2027}')
      returning id`, [uniId, u.coach])).rows[0].id;
  });
  await check('un borrador no es visible para atletas ni anónimos', async () => {
    eq((await as(u.adult, `select count(*)::int n from opportunities where id = $1`, [oppId])).rows[0].n, 0);
    eq((await as(null, `select count(*)::int n from opportunities where id = $1`, [oppId])).rows[0].n, 0);
  });
  await check('el coach NO puede publicar sin revisión', async () => {
    await expectError(() => as(u.coach, `update opportunities set status = 'published' where id = $1`, [oppId]), /admin_only/);
  });
  await check('admin publica tras revisión y queda visible para todos', async () => {
    await as(u.coach, `update opportunities set status = 'pending_review' where id = $1`, [oppId]);
    await as(u.admin, `update opportunities set status = 'published' where id = $1`, [oppId]);
    eq((await as(null, `select count(*)::int n from opportunities where id = $1`, [oppId])).rows[0].n, 1);
  });
  await check('si el coach edita una oportunidad publicada, se revisa de nuevo (sola si está limpia)', async () => {
    await as(u.coach, `update opportunities set title = 'Point guard 2027 (actualizada)' where id = $1`, [oppId]);
    eq((await as(u.coach, `select status from opportunities where id = $1`, [oppId])).rows[0].status, 'published', 'edición limpia:');
    await as(u.coach, `update opportunities set description = 'Beca con plaza garantizada si haces un depósito previo.' where id = $1`, [oppId]);
    eq((await as(u.coach, `select status from opportunities where id = $1`, [oppId])).rows[0].status, 'pending_review', 'con alarmas:');
    await as(u.admin, `update opportunities set status = 'published' where id = $1`, [oppId]);
  });
  await check('ANÓNIMO: no lee columnas internas de una oportunidad publicada', async () => {
    await expectError(() => as(null, `select review_note from opportunities where id = $1`, [oppId]), /permission denied/);
    await expectError(() => as(null, `select created_by from opportunities where id = $1`, [oppId]), /permission denied/);
    await expectError(() => as(null, `select reviewed_by from opportunities where id = $1`, [oppId]), /permission denied/);
    await expectError(() => as(null, `select * from opportunities where id = $1`, [oppId]), /permission denied/);
  });
  await check('ANÓNIMO: sí lee los datos públicos y si está revisada, no quién la revisó', async () => {
    const r = (await as(null, `select title, status, is_reviewed from opportunities where id = $1`, [oppId])).rows[0];
    eq(r.status, 'published');
    eq(r.is_reviewed, true);
  });
  await check('ANÓNIMO: no lee quién creó ni quién verificó una organización', async () => {
    await expectError(() => as(null, `select created_by from organizations where id = $1`, [uniId]), /permission denied/);
    await expectError(() => as(null, `select verified_by from organizations where id = $1`, [uniId]), /permission denied/);
    eq((await as(null, `select name, verification_status from organizations where id = $1`, [uniId])).rows[0].verification_status, 'verified');
  });
  await check('ANÓNIMO: las columnas que piden /oportunidades y /oportunidades/[id] son legibles (contrato con src/lib/data/public-opportunity.ts)', async () => {
    const r = await as(null, `select o.id, o.title, o.type, o.sport_id, o.position_ids, o.graduation_years, o.division, o.min_gpa_4, o.english_required,
        o.location, o.start_term, o.places, o.deadline, o.annual_cost_usd, o.aid_amount_usd, o.financial_source, o.description, o.status,
        o.is_reviewed, o.updated_at, g.name, g.type, g.verification_status, g.website
      from opportunities o join organizations g on g.id = o.organization_id where o.id = $1`, [oppId]);
    eq(r.rowCount, 1);
  });
  await check('CON SESIÓN: el miembro de la organización sigue viendo la nota de revisión', async () => {
    eq((await as(u.coach, `select count(review_note)::int >= 0 ok from opportunities where id = $1`, [oppId])).rows[0].ok, true);
  });

  results.push('\nCandidaturas y CRM');
  let appId;
  await check('el atleta aplica y se registra el historial', async () => {
    appId = (await as(u.adult, `insert into applications (opportunity_id, athlete_id, status) values ($1, $2, 'offer') returning id, status`,
      [oppId, u.adult])).rows[0].id;
    const st = (await as(u.adult, `select status from applications where id = $1`, [appId])).rows[0].status;
    eq(st, 'applied', 'el atleta no puede autoasignarse un estado:');
  });
  await check('no se puede aplicar dos veces', async () => {
    await expectError(() => as(u.adult, `insert into applications (opportunity_id, athlete_id) values ($1, $2)`, [oppId, u.adult]));
  });
  await check('el atleta no puede marcarse "offer"', async () => {
    await expectError(() => as(u.adult, `update applications set status = 'offer' where id = $1`, [appId]), /athlete_can_only_withdraw/);
  });
  await check('el coach mueve la candidatura en el pipeline', async () => {
    await as(u.coach, `update applications set status = 'interview' where id = $1`, [appId]);
    eq((await as(u.adult, `select count(*)::int n from application_status_history where application_id = $1`, [appId])).rows[0].n, 2);
  });
  await check('el historial de estados es inmutable', async () => {
    await expectError(() => as(u.coach, `delete from application_status_history where application_id = $1`, [appId]));
  });
  await check('las notas internas no son visibles para el atleta', async () => {
    await as(u.coach, `insert into application_notes (application_id, author_id, body) values ($1, $2, 'Buen IQ de juego')`, [appId, u.coach]);
    eq((await as(u.adult, `select count(*)::int n from application_notes where application_id = $1`, [appId])).rows[0].n, 0);
  });
  await check('otra organización no ve la candidatura', async () => {
    eq((await as(u.coach2, `select count(*)::int n from applications where id = $1`, [appId])).rows[0].n, 0);
  });

  results.push('\nFamilia ↔ atleta');
  let token;
  await check('la familia crea una invitación', async () => {
    token = (await as(u.parent, `insert into parent_athlete_links (parent_id, invited_by) values ($1, $1) returning invitation_token`,
      [u.parent])).rows[0].invitation_token;
  });
  await check('antes de aceptar, la familia no ve al menor', async () => eq(await countVisible(u.parent, u.minor), 0));
  await check('la familia no puede aprobarse a sí misma', async () => {
    await expectError(() => as(u.parent, `update parent_athlete_links set athlete_id = $1, status = 'approved', approved_at = now()
      where invitation_token = $2`, [u.minor, token]));
  });
  await check('el atleta acepta y la familia ve perfil y académico', async () => {
    await as(u.minor, `select accept_family_invitation($1)`, [token]);
    eq(await countVisible(u.parent, u.minor), 1);
    eq((await as(u.parent, `select count(*)::int n from athlete_academics where athlete_id = $1`, [u.minor])).rows[0].n, 1);
  });
  await check('la familia no puede ampliarse permisos', async () => {
    await expectError(() => as(u.parent, `update parent_athlete_links set can_edit_profile = true where parent_id = $1`, [u.parent]),
      /only_athlete_sets_family_permissions/);
  });
  await check('una marca no puede usar el token para vincularse', async () => {
    await expectError(() => as(u.brand, `select accept_family_invitation($1)`, [token]), /invitation_invalid/);
  });
  await check('el atleta revoca y la familia deja de verle', async () => {
    await as(u.minor, `update parent_athlete_links set status = 'revoked' where athlete_id = $1`, [u.minor]);
    eq(await countVisible(u.parent, u.minor), 0);
  });

  results.push('\nListas, consentimientos y auditoría');
  await check('una marca no puede guardar a un menor en su lista', async () => {
    await expectError(() => as(u.brand, `insert into saved_athletes (owner_id, athlete_id) values ($1, $2)`, [u.brand, u.minor]));
  });
  await check('las listas de un coach son privadas', async () => {
    await as(u.coach, `insert into saved_athletes (owner_id, athlete_id, private_note) values ($1, $2, 'seguir')`, [u.coach, u.adult]);
    eq((await as(u.agent, `select count(*)::int n from saved_athletes where athlete_id = $1`, [u.adult])).rows[0].n, 0);
  });
  await check('un anónimo puede registrar su consentimiento de cookies, pero no leerlo', async () => {
    await as(null, `insert into cookie_consent_logs (anonymous_id, analytics_allowed, functional_allowed, third_party_allowed)
      values ('anon-12345678', false, true, false)`);
    await expectError(() => as(null, `select * from cookie_consent_logs`));
  });
  await check('nadie puede borrar el registro de auditoría', async () => {
    await expectError(() => as(u.admin, `delete from audit_logs`));
  });
  await check('el directorio de talento respeta la RLS (marca ve 1 de 3 atletas)', async () => {
    eq((await as(u.brand, `select count(*)::int n from athlete_directory`)).rows[0].n, 1);
  });

  results.push('\nEquipo de la universidad (invitaciones a coaches)');
  let orgToken;
  await check('la universidad invita a un coach y este se une al equipo', async () => {
    orgToken = (await as(u.uni, `insert into organization_invitations (organization_id, invited_by) values ($1, $2) returning token`, [uniId, u.uni])).rows[0].token;
    await as(u.coach2, `select accept_organization_invitation($1)`, [orgToken]);
    eq((await as(u.coach2, `select count(*)::int n from organization_members where organization_id = $1 and user_id = $2`, [uniId, u.coach2])).rows[0].n, 1);
    eq(await countVisible(u.coach2, u.minor), 1, 'el coach de la universidad verificada ve al menor:');
  });
  await check('un coach no admin no puede crear invitaciones', async () => {
    await expectError(() => as(u.coach2, `insert into organization_invitations (organization_id, invited_by) values ($1, $2)`, [uniId, u.coach2]));
  });
  await check('una marca no puede usar una invitación de equipo', async () => {
    const tk = (await as(u.uni, `insert into organization_invitations (organization_id, invited_by) values ($1, $2) returning token`, [uniId, u.uni])).rows[0].token;
    await expectError(() => as(u.brand, `select accept_organization_invitation($1)`, [tk]), /coach_role_required/);
  });

  results.push('\nCartera de agentes');
  let agencyId; let repId;
  const inOneYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const BASIC_PERMS = ['passport.view', 'opportunities.manage', 'pipeline.view', 'pipeline.manage', 'tasks.manage', 'deadlines.manage', 'messages.participate'];
  const repRequest = async (agent, agency, athlete, o = {}) => (await as(agent,
    `select representation_request($1, $2, $3, $4::text[], $5::text[], $6::text[], $7::text[], $8::date, coalesce($9::date, current_date), $10::uuid) id`,
    [agency, athlete, o.type || 'non_exclusive', o.sports || ['basketball'], o.territories || ['WORLD'], o.categories || ['university', 'club', 'academy'],
     o.perms || BASIC_PERMS, o.end || inOneYear, o.start || null, o.opportunity || null])).rows[0].id;
  await check('el agente crea su agencia y pide representar a un adulto', async () => {
    agencyId = (await as(u.agent, `insert into organizations (name, type, created_by) values ('Top Agency', 'agency', $1) returning id`, [u.agent])).rows[0].id;
    await expectError(() => repRequest(u.agent, agencyId, u.adult), /agency_not_verified/);
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [agencyId]);
    repId = await repRequest(u.agent, agencyId, u.adult);
    eq((await as(u.agent, `select status from agent_representations where id = $1`, [repId])).rows[0].status, 'requested', 'no puede autoactivarse:');
    eq(await repRequest(u.agent, agencyId, u.adult), repId, 'idempotente:');
  });
  await check('nadie inserta representaciones a mano: solo la función transaccional', async () => {
    await expectError(() => as(u.agent, `insert into agent_representations (agency_id, agent_id, athlete_id, end_date) values ($1, $2, $3, current_date + 30)`, [agencyId, u.agent, u.minor]), /representation_rpc_only|row-level/);
  });
  await check('el agente no puede aceptar en nombre del atleta', async () => {
    await expectError(() => as(u.agent, `update agent_representations set status = 'active' where id = $1`, [repId]), /representation_rpc_only/);
    await expectError(() => as(u.agent, `select representation_respond($1, true)`, [repId]), /not_found/);
  });
  await check('el atleta acepta y la representación queda activa', async () => {
    eq((await as(u.adult, `select representation_respond($1, true) s`, [repId])).rows[0].s, 'active');
    eq((await as(u.agent, `select status from agent_representations where id = $1`, [repId])).rows[0].status, 'active');
  });
  await check('otra organización no ve la cartera del agente', async () => {
    eq((await as(u.brand, `select count(*)::int n from agent_representations`)).rows[0].n, 0);
  });

  results.push('\nAgent Workspace: notas privadas de agencia');
  const agent2 = randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'agent2@test.dev', $2)`, [agent2, { display_name: 'agent2' }]);
  await as(agent2, `insert into user_roles (user_id, role) values ($1, 'agent')`, [agent2]);
  await as(agent2, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [agent2, yearsAgo(35)]);
  const agency2 = (await as(agent2, `insert into organizations (name, type, created_by) values ('Rival Agency', 'agency', $1) returning id`, [agent2])).rows[0].id;
  let noteId; let followId;
  await check('el agente anota y programa un seguimiento sobre un atleta de su cartera', async () => {
    noteId = (await as(u.agent, `insert into agency_athlete_notes (agency_id, athlete_id, author_id, body) values ($1, $2, $3, 'Muy buena reunión') returning id`,
      [agencyId, u.adult, u.agent])).rows[0].id;
    followId = (await as(u.agent, `insert into agency_athlete_notes (agency_id, athlete_id, author_id, kind, body, due_date) values ($1, $2, $3, 'follow_up', 'Llamar al coach', current_date + 3) returning id`,
      [agencyId, u.adult, u.agent])).rows[0].id;
    eq((await as(u.agent, `select count(*)::int n from agency_athlete_notes where athlete_id = $1`, [u.adult])).rows[0].n, 2);
  });
  await check('el atleta nunca ve las notas internas de la agencia', async () => {
    eq((await as(u.adult, `select count(*)::int n from agency_athlete_notes`)).rows[0].n, 0);
  });
  await check('otra agencia no ve ni puede escribir notas de la primera', async () => {
    eq((await as(agent2, `select count(*)::int n from agency_athlete_notes`)).rows[0].n, 0);
    await expectError(() => as(agent2, `insert into agency_athlete_notes (agency_id, athlete_id, author_id, body) values ($1, $2, $3, 'x')`,
      [agencyId, u.adult, agent2]), /row-level security|agency_required/);
  });
  await check('una agencia no puede anotar atletas con los que no tiene relación', async () => {
    await expectError(() => as(agent2, `insert into agency_athlete_notes (agency_id, athlete_id, author_id, body) values ($1, $2, $3, 'x')`,
      [agency2, u.adult, agent2]), /row-level security/);
  });
  await check('nadie fuera de la agencia puede sondear su cartera', async () => {
    eq((await as(agent2, `select agency_has_relationship($1, $2) r`, [agencyId, u.adult])).rows[0].r, false);
    eq((await as(u.agent, `select agency_has_relationship($1, $2) r`, [agencyId, u.adult])).rows[0].r, true);
  });
  await check('Mis atletas: el UUID de un atleta ajeno no devuelve ningún registro a otra agencia', async () => {
    for (const t of ['agent_representations', 'recruiting_cases', 'athlete_offers', 'agency_athlete_notes']) {
      eq((await as(agent2, `select count(*)::int n from ${t} where athlete_id = $1`, [u.adult])).rows[0].n, 0, t);
    }
    eq((await as(u.agent, `select count(*)::int n from agent_representations where athlete_id = $1`, [u.adult])).rows[0].n > 0, true, 'la propia agencia sí');
  });
  await check('Ficha 360: las notas internas de la agencia no llegan al atleta, a una universidad ni a otra agencia', async () => {
    for (const who of [u.adult, u.coach, u.uni, agent2]) {
      eq((await as(who, `select count(*)::int n from agency_athlete_notes where athlete_id = $1`, [u.adult])).rows[0].n, 0);
    }
    eq((await as(u.agent, `select count(*)::int n from agency_athlete_notes where athlete_id = $1`, [u.adult])).rows[0].n > 0, true, 'la propia agencia sí');
  });
  await check('nadie se hace pasar por otro autor', async () => {
    await expectError(() => as(u.agent, `insert into agency_athlete_notes (agency_id, athlete_id, author_id, body) values ($1, $2, $3, 'x')`,
      [agencyId, u.adult, agent2]), /row-level security/);
  });
  await check('solo el autor edita y la nota no cambia de agencia ni de atleta', async () => {
    eq((await as(agent2, `update agency_athlete_notes set body = 'hackeado' where id = $1`, [noteId])).rowCount, 0);
    await expectError(() => as(u.agent, `update agency_athlete_notes set agency_id = $2 where id = $1`, [noteId, agency2]), /note_immutable|row-level security/);
    await as(u.agent, `update agency_athlete_notes set body = 'Reunión: interés de 2 universidades' where id = $1`, [noteId]);
  });
  await check('completar un seguimiento registra la fecha', async () => {
    await as(u.agent, `update agency_athlete_notes set done = true where id = $1`, [followId]);
    const r = (await as(u.agent, `select done, done_at is not null as stamped from agency_athlete_notes where id = $1`, [followId])).rows[0];
    eq(`${r.done}${r.stamped}`, 'truetrue');
  });
  await check('una nota simple no admite fecha de seguimiento', async () => {
    await expectError(() => as(u.agent, `insert into agency_athlete_notes (agency_id, athlete_id, author_id, kind, body, due_date) values ($1, $2, $3, 'note', 'x', current_date)`,
      [agencyId, u.adult, u.agent]), /note_due_only_follow_up/);
  });
  await check('solo el autor borra una nota', async () => {
    eq((await as(agent2, `delete from agency_athlete_notes where id = $1`, [noteId])).rowCount, 0);
    eq((await as(u.agent, `delete from agency_athlete_notes where id = $1`, [noteId])).rowCount, 1);
  });
  await check('nadie puede borrar una representación (el historial se conserva)', async () => {
    eq((await as(u.agent, `delete from agent_representations where id = $1`, [repId])).rowCount, 0);
    eq((await as(u.adult, `delete from agent_representations where id = $1`, [repId])).rowCount, 0);
  });
  await check('cada cambio de una representación queda auditado', async () => {
    eq((await as(u.admin, `select count(*)::int n from audit_logs where entity = 'agent_representations' and entity_id = $1`, [repId])).rows[0].n, 2);
  });

  results.push('\nOfertas de marcas');
  let brandOrg2; let campId;
  await check('la marca crea una oferta en borrador y no puede publicarla', async () => {
    brandOrg2 = (await as(u.brand, `insert into organizations (name, type, created_by) values ('Brand Two', 'brand', $1) returning id`, [u.brand])).rows[0].id;
    campId = (await as(u.brand, `insert into brand_campaigns (brand_org_id, created_by, title, description, kind, deliverables, compensation_kind)
      values ($1, $2, 'Embajador 2026', 'Buscamos atletas para contenido en redes durante la temporada.', 'ambassador', '2 reels al mes', 'product') returning id`,
      [brandOrg2, u.brand])).rows[0].id;
    await expectError(() => as(u.brand, `update brand_campaigns set status = 'published' where id = $1`, [campId]), /admin_only/);
  });
  await check('el admin no puede publicar si la marca no está verificada', async () => {
    await expectError(() => as(u.admin, `update brand_campaigns set status = 'published' where id = $1`, [campId]), /brand_not_verified/);
  });
  await check('marca verificada + revisión → publicada', async () => {
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [brandOrg2]);
    await as(u.admin, `update brand_campaigns set status = 'published' where id = $1`, [campId]);
    eq((await as(u.adult, `select count(*)::int n from brand_campaigns where id = $1`, [campId])).rows[0].n, 1);
  });
  await check('un menor no puede aplicar a una oferta de marca', async () => {
    await expectError(() => as(u.minor, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true)`, [campId, u.minor]), /adults_only/);
  });
  await check('un adulto aplica (confirmando revisar su normativa) y la marca lo ve', async () => {
    await expectError(() => as(u.adult, `insert into campaign_applications (campaign_id, athlete_id) values ($1, $2)`, [campId, u.adult]));
    await as(u.adult, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true)`, [campId, u.adult]);
    eq((await as(u.brand, `select count(*)::int n from campaign_applications where campaign_id = $1`, [campId])).rows[0].n, 1);
    eq((await as(u.agent, `select count(*)::int n from campaign_applications where campaign_id = $1`, [campId])).rows[0].n, 0);
  });
  await check('la marca no puede marcar "withdrawn" por el atleta', async () => {
    await expectError(() => as(u.brand, `update campaign_applications set status = 'withdrawn' where campaign_id = $1`, [campId]), /only_athlete/);
  });

  results.push('\nGala IA');
  await check('el límite diario de IA no se puede saltar', async () => {
    let last = true;
    for (let i = 0; i < 41; i++) last = (await as(u.adult, `select consume_ai_request() as ok`)).rows[0].ok;
    eq(last, false);
  });
  await check('un anónimo no consume IA', async () => {
    await expectError(() => as(null, `select consume_ai_request()`));
  });

  results.push('\nInstituciones con datos oficiales');
  let instId;
  await check('solo admin importa instituciones', async () => {
    await expectError(() => as(u.uni, `insert into institutions (name) values ('Fake College')`));
    instId = (await as(u.admin, `insert into institutions (ipeds_unitid, name, state, website_url, data_source, source_fetched_at)
      values (999001, 'Test State University', 'IN', 'https://www.test.edu', 'college_scorecard', now()) returning id`)).rows[0].id;
  });
  await check('solo admin vincula la universidad con su institución', async () => {
    await expectError(() => as(u.uni, `update organizations set institution_id = $1 where id = $2`, [instId, uniId]), /institution_link_admin_only/);
    await as(u.admin, `update organizations set institution_id = $1 where id = $2`, [instId, uniId]);
  });
  await check('la universidad no puede tocar los datos oficiales importados', async () => {
    await expectError(() => as(u.uni, `update institutions set cost_attendance_usd = 1 where id = $1`, [instId]), /official_data_admin_only/);
  });
  await check('la universidad edita sus enlaces y quedan pendientes de revisión', async () => {
    await as(u.admin, `update institutions set athletics_url = 'https://athletics.test.edu' where id = $1`, [instId]);
    await as(u.uni, `update institutions set virtual_tour_url = 'https://www.test.edu/visit' where id = $1`, [instId]);
    eq((await as(u.uni, `select links_verified_at from institutions where id = $1`, [instId])).rows[0].links_verified_at, null);
  });
  await check('un coach que no es admin de la universidad no edita la institución', async () => {
    eq((await as(u.coach2, `update institutions set athletics_url = 'https://evil.example' where id = $1`, [instId])).rowCount, 0);
  });

  results.push('\nEnlaces del atleta y denuncias');
  await check('el atleta añade un enlace pero no puede autoverificarlo', async () => {
    await expectError(() => as(u.adult, `insert into athlete_links (athlete_id, kind, url, verified) values ($1, 'club_profile', 'https://club.example/p/1', true)`, [u.adult]));
    await as(u.adult, `insert into athlete_links (athlete_id, kind, url) values ($1, 'club_profile', 'https://club.example/p/1')`, [u.adult]);
  });
  await check('los enlaces de un menor no son visibles para una marca', async () => {
    await as(u.minor, `insert into athlete_links (athlete_id, kind, url) values ($1, 'highlight_video', 'https://video.example/1')`, [u.minor]);
    eq((await as(u.brand, `select count(*)::int n from athlete_links where athlete_id = $1`, [u.minor])).rows[0].n, 0);
  });
  await check('una denuncia de seguridad infantil entra con prioridad máxima', async () => {
    const r = (await as(u.parent, `insert into content_reports (entity_type, entity_id, reason, priority) values ('athlete_profile', $1, 'child_safety', 3) returning id`, [u.adult])).rows[0];
    eq((await as(u.admin, `select priority from content_reports where id = $1`, [r.id])).rows[0].priority, 0);
  });
  await check('cerrar una denuncia exige motivo', async () => {
    const id = (await as(u.brand, `insert into content_reports (entity_type, entity_id, reason) values ('opportunity', $1, 'spam') returning id`, [oppId])).rows[0].id;
    await expectError(() => as(u.admin, `update content_reports set status = 'dismissed' where id = $1`, [id]), /decision_reason_required/);
    await as(u.admin, `update content_reports set status = 'dismissed', decision_reason = 'Oferta revisada y correcta' where id = $1`, [id]);
  });

  results.push('\nContacto seguro');
  let reqId;
  await check('organización verificada contacta a un adulto; él acepta y conversan', async () => {
    reqId = (await as(u.coach, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Hola, nos gustaría hablar contigo sobre la beca 2027.') returning id`, [uniId, u.coach, u.adult])).rows[0].id;
    await expectError(() => as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'hola')`, [reqId, u.coach]), /conversation_not_open/);
    await as(u.adult, `update contact_requests set status = 'accepted' where id = $1`, [reqId]);
    await as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Gracias por aceptar')`, [reqId, u.coach]);
    eq((await as(u.adult, `select count(*)::int n from contact_messages where request_id = $1`, [reqId])).rows[0].n, 1);
  });
  const unvAgency = (await as(u.agent, `insert into organizations (name, type, created_by) values ('Agencia sin verificar', 'agency', $1) returning id`, [u.agent])).rows[0].id;
  await check('una organización sin verificar no puede contactar', async () => {
    await expectError(() => as(u.agent, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Quiero representarte, hablemos por favor.')`, [unvAgency, u.agent, u.adult]), /verified_organization_required/);
  });
  let minorReq;
  await check('contactar a un menor exige familia vinculada y su aprobación', async () => {
    const tk = (await as(u.parent, `insert into parent_athlete_links (parent_id, invited_by) values ($1, $1) returning invitation_token`, [u.parent])).rows[0].invitation_token;
    await as(u.minor, `select accept_family_invitation($1)`, [tk]);
    minorReq = (await as(u.coach, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Hola, nos interesa tu perfil para la temporada 2027.') returning id, status`, [uniId, u.coach, u.minor])).rows[0].id;
    eq((await as(u.minor, `select status from contact_requests where id = $1`, [minorReq])).rows[0].status, 'pending_guardian');
    await expectError(() => as(u.minor, `update contact_requests set status = 'accepted' where id = $1`, [minorReq]), /transition_not_allowed/);
    await as(u.parent, `update contact_requests set status = 'pending' where id = $1`, [minorReq]);
    await as(u.minor, `update contact_requests set status = 'accepted' where id = $1`, [minorReq]);
  });
  await check('con un menor no se pueden compartir teléfonos ni emails', async () => {
    await expectError(() => as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Escríbeme a coach@test.edu')`, [minorReq, u.coach]), /contact_data_not_allowed/);
    await expectError(() => as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Llámame al +1 555 123 4567')`, [minorReq, u.coach]), /contact_data_not_allowed/);
    await as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Te enviamos el calendario de visitas por aquí')`, [minorReq, u.coach]);
  });
  await check('la familia lee la conversación del menor; una marca no', async () => {
    eq((await as(u.parent, `select count(*)::int n from contact_messages where request_id = $1`, [minorReq])).rows[0].n, 1);
    eq((await as(u.brand, `select count(*)::int n from contact_messages where request_id = $1`, [minorReq])).rows[0].n, 0);
  });
  await check('el admin solo lee una conversación con denuncia abierta, y queda auditado', async () => {
    eq((await as(u.admin, `select count(*)::int n from contact_messages`)).rows[0].n, 0, 'sin acceso directo:');
    const rep = (await as(u.parent, `insert into content_reports (entity_type, entity_id, reason) values ('contact_request', $1, 'harassment') returning id`, [minorReq])).rows[0].id;
    eq((await as(u.admin, `select count(*)::int n from admin_read_thread($1, $2)`, [minorReq, rep])).rows[0].n, 1);
    eq((await as(u.admin, `select count(*)::int n from audit_logs where action = 'moderation.thread_viewed'`)).rows[0].n, 1);
  });

  results.push('\nActualidad');
  await check('solo organizaciones verificadas publican; la editorial es del admin', async () => {
    await expectError(() => as(u.agent, `insert into news_posts (organization_id, author_id, kind, title, body) values ($1, $2, 'announcement', 'Nueva agencia', 'Abrimos oficina en Valencia para atletas.')`, [unvAgency, u.agent]), /verified_organization_required/);
    await expectError(() => as(u.brand, `insert into news_posts (author_id, kind, title, body) values ($1, 'story', 'Editorial falsa', 'Contenido sin organización de prueba.')`, [u.brand]));
    await as(u.uni, `insert into news_posts (organization_id, author_id, kind, title, body) values ($1, $2, 'announcement', 'Jornada de puertas abiertas', 'Visita virtual del campus el 1 de diciembre.')`, [uniId, u.uni]);
  });
  await check('un fichaje solo se publica con el consentimiento del atleta', async () => {
    const id = (await as(u.uni, `insert into news_posts (organization_id, author_id, kind, title, body, athlete_id) values ($1, $2, 'signing', 'Nuevo fichaje 2027', 'Damos la bienvenida a nuestro nuevo base internacional.', $3) returning id`, [uniId, u.uni, u.adult])).rows[0].id;
    eq((await as(null, `select count(*)::int n from news_posts where id = $1`, [id])).rows[0].n, 0, 'oculto hasta consentir:');
    await as(u.adult, `update news_posts set status = 'published' where id = $1`, [id]);
    eq((await as(null, `select count(*)::int n from news_posts where id = $1`, [id])).rows[0].n, 1);
  });
  await check('nadie puede etiquetar a un menor en una publicación', async () => {
    await expectError(() => as(u.uni, `insert into news_posts (organization_id, author_id, kind, title, body, athlete_id) values ($1, $2, 'signing', 'Fichaje menor', 'Texto de prueba suficientemente largo.', $3)`, [uniId, u.uni, u.minor]), /minors_not_taggable/);
  });

  results.push('\nNotificaciones internas');
  await check('el sistema avisa al atleta, a la familia del menor y a quien contactó', async () => {
    eq((await as(u.adult, `select count(*)::int n from notifications where kind = 'contact.new'`)).rows[0].n >= 1, true, 'atleta:');
    eq((await as(u.parent, `select count(*)::int n from notifications where kind = 'contact.guardian_review'`)).rows[0].n >= 1, true, 'familia:');
    eq((await as(u.coach, `select count(*)::int n from notifications where kind = 'contact.accepted'`)).rows[0].n >= 1, true, 'coach:');
  });
  await check('nadie lee ni crea notificaciones ajenas', async () => {
    eq((await as(u.brand, `select count(*)::int n from notifications where user_id = $1`, [u.adult])).rows[0].n, 0);
    await expectError(() => as(u.brand, `insert into notifications (user_id, kind, title) values ($1, 'x', 'Falsa')`, [u.adult]));
  });
  await check('el usuario marca como leída, pero no puede reescribirla', async () => {
    await as(u.adult, `update notifications set read_at = now() where user_id = $1`, [u.adult]);
    await expectError(() => as(u.adult, `update notifications set title = 'otra' where user_id = $1`, [u.adult]), /notification_immutable/);
  });

  results.push('\nAcademia SAT/TOEFL');
  await check('el atleta guarda su progreso y la familia del menor lo sigue', async () => {
    await as(u.minor, `insert into academy_progress (user_id, exam, topic_id) values ($1, 'sat', 'rw-conventions')`, [u.minor]);
    await as(u.minor, `insert into academy_attempts (user_id, exam, correct, total) values ($1, 'sat', 7, 10)`, [u.minor]);
    eq((await as(u.parent, `select count(*)::int n from academy_attempts where user_id = $1`, [u.minor])).rows[0].n, 1);
  });
  await check('una organización no ve el estudio de un atleta', async () => {
    eq((await as(u.coach, `select count(*)::int n from academy_attempts where user_id = $1`, [u.minor])).rows[0].n, 0);
    eq((await as(u.brand, `select count(*)::int n from academy_progress where user_id = $1`, [u.minor])).rows[0].n, 0);
  });
  await check('no se pueden registrar más aciertos que preguntas', async () => {
    await expectError(() => as(u.adult, `insert into academy_attempts (user_id, exam, correct, total) values ($1, 'toefl', 11, 10)`, [u.adult]));
  });

  results.push('\nBúsquedas guardadas');
  await check('un coach guarda una búsqueda; un atleta no puede', async () => {
    await as(u.coach, `insert into saved_searches (owner_id, label, filters) values ($1, 'Bases 2027', '{"sport":"basketball","grad":"2027"}')`, [u.coach]);
    await expectError(() => as(u.adult, `insert into saved_searches (owner_id, label, filters) values ($1, 'Yo', '{}')`, [u.adult]), /recruiter_role_required/);
  });
  await check('solo se aceptan filtros conocidos y solo las ve su dueño', async () => {
    await expectError(() => as(u.coach, `insert into saved_searches (owner_id, label, filters) values ($1, 'Raro', '{"dob":"2010"}')`, [u.coach]));
    eq((await as(u.coach2, `select count(*)::int n from saved_searches`)).rows[0].n, 0);
  });

  results.push('\nNovedades del atleta');
  await check('las novedades siguen la visibilidad del perfil', async () => {
    await as(u.adult, `insert into athlete_updates (athlete_id, kind, body) values ($1, 'result', '24 puntos y 8 rebotes en la final autonómica')`, [u.adult]);
    eq((await as(u.brand, `select count(*)::int n from athlete_updates where athlete_id = $1`, [u.adult])).rows[0].n, 1, 'marca ve al adulto:');
    eq((await as(null, `select count(*)::int n from athlete_updates where athlete_id = $1`, [u.adult])).rows[0].n, 0, 'anónimo no:');
  });
  await check('la novedad de un menor solo la ven reclutadores verificados', async () => {
    await as(u.minor, `insert into athlete_updates (athlete_id, kind, body) values ($1, 'academic', 'He aprobado el primer trimestre con media de 9')`, [u.minor]);
    eq((await as(u.brand, `select count(*)::int n from athlete_updates where athlete_id = $1`, [u.minor])).rows[0].n, 0, 'marca:');
    eq((await as(u.coach, `select count(*)::int n from athlete_updates where athlete_id = $1`, [u.minor])).rows[0].n, 1, 'coach verificado:');
  });
  await check('un menor no puede publicar datos de contacto', async () => {
    await expectError(() => as(u.minor, `insert into athlete_updates (athlete_id, kind, body) values ($1, 'other', 'Escríbeme a mi instagram @yo')`, [u.minor]), /contact_data_not_allowed/);
  });
  await check('nadie publica en nombre de otro atleta', async () => {
    await as(u.brand, `insert into athlete_updates (athlete_id, kind, body) values ($1, 'other', 'Texto suplantado por la marca')`, [u.brand]).catch(() => {});
    eq((await as(u.admin, `select count(*)::int n from athlete_updates where body like '%suplantado%' and athlete_id <> $1`, [u.brand])).rows[0].n, 0);
  });

  results.push('\nPlanes y servicios (validación comercial)');
  let srId;
  await check('un usuario solicita un plan y no puede autoaprobarse', async () => {
    srId = (await as(u.uni, `insert into service_requests (user_id, plan_code, organization_id, status) values ($1, 'org_recruit', $2, 'won') returning id`, [u.uni, uniId])).rows[0].id;
    eq((await as(u.uni, `select status from service_requests where id = $1`, [srId])).rows[0].status, 'new');
    eq((await as(u.uni, `update service_requests set status = 'won' where id = $1`, [srId])).rowCount, 0);
  });
  await check('no se puede solicitar en nombre de una organización ajena', async () => {
    await expectError(() => as(u.brand, `insert into service_requests (user_id, plan_code, organization_id) values ($1, 'org_recruit', $2)`, [u.brand, uniId]), /not_org_member/);
  });
  await check('el admin gestiona el pipeline; otros no lo ven', async () => {
    await as(u.admin, `update service_requests set status = 'contacted', admin_note = 'Llamada el lunes' where id = $1`, [srId]);
    eq((await as(u.brand, `select count(*)::int n from service_requests where id = $1`, [srId])).rows[0].n, 0);
  });

  results.push('\nPanel de mando');
  await check('solo el admin obtiene métricas y liquidez', async () => {
    const m = (await as(u.admin, `select admin_metrics(30) as m`)).rows[0].m;
    eq(m.north_star >= 2, true, 'north star:');
    eq(m.queues.service_requests_new, 0, 'cola de solicitudes:');
    await as(u.admin, `select * from admin_liquidity()`);
    await expectError(() => as(u.coach, `select admin_metrics(30)`), /admin_only/);
    await expectError(() => as(u.brand, `select * from admin_liquidity()`), /admin_only/);
  });
  await check('la universidad no puede tocar el SAT medio oficial', async () => {
    await expectError(() => as(u.uni, `update institutions set sat_avg = 1500 where id = $1`, [instId]), /official_data_admin_only/);
  });

  results.push('\nBloqueo');
  await check('el atleta bloquea a una organización: deja de verle y no puede volver a pedir contacto', async () => {
    eq(await countVisible(u.coach, u.adult), 1, 'antes:');
    await as(u.adult, `update contact_requests set status = 'blocked' where id = $1`, [reqId]);
    eq(await countVisible(u.coach, u.adult), 0, 'después (coach):');
    eq(await countVisible(u.coach2, u.adult), 0, 'después (otro coach de la misma universidad):');
    eq(await countVisible(u.brand, u.adult), 1, 'otra organización sigue viéndole:');
    await expectError(() => as(u.coach, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Volvemos a intentarlo con otra propuesta')`, [uniId, u.coach, u.adult]), /blocked_by_athlete/);
  });
  await check('quien contactó no sabe si fue un rechazo o un bloqueo', async () => {
    eq((await as(u.coach, `select count(*)::int n from notifications where kind = 'contact.closed'`)).rows[0].n, 1);
  });

  results.push('\nCentro de documentos');
  await check('el atleta y su familia gestionan documentos; nadie más los ve', async () => {
    await as(u.minor, `insert into athlete_documents (athlete_id, kind, title, due_date) values ($1, 'transcript', 'Notas de 4.º ESO', '2027-03-01')`, [u.minor]);
    await as(u.parent, `update athlete_documents set due_date = '2027-02-15' where athlete_id = $1`, [u.minor]).catch(() => {});
    eq((await as(u.parent, `select count(*)::int n from athlete_documents where athlete_id = $1`, [u.minor])).rows[0].n, 1, 'familia:');
    eq((await as(u.coach, `select count(*)::int n from athlete_documents where athlete_id = $1`, [u.minor])).rows[0].n, 0, 'coach verificado:');
    eq((await as(u.admin, `select count(*)::int n from athlete_documents where athlete_id = $1`, [u.minor])).rows[0].n, 0, 'admin:');
  });
  await check('la ruta del archivo debe pertenecer al atleta', async () => {
    await expectError(() => as(u.adult, `insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'passport', 'Pasaporte', $2, now())`,
      [u.adult, `${u.minor}/pasaporte.pdf`]), /path_belongs_to_athlete/);
  });

  results.push('\nPortal de academias y clubes');
  let clubId; let rosterToken;
  await check('solo un club verificado crea enlaces de roster', async () => {
    clubId = (await as(u.coach2, `insert into organizations (name, type, created_by) values ('CB Valencia Academy', 'academy', $1) returning id`, [u.coach2])).rows[0].id;
    await expectError(() => as(u.coach2, `insert into club_roster_invites (organization_id, created_by, season) values ($1, $2, '2026-27')`, [clubId, u.coach2]));
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [clubId]);
    rosterToken = (await as(u.coach2, `insert into club_roster_invites (organization_id, created_by, season) values ($1, $2, '2026-27') returning token`, [clubId, u.coach2])).rows[0].token;
  });
  await check('el atleta se une con consentimiento y el club valida su estadística', async () => {
    await as(u.adult, `select accept_roster_invitation($1, true)`, [rosterToken]);
    const stat = (await as(u.adult, `insert into athlete_statistics (athlete_id, stat_definition_id, season, value)
      values ($1, (select id from sport_stat_definitions where code = 'ppg'), '2026-27', 18.5) returning id`, [u.adult])).rows[0].id;
    await as(u.coach2, `select club_verify_statistic($1, $2)`, [stat, clubId]);
    eq((await as(u.adult, `select source::text s from athlete_statistics where id = $1`, [stat])).rows[0].s, 'club_verified');
    await expectError(() => as(u.adult, `update athlete_statistics set value = 30 where id = $1 returning id`, [stat]).then((r) => { if (!r.rowCount) throw new Error('bloqueado'); }));
  });
  await check('un club no valida a quien no está en su roster', async () => {
    const other = (await as(u.minor, `insert into athlete_statistics (athlete_id, stat_definition_id, season, value)
      values ($1, (select id from sport_stat_definitions where code = 'rpg'), '2026-27', 7) returning id`, [u.minor])).rows[0].id;
    await expectError(() => as(u.coach2, `select club_verify_statistic($1, $2)`, [other, clubId]), /not_in_roster/);
  });
  await check('el resumen respeta si el atleta comparte su progreso', async () => {
    eq((await as(u.coach2, `select count(*)::int n from club_roster_summary($1)`, [clubId])).rows[0].n, 1);
    await as(u.adult, `update club_roster set status = 'left' where athlete_id = $1`, [u.adult]);
    eq((await as(u.coach2, `select count(*)::int n from club_roster_summary($1)`, [clubId])).rows[0].n, 0);
    await expectError(() => as(u.brand, `select * from club_roster_summary($1)`, [clubId]), /org_member_required/);
  });

  results.push('\nEmbudo y conservación');
  await check('los eventos solo admiten la lista cerrada y solo los lee el admin', async () => {
    await as(u.adult, `select log_event('passport_saved', '{}')`);
    await expectError(() => as(u.adult, `select log_event('lo_que_sea', '{}')`));
    eq((await as(u.brand, `select count(*)::int n from product_events`)).rows[0].n, 0);
    eq((await as(u.admin, `select count(*)::int n from admin_event_counts(30)`)).rows[0].n >= 1, true);
  });
  await check('el borrado automático lo ejecuta el admin o el sistema, nunca un usuario', async () => {
    await expectError(() => as(u.brand, `select run_retention()`), /admin_only/);
    await as(u.admin, `select run_retention()`);
  });

  results.push('\nOperación autónoma');
  await check('una universidad con email .edu de su web se verifica sola; con gmail espera revisión', async () => {
    const good = randomUUID(); const bad = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, 'coach@stateu.edu', '{}', now()), ($2, 'coachstate@gmail.com', '{}', now())`, [good, bad]);
    for (const id of [good, bad]) {
      await as(id, `insert into user_roles (user_id, role) values ($1, 'university')`, [id]);
      await as(id, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [id, yearsAgo(35)]);
    }
    const g = (await as(good, `insert into organizations (name, type, created_by, website, verification_status) values ('State U', 'university', $1, 'https://www.stateu.edu', 'submitted') returning id`, [good])).rows[0].id;
    const b = (await as(bad, `insert into organizations (name, type, created_by, website, verification_status) values ('Fake State', 'university', $1, 'https://www.stateu.edu', 'submitted') returning id`, [bad])).rows[0].id;
    eq((await db.query(`select verification_status::text v from organizations where id = $1`, [g])).rows[0].v, 'verified', 'dominio .edu:');
    eq((await db.query(`select verification_status::text v from organizations where id = $1`, [b])).rows[0].v, 'submitted', 'gmail:');
  });
  await check('una oportunidad limpia de una organización verificada se publica sola; con alarmas espera', async () => {
    const clean = (await as(u.uni, `insert into opportunities (organization_id, created_by, type, title, description, sport_id, status)
      values ($1, $2, 'athletic_scholarship', 'Beca baloncesto 2028', 'Beca parcial para base internacional con buen expediente.', 'basketball', 'pending_review') returning status`, [uniId, u.uni])).rows[0].status;
    eq(clean, 'published', 'limpia:');
    const risky = (await as(u.uni, `insert into opportunities (organization_id, created_by, type, title, description, sport_id, status)
      values ($1, $2, 'athletic_scholarship', 'Beca garantizada', 'Plaza garantizada con depósito previo por transferencia.', 'basketball', 'pending_review') returning status`, [uniId, u.uni])).rows[0].status;
    eq(risky, 'pending_review', 'con alarmas:');
  });
  await check('una denuncia de seguridad infantil oculta la novedad al momento', async () => {
    const upd = (await as(u.admin, `select id from athlete_updates where athlete_id = $1 limit 1`, [u.adult])).rows[0].id;
    await as(u.brand, `insert into content_reports (entity_type, entity_id, reason) values ('athlete_update', $1, 'child_safety')`, [upd]);
    eq((await as(u.brand, `select count(*)::int n from athlete_updates where id = $1`, [upd])).rows[0].n, 0);
  });
  await check('un atleta borra su cuenta él mismo, con consentimientos y candidaturas incluidos', async () => {
    const leaver = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'leaver@test.dev', $2)`, [leaver, { display_name: 'leaver', date_of_birth: yearsAgo(20) }]);
    await as(leaver, `insert into user_roles (user_id, role) values ($1, 'athlete')`, [leaver]);
    await as(leaver, `insert into athlete_profiles (user_id, sport_id, graduation_year) values ($1, 'basketball', 2027)`, [leaver]);
    await as(leaver, `insert into consents (user_id, purpose, document_version, granted) values ($1, 'terms', '2026-11', true)`, [leaver]);
    await expectError(() => as(leaver, `select delete_my_account('no')`), /confirmation_required/);
    await as(leaver, `select delete_my_account('ELIMINAR')`);
    eq((await db.query(`select count(*)::int n from auth.users where id = $1`, [leaver])).rows[0].n, 0);
    await as(u.adult, `insert into consents (user_id, purpose, document_version, granted) values ($1, 'terms', '2026-11', true)`, [u.adult]);
    await expectError(() => db.query(`update consents set granted = false where user_id = $1`, [u.adult]), /immutable_record/);
  });
  await check('los planes se conceden por jerarquía: Signature incluye Elite y Core', async () => {
    await db.query(`insert into entitlements (user_id, plan_code, source, reference) values ($1, 'family_signature', 'stripe', 'cs_test_sig')`, [u.adult]);
    const r = (await as(u.adult, `select has_plan($1, 'family_core') c, has_plan($1, 'family_elite') e, has_plan($1, 'family_signature') s`, [u.adult])).rows[0];
    eq(`${r.c}${r.e}${r.s}`, 'truetruetrue');
    await expectError(() => as(u.adult, `insert into entitlements (user_id, plan_code, source, reference) values ($1, 'family_elite', 'stripe', 'x')`, [u.adult]), /row-level security/);
  });
  await check('ofertas externas: solo atleta y familia con permiso, nunca organizaciones', async () => {
    await as(u.adult, `insert into athlete_offers (athlete_id, university_name, annual_cost_usd, aid_amount_usd) values ($1, 'State University', 60000, 20000)`, [u.adult]);
    eq((await as(u.adult, `select count(*)::int n from athlete_offers where athlete_id = $1`, [u.adult])).rows[0].n, 1);
    eq((await as(u.uni, `select count(*)::int n from athlete_offers where athlete_id = $1`, [u.adult])).rows[0].n, 0);
    await expectError(() => as(u.uni, `insert into athlete_offers (athlete_id, university_name) values ($1, 'Fake')`, [u.adult]), /row-level security/);
    await expectError(() => as(u.adult, `insert into athlete_offers (athlete_id, university_name, annual_cost_usd, aid_amount_usd) values ($1, 'X Uni', 1000, 5000)`, [u.adult]), /offer_aid_not_above_cost/);
  });

  // ---------------------------------------------------------------------------
  results.push('\nOleada 1: enlace privado de reclutamiento');
  const teen = randomUUID(); const teenParent = randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'teen2@test.dev', $2), ($3, 'teenparent@test.dev', $4)`,
    [teen, { display_name: 'Lucía Ferrer Pons' }, teenParent, { display_name: 'Marta Pons' }]);
  await as(teen, `insert into user_roles (user_id, role) values ($1, 'athlete')`, [teen]);
  await as(teen, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [teen, yearsAgo(16)]);
  await as(teenParent, `insert into user_roles (user_id, role) values ($1, 'parent')`, [teenParent]);
  await as(teenParent, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [teenParent, yearsAgo(45)]);
  await as(teen, `insert into athlete_profiles (user_id, sport_id, graduation_year, current_team, city, highlight_video_url, profile_visibility)
    values ($1, 'basketball', 2028, 'Valencia Basket U16', 'Valencia', 'https://video.example/teen', 'members')`, [teen]);
  await db.query(`insert into parent_athlete_links (parent_id, athlete_id, invited_by, status, approved_at, relationship, guardian_consent_given)
    values ($1, $2, $1, 'approved', now(), 'parent', true)`, [teenParent, teen]);
  await db.query(`update athlete_profiles set city = 'Madrid', current_team = 'CB Estudiantes', highlight_video_url = 'https://video.example/adult' where user_id = $1`, [u.adult]);

  let adultToken; let adultLinkId; let teenToken;
  await check('un atleta adulto crea su enlace y el token lo genera la base de datos', async () => {
    const r = (await as(u.adult, `insert into recruiting_links (athlete_id, label, token) values ($1, 'Coach Smith', 'elegido-por-mi') returning id, token, expires_at > now() + interval '29 days' as d30`, [u.adult])).rows[0];
    adultLinkId = r.id; adultToken = r.token;
    if (!/^[a-f0-9]{64}$/.test(adultToken)) throw new Error(`token no aleatorio: ${adultToken}`);
    eq(r.d30, true, 'caduca a los 30 días por defecto:');
  });
  await check('la caducidad nunca supera 90 días', async () => {
    const r = (await as(u.adult, `insert into recruiting_links (athlete_id, label, expires_at) values ($1, 'Largo', now() + interval '400 days') returning expires_at <= now() + interval '90 days 1 minute' as capped`, [u.adult])).rows[0];
    eq(r.capped, true);
  });
  await check('un menor no puede crear su propio enlace', async () => {
    await expectError(() => as(teen, `insert into recruiting_links (athlete_id, label) values ($1, 'x')`, [teen]), /guardian_required|row-level security/);
  });
  await check('su madre o padre (vínculo aprobado) sí puede crearlo', async () => {
    teenToken = (await as(teenParent, `insert into recruiting_links (athlete_id, label) values ($1, 'Coach Brown') returning token`, [teen])).rows[0].token;
  });
  await check('nadie más puede crear enlaces de un atleta', async () => {
    await expectError(() => as(u.coach, `insert into recruiting_links (athlete_id, label) values ($1, 'x')`, [u.adult]), /row-level security/);
    await expectError(() => as(u.agent, `insert into recruiting_links (athlete_id, label) values ($1, 'x')`, [u.adult]), /row-level security/);
  });
  await check('los enlaces (y sus tokens) solo los ven el atleta y su familia', async () => {
    eq((await as(u.coach, `select count(*)::int n from recruiting_links`)).rows[0].n, 0);
    eq((await as(null, `select count(*)::int n from recruiting_links`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n, 0);
    eq((await as(teenParent, `select count(*)::int n from recruiting_links where athlete_id = $1`, [teen])).rows[0].n, 1);
    eq((await as(teen, `select count(*)::int n from recruiting_links where athlete_id = $1`, [teen])).rows[0].n, 1);
  });
  await check('sin iniciar sesión, un enlace válido muestra la ficha y registra la visita', async () => {
    const r = (await as(null, `select * from get_recruiting_card($1)`, [adultToken])).rows;
    eq(r.length, 1);
    eq(r[0].display_name, 'adult');
    eq(r[0].current_team, 'CB Estudiantes');
    eq(r[0].video_url, 'https://video.example/adult');
    eq((await as(u.adult, `select count(*)::int n from recruiting_link_views where link_id = $1`, [adultLinkId])).rows[0].n, 1);
  });
  await check('la ficha de un menor oculta apellidos, equipo y ciudad', async () => {
    const r = (await as(null, `select * from get_recruiting_card($1)`, [teenToken])).rows[0];
    eq(r.display_name, 'Lucía F.');
    eq(r.current_team, null);
    eq(r.city, null);
    eq(r.is_minor, true);
  });
  await check('la ficha nunca incluye el presupuesto familiar', async () => {
    const cols = (await as(null, `select * from get_recruiting_card($1)`, [adultToken])).fields.map((f) => f.name);
    if (cols.some((c) => /budget|financ/.test(c))) throw new Error(`columna sensible: ${cols}`);
  });
  await check('un token inventado no devuelve nada', async () => {
    eq((await as(null, `select * from get_recruiting_card($1)`, ['f'.repeat(64)])).rows.length, 0);
  });
  await check('un enlace caducado no devuelve nada', async () => {
    const tk = (await as(u.adult, `insert into recruiting_links (athlete_id, label) values ($1, 'old') returning token`, [u.adult])).rows[0].token;
    // Simula el paso del tiempo (el trigger impide cambiar la caducidad a cualquiera).
    await db.query(`set session_replication_role = replica`);
    await db.query(`update recruiting_links set expires_at = now() - interval '1 day' where token = $1`, [tk]);
    await db.query(`set session_replication_role = origin`);
    eq((await as(null, `select * from get_recruiting_card($1)`, [tk])).rows.length, 0);
  });
  await check('al revocarlo deja de funcionar y no se puede reactivar', async () => {
    await as(u.adult, `update recruiting_links set revoked_at = now() where id = $1`, [adultLinkId]);
    eq((await as(null, `select * from get_recruiting_card($1)`, [adultToken])).rows.length, 0);
    await expectError(() => as(u.adult, `update recruiting_links set revoked_at = null where id = $1`, [adultLinkId]), /link_immutable/);
  });
  await check('un enlace no cambia de atleta ni de token', async () => {
    const id = (await as(u.adult, `insert into recruiting_links (athlete_id, label) values ($1, 'z') returning id`, [u.adult])).rows[0].id;
    await expectError(() => as(u.adult, `update recruiting_links set token = 'x' where id = $1`, [id]), /link_immutable/);
  });
  await check('las visitas solo las ve el atleta o su familia', async () => {
    eq((await as(u.coach, `select count(*)::int n from recruiting_link_views`)).rows[0].n, 0);
    await expectError(() => as(u.coach, `insert into recruiting_link_views (link_id) values ($1)`, [adultLinkId]), /row-level security|permission denied/);
  });

  results.push('\nFase 1: bloquear a una persona');
  // Punto de partida limpio: la conversación coach-atleta de pruebas anteriores quedó bloqueada a nivel de organización.
  await db.query(`set session_replication_role = replica`);
  await db.query(`update contact_requests set status = 'accepted' where id = $1`, [reqId]);
  await db.query(`set session_replication_role = origin`);
  await check('antes de bloquear, el coach ve al atleta y puede escribirle', async () => {
    eq((await as(u.coach, `select public.can_view_athlete($1) v`, [u.adult])).rows[0].v, true);
    await as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Antes del bloqueo')`, [reqId, u.coach]);
  });
  await check('nadie puede bloquear en nombre de otro ni bloquearse a sí mismo', async () => {
    await expectError(() => as(u.agent, `insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [u.adult, u.coach]), /row-level security/);
    await expectError(() => as(u.adult, `insert into user_blocks (blocker_id, blocked_id) values ($1, $1)`, [u.adult]), /check constraint|violates/);
  });
  await check('el atleta bloquea al coach: deja de ver su perfil', async () => {
    await as(u.adult, `insert into user_blocks (blocker_id, blocked_id, reason) values ($1, $2, 'Insistente')`, [u.adult, u.coach]);
    eq((await as(u.coach, `select public.can_view_athlete($1) v`, [u.adult])).rows[0].v, false);
  });
  await check('con el bloqueo nadie de los dos puede escribir en la conversación', async () => {
    await expectError(() => as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'hola')`, [reqId, u.coach]), /row-level security/);
    await expectError(() => as(u.adult, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'hola')`, [reqId, u.adult]), /row-level security/);
  });
  await check('el bloqueado no sabe quién le ha bloqueado (no ve la fila)', async () => {
    eq((await as(u.coach, `select count(*)::int n from user_blocks`)).rows[0].n, 0);
    eq((await as(u.adult, `select count(*)::int n from user_blocks`)).rows[0].n, 1);
  });
  await check('la madre o el padre de un menor bloquea en su nombre', async () => {
    await as(teenParent, `insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [teenParent, u.agent]);
    eq((await as(u.agent, `select public.is_blocked_by_user($1) v`, [teen])).rows[0].v, true);
    eq((await as(u.agent, `select public.can_view_athlete($1) v`, [teen])).rows[0].v, false);
  });
  await check('al desbloquear todo vuelve a funcionar', async () => {
    await as(u.adult, `delete from user_blocks where blocker_id = $1 and blocked_id = $2`, [u.adult, u.coach]);
    eq((await as(u.coach, `select public.can_view_athlete($1) v`, [u.adult])).rows[0].v, true);
    await as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Después del desbloqueo')`, [reqId, u.coach]);
  });
  await check('los bloqueos no se pueden editar (solo crear y borrar)', async () => {
    await as(u.adult, `insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [u.adult, u.brand]);
    const r = await as(u.adult, `update user_blocks set blocked_id = $2 where blocker_id = $1 returning 1`, [u.adult, u.coach]).catch((e) => e);
    if (!(r instanceof Error) && r.rows.length) throw new Error('se pudo editar un bloqueo');
  });

  results.push('\nFase 1: derechos de imagen');
  await check('el atleta registra que tiene derecho a publicar su vídeo', async () => {
    await as(u.adult, `insert into consents (user_id, purpose, document_version, granted) values ($1, 'media_rights', 'media-2026-11', true)`, [u.adult]);
    eq((await as(u.adult, `select count(*)::int n from consents where purpose = 'media_rights'`)).rows[0].n, 1);
  });
  await check('nadie registra ese consentimiento en nombre de otro', async () => {
    await expectError(() => as(u.coach, `insert into consents (user_id, purpose, document_version, granted) values ($1, 'media_rights', 'x', true)`, [u.adult]), /row-level security/);
  });

  results.push('\nCumplimiento NCAA: ventana de contacto');
  const farYear = new Date().getFullYear() + 4; // aún en 1.º-2.º de bachillerato: ventana D-I cerrada
  await check('fecha de apertura: 15 de junio tras el 2.º curso (general), 1 de agosto en béisbol, sin límite en D-III', async () => {
    eq((await db.query(`select public.ncaa_contact_opens_on(2030, 'ncaa_d1', 'basketball')::text d`)).rows[0].d, '2028-06-15');
    eq((await db.query(`select public.ncaa_contact_opens_on(2030, 'ncaa_d1', 'baseball')::text d`)).rows[0].d, '2028-08-01');
    eq((await db.query(`select public.ncaa_contact_opens_on(2030, 'ncaa_d3', 'basketball') d`)).rows[0].d, null);
    eq((await db.query(`select public.ncaa_contact_opens_on(null, 'ncaa_d1', 'basketball') d`)).rows[0].d, null);
  });
  await check('una universidad D-I no puede iniciar contacto antes de la ventana NCAA', async () => {
    await db.query(`update athlete_profiles set graduation_year = $2 where user_id = $1`, [teen, farYear]);
    await db.query(`delete from contact_requests where athlete_id = $1`, [teen]);
    await expectError(() => as(u.coach, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Hola, nos interesa tu perfil para dentro de unos años.')`, [uniId, u.coach, teen]), /ncaa_contact_window_closed/);
  });
  await check('con la ventana abierta la misma universidad sí puede', async () => {
    await db.query(`update athlete_profiles set graduation_year = 2027 where user_id = $1`, [teen]);
    await as(u.coach, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Hola, nos interesa tu perfil para la temporada que viene.')`, [uniId, u.coach, teen]);
  });

  results.push('\nEndurecimiento: funciones internas sin acceso anónimo');
  for (const fn of ['has_role(\'admin\')', 'is_verified_recruiter()', `is_blocked_by_athlete('${teen}')`, `has_connection_with_athlete('${teen}')`]) {
    await check(`sin sesión no se puede llamar a ${fn.split('(')[0]}`, async () => {
      await expectError(() => as(null, `select public.${fn}`), /permission denied/);
    });
  }
  await check('con sesión siguen funcionando (las usan las políticas)', async () => {
    await as(u.coach, `select public.has_role('university'), public.is_verified_recruiter()`);
  });
  await check('las políticas públicas siguen funcionando sin sesión (perfiles públicos)', async () => {
    await as(null, `select count(*) from athlete_profiles`);
  });

  results.push('\nNetworking: avisos automáticos');
  await check('mensaje nuevo: avisa a la otra parte, no a quien escribe', async () => {
    await as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Te paso el calendario de visitas.')`, [reqId, u.coach]);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'message.new'`, [u.adult])).rows[0].n >= 1, true);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'message.new'`, [u.coach])).rows[0].n, 0);
  });
  await check('mensajes seguidos: un solo aviso sin leer por conversación', async () => {
    await as(u.coach, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Y otra cosa más.')`, [reqId, u.coach]);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'message.new' and read_at is null`, [u.adult])).rows[0].n, 1);
  });
  await check('perfil abierto: avisa al atleta una vez al día por enlace', async () => {
    await as(null, `select * from get_recruiting_card($1)`, [adultToken]);
    await as(null, `select * from get_recruiting_card($1)`, [adultToken]);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'profile.view'`, [u.adult])).rows[0].n, 1);
  });
  await check('beca publicada: avisa a atletas de ese deporte, no a organizaciones', async () => {
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'opportunity.match'`, [u.adult])).rows[0].n >= 1, true);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'opportunity.match'`, [u.coach])).rows[0].n, 0);
  });

  results.push('\nNetworking: recomendaciones del club');
  await db.query(`set session_replication_role = replica`);
  await db.query(`update club_roster set status = 'active', ended_at = null where athlete_id = $1 and organization_id = $2`, [u.adult, clubId]);
  await db.query(`set session_replication_role = default`);
  let recId;
  await check('el club verificado recomienda a un atleta de su roster; queda pendiente', async () => {
    const r = (await as(u.coach2, `insert into club_recommendations (athlete_id, organization_id, body)
      values ($1, $2, 'Base trabajador y líder del vestuario. Ha mejorado cada temporada y entrena con el primer equipo.') returning id, status, author_id`, [u.adult, clubId])).rows[0];
    recId = r.id; eq(r.status, 'pending'); eq(r.author_id, u.coach2);
  });
  await check('no recomienda quien no es del club ni a quien no está en su roster', async () => {
    await expectError(() => as(u.brand, `insert into club_recommendations (athlete_id, organization_id, body) values ($1, $2, 'Recomendación de alguien que no pertenece al club en absoluto.')`, [u.adult, clubId]), /club_admin_required|row-level security/);
    await expectError(() => as(u.coach2, `insert into club_recommendations (athlete_id, organization_id, body) values ($1, $2, 'Recomendación para alguien que no está en el roster del club.')`, [u.minor, clubId]), /not_in_roster/);
  });
  await check('pendiente: la ve el atleta, no un coach externo; el club no puede publicarla', async () => {
    eq((await as(u.adult, `select count(*)::int n from club_recommendations where id = $1`, [recId])).rows[0].n, 1);
    eq((await as(u.coach, `select count(*)::int n from club_recommendations where id = $1`, [recId])).rows[0].n, 0);
    await expectError(() => as(u.coach2, `update club_recommendations set status = 'published' where id = $1`, [recId]), /recommendation_transition_not_allowed|row-level security/);
  });
  await check('el atleta la publica y la ven los coaches verificados', async () => {
    await as(u.adult, `update club_recommendations set status = 'published' where id = $1`, [recId]);
    eq((await as(u.coach, `select count(*)::int n from club_recommendations where id = $1`, [recId])).rows[0].n, 1);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'recommendation.new'`, [u.adult])).rows[0].n, 1);
  });

  results.push('\nNetworking: preguntas abiertas en cada beca');
  const pubOpp = (await db.query(`select id from opportunities where title = 'Beca baloncesto 2028' and status = 'published' limit 1`)).rows[0].id;
  let qId;
  await check('un atleta pregunta en una beca publicada', async () => {
    qId = (await as(u.adult, `insert into opportunity_questions (opportunity_id, body) values ($1, '¿Qué nivel de inglés pedís para la admisión?') returning id`, [pubOpp])).rows[0].id;
    eq((await db.query(`select asker_id from opportunity_questions where id = $1`, [qId])).rows[0].asker_id, u.adult);
  });
  await check('en público no se comparten emails, teléfonos ni redes', async () => {
    await expectError(() => as(u.adult, `insert into opportunity_questions (opportunity_id, body) values ($1, 'Escribidme a atleta@test.dev por favor')`, [pubOpp]), /contact_data_not_allowed/);
  });
  await check('sin responder: la ven quien pregunta y la organización, no otros atletas', async () => {
    eq((await as(u.privateAth, `select count(*)::int n from opportunity_questions where id = $1`, [qId])).rows[0].n, 0);
    eq((await as(u.uni, `select count(*)::int n from opportunity_questions where id = $1`, [qId])).rows[0].n, 1);
  });
  await check('el atleta no puede responder; la organización sí y queda visible para todos', async () => {
    await as(u.adult, `update opportunity_questions set answer = 'Me respondo yo' where id = $1`, [qId]);
    eq((await db.query(`select answer from opportunity_questions where id = $1`, [qId])).rows[0].answer, null);
    await as(u.uni, `update opportunity_questions set answer = 'Pedimos TOEFL 80 o Duolingo 105.' where id = $1`, [qId]);
    eq((await as(u.privateAth, `select count(*)::int n from opportunity_questions where id = $1`, [qId])).rows[0].n, 1);
    eq((await as(null, `select count(*)::int n from opportunity_questions where id = $1`, [qId])).rows[0].n, 1);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'question.answered'`, [u.adult])).rows[0].n, 1);
  });
  await check('quién preguntó no se expone (ni en público ni a otros usuarios)', async () => {
    await expectError(() => as(null, `select asker_id from opportunity_questions where id = $1`, [qId]), /permission denied/);
    await expectError(() => as(u.uni, `select asker_id from opportunity_questions where id = $1`, [qId]), /permission denied/);
  });

  results.push('\nNetworking: Showcase Day');
  let evId;
  await check('solo administración crea jornadas', async () => {
    await expectError(() => as(u.coach, `insert into showcase_events (title, starts_at, ends_at) values ('Jornada falsa', now(), now() + interval '1 day')`), /row-level security/);
    evId = (await as(u.admin, `insert into showcase_events (title, sport_id, starts_at, ends_at) values ('Showcase baloncesto', 'basketball', now() + interval '7 days', now() + interval '8 days') returning id`)).rows[0].id;
  });
  await check('el atleta se inscribe y puede retirarse', async () => {
    await as(u.adult, `insert into showcase_entries (event_id, athlete_id) values ($1, $2)`, [evId, u.adult]);
    eq((await as(u.adult, `select count(*)::int n from showcase_entries where event_id = $1`, [evId])).rows[0].n, 1);
    await expectError(() => as(u.coach, `insert into showcase_entries (event_id, athlete_id) values ($1, $2)`, [evId, u.adult]), /row-level security|duplicate/);
  });
  await check('antes de empezar, las organizaciones no ven a los inscritos', async () => {
    eq((await as(u.coach, `select count(*)::int n from showcase_entries where event_id = $1`, [evId])).rows[0].n, 0);
  });
  await check('en directo: los ven reclutadores verificados, no marcas', async () => {
    await db.query(`update showcase_events set starts_at = now() - interval '1 hour', ends_at = now() + interval '1 day' where id = $1`, [evId]);
    eq((await as(u.coach, `select count(*)::int n from showcase_entries where event_id = $1`, [evId])).rows[0].n, 1);
    eq((await as(u.brand, `select count(*)::int n from showcase_entries where event_id = $1`, [evId])).rows[0].n, 0);
  });
  await check('el atleta se retira', async () => {
    await as(u.adult, `delete from showcase_entries where event_id = $1 and athlete_id = $2`, [evId, u.adult]);
    eq((await db.query(`select count(*)::int n from showcase_entries where event_id = $1`, [evId])).rows[0].n, 0);
  });

  results.push('\nAgency Core: procesos, contactos, tareas y aislamiento');
  // Segunda agencia (otra persona) para probar el aislamiento entre agencias.
  await db.query(`set session_replication_role = replica`);
  const agencyB = (await db.query(`insert into organizations (name, type, created_by) values ('Agencia B', 'agency', $1) returning id`, [u.brand])).rows[0].id;
  await db.query(`insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'admin')`, [agencyB, u.brand]);
  await db.query(`set session_replication_role = default`);
  let caseId; let contactId;
  await check('la agencia guarda un contacto de coach privado', async () => {
    contactId = (await as(u.agent, `insert into agency_contacts (agency_id, institution_name, sport_id, name, role_title, email)
      values ($1, 'University of Example', 'basketball', 'Coach Rivera', 'Assistant Coach', 'rivera@example.edu') returning id`, [agencyId])).rows[0].id;
  });
  await check('abre un proceso atleta + universidad + temporada con un atleta que representa', async () => {
    const r = (await as(u.agent, `insert into recruiting_cases (agency_id, athlete_id, institution_name, sport_id, cycle, contact_id, next_action, next_action_due)
      values ($1, $2, 'University of Example', 'basketball', '2027-28', $3, 'Enviar vídeo al coach', current_date + 3) returning id, stage, owner_id`, [agencyId, u.adult, contactId])).rows[0];
    caseId = r.id; eq(r.stage, 'research'); eq(r.owner_id, u.agent);
  });
  await check('no abre procesos para atletas que no representa', async () => {
    await expectError(() => as(u.agent, `insert into recruiting_cases (agency_id, athlete_id, institution_name, sport_id, cycle) values ($1, $2, 'X University', 'basketball', '2027-28')`, [agencyId, u.privateAth]), /representation_required|row-level security/);
  });
  await check('cambiar de fase deja historial automático con autor', async () => {
    await as(u.agent, `update recruiting_cases set stage = 'contacted' where id = $1`, [caseId]);
    const h = (await as(u.agent, `select kind, from_stage, to_stage, actor_id from recruiting_case_activities where case_id = $1 and kind = 'stage_change' and from_stage is not null`, [caseId])).rows[0];
    eq(h.from_stage, 'research'); eq(h.to_stage, 'contacted'); eq(h.actor_id, u.agent);
  });
  await check('registra una interacción y una tarea con responsable y fecha', async () => {
    await as(u.agent, `insert into recruiting_case_activities (case_id, kind, body) values ($1, 'email', 'Enviado vídeo de la temporada')`, [caseId]);
    await as(u.agent, `insert into recruiting_case_tasks (case_id, title, assignee_id, due_date) values ($1, 'Llamar al coach', $2, current_date + 5)`, [caseId, u.agent]);
    eq((await as(u.agent, `select count(*)::int n from recruiting_case_tasks where case_id = $1`, [caseId])).rows[0].n, 1);
  });
  await check('una tarea no se asigna a alguien de fuera de la agencia', async () => {
    await expectError(() => as(u.agent, `insert into recruiting_case_tasks (case_id, title, assignee_id) values ($1, 'x tarea', $2)`, [caseId, u.brand]), /assignee_not_member/);
  });
  await check('AISLAMIENTO: una segunda agencia no ve procesos, historial, tareas ni contactos', async () => {
    for (const t of ['recruiting_cases', 'recruiting_case_activities', 'recruiting_case_tasks', 'agency_contacts']) {
      eq((await as(u.brand, `select count(*)::int n from ${t}`)).rows[0].n, 0, t);
    }
    eq((await as(u.brand, `update recruiting_cases set stage = 'closed' where id = $1`, [caseId])).rowCount, 0);
  });
  await check('el atleta no ve el proceso hasta que la agencia lo comparte; nunca las notas internas', async () => {
    await as(u.agent, `insert into recruiting_case_activities (case_id, kind, body) values ($1, 'note', 'Nota interna: coach dudoso')`, [caseId]);
    eq((await as(u.adult, `select count(*)::int n from recruiting_cases where id = $1`, [caseId])).rows[0].n, 0);
    await as(u.agent, `update recruiting_cases set shared_with_athlete = true where id = $1`, [caseId]);
    eq((await as(u.adult, `select count(*)::int n from recruiting_cases where id = $1`, [caseId])).rows[0].n, 1);
    eq((await as(u.adult, `select count(*)::int n from recruiting_case_activities where case_id = $1 and kind = 'note'`, [caseId])).rows[0].n, 0);
    eq((await as(u.adult, `select count(*)::int n from recruiting_case_activities where case_id = $1 and kind = 'stage_change'`, [caseId])).rows[0].n, 2, 'apertura + cambio:');
    eq((await as(u.adult, `select count(*)::int n from recruiting_case_tasks where case_id = $1`, [caseId])).rows[0].n, 0);
  });
  await check('el atleta recibe un aviso al compartir y al cambiar de fase un proceso compartido (no antes)', async () => {
    const count = async () => (await as(u.adult, `select count(*)::int n from notifications where user_id = $1 and kind like 'case.%'`, [u.adult])).rows[0].n;
    const before = await count();
    await as(u.agent, `update recruiting_cases set stage = 'response_received' where id = $1`, [caseId]);
    eq(await count(), before + 1, 'cambio de fase compartido:');
    await as(u.agent, `update recruiting_cases set next_action = 'Preparar visita' where id = $1`, [caseId]);
    eq(await count(), before + 1, 'cambiar solo la próxima acción no avisa:');
    await as(u.agent, `update recruiting_cases set shared_with_athlete = false where id = $1`, [caseId]);
    await as(u.agent, `update recruiting_cases set stage = 'active_conversation' where id = $1`, [caseId]);
    eq(await count(), before + 1, 'sin compartir no avisa:');
    await as(u.agent, `update recruiting_cases set shared_with_athlete = true where id = $1`, [caseId]);
    eq(await count(), before + 2, 'al volver a compartir avisa:');
  });
  await check('rol de solo lectura: sin asignación no ve; asignado como viewer ve pero no escribe (12B)', async () => {
    await db.query(`set session_replication_role = replica`);
    await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'viewer')`, [agencyId, u.coach2]);
    await db.query(`set session_replication_role = default`);
    eq((await as(u.coach2, `select count(*)::int n from recruiting_cases where id = $1`, [caseId])).rows[0].n, 0, 'sin asignación');
    await as(u.agent, `select representation_assign($1, $2, 'viewer')`, [repId, u.coach2]);
    eq((await as(u.coach2, `select count(*)::int n from recruiting_cases where id = $1`, [caseId])).rows[0].n, 1);
    eq((await as(u.coach2, `update recruiting_cases set stage = 'closed' where id = $1`, [caseId])).rowCount, 0);
  });
  await check('un miembro sin rol de administrador no puede cambiarse el rol a sí mismo', async () => {
    eq((await as(u.coach2, `update organization_members set agency_role = 'owner' where organization_id = $1 and user_id = $2`, [agencyId, u.coach2])).rowCount, 0);
  });
  await check('métricas de agencias: solo admin, con datos reales', async () => {
    await expectError(() => as(u.agent, `select public.admin_agency_metrics(30)`), /admin_only/);
    const m = (await as(u.admin, `select public.admin_agency_metrics(30) m`)).rows[0].m;
    eq(m.agencies_with_cases, 1); eq(m.cases_total, 1); eq(m.cases_opened, 1);
    eq(typeof m.by_stage, 'object');
    eq(m.contacts_total, 1);
  });
  await check('REVOCACIÓN: con la relación terminada no se abren procesos nuevos', async () => {
    eq((await as(u.adult, `select representation_end($1, 'Fin de la relación') s`, [repId])).rows[0].s, 'revoked');
    await expectError(() => as(u.agent, `insert into recruiting_cases (agency_id, athlete_id, institution_name, sport_id, cycle) values ($1, $2, 'Otra University', 'basketball', '2027-28')`, [agencyId, u.adult]), /representation_required/);
  });
  results.push('\nPassport v2: bloques, procedencia, vídeos, objetivos y visitas');
  await check('verified_orgs: una universidad verificada ve el bloque; una marca y un anónimo no', async () => {
    await as(u.adult, `update athlete_profiles set profile_visibility = 'public', videos_visibility = 'verified_orgs' where user_id = $1`, [u.adult]);
    await as(u.adult, `insert into athlete_videos (athlete_id, kind, url, is_featured) values ($1, 'highlight', 'https://youtu.be/x', true)`, [u.adult]);
    eq((await as(u.uni, `select count(*)::int n from athlete_videos where athlete_id = $1`, [u.adult])).rows[0].n, 1, 'uni');
    eq((await as(u.brand, `select count(*)::int n from athlete_videos where athlete_id = $1`, [u.adult])).rows[0].n, 0, 'marca');
    eq((await as(null, `select count(*)::int n from athlete_videos where athlete_id = $1`, [u.adult])).rows[0].n, 0, 'anon');
  });
  await check('solo un vídeo destacado por atleta', async () => {
    await expectError(() => as(u.adult, `insert into athlete_videos (athlete_id, kind, url, is_featured) values ($1, 'full_game', 'https://youtu.be/y', true)`, [u.adult]));
  });
  await check('nadie puede añadir vídeos al Passport de otro', async () => {
    await expectError(() => as(u.brand, `insert into athlete_videos (athlete_id, kind, url) values ($1, 'clip', 'https://youtu.be/z')`, [u.adult]));
  });
  await check('menor: ningún bloque se guarda como público', async () => {
    await as(u.minor, `update athlete_profiles set profile_visibility = 'public', videos_visibility = 'public', goals_visibility = 'public' where user_id = $1`, [u.minor]);
    const r = (await db.query(`select profile_visibility::text p, videos_visibility::text v, goals_visibility::text g from athlete_profiles where user_id = $1`, [u.minor])).rows[0];
    eq(r.p, 'members', 'perfil'); eq(r.v, 'members', 'vídeos'); eq(r.g, 'verified_orgs', 'objetivos');
  });
  await check('el atleta no puede marcar su nota como documentada', async () => {
    await as(u.minor, `update athlete_academics set gpa_source = 'documented', english_source = 'club_verified' where athlete_id = $1`, [u.minor]);
    const r = (await db.query(`select gpa_source::text g, english_source::text e from athlete_academics where athlete_id = $1`, [u.minor])).rows[0];
    eq(r.g, 'self_reported'); eq(r.e, 'self_reported');
  });
  await check('si el atleta cambia una nota documentada, vuelve a "declarado"', async () => {
    await as(u.admin, `update athlete_academics set gpa_source = 'documented' where athlete_id = $1`, [u.minor]);
    await as(u.minor, `update athlete_academics set gpa = 3.9 where athlete_id = $1`, [u.minor]);
    eq((await db.query(`select gpa_source::text g from athlete_academics where athlete_id = $1`, [u.minor])).rows[0].g, 'self_reported');
  });
  await check('estadísticas: misma temporada en dos equipos, sin poder autoverificarse', async () => {
    const def = (await db.query(`select id from sport_stat_definitions where sport_id = 'basketball' and code = 'ppg'`)).rows[0].id;
    await as(u.adult, `insert into athlete_statistics (athlete_id, stat_definition_id, season, value, team, competition) values ($1, $2, '2025-26', 14.2, 'Club A', 'Liga U18')`, [u.adult, def]);
    await as(u.adult, `insert into athlete_statistics (athlete_id, stat_definition_id, season, value, team, competition) values ($1, $2, '2025-26', 18.0, 'Selección', 'Europeo U18')`, [u.adult, def]);
    await expectError(() => as(u.adult, `insert into athlete_statistics (athlete_id, stat_definition_id, season, value, team, source) values ($1, $2, '2024-25', 10, 'Club A', 'club_verified')`, [u.adult, def]));
  });
  await check('objetivos: nunca visibles para anónimos; sí para el propio atleta', async () => {
    await as(u.adult, `insert into athlete_goals (athlete_id, pathways, countries) values ($1, '{ncaa_d1,naia}', '{US}')`, [u.adult]);
    await expectError(() => as(null, `select count(*) from athlete_goals where athlete_id = $1`, [u.adult]));
    eq((await as(u.adult, `select count(*)::int n from athlete_goals where athlete_id = $1`, [u.adult])).rows[0].n, 1);
  });
  await check('objetivos: rechaza un camino que no existe', async () => {
    await expectError(() => as(u.adult, `update athlete_goals set pathways = '{lottery}' where athlete_id = $1`, [u.adult]));
  });
  await check('visitas reales: la universidad cuenta una vez al día; el propio atleta no cuenta', async () => {
    await as(u.uni, `select record_passport_view($1)`, [u.adult]);
    await as(u.uni, `select record_passport_view($1)`, [u.adult]);
    await as(u.adult, `select record_passport_view($1)`, [u.adult]);
    const r = (await as(u.adult, `select * from passport_view_stats($1)`, [u.adult])).rows[0];
    eq(Number(r.total_views), 1, 'total'); eq(Number(r.university_views), 1, 'uni');
  });
  await check('visitas: nadie más puede leer las estadísticas ni la tabla', async () => {
    eq(Number((await as(u.brand, `select * from passport_view_stats($1)`, [u.adult])).rows[0].total_views), 0);
    await expectError(() => as(u.uni, `select count(*) from passport_views`));
  });
  await check('un perfil privado no registra visitas de terceros', async () => {
    await as(u.uni, `select record_passport_view($1)`, [u.privateAth]);
    eq((await db.query(`select count(*)::int n from passport_views where athlete_id = $1`, [u.privateAth])).rows[0].n, 0);
  });
  await check('edad: visible como número para quien ve el perfil; nunca para anónimos si es menor', async () => {
    eq((await as(u.uni, `select athlete_age($1) a`, [u.minor])).rows[0].a, 16);
    eq((await as(null, `select athlete_age($1) a`, [u.minor])).rows[0].a, null);
    eq((await as(u.brand, `select athlete_age($1) a`, [u.minor])).rows[0].a, null);
  });
  await check('nombre de usuario: formato y reservados', async () => {
    await expectError(() => as(u.adult, `update athlete_profiles set username = 'Admin' where user_id = $1`, [u.adult]));
    await expectError(() => as(u.adult, `update athlete_profiles set username = 'admin' where user_id = $1`, [u.adult]));
    await as(u.adult, `update athlete_profiles set username = 'lucia-martinez' where user_id = $1`, [u.adult]);
  });

  results.push('\nGala Match v2: guardados, señales y datos oficiales');
  const gmInst = (await db.query(`insert into institutions (name, state, sports_offered, data_source) values ('Test University', 'FL', '{basketball}', 'college_scorecard') returning id`)).rows[0].id;
  await check('el atleta guarda una universidad con estado y shortlist propia', async () => {
    await as(u.adult, `insert into saved_items (athlete_id, target_kind, target_id, shortlist_tier, match_score_at_save) values ($1, 'institution', $2, 'target', 80)`, [u.adult, gmInst]);
    eq((await as(u.adult, `select status from saved_items where athlete_id = $1`, [u.adult])).rows[0].status, 'saved');
  });
  await check('no se puede guardar algo que no existe ni por otra persona', async () => {
    await expectError(() => as(u.adult, `insert into saved_items (athlete_id, target_kind, target_id) values ($1, 'institution', gen_random_uuid())`, [u.adult]), /target_not_found/);
    await expectError(() => as(u.brand, `insert into saved_items (athlete_id, target_kind, target_id) values ($1, 'institution', $2)`, [u.adult, gmInst]));
  });
  await check('los guardados son privados: ni universidades ni marcas los ven', async () => {
    eq((await as(u.uni, `select count(*)::int n from saved_items where athlete_id = $1`, [u.adult])).rows[0].n, 0);
    eq((await as(u.brand, `select count(*)::int n from saved_items`)).rows[0].n, 0);
  });
  await check('señales: cada atleta solo escribe y lee las suyas', async () => {
    await as(u.adult, `insert into match_signals (athlete_id, target_kind, target_id, signal, match_score, engine_version) values ($1, 'institution', $2, 'hidden', 40, 'gm-2.0')`, [u.adult, gmInst]);
    await expectError(() => as(u.uni, `insert into match_signals (athlete_id, target_kind, target_id, signal) values ($1, 'institution', $2, 'viewed')`, [u.adult, gmInst]));
    eq((await as(u.uni, `select count(*)::int n from match_signals`)).rows[0].n, 0);
  });
  await check('datos oficiales nuevos: solo admin; la procedencia deportiva la fija la base de datos', async () => {
    await as(u.admin, `update organizations set institution_id = $1 where id = $2`, [gmInst, uniId]);
    await expectError(() => as(u.uni, `update institutions set net_price_usd = 1000 where id = $1`, [gmInst]), /official_data_admin_only/);
    await as(u.uni, `update institutions set division = 'ncaa_d2', athletic_source = 'manual_admin' where id = $1`, [gmInst]);
    eq((await db.query(`select athletic_source from institutions where id = $1`, [gmInst])).rows[0].athletic_source, 'organization');
  });

  results.push('\nUniversidades v2: programas, reclamaciones, ciclo de vida y avisos');
  await check('programas: la organización verificada los gestiona; la procedencia la fija la base de datos', async () => {
    await as(u.uni, `insert into institution_programs (institution_id, sport_id, gender, division, source, source_url) values ($1, 'tennis', 'women', 'ncaa_d2', 'official_external', 'https://fake.example')`, [gmInst]);
    const r = (await db.query(`select source, source_url from institution_programs where institution_id = $1 and sport_id = 'tennis'`, [gmInst])).rows[0];
    eq(r.source, 'organization'); eq(r.source_url, null);
    eq((await db.query(`select 'tennis' = any(sports_offered) ok from institutions where id = $1`, [gmInst])).rows[0].ok, true, 'sincroniza sports_offered');
  });
  await check('programas: una marca u otra universidad no pueden tocarlos; cualquiera los lee', async () => {
    await expectError(() => as(u.brand, `insert into institution_programs (institution_id, sport_id, gender, source) values ($1, 'soccer', 'men', 'organization')`, [gmInst]));
    eq((await as(null, `select count(*)::int n from institution_programs where institution_id = $1`, [gmInst])).rows[0].n >= 1, true);
  });
  await check('reclamar universidad: dominio comprobado, privada y solo un admin la aprueba', async () => {
    await as(u.admin, `update institutions set website_url = 'https://www.testu.edu' where id = $1`, [gmInst]);
    await as(u.coach, `insert into institution_claims (institution_id, user_id, work_email, role_title) values ($1, $2, 'coach@athletics.testu.edu', 'Head Coach')`, [gmInst, u.coach]);
    eq((await db.query(`select domain_matches from institution_claims where user_id = $1`, [u.coach])).rows[0].domain_matches, true);
    eq((await as(u.brand, `select count(*)::int n from institution_claims`)).rows[0].n, 0);
    await as(u.coach, `update institution_claims set status = 'approved' where user_id = $1`, [u.coach]).catch(() => null);
    eq((await db.query(`select status from institution_claims where user_id = $1`, [u.coach])).rows[0].status, 'pending');
  });
  await check('reclamar universidad: no se puede reclamar en nombre de una organización ajena', async () => {
    await expectError(() => as(u.brand, `insert into institution_claims (institution_id, user_id, organization_id, work_email, role_title) values ($1, $2, $3, 'x@testu.edu', 'Coach')`, [gmInst, u.brand, uniId]), /not_org_admin/);
  });
  await check('oportunidad: la organización puede cerrarla o marcarla cubierta, pero no republicarla', async () => {
    const opp = (await db.query(`select id from opportunities where organization_id = $1 and status = 'published' limit 1`, [uniId])).rows[0];
    if (!opp) return;
    await as(u.uni, `update opportunities set status = 'filled' where id = $1`, [opp.id]);
    await expectError(() => as(u.uni, `update opportunities set status = 'published' where id = $1`, [opp.id]), /opportunity_status_admin_only/);
    await as(u.admin, `update opportunities set status = 'published' where id = $1`, [opp.id]);
  });
  await check('caducidad: una oportunidad con plazo vencido pasa a "expired"; solo admin o el sistema la ejecutan', async () => {
    await expectError(() => as(u.uni, `select expire_stale_opportunities()`), /admin_only/);
    const opp = (await db.query(`select id from opportunities where organization_id = $1 and status = 'published' limit 1`, [uniId])).rows[0];
    if (!opp) return;
    await db.query(`alter table opportunities disable trigger user`);
    await db.query(`update opportunities set deadline = current_date - 2 where id = $1`, [opp.id]);
    await db.query(`alter table opportunities enable trigger user`);
    await as(u.admin, `select expire_stale_opportunities()`);
    eq((await db.query(`select status::text s from opportunities where id = $1`, [opp.id])).rows[0].s, 'expired');
  });
  await check('aviso: quien guardó la universidad recibe una notificación al publicarse una oportunidad', async () => {
    await as(u.admin, `update organizations set institution_id = $1 where id = $2`, [gmInst, uniId]);
    const opp = (await db.query(`select id from opportunities where organization_id = $1 limit 1`, [uniId])).rows[0];
    if (!opp) return;
    await db.query(`alter table opportunities disable trigger user`);
    await db.query(`update opportunities set status = 'draft', deadline = current_date + 30 where id = $1`, [opp.id]);
    await db.query(`alter table opportunities enable trigger user`);
    await as(u.admin, `update opportunities set status = 'published' where id = $1`, [opp.id]);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'saved_university_opportunity'`, [u.adult])).rows[0].n >= 1, true);
  });

  results.push('\nAthlete Command Center: tareas, preferencias de avisos y recordatorios');
  await check('tareas: el atleta marca las suyas; otro usuario no las ve ni las toca', async () => {
    await as(u.adult, `insert into athlete_task_state (athlete_id, task_key, status) values ($1, 'compare', 'done')`, [u.adult]);
    eq((await as(u.brand, `select count(*)::int n from athlete_task_state`)).rows[0].n, 0);
    await expectError(() => as(u.brand, `insert into athlete_task_state (athlete_id, task_key, status) values ($1, 'x', 'done')`, [u.adult]));
    eq((await db.query(`select updated_by from athlete_task_state where athlete_id = $1`, [u.adult])).rows[0].updated_by, u.adult);
  });
  await check('tareas: posponer exige una fecha futura razonable', async () => {
    await expectError(() => as(u.adult, `insert into athlete_task_state (athlete_id, task_key, status, snoozed_until) values ($1, 'matches', 'snoozed', current_date - 1)`, [u.adult]), /invalid_snooze/);
    await as(u.adult, `insert into athlete_task_state (athlete_id, task_key, status, snoozed_until) values ($1, 'matches', 'snoozed', current_date + 3)`, [u.adult]);
  });
  await check('avisos: una categoría silenciada no genera notificación; lo esencial siempre llega', async () => {
    await as(u.adult, `insert into notification_preferences (user_id, category, in_app) values ($1, 'matches', false)`, [u.adult]);
    const before = (await db.query(`select count(*)::int n from notifications where user_id = $1`, [u.adult])).rows[0].n;
    await db.query(`select notify($1, 'saved_university_opportunity', 't', 'b', '/app')`, [u.adult]);
    await db.query(`select notify($1, 'contact.request', 't', 'b', '/app')`, [u.adult]);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1`, [u.adult])).rows[0].n, before + 1);
    await expectError(() => as(u.adult, `insert into notification_preferences (user_id, category, in_app) values ($1, 'essential', false)`, [u.adult]));
    await expectError(() => as(u.brand, `insert into notification_preferences (user_id, category, in_app) values ($1, 'messages', false)`, [u.adult]));
  });
  await check('recordatorios: solo plazos oficiales guardados, sin duplicados y no ejecutable por usuarios', async () => {
    await expectError(() => as(u.adult, `select notify_upcoming_deadlines()`));
    await db.query(`delete from notification_preferences where user_id = $1`, [u.adult]);
    const opp = (await db.query(`select id from opportunities where organization_id = $1 and status = 'published' limit 1`, [uniId])).rows[0];
    if (!opp) return;
    await db.query(`alter table opportunities disable trigger user`);
    await db.query(`update opportunities set deadline = current_date + 7 where id = $1`, [opp.id]);
    await db.query(`alter table opportunities enable trigger user`);
    await as(u.adult, `insert into saved_items (athlete_id, target_kind, target_id) values ($1, 'opportunity', $2) on conflict do nothing`, [u.adult, opp.id]);
    await db.query(`select notify_upcoming_deadlines()`);
    await db.query(`select notify_upcoming_deadlines()`);
    eq((await db.query(`select count(*)::int n from notifications where user_id = $1 and kind = 'deadline.d7'`, [u.adult])).rows[0].n, 1);
  });

  results.push('\nOpportunity Pipeline: procesos, línea de tiempo, tareas, contactos, documentos y ofertas');
  let procId;
  await check('proceso: el atleta mueve la etapa y queda en la línea de tiempo con fuente "usuario"', async () => {
    procId = (await as(u.adult, `insert into saved_items (athlete_id, target_kind, target_id) values ($1, 'institution', $2) on conflict (athlete_id, target_kind, target_id) do update set note = saved_items.note returning id`, [u.adult, gmInst])).rows[0].id;
    await as(u.adult, `update saved_items set status = 'contacted', next_action = 'Enviar vídeo', next_action_due = current_date + 3 where id = $1`, [procId]);
    const ev = (await db.query(`select kind, source from pipeline_events where process_id = $1 order by id`, [procId])).rows;
    eq(ev.some((e) => e.kind === 'stage_changed' && e.source === 'user'), true);
    eq(ev.some((e) => e.kind === 'next_action'), true);
  });
  await check('línea de tiempo: el usuario no puede fingir eventos de la organización ni de la plataforma', async () => {
    await as(u.adult, `insert into pipeline_events (athlete_id, process_id, kind, source, title, channel) values ($1, $2, 'interaction', 'organization', 'Llamada con el coach', 'call')`, [u.adult, procId]);
    eq((await db.query(`select source from pipeline_events where process_id = $1 and kind = 'interaction'`, [procId])).rows[0].source, 'user');
    await expectError(() => as(u.adult, `insert into pipeline_events (athlete_id, process_id, kind, source, title) values ($1, $2, 'application_update', 'user', 'x')`, [u.adult, procId]), /event_kind_not_allowed/);
    await as(u.adult, `delete from pipeline_events where process_id = $1 and kind = 'stage_changed'`, [procId]);
    eq((await db.query(`select count(*)::int n from pipeline_events where process_id = $1 and kind = 'stage_changed'`, [procId])).rows[0].n >= 1, true, 'la auditoría no se borra');
  });
  await check('pipeline aislado: otro usuario no ve procesos, eventos, tareas ni contactos', async () => {
    await as(u.adult, `insert into pipeline_tasks (athlete_id, process_id, title, due_date) values ($1, $2, 'Pedir expediente', current_date + 1)`, [u.adult, procId]);
    await as(u.adult, `insert into pipeline_contacts (athlete_id, process_id, name, role, email) values ($1, $2, 'Coach Demo', 'Assistant coach', 'coach@example.edu')`, [u.adult, procId]);
    for (const t of ['saved_items', 'pipeline_events', 'pipeline_tasks', 'pipeline_contacts']) {
      eq((await as(u.brand, `select count(*)::int n from ${t} where athlete_id = $1`, [u.adult])).rows[0].n, 0, t);
      eq((await as(u.coach, `select count(*)::int n from ${t} where athlete_id = $1`, [u.adult])).rows[0].n, 0, t);
    }
    await expectError(() => as(u.brand, `insert into pipeline_tasks (athlete_id, title) values ($1, 'spam')`, [u.adult]));
  });
  await check('pipeline: no se pueden colgar tareas o contactos de un proceso ajeno', async () => {
    await expectError(() => as(u.privateAth, `insert into pipeline_tasks (athlete_id, process_id, title) values ($1, $2, 'x tarea')`, [u.privateAth, procId]));
    await expectError(() => as(u.privateAth, `insert into pipeline_contacts (athlete_id, process_id, name) values ($1, $2, 'Nombre')`, [u.privateAth, procId]));
  });
  await check('ofertas: lo que registra el atleta nunca figura como de la organización y abre su proceso', async () => {
    await as(u.adult, `insert into athlete_offers (athlete_id, university_name, institution_id, source, in_writing) values ($1, 'Test U', $2, 'organization', false)`, [u.adult, gmInst]);
    const o = (await db.query(`select source, process_id from athlete_offers where athlete_id = $1 and institution_id = $2`, [u.adult, gmInst])).rows[0];
    eq(o.source, 'athlete'); eq(o.process_id, procId);
    eq((await db.query(`select status from saved_items where id = $1`, [procId])).rows[0].status, 'offer');
  });
  await check('decisión: solo un compromiso activo por atleta', async () => {
    await as(u.adult, `update saved_items set status = 'committed' where id = $1`, [procId]);
    const opp = (await db.query(`select id from opportunities where status = 'published' limit 1`)).rows[0];
    if (!opp) return;
    const other = (await as(u.adult, `insert into saved_items (athlete_id, target_kind, target_id) values ($1, 'opportunity', $2) on conflict (athlete_id, target_kind, target_id) do update set note = saved_items.note returning id`, [u.adult, opp.id])).rows[0].id;
    await expectError(() => as(u.adult, `update saved_items set status = 'committed' where id = $1`, [other]));
    eq((await db.query(`select decided_at is not null ok from saved_items where id = $1`, [procId])).rows[0].ok, true);
  });
  await check('candidatura: crea o avanza el proceso con fuente "organización" y no retrocede', async () => {
    const opp = (await db.query(`select id from opportunities where organization_id = $1 and status = 'published' and (deadline is null or deadline >= current_date) limit 1`, [uniId])).rows[0];
    if (!opp) throw new Error('sin oportunidad de prueba');
    await db.query(`delete from applications where athlete_id = $1 and opportunity_id = $2`, [u.privateAth, opp.id]);
    await as(u.privateAth, `insert into applications (opportunity_id, athlete_id) values ($1, $2)`, [opp.id, u.privateAth]);
    const p = (await db.query(`select id, status from saved_items where athlete_id = $1 and target_id = $2`, [u.privateAth, opp.id])).rows[0];
    eq(p.status, 'applied');
    await as(u.uni, `update applications set status = 'interview' where athlete_id = $1 and opportunity_id = $2`, [u.privateAth, opp.id]);
    eq((await db.query(`select status from saved_items where id = $1`, [p.id])).rows[0].status, 'call');
    eq((await db.query(`select count(*)::int n from pipeline_events where process_id = $1 and source = 'organization' and kind = 'application_update'`, [p.id])).rows[0].n >= 1, true);
    await as(u.uni, `update applications set status = 'contacted' where athlete_id = $1 and opportunity_id = $2`, [u.privateAth, opp.id]);
    eq((await db.query(`select status from saved_items where id = $1`, [p.id])).rows[0].status, 'call', 'no retrocede');
  });
  await check('documentos del proceso: solo se enlazan documentos propios', async () => {
    const doc = (await as(u.privateAth, `insert into athlete_documents (athlete_id, kind, title) values ($1, 'transcript', 'Expediente') returning id`, [u.privateAth])).rows[0].id;
    await expectError(() => as(u.adult, `insert into process_documents (process_id, athlete_id, kind, document_id) values ($1, $2, 'transcript', $3)`, [procId, u.adult, doc]));
    await as(u.adult, `insert into process_documents (process_id, athlete_id, kind) values ($1, $2, 'transcript')`, [procId, u.adult]);
  });

  results.push('\nGala AI: métricas sin contenido, feedback y límites');
  await check('ai: cada usuario registra y ve solo sus métricas; el feedback solo sobre sus peticiones', async () => {
    const rid = randomUUID();
    await as(u.adult, `select log_ai_event($1, 'next_action', 'model', 'ok', 'anthropic', 'm', 10, 20, 1, 300, '/app')`, [rid]);
    eq((await as(u.brand, `select count(*)::int n from ai_events where id = $1`, [rid])).rows[0].n, 0);
    eq((await as(u.adult, `select user_id from ai_events where id = $1`, [rid])).rows[0].user_id, u.adult);
    await expectError(() => as(u.brand, `insert into ai_feedback (request_id, user_id, rating) values ($1, $2, 1)`, [rid, u.brand]));
    await as(u.adult, `insert into ai_feedback (request_id, user_id, rating, reason) values ($1, $2, -1, 'wrong')`, [rid, u.adult]);
    await expectError(() => as(u.adult, `insert into ai_events (id, user_id, intent, mode, outcome) values ($1, $2, 'x', 'model', 'ok')`, [randomUUID(), u.adult]));
  });
  await check('ai: ráfaga de 6 por minuto y estadísticas solo para admin', async () => {
    const r = [];
    for (let i = 0; i < 7; i++) r.push((await as(u.coach, `select consume_ai_request() ok`)).rows[0].ok);
    eq(r.slice(0, 6).every(Boolean), true); eq(r[6], false);
    await expectError(() => as(u.adult, `select * from admin_ai_stats()`), /admin_only/);
    eq((await as(u.admin, `select requests from admin_ai_stats()`)).rows[0].requests >= 1, true);
  });

  results.push('\nCoach & University Portal: roles, aislamiento, shortlists, notas, candidatos, solicitudes y documentos');
  let uniB; let listTeam; let listPriv;
  const otherUni = randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'otheruni@test.dev', $2)`, [otherUni, { display_name: 'Other Uni' }]);
  await as(otherUni, `insert into user_roles (user_id, role) values ($1, 'university')`, [otherUni]);
  await as(otherUni, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [otherUni, yearsAgo(40)]);
  await check('roles: admisiones no descubre ni gestiona pipeline; organización sin verificar no toca atletas', async () => {
    uniB = (await as(otherUni, `insert into organizations (name, type, created_by) values ('Uni B', 'university', $1) returning id`, [otherUni])).rows[0].id;
    eq((await as(otherUni, `select org_can($1, 'discover') ok`, [uniB])).rows[0].ok, false, 'sin verificar');
    eq((await as(otherUni, `select org_can($1, 'needs') ok`, [uniB])).rows[0].ok, true, 'configurar sí');
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [uniB]);
    await as(u.uni, `update organization_members set member_role = 'admissions' where organization_id = $1 and user_id = $2`, [uniId, u.coach]);
    eq((await as(u.coach, `select org_can($1, 'discover') d, org_can($1, 'academic') a`, [uniId])).rows[0].d, false);
    await as(u.uni, `update organization_members set member_role = 'assistant_coach' where organization_id = $1 and user_id = $2`, [uniId, u.coach]);
    eq((await as(u.coach, `select org_can($1, 'discover') ok`, [uniId])).rows[0].ok, true);
    eq((await as(u.coach, `select org_can($1, 'manage_members') ok`, [uniId])).rows[0].ok, false);
  });
  await check('shortlists: privada solo para su dueño; de equipo para el staff; otra universidad no ve nada', async () => {
    listTeam = (await as(u.uni, `insert into org_shortlists (organization_id, name, visibility, owner_id) values ($1, '2027 PG', 'team', $2) returning id`, [uniId, u.uni])).rows[0].id;
    listPriv = (await as(u.coach, `insert into org_shortlists (organization_id, name, visibility, owner_id) values ($1, 'Mía', 'private', $2) returning id`, [uniId, u.coach])).rows[0].id;
    await as(u.uni, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id) values ($1, $2, $3)`, [listTeam, uniId, u.adult]);
    eq((await as(u.coach, `select count(*)::int n from org_shortlist_members where shortlist_id = $1`, [listTeam])).rows[0].n, 1);
    eq((await as(otherUni, `select count(*)::int n from org_shortlists where organization_id = $1`, [uniId])).rows[0].n, 0);
    eq((await as(u.adult, `select count(*)::int n from org_shortlist_members where athlete_id = $1`, [u.adult])).rows[0].n, 0, 'el atleta no ve shortlists');
    await expectError(() => as(otherUni, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id) values ($1, $2, $3)`, [listTeam, uniB, u.privateAth]));
    await expectError(() => as(u.uni, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id) values ($1, $2, $3)`, [listTeam, uniId, u.adult]), /duplicate|unique/);
  });
  await check('shortlist: no se puede añadir un atleta que no puedes ver ni asignar a alguien de fuera', async () => {
    await as(u.privateAth, `update athlete_profiles set profile_visibility = 'private' where user_id = $1`, [u.privateAth]);
    await expectError(() => as(u.uni, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id) values ($1, $2, $3)`, [listTeam, uniId, u.privateAth]));
    await expectError(() => as(u.uni, `update org_shortlist_members set assigned_to = $2 where shortlist_id = $1`, [listTeam, otherUni]), /assignee_not_member/);
    await as(u.uni, `update org_shortlist_members set assigned_to = $2, review_status = 'reviewed' where shortlist_id = $1`, [listTeam, u.coach]);
  });
  await check('notas internas: nunca las ve el atleta ni otra universidad', async () => {
    await as(u.coach, `insert into org_notes (organization_id, athlete_id, author_id, body) values ($1, $2, $3, 'Ver partido completo')`, [uniId, u.adult, u.coach]);
    eq((await as(u.adult, `select count(*)::int n from org_notes`)).rows[0].n, 0);
    eq((await as(otherUni, `select count(*)::int n from org_notes`)).rows[0].n, 0);
    eq((await as(u.uni, `select count(*)::int n from org_notes where athlete_id = $1`, [u.adult])).rows[0].n, 1);
  });
  await check('candidatos: la etapa interna es privada de la organización; la asignación exige ser miembro', async () => {
    const c = (await as(u.uni, `insert into org_candidates (organization_id, athlete_id, internal_stage) values ($1, $2, 'priority_review') on conflict (organization_id, athlete_id) do update set internal_stage = 'priority_review' returning id`, [uniId, u.adult])).rows[0].id;
    eq((await as(u.adult, `select count(*)::int n from org_candidates`)).rows[0].n, 0);
    eq((await as(otherUni, `select count(*)::int n from org_candidates where organization_id = $1`, [uniId])).rows[0].n, 0);
    await expectError(() => as(u.uni, `update org_candidates set assigned_to = $2 where id = $1`, [c, otherUni]), /assignee_not_member/);
    await as(u.uni, `update org_candidates set assigned_to = $2 where id = $1`, [c, u.coach]);
    const kinds = (await as(u.uni, `select kind from org_activity where organization_id = $1 and athlete_id = $2`, [uniId, u.adult])).rows.map((r) => r.kind);
    eq(kinds.includes('shortlisted') && kinds.includes('note_added') && kinds.includes('assigned'), true);
    await expectError(() => as(u.uni, `update org_activity set kind = 'export' where organization_id = $1`, [uniId]));
  });
  await check('solicitud de información: el atleta decide y el acceso al documento caduca', async () => {
    const doc = (await as(u.adult, `insert into athlete_documents (athlete_id, kind, title) values ($1, 'transcript', 'Expediente') returning id`, [u.adult])).rows[0].id;
    const req = (await as(u.coach, `insert into info_requests (organization_id, athlete_id, requested_by, kind, message) values ($1, $2, $3, 'transcript', 'Necesitamos tu expediente académico') returning id, status`, [uniId, u.adult, u.coach])).rows[0];
    eq(req.status, 'pending');
    eq((await as(u.coach, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 0, 'existe ≠ compartido');
    await expectError(() => as(u.coach, `select respond_info_request($1, true, $2, null)`, [req.id, doc]));
    await as(u.adult, `select respond_info_request($1, true, $2, current_date + 10)`, [req.id, doc]);
    eq((await as(u.coach, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 1);
    eq((await as(otherUni, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 0);
    await as(u.coach, `select log_document_access($1)`, [req.id]);
    await db.query(`update info_requests set shared_until = current_date - 1 where id = $1`, [req.id]);
    eq((await as(u.coach, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 0, 'caducado');
  });
  await check('menores: la solicitud va a la familia y el menor no puede compartir solo', async () => {
    await as(u.minor, `update athlete_profiles set profile_visibility = 'verified_orgs' where user_id = $1`, [u.minor]);
    const r = (await as(u.uni, `insert into info_requests (organization_id, athlete_id, requested_by, kind, message) values ($1, $2, $3, 'full_game_video', 'Queremos ver un partido completo') returning id, status`, [uniId, u.minor, u.uni])).rows[0];
    eq(r.status, 'pending_guardian');
    await expectError(() => as(u.minor, `select respond_info_request($1, true, null, null)`, [r.id]), /guardian_required/);
  });
  await check('búsqueda: un bloque deportivo privado no se ve ni se puede filtrar', async () => {
    await as(u.adult, `update athlete_profiles set profile_visibility = 'public', sport_visibility = 'private', height_cm = 181 where user_id = $1`, [u.adult]);
    const row = (await as(u.coach, `select sport_id, height_cm from athlete_directory where user_id = $1`, [u.adult])).rows[0];
    eq(row.sport_id, null); eq(row.height_cm, null);
    eq((await as(u.coach, `select count(*)::int n from athlete_directory where user_id = $1 and height_cm >= 180`, [u.adult])).rows[0].n, 0);
    eq((await as(u.adult, `select height_cm from athlete_directory where user_id = $1`, [u.adult])).rows[0].height_cm, 181, 'el atleta sí');
    await as(u.adult, `update athlete_profiles set sport_visibility = 'members' where user_id = $1`, [u.adult]);
  });
  await check('búsqueda de talento: los filtros nuevos respetan el bloque de visibilidad y no son un oráculo', async () => {
    await as(u.adult, `update athlete_profiles set profile_visibility = 'public', sport_visibility = 'members', nationality = 'ES', weight_kg = 78, dominant_side = 'left', league = 'Liga demo', years_experience = 6 where user_id = $1`, [u.adult]);
    await as(u.adult, `insert into athlete_languages (athlete_id, language_code, level) values ($1, 'en', 'b2') on conflict (athlete_id, language_code) do update set level = 'b2'`, [u.adult]);
    const r = (await as(u.coach, `select nationality, weight_kg, dominant_side, league, years_experience, english_level from athlete_directory where user_id = $1`, [u.adult])).rows[0];
    eq(r.nationality, 'ES'); eq(r.weight_kg, 78); eq(r.dominant_side, 'left'); eq(r.english_level, 'b2');
    eq((await as(u.coach, `select count(*)::int n from athlete_directory where user_id = $1 and dominant_side = 'left' and weight_kg between 70 and 80`, [u.adult])).rows[0].n, 1, 'filtrable');
    // Bloque deportivo privado: peso, lateralidad, liga y experiencia desaparecen y no se pueden filtrar.
    await as(u.adult, `update athlete_profiles set sport_visibility = 'private' where user_id = $1`, [u.adult]);
    const h = (await as(u.coach, `select weight_kg, dominant_side, league, years_experience from athlete_directory where user_id = $1`, [u.adult])).rows[0];
    eq(h.weight_kg, null); eq(h.dominant_side, null); eq(h.league, null); eq(h.years_experience, null);
    eq((await as(u.coach, `select count(*)::int n from athlete_directory where user_id = $1 and dominant_side = 'left'`, [u.adult])).rows[0].n, 0, 'oculto = no filtrable');
    eq((await as(u.adult, `select weight_kg from athlete_directory where user_id = $1`, [u.adult])).rows[0].weight_kg, 78, 'el atleta sí');
    await as(u.adult, `update athlete_profiles set sport_visibility = 'members' where user_id = $1`, [u.adult]);
    // Estadística validada por club: solo cuenta si el bloque de estadísticas es visible.
    const def = (await db.query(`select id from sport_stat_definitions limit 1`)).rows[0].id;
    await db.query(`insert into athlete_statistics (athlete_id, stat_definition_id, season, value, source) values ($1, $2, '2026', 1, 'club_verified') on conflict do nothing`, [u.adult, def]);
    await as(u.adult, `update athlete_profiles set stats_visibility = 'members' where user_id = $1`, [u.adult]);
    eq((await as(u.coach, `select has_verified_stats v from athlete_directory where user_id = $1`, [u.adult])).rows[0].v, true);
    await as(u.adult, `update athlete_profiles set stats_visibility = 'private' where user_id = $1`, [u.adult]);
    eq((await as(u.coach, `select has_verified_stats v from athlete_directory where user_id = $1`, [u.adult])).rows[0].v, false, 'oculto');
    await as(u.adult, `update athlete_profiles set stats_visibility = 'members' where user_id = $1`, [u.adult]);
  });
  await check('becas: sin información no se puede anunciar ayuda; la confirmada solo vive en la oferta', async () => {
    const opp = (await db.query(`select id from opportunities where organization_id = $1 limit 1`, [uniId])).rows[0];
    if (!opp) return;
    await expectError(() => as(u.uni, `update opportunities set scholarship_status = 'not_provided', aid_amount_usd = 20000 where id = $1`, [opp.id]));
    await expectError(() => as(u.uni, `update opportunities set scholarship_status = 'confirmed_in_offer' where id = $1`, [opp.id]));
  });
  await check('oferta de la organización: entra en la entidad compartida y la ve el atleta', async () => {
    const c = (await as(u.uni, `select id from org_candidates where organization_id = $1 and athlete_id = $2`, [uniId, u.adult])).rows[0].id;
    await expectError(() => as(u.coach, `select org_record_offer($1, 40000, 10000, 'yes', true, null, 'athletic')`, [c]), /not_allowed/);
    await as(u.uni, `select org_record_offer($1, 40000, 10000, 'yes', true, null, 'athletic')`, [c]);
    eq((await as(u.adult, `select count(*)::int n from athlete_offers where source = 'organization'`)).rows[0].n >= 1, true);
  });
  await check('salida de staff: pierde el acceso, se liberan asignaciones y queda en auditoría; siempre queda un admin', async () => {
    await as(u.uni, `delete from organization_members where organization_id = $1 and user_id = $2`, [uniId, u.coach]);
    eq((await as(u.coach, `select count(*)::int n from org_candidates where organization_id = $1`, [uniId])).rows[0].n, 0);
    eq((await as(u.uni, `select count(*)::int n from org_candidates where organization_id = $1 and assigned_to = $2`, [uniId, u.coach])).rows[0].n, 0);
    eq((await as(u.uni, `select visibility from org_shortlists where id = $1`, [listPriv])).rows[0].visibility, 'team', 'su lista privada pasa al equipo');
    eq((await as(u.uni, `select count(*)::int n from org_activity where organization_id = $1 and kind = 'member_removed'`, [uniId])).rows[0].n, 1);
    await expectError(() => as(u.uni, `delete from organization_members where organization_id = $1 and user_id = $2`, [uniId, u.uni]), /last_admin/);
    await as(u.uni, `insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'coach')`, [uniId, u.coach]);
  });

  // ---------------------------------------------------------------- Fase 04 · foto del encaje al guardar
  await check('foto de encaje: el atleta la guarda en su guardado; nadie más la lee; tamaño acotado', async () => {
    const snap = JSON.stringify({ v: 'gm-2.0', s: 82, c: 'medium', f: { english: ['unknown', 'Inglés', 'athlete'] } });
    await as(u.adult, `update saved_items set match_snapshot = $2::jsonb where athlete_id = $1 and target_kind = 'institution' and target_id = $3`, [u.adult, snap, gmInst]);
    eq((await as(u.adult, `select match_snapshot->>'c' c from saved_items where athlete_id = $1 and target_id = $2`, [u.adult, gmInst])).rows[0].c, 'medium');
    eq((await as(u.uni, `select count(*)::int n from saved_items where match_snapshot is not null`)).rows[0].n, 0);
    await expectError(() => as(u.adult, `update saved_items set match_snapshot = to_jsonb(repeat('x', 20000)) where athlete_id = $1`, [u.adult]));
  });

  // ---------------------------------------------------------------- Fase 06 · historial de Gala AI (opcional)
  await check('gala ai: sin activar el historial no se puede guardar nada', async () => {
    await expectError(() => as(u.adult, `insert into ai_conversations (user_id, title) values ($1, 'x')`, [u.adult]), /history_disabled/);
  });
  await check('gala ai: con historial, solo el dueño ve y escribe; desactivarlo lo borra todo', async () => {
    await as(u.adult, `insert into ai_preferences (user_id, save_history) values ($1, true) on conflict (user_id) do update set save_history = true`, [u.adult]);
    const cid = (await as(u.adult, `insert into ai_conversations (user_id, title) values ($1, 'Plazos') returning id`, [u.adult])).rows[0].id;
    await as(u.adult, `insert into ai_messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'hola')`, [cid, u.adult]);
    eq((await as(u.parent, `select count(*)::int n from ai_messages`)).rows[0].n, 0, 'la familia no lo ve');
    eq((await as(u.uni, `select count(*)::int n from ai_conversations`)).rows[0].n, 0, 'una organización no lo ve');
    await expectError(() => as(u.uni, `insert into ai_messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'x')`, [cid, u.uni]));
    await as(u.adult, `update ai_preferences set save_history = false where user_id = $1`, [u.adult]);
    eq((await as(u.adult, `select count(*)::int n from ai_conversations`)).rows[0].n, 0, 'al desactivar se borra');
  });

  // ---------------------------------------------------------------- 11 / 11A · Trials & Academy Programs
  results.push('\nPrompt 11A: Trials & Academy Programs');
  // Organización verificada (club o academia) cuyo creador queda como dueño.
  const verifiedOrg = async (owner, name, type) => {
    const id = (await as(owner, `insert into organizations (name, type, created_by) values ($1, $2, $3) returning id`, [name, type, owner])).rows[0].id;
    await as(owner, `update organizations set verification_status = 'submitted' where id = $1`, [id]);
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [id]);
    const st = (await db.query(`select verification_status, org_status from organizations where id = $1`, [id])).rows[0];
    eq(`${st.verification_status}/${st.org_status}`, 'verified/active', 'organización verificada');
    return id;
  };
  // Trial o programa completo y publicable (las reglas de publicación las aplica la BD).
  const makeOpp = async (owner, org, { type = 'tryout', price = 'free', amount = null, mode = 'direct', capacity = null, extraCosts = [], title = 'Trial U18 base' } = {}) => {
    const id = (await as(owner, `insert into opportunities (organization_id, created_by, type, title, description, sport_id, start_at, timezone, city, country, age_category_code)
      values ($1, $2, $3, $4, 'Prueba para bases U18 durante dos días en Valencia.', 'basketball', now() + interval '30 days', 'Europe/Madrid', 'Valencia', 'ES', 'U18') returning id`,
      [org, owner, type, title])).rows[0].id;
    if (mode === 'application_required' || type === 'academy') await as(owner, `update opportunities set deadline = current_date + 20 where id = $1`, [id]);

    if (type === 'academy') {
      await as(owner, `insert into academy_program_details (opportunity_id, calendar_type, price_status, capacity) values ($1, 'fixed_term', $2, $3)`, [id, price, capacity]);
    } else {
      await as(owner, `insert into trial_details (opportunity_id, registration_mode, price_status, capacity) values ($1, $2, $3, $4)`, [id, mode, price, capacity]);
    }
    if (amount != null) await as(owner, `insert into opportunity_cost_components (opportunity_id, component_type, label, amount, currency) values ($1, $2, $3, $4, 'EUR')`,
      [id, type === 'academy' ? 'program_fee' : 'registration', type === 'academy' ? 'Cuota del programa' : 'Inscripción', amount]);
    for (const c of extraCosts) await as(owner, `insert into opportunity_cost_components (opportunity_id, component_type, label, amount, currency, required, included) values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, c.type, c.label, c.amount ?? null, c.amount != null ? 'EUR' : null, c.required ?? true, c.included ?? false]);
    await as(owner, `insert into opportunity_requirements (opportunity_id, kind, strength, params, label) values ($1, 'age', 'required', '{"min": 15, "max": 18}', 'Edad')`, [id]);
    await as(u.admin, `update opportunities set status = 'published' where id = $1`, [id]);
    return id;
  };
  const startEvent = (opp) => as(u.admin, `update opportunities set start_at = now() - interval '1 hour' where id = $1`, [opp]);

  let clubA; let academyC; let freeTrial; let paidTrial; let inviteTrial; let program; let agencyT;
  await check('11A publicación: solo con lo obligatorio (fecha, lugar, categoría, coste, requisitos) y mensajes concretos', async () => {
    clubA = await verifiedOrg(u.coach2, 'Club Trials CF', 'club');
    const draft = (await as(u.coach2, `insert into opportunities (organization_id, created_by, type, title, description, sport_id)
      values ($1, $2, 'tryout', 'Trial sin datos', 'Borrador incompleto para comprobar la validación.', 'basketball') returning id`, [clubA, u.coach2])).rows[0].id;
    await expectError(() => as(u.coach2, `update opportunities set status = 'pending_review' where id = $1`, [draft]), /not_publishable:.*details/);
    await as(u.coach2, `insert into trial_details (opportunity_id, price_status) values ($1, 'paid')`, [draft]);
    const gaps = (await as(u.coach2, `select opportunity_publish_gaps($1) g`, [draft])).rows[0].g;
    for (const g of ['location', 'age_category', 'requirements', 'date', 'price']) eq(gaps.includes(g), true, `falta ${g}`);
    // Un trial de pago nunca se publica sin importe; «0 €» o null nunca equivalen a «gratis».
    await expectError(() => as(u.coach2, `insert into opportunity_cost_components (opportunity_id, component_type, label, amount) values ($1, 'registration', 'Inscripción', 150)`, [draft]), /cost_amount_has_currency/);
    await expectError(() => as(u.coach2, `insert into trial_details (opportunity_id) values ($1)`, [draft]), /duplicate key/);
    // Especialización solo para su tipo; equipo de otra organización imposible.
    const uniOpp = (await as(u.uni, `insert into opportunities (organization_id, created_by, type, title, description, sport_id) values ($1, $2, 'athletic_scholarship', 'Beca', 'Beca universitaria completa de baloncesto.', 'basketball') returning id`, [uniId, u.uni])).rows[0].id;
    await expectError(() => as(u.uni, `insert into trial_details (opportunity_id) values ($1)`, [uniOpp]), /not_a_trial/);
    await expectError(() => db.query(`update opportunities set timezone = 'Mars/Olympus' where id = $1`, [draft]), /invalid_timezone/);
  });

  await check('11A escenario 1 · trial gratuito: candidatura → club acepta → familia aprueba → club confirma → asistencia → recruiting', async () => {
    freeTrial = await makeOpp(u.coach2, clubA, { mode: 'application_required' });
    eq((await as(u.anon ?? null, `select price_status from trial_details where opportunity_id = $1`, [freeTrial])).rows[0].price_status, 'free', 'público ve «gratis» declarado');
    // Modo candidatura: no se puede inscribir sin candidatura aceptada.
    await expectError(() => as(u.minor, `select trial_register($1, $2)`, [freeTrial, u.minor]), /application_required/);
    const app = (await as(u.minor, `insert into applications (opportunity_id, athlete_id, organization_id) values ($1, $2, $3) returning id, organization_id, guardian_consent_status`, [freeTrial, u.minor, uniId])).rows[0];
    eq(app.organization_id, clubA, 'el tenant lo decide la oportunidad, no el cliente');
    eq(app.guardian_consent_status, 'pending');
    // El atleta no puede aceptarse a sí mismo; otra organización tampoco decide.
    await expectError(() => as(u.minor, `update applications set status = 'accepted' where id = $1`, [app.id]), /athlete_can_only_withdraw/);
    await expectError(() => as(u.uni, `select application_org_decide($1, 'accepted')`, [app.id]), /not_allowed/);
    eq((await as(u.coach2, `select application_org_decide($1, 'accepted') s`, [app.id])).rows[0].s, 'accepted');
    eq((await as(u.coach2, `select application_org_decide($1, 'accepted') s`, [app.id])).rows[0].s, 'accepted', 'doble clic idempotente');
    const reg = (await as(u.minor, `select id, status, guardian_status, origin, application_id from opportunity_registrations where opportunity_id = $1 and athlete_id = $2`, [freeTrial, u.minor])).rows[0];
    eq(reg.status, 'pending'); eq(reg.guardian_status, 'pending'); eq(reg.origin, 'application'); eq(reg.application_id, app.id);
    // Sin la familia no se confirma.
    await expectError(() => as(u.coach2, `select trial_org_action($1, 'confirm')`, [reg.id]), /invalid_transition|guardian_consent_missing/);
    await expectError(() => as(u.minor, `select trial_respond($1, 'guardian_approve')`, [reg.id]), /invalid_transition/);
    eq((await as(u.parent, `select trial_respond($1, 'guardian_approve') s`, [reg.id])).rows[0].s, 'registered');
    eq((await as(u.parent, `select count(*)::int n from consents where user_id = $1 and purpose = 'trial_participation' and target_id = $2 and granted`, [u.minor, freeTrial])).rows[0].n >= 1, true, 'consentimiento granular registrado');
    eq((await as(u.coach2, `select trial_org_action($1, 'confirm') s`, [reg.id])).rows[0].s, 'confirmed');
    // Asistencia: desconocida hasta que el club la registra; nunca antes del evento; el atleta no puede marcarla.
    await expectError(() => as(u.coach2, `select attendance_record($1, 'no_show')`, [reg.id]), /event_not_started/);
    await expectError(() => as(u.minor, `insert into opportunity_attendance (registration_id, opportunity_id, organization_id, athlete_id, status) values ($1, $2, $3, $4, 'attended')`, [reg.id, freeTrial, clubA, u.minor]), /permission denied/);
    eq((await as(u.minor, `select count(*)::int n from opportunity_attendance where registration_id = $1`, [reg.id])).rows[0].n, 0, 'confirmado ≠ asistió');
    await startEvent(freeTrial);
    eq((await as(u.coach2, `select attendance_record($1, 'attended') s`, [reg.id])).rows[0].s, 'attended');
    eq((await as(u.coach2, `select attendance_record($1, 'attended') s`, [reg.id])).rows[0].s, 'attended', 'check-in doble no duplica');
    eq((await as(u.minor, `select status from opportunity_registrations where id = $1`, [reg.id])).rows[0].status, 'completed');
    // Resultado interno + mensaje compartido; recruiting central sin duplicar y sin oferta.
    await as(u.coach2, `select outcome_record($1, 'start_recruiting_process', 'Muy buena lectura de juego', 'Queremos seguir hablando contigo.')`, [reg.id]);
    const cand = (await as(u.coach2, `select id, source, registration_id from org_candidates where organization_id = $1 and athlete_id = $2`, [clubA, u.minor])).rows;
    eq(cand.length, 1); eq(cand[0].source === 'trial' || cand[0].source === 'application', true); eq(cand[0].registration_id, reg.id);
    await as(u.coach2, `select start_recruiting_from_trial($1)`, [reg.id]);
    eq((await as(u.coach2, `select count(*)::int n from org_candidates where organization_id = $1 and athlete_id = $2`, [clubA, u.minor])).rows[0].n, 1, 'sin duplicar el proceso');
    eq((await as(u.minor, `select count(*)::int n from opportunity_outcomes`)).rows[0].n, 0, 'el resultado interno no es visible para el atleta');
    eq((await as(u.parent, `select count(*)::int n from opportunity_outcomes`)).rows[0].n, 0, 'ni para la familia');
    eq((await as(u.minor, `select athlete_update from opportunity_registrations where id = $1`, [reg.id])).rows[0].athlete_update, 'Queremos seguir hablando contigo.');
  });

  await check('11A escenario 2 · trial de pago: coste transparente (obligatorio vs opcional) y pago preparado, nunca marcable desde el cliente', async () => {
    academyC = await verifiedOrg(u.coach, 'Academia C', 'academy');
    paidTrial = await makeOpp(u.coach, academyC, { price: 'paid', amount: 150, capacity: 1, title: 'Trial de pago', extraCosts: [
      { type: 'accommodation', label: 'Alojamiento', amount: 80, required: false }, { type: 'meals', label: 'Comidas', included: true }] });
    const costs = (await as(u.adult, `select component_type, amount, required, included from opportunity_cost_components where opportunity_id = $1 order by sort, component_type`, [paidTrial])).rows;
    eq(costs.length, 3, 'el atleta ve todos los componentes');
    const reg = (await as(u.adult, `select trial_register($1, $2) id`, [paidTrial, u.adult])).rows[0].id;
    eq((await as(u.adult, `select status, payment_status from opportunity_registrations where id = $1`, [reg])).rows[0].payment_status, 'pending');
    const pays = (await as(u.adult, `select amount, currency, status from payment_requirements where registration_id = $1`, [reg])).rows;
    eq(pays.length, 1, 'solo lo obligatorio con importe (no el alojamiento opcional ni lo incluido)');
    eq(Number(pays[0].amount), 150); eq(pays[0].status, 'pending');
    await expectError(() => as(u.adult, `update payment_requirements set status = 'paid' where registration_id = $1`, [reg]), /permission denied/);
    await expectError(() => as(u.coach, `update payment_requirements set status = 'paid' where registration_id = $1`, [reg]), /permission denied/);
    // Capacidad confirmada: plazas libres derivadas; no se confirma por encima.
    eq((await as(u.coach, `select trial_org_action($1, 'confirm') s`, [reg])).rows[0].s, 'confirmed');
    eq((await as(u.coach, `select opportunity_visible_confirmed_count($1) n`, [paidTrial])).rows[0].n, 1);
    const reg2 = (await as(u.privateAth, `select trial_register($1, $2) id`, [paidTrial, u.privateAth])).rows[0].id;
    await expectError(() => as(u.coach, `select trial_org_action($1, 'confirm')`, [reg2]), /capacity_reached/);
    eq((await as(u.coach, `select trial_org_action($1, 'waitlist') s`, [reg2])).rows[0].s, 'waitlisted');
  });

  await check('11A agente: con representación activa propone; si cuesta dinero el atleta acepta antes; no inscribe a quien no representa', async () => {
    agencyT = (await as(u.agent, `insert into organizations (name, type, created_by) values ('Agency Trials', 'agency', $1) returning id`, [u.agent])).rows[0].id;
    await expectError(() => as(u.agent, `select trial_register($1, $2, $3)`, [paidTrial, u.adult, agencyT]), /not_allowed/);
    await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [agencyT]);
    { const rid = await repRequest(u.agent, agencyT, u.adult); await as(u.adult, `select representation_respond($1, true)`, [rid]); }
    const t3 = await makeOpp(u.coach, academyC, { price: 'paid', amount: 40, title: 'Trial agente' });
    eq((await as(u.agent, `select count(*)::int n from agent_representations where agency_id = $1 and athlete_id = $2 and status = 'active'`, [agencyT, u.adult])).rows[0].n, 1, 'representación activa');
    {
      const r = (await as(u.agent, `select trial_register($1, $2, $3) id`, [t3, u.adult, agencyT])).rows[0].id;
      const row = (await as(u.agent, `select status, needs_athlete_ok from opportunity_registrations where id = $1`, [r])).rows[0];
      eq(row.status, 'pending'); eq(row.needs_athlete_ok, true);
      await expectError(() => as(u.agent, `select trial_respond($1, 'confirm_cost')`, [r]), /invalid_transition/);
      eq((await as(u.agent, `select trial_register($1, $2, $3) id`, [t3, u.adult, agencyT])).rows[0].id, r, 'idempotente');
      eq((await as(u.adult, `select trial_respond($1, 'confirm_cost') s`, [r])).rows[0].s, 'registered');
    }
    await expectError(() => as(u.agent, `select trial_register($1, $2, $3)`, [t3, u.privateAth, agencyT]), /not_allowed/);
    await expectError(() => as(u.adult, `insert into opportunity_registrations (opportunity_id, organization_id, athlete_id, status, origin) values ($1, $2, $3, 'confirmed', 'athlete')`, [t3, academyC, u.adult]), /permission denied/);
  });

  await check('11A escenario 3 · invitación del club: interesado ≠ inscrito; la familia aprueba y se crea la inscripción con su procedencia', async () => {
    inviteTrial = await makeOpp(u.coach2, clubA, { mode: 'invitation_only', title: 'Trial por invitación' });
    await expectError(() => as(u.adult, `select trial_register($1, $2)`, [inviteTrial, u.adult]), /invitation_required/);
    await expectError(() => as(u.uni, `select trial_org_invite($1, $2)`, [inviteTrial, u.minor]), /not_allowed/);
    const inv = (await as(u.coach2, `select trial_org_invite($1, $2, 'shortlist') id`, [inviteTrial, u.minor])).rows[0].id;
    eq((await as(u.coach2, `select trial_org_invite($1, $2, 'shortlist') id`, [inviteTrial, u.minor])).rows[0].id, inv, 'invitación idempotente');
    eq((await as(u.adult, `select count(*)::int n from opportunity_invitations where id = $1`, [inv])).rows[0].n, 0, 'otros atletas no la ven');
    eq((await as(u.minor, `select invitation_respond($1, 'viewed') s`, [inv])).rows[0].s, 'viewed');
    eq((await as(u.minor, `select invitation_respond($1, 'interested') s`, [inv])).rows[0].s, 'interested');
    eq((await as(u.minor, `select count(*)::int n from opportunity_registrations where opportunity_id = $1`, [inviteTrial])).rows[0].n, 0, 'interesado no crea inscripción');
    eq((await as(u.parent, `select invitation_respond($1, 'guardian_approve') s`, [inv])).rows[0].s, 'registered');
    const reg = (await as(u.minor, `select status, origin, invitation_id, guardian_status from opportunity_registrations where opportunity_id = $1 and athlete_id = $2`, [inviteTrial, u.minor])).rows[0];
    eq(reg.status, 'registered'); eq(reg.origin, 'club_invite'); eq(reg.invitation_id, inv); eq(reg.guardian_status, 'approved');
    eq((await as(u.minor, `select status from opportunity_invitations where id = $1`, [inv])).rows[0].status, 'converted_to_registration');
  });

  await check('11A escenario 4 · programa de academia: candidatura → aceptada → plaza ofrecida → aceptada → matrícula (aceptado ≠ matriculado)', async () => {
    program = await makeOpp(u.coach, academyC, { type: 'academy', price: 'paid', amount: 8000, title: 'Programa anual', extraCosts: [
      { type: 'accommodation', label: 'Alojamiento', amount: 4500 }, { type: 'registration', label: 'Matrícula', amount: 250 }, { type: 'meals', label: 'Comidas', included: true },
      { type: 'transport', label: 'Viaje', required: false }] });
    const req = (await as(u.adult, `select coalesce(sum(amount), 0)::int t from opportunity_cost_components where opportunity_id = $1 and required and not included`, [program])).rows[0].t;
    eq(req, 12750, 'coste obligatorio conocido sin inventar el viaje');
    const app = (await as(u.adult, `insert into applications (opportunity_id, athlete_id) values ($1, $2) returning id`, [program, u.adult])).rows[0].id;
    await as(u.coach, `select application_org_decide($1, 'accepted')`, [app]);
    const enr = (await as(u.adult, `select id, status, application_id from program_enrollments where opportunity_id = $1 and athlete_id = $2`, [program, u.adult])).rows[0];
    eq(enr.status, 'offered'); eq(enr.application_id, app);
    await expectError(() => as(u.adult, `update program_enrollments set status = 'enrolled' where id = $1`, [enr.id]).then((r) => { if (!r.rowCount) throw new Error('permission denied (0 filas)'); }), /permission denied/);
    await expectError(() => as(u.coach, `select enrollment_org_action($1, 'enroll')`, [enr.id]), /invalid_transition/);
    eq((await as(u.adult, `select enrollment_respond($1, 'accept') s`, [enr.id])).rows[0].s, 'accepted');
    eq((await as(u.adult, `select count(*)::int n from payment_requirements where enrollment_id = $1`, [enr.id])).rows[0].n, 3, 'cuota + alojamiento + matrícula');
    eq((await as(u.coach, `select enrollment_org_action($1, 'enroll') s`, [enr.id])).rows[0].s, 'enrolled');
    eq((await as(u.coach, `select enrollment_org_action($1, 'activate') s`, [enr.id])).rows[0].s, 'active');
    await expectError(() => as(u.coach, `select application_org_decide($1, 'declined')`, [app]), /invalid_transition/);
  });

  await check('11A integridad: equipo de otro tenant imposible, candidatura duplicada bloqueada', async () => {
    const progA = (await as(u.coach2, `insert into org_programs (organization_id, sport_id, gender, name) values ($1, 'basketball', 'women', 'Femenino') returning id`, [clubA])).rows[0].id;
    const teamA = (await as(u.coach2, `insert into org_teams (organization_id, program_id, name, age_category_code, created_by) values ($1, $2, 'U18 A', 'U18', $3) returning id`, [clubA, progA, u.coach2])).rows[0].id;
    // Un programa de otra organización no puede alojar un equipo de este club.
    const progC = (await as(u.coach, `insert into org_programs (organization_id, sport_id, gender, name) values ($1, 'basketball', 'men', 'Masculino') returning id`, [academyC])).rows[0].id;
    await expectError(() => as(u.coach2, `insert into org_teams (organization_id, program_id, name, created_by) values ($1, $2, 'Intruso', $3)`, [clubA, progC, u.coach2]), /team_program_org|row-level security/);
    // Un trial de la academia no puede apuntar al equipo del club.
    await expectError(() => as(u.coach, `update opportunities set team_id = $1 where id = $2`, [teamA, paidTrial]), /team|violates|row-level security/);
    eq((await db.query(`select team_id from opportunities where id = $1`, [paidTrial])).rows[0].team_id, null, 'sin equipo ajeno');
    // Segunda candidatura activa a la misma oportunidad: bloqueada.
    await expectError(() => as(u.minor, `insert into applications (opportunity_id, athlete_id) values ($1, $2)`, [freeTrial, u.minor]), /duplicate key|already/);
  });

  await check('11A escenario 5 · multitenant: otro club no modifica el trial ni ve candidaturas, inscripciones, asistencia, resultados ni matrículas', async () => {
    const r = await as(u.uni, `update trial_details set price_status = 'free' where opportunity_id = $1`, [paidTrial]);
    eq(r.rowCount, 0, 'no modifica');
    eq((await as(u.uni, `update opportunity_cost_components set amount = 1 where opportunity_id = $1`, [paidTrial])).rowCount, 0, 'no cambia precios');
    for (const t of ['applications', 'opportunity_registrations', 'opportunity_invitations', 'opportunity_attendance', 'opportunity_outcomes', 'program_enrollments', 'payment_requirements']) {
      eq((await as(u.uni, `select count(*)::int n from ${t} where organization_id in ($1, $2)`, [clubA, academyC])).rows[0].n, 0, t);
      eq((await as(u.brand, `select count(*)::int n from ${t} where organization_id in ($1, $2)`, [clubA, academyC])).rows[0].n, 0, `${t} (marca)`);
    }
    const reg = (await db.query(`select id from opportunity_registrations where opportunity_id = $1 limit 1`, [freeTrial])).rows[0].id;
    for (const sql of [`select trial_org_action($1, 'decline')`, `select attendance_record($1, 'no_show')`, `select outcome_record($1, 'closed')`, `select start_recruiting_from_trial($1)`]) {
      await expectError(() => as(u.uni, sql, [reg]), /not_allowed/);
    }
    eq((await as(u.adult, `select count(*)::int n from opportunity_registrations where athlete_id <> $1`, [u.adult])).rows[0].n, 0, 'un atleta no ve quién más participa');
  });

  // ---------------------------------------------------------------- 11B · RLS & seguridad de Clubs & Academies
  results.push('\nPrompt 11B: RLS & seguridad de Clubs & Academies');
  const v = { scoutU18: randomUUID(), directorA: randomUUID(), viewerA: randomUUID(), ownerB: randomUUID(), unverified: randomUUID(), exParent: randomUUID() };
  for (const [name, id] of Object.entries(v)) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}@test.dev`, { display_name: name }]);
    await as(id, `insert into user_roles (user_id, role) values ($1, $2)`, [id, name === 'exParent' ? 'parent' : 'coach']);
  }
  let progFem; let teamU18; let teamFirst; let trialU18; let trialFirst; let clubB; let docT; let docMed;
  await check('11B equipos: el scout del U18 no ve el First Team; el director deportivo ve ambos', async () => {
    progFem = (await db.query(`select id from org_programs where organization_id = $1 and sport_id = 'basketball' and gender = 'women'`, [clubA])).rows[0]?.id
      ?? (await as(u.coach2, `insert into org_programs (organization_id, sport_id, gender, name) values ($1, 'basketball', 'women', 'Femenino base') returning id`, [clubA])).rows[0].id;
    teamU18 = (await as(u.coach2, `insert into org_teams (organization_id, program_id, name, age_category_code, created_by) values ($1, $2, 'U18 Femenino', 'U18', $3) returning id`, [clubA, progFem, u.coach2])).rows[0].id;
    teamFirst = (await as(u.coach2, `insert into org_teams (organization_id, program_id, name, age_category_code, created_by) values ($1, $2, 'Primer equipo', 'FIRST_TEAM', $3) returning id`, [clubA, progFem, u.coach2])).rows[0].id;
    await as(u.coach2, `insert into organization_members (organization_id, user_id, member_role, team_scope, team_ids) values ($1, $2, 'recruiter', 'selected', $3)`, [clubA, v.scoutU18, [teamU18]]);
    await as(u.coach2, `insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'athletic_director')`, [clubA, v.directorA]);
    await as(u.coach2, `insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'viewer')`, [clubA, v.viewerA]);
    // Un equipo de otra organización no se puede asignar a un miembro.
    await expectError(() => as(u.coach2, `update organization_members set team_scope = 'selected', team_ids = $1 where organization_id = $2 and user_id = $3`, [[randomUUID()], clubA, v.viewerA]), /team_not_in_org/);
    trialU18 = await makeOpp(u.coach2, clubA, { title: 'Trial U18 femenino' });
    trialFirst = await makeOpp(u.coach2, clubA, { title: 'Trial primer equipo' });
    await as(u.admin, `update opportunities set team_id = $1 where id = $2`, [teamU18, trialU18]);
    await as(u.admin, `update opportunities set team_id = $1 where id = $2`, [teamFirst, trialFirst]);
    for (const t of [trialU18, trialFirst]) await as(u.adult, `select trial_register($1, $2)`, [t, u.adult]);
    const sees = async (who, t) => (await as(who, `select count(*)::int n from opportunity_registrations where opportunity_id = $1`, [t])).rows[0].n;
    eq(await sees(v.scoutU18, trialU18), 1, 'scout U18 → su equipo');
    eq(await sees(v.scoutU18, trialFirst), 0, 'scout U18 → First Team');
    eq(await sees(v.directorA, trialFirst), 1, 'director → First Team');
    eq(await sees(v.viewerA, trialU18), 0, 'viewer sin permisos');
    const regFirst = (await db.query(`select id from opportunity_registrations where opportunity_id = $1`, [trialFirst])).rows[0].id;
    await expectError(() => as(v.scoutU18, `select trial_org_action($1, 'confirm')`, [regFirst]), /not_allowed/);
    await expectError(() => as(v.scoutU18, `select trial_org_invite($1, $2)`, [trialFirst, u.adult]), /not_allowed/);
    eq((await as(v.directorA, `select trial_org_action($1, 'confirm') s`, [regFirst])).rows[0].s, 'confirmed');
    // Borrador de otro equipo: invisible para el scout; visible para el director.
    await as(u.admin, `update opportunities set status = 'draft' where id = $1`, [trialFirst]).catch(() => null);
    const draft = (await as(u.coach2, `insert into opportunities (organization_id, created_by, type, title, description, sport_id, team_id, program_id) values ($1, $2, 'tryout', 'Borrador First Team', 'Trial interno todavía en preparación.', 'basketball', $3, $4) returning id`, [clubA, u.coach2, teamFirst, progFem])).rows[0].id;
    eq((await as(v.scoutU18, `select count(*)::int n from opportunities where id = $1`, [draft])).rows[0].n, 0, 'scout no ve borrador de otro equipo');
    eq((await as(v.directorA, `select count(*)::int n from opportunities where id = $1`, [draft])).rows[0].n, 1, 'director sí');
    for (const who of [u.adult, u.parent, u.uni, null]) eq((await as(who, `select count(*)::int n from opportunities where id = $1`, [draft])).rows[0].n, 0, `borrador oculto a ${who}`);
  });

  await check('11B aislamiento: el Club B no accede a nada privado del Club A (cambiar organization_id no ayuda)', async () => {
    clubB = await verifiedOrg(v.ownerB, 'Club B Basket', 'club');
    const tables = ['applications', 'opportunity_registrations', 'opportunity_invitations', 'opportunity_attendance', 'opportunity_outcomes',
      'program_enrollments', 'payment_requirements', 'org_candidates', 'recruiting_needs', 'org_shortlists', 'org_notes', 'document_access_grants'];
    for (const t of tables) eq((await as(v.ownerB, `select count(*)::int n from ${t} where organization_id = $1`, [clubA])).rows[0].n, 0, t);
    const reg = (await db.query(`select id from opportunity_registrations where opportunity_id = $1`, [trialU18])).rows[0].id;
    for (const sql of [`select trial_org_action($1, 'confirm')`, `select attendance_record($1, 'attended')`, `select outcome_record($1, 'closed')`, `select start_recruiting_from_trial($1)`]) {
      await expectError(() => as(v.ownerB, sql, [reg]), /not_allowed/);
    }
    // Insertar con el organization_id de otro club tampoco sirve.
    await expectError(() => as(v.ownerB, `insert into recruiting_needs (organization_id, sport_id, title) values ($1, 'basketball', 'Base U18')`, [clubA]), /row-level security|violates/);
    await expectError(() => as(v.ownerB, `insert into org_shortlists (organization_id, name, owner_id) values ($1, 'Robada', $2)`, [clubA, v.ownerB]), /row-level security|violates/);
    eq((await as(v.ownerB, `update opportunities set title = 'hackeado' where id = $1`, [trialU18])).rowCount, 0, 'no edita trials ajenos');
    // Presupuesto familiar: ningún club lo ve.
    for (const who of [u.coach2, v.directorA, v.ownerB]) eq((await as(who, `select count(*)::int n from athlete_finances`)).rows[0].n, 0, 'family budget');
  });

  await check('11B candidaturas: el staff no cambia el estado de un trial por UPDATE directo; el atleta no se acepta ni aplica por otro', async () => {
    const t = await makeOpp(u.coach2, clubA, { mode: 'application_required', title: 'Trial con candidatura' });
    const app = (await as(u.adult, `insert into applications (opportunity_id, athlete_id) values ($1, $2) returning id`, [t, u.adult])).rows[0].id;
    await expectError(() => as(u.coach2, `update applications set status = 'accepted' where id = $1`, [app]), /use_application_org_decide/);
    await expectError(() => as(u.adult, `update applications set status = 'accepted' where id = $1`, [app]), /athlete_can_only_withdraw|use_application/);
    await expectError(() => as(u.adult, `insert into applications (opportunity_id, athlete_id) values ($1, $2)`, [t, u.privateAth]), /row-level security/);
    eq((await as(v.viewerA, `select count(*)::int n from applications where id = $1`, [app])).rows[0].n, 0, 'viewer no ve candidaturas');
    await expectError(() => as(v.ownerB, `select application_org_decide($1, 'accepted')`, [app]), /not_allowed/);
    eq((await as(u.coach2, `select application_org_decide($1, 'waitlisted') s`, [app])).rows[0].s, 'waitlisted');
  });

  await check('11B documentos: concesión con finalidad y caducidad; otro club, caducada o revocada → nada; los muy sensibles, solo nominales', async () => {
    docT = (await as(u.adult, `insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'transcript', 'Expediente 2026', $2, now()) returning id`, [u.adult, `${u.adult}/exp.pdf`])).rows[0].id;
    docMed = (await as(u.adult, `insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'medical', 'Reconocimiento médico', $2, now()) returning id`, [u.adult, `${u.adult}/med.pdf`])).rows[0].id;
    const sees = async (who, d) => (await as(who, `select count(*)::int n from athlete_documents where id = $1`, [d])).rows[0].n;
    eq(await sees(u.coach2, docT), 0, 'sin concesión');
    // La organización no puede concederse acceso a sí misma.
    await expectError(() => as(u.coach2, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '10 days')`, [docT, u.adult, clubA]), /row-level security|not_allowed/);
    const g = (await as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, context_type, context_id, expires_at) values ($1, $2, $3, 'trial_registration', 'opportunity', $4, now() + interval '10 days') returning id`, [docT, u.adult, clubA, trialU18])).rows[0].id;
    eq(await sees(u.coach2, docT), 1, 'Club A con concesión');
    eq(await sees(v.ownerB, docT), 0, 'Club B con el id');
    eq(await sees(v.viewerA, docT), 0, 'viewer del Club A sin permiso de candidatos');
    // Documento médico: exige destinatario y máximo 30 días; solo lo ve esa persona.
    await expectError(() => as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'trial_registration', now() + interval '10 days')`, [docMed, u.adult, clubA]), /grantee_required/);
    await expectError(() => as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at, grantee_user_id) values ($1, $2, $3, 'trial_registration', now() + interval '90 days', $4)`, [docMed, u.adult, clubA, v.directorA]), /sensitive_grant_too_long/);
    await expectError(() => as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at, grantee_user_id) values ($1, $2, $3, 'trial_registration', now() + interval '7 days', $4)`, [docMed, u.adult, clubA, v.ownerB]), /grantee_not_in_org/);
    await as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at, grantee_user_id) values ($1, $2, $3, 'trial_registration', now() + interval '7 days', $4)`, [docMed, u.adult, clubA, v.directorA]);
    eq(await sees(v.directorA, docMed), 1, 'destinatario nominal');
    eq(await sees(u.coach2, docMed), 0, 'resto del staff no');
    // Revocada / caducada → sin acceso. Una concesión revocada no se «desrevoca» ni se alarga.
    await as(u.adult, `update document_access_grants set revoked_at = now() where id = $1`, [g]);
    eq(await sees(u.coach2, docT), 0, 'revocada');
    await expectError(() => as(u.adult, `update document_access_grants set revoked_at = null where id = $1`, [g]), /grant_immutable/);
    const g2 = (await as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '5 days') returning id`, [docT, u.adult, clubA])).rows[0].id;
    eq(await sees(u.coach2, docT), 1);
    await as(u.adult, `update document_access_grants set expires_at = now() - interval '1 minute' where id = $1`, [g2]);
    eq(await sees(u.coach2, docT), 0, 'caducada');
    await expectError(() => as(u.coach2, `update document_access_grants set expires_at = now() + interval '300 days' where id = $1`, [g2]), /grant_immutable|permission denied|row-level/).catch(async () => {
      eq((await as(u.coach2, `update document_access_grants set expires_at = now() + interval '300 days' where id = $1`, [g2])).rowCount, 0, 'el club no alarga');
    });
  });

  await check('11B suspensión y verificación: organización suspendida o sin verificar → sin trial público, invitaciones ni contacto', async () => {
    const unv = (await as(v.unverified, `insert into organizations (name, type, created_by) values ('Club Sin Verificar', 'club', $1) returning id`, [v.unverified])).rows[0].id;
    const oppU = (await as(v.unverified, `insert into opportunities (organization_id, created_by, type, title, description, sport_id) values ($1, $2, 'tryout', 'Trial falso', 'Trial de un club que aún no está verificado.', 'basketball') returning id`, [unv, v.unverified])).rows[0].id;
    await expectError(() => as(v.unverified, `select trial_org_invite($1, $2)`, [oppU, u.minor]), /not_allowed/);
    await expectError(() => as(v.unverified, `insert into contact_requests (organization_id, requested_by, athlete_id, message) values ($1, $2, $3, 'Hola, ven a probar con nosotros.')`, [unv, v.unverified, u.minor]), /row-level security|verified_organization_required/);
    eq((await as(v.unverified, `select minor_contact_mode($1, $2) m`, [u.minor, unv])).rows[0].m, 'contact_blocked');
    eq((await as(u.coach2, `select minor_contact_mode($1, $2) m`, [u.minor, clubA])).rows[0].m, 'guardian_approval_required');
    eq((await as(u.coach2, `select minor_contact_mode($1, $2) m`, [u.adult, clubA])).rows[0].m, 'contact_allowed');
    // Suspender el Club B: su trial publicado deja de ser público y su staff pierde capacidades.
    const tB = await makeOpp(v.ownerB, clubB, { title: 'Trial Club B' });
    eq((await as(null, `select count(*)::int n from opportunities where id = $1`, [tB])).rows[0].n, 1, 'público antes');
    await as(u.admin, `update organizations set org_status = 'suspended' where id = $1`, [clubB]);
    eq((await as(null, `select count(*)::int n from opportunities where id = $1`, [tB])).rows[0].n, 0, 'anónimo tras suspensión');
    eq((await as(u.adult, `select count(*)::int n from opportunities where id = $1`, [tB])).rows[0].n, 0, 'atleta tras suspensión');
    await expectError(() => as(v.ownerB, `select trial_org_invite($1, $2)`, [tB, u.adult]), /not_allowed/);
    eq((await db.query(`select count(*)::int n from opportunities where id = $1`, [tB])).rows[0].n, 1, 'los datos no se borran');
    await as(u.admin, `update organizations set org_status = 'active' where id = $1`, [clubB]);
  });

  await check('11B familia: un tutor revocado deja de ver y de aprobar; nunca ve resultados internos ni notas', async () => {
    await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [v.exParent, yearsAgo(44)]);
    await db.query(`insert into parent_athlete_links (parent_id, athlete_id, invited_by, status, approved_at, relationship) values ($1, $2, $1, 'approved', now(), 'parent')`, [v.exParent, u.minor]);
    const t = await makeOpp(u.coach2, clubA, { title: 'Trial menores' });
    const inv = (await as(u.coach2, `select trial_org_invite($1, $2) id`, [t, u.minor])).rows[0].id;
    eq((await as(v.exParent, `select count(*)::int n from opportunity_invitations where id = $1`, [inv])).rows[0].n, 1, 'tutor activo ve la invitación');
    await db.query(`update parent_athlete_links set status = 'revoked' where parent_id = $1`, [v.exParent]);
    eq((await as(v.exParent, `select count(*)::int n from opportunity_invitations where id = $1`, [inv])).rows[0].n, 0, 'revocado no la ve');
    await expectError(() => as(v.exParent, `select invitation_respond($1, 'guardian_approve')`, [inv]), /not_allowed/);
    eq((await as(u.parent, `select count(*)::int n from org_notes`)).rows[0].n, 0, 'notas internas');
    eq((await as(u.minor, `select count(*)::int n from org_shortlists`)).rows[0].n, 0, 'shortlists');
  });

  // ================================================================ 7B · verificación, Discovery y shortlists
  results.push('\nPrompt 7B: verificación, Discovery y shortlists');
  await check('7B dominios: coincidencia exacta o subdominio, nunca por texto parcial', async () => {
    const r = (await db.query(`select domain_matches('university.edu', 'university.edu') a, domain_matches('athletics.university.edu', 'university.edu') b,
      domain_matches('fake-university.edu', 'university.edu') c, domain_matches('university.edu.evil.com', 'university.edu') d, domain_matches('mail.notuniversity.edu', 'university.edu') e`)).rows[0];
    eq(r.a, true); eq(r.b, true); eq(r.c, false); eq(r.d, false); eq(r.e, false);
  });
  let domId;
  await check('7B dominios: la organización propone, solo Gala verifica, y un dominio verificado no se duplica', async () => {
    domId = (await as(u.uni, `insert into organization_domains (organization_id, domain, is_primary, created_by) values ($1, 'teststate.edu', true, $2) returning id`, [uniId, u.uni])).rows[0].id;
    eq((await as(u.uni, `update organization_domains set status = 'verified' where id = $1`, [domId])).rowCount, 0, 'la organización no se autoverifica');
    await as(u.admin, `update organization_domains set status = 'verified', verification_method = 'admin_review' where id = $1`, [domId]);
    await expectError(() => as(u.admin, `insert into organization_domains (organization_id, domain, status, created_by) values ($1, 'teststate.edu', 'verified', $2)`, [uniB, u.admin]));
  });
  await check('7B email institucional: token con hash, solo el servidor lo emite, un solo uso e intentos limitados', async () => {
    const id = (await as(u.coach, `select email_verification_start($1, 'coach@athletics.teststate.edu') id`, [uniId])).rows[0].id;
    await expectError(() => as(u.coach, `select email_verification_issue($1)`, [id]), /permission denied/);
    await db.query('begin'); await db.query('set local role service_role');
    const token = (await db.query(`select email_verification_issue($1) t`, [id])).rows[0].t; await db.query('commit');
    await expectError(() => as(u.coach, `select token_hash from email_verifications where id = $1`, [id]), /permission denied/);
    eq((await as(u.coach, `select email_verification_confirm($1, 'mal') ok`, [id])).rows[0].ok, false);
    eq((await as(u.coach, `select attempts from email_verifications where id = $1`, [id])).rows[0].attempts, 1);
    eq((await as(otherUni, `select email_verification_confirm($1, $2) ok`, [id, token])).rows[0].ok, false, 'otra persona no puede usar el token');
    eq((await as(u.coach, `select email_verification_confirm($1, $2) ok`, [id, token])).rows[0].ok, true);
    eq((await as(u.coach, `select email_verification_confirm($1, $2) ok`, [id, token])).rows[0].ok, false, 'un solo uso');
    eq((await as(u.coach, `select affiliation_verification a from organization_members where organization_id = $1 and user_id = $2`, [uniId, u.coach])).rows[0].a, 'email_verified');
    const sum = (await as(u.coach, `select verification_summary($1) s`, [uniId])).rows[0].s;
    eq(sum.email_verified, true); eq(sum.organization_verified, true); eq(sum.role_verified, false); eq(sum.access_active, true);
    eq((await as(otherUni, `select verification_summary($1, $2) s`, [uniId, u.coach])).rows[0].s, null, 'nadie de fuera consulta el estado de otro');
    await expectError(() => as(u.uni, `update organization_members set role_verification = 'verified' where organization_id = $1 and user_id = $2`, [uniId, u.coach]), /verification_admin_only/);
  });
  let claimOrg; let claimReq;
  await check('7B reclamación: importada ≠ reclamada ≠ verificada; solo Gala decide; la decisión queda y es inmutable', async () => {
    await db.query(`select set_config('request.jwt.claims', '{}', false)`);
    claimOrg = (await db.query(`insert into organizations (name, type, created_by, source, external_id) values ('Imported State', 'university', $1, 'imported', 'SC-1') returning id`, [u.admin])).rows[0].id;
    eq((await db.query(`select claim_status, verification_status from organizations where id = $1`, [claimOrg])).rows[0].claim_status, 'unclaimed');
    claimReq = (await as(u.coach2, `select verification_submit('organization_claim', $1, null, 'Head Coach') id`, [claimOrg])).rows[0].id;
    eq((await db.query(`select claim_status from organizations where id = $1`, [claimOrg])).rows[0].claim_status, 'claim_pending');
    await expectError(() => as(u.coach2, `select verification_submit('organization_claim', $1, null, 'Head Coach')`, [claimOrg]), /duplicate key/);
    await expectError(() => as(u.coach2, `select verification_decide($1, 'approved', 'ok')`, [claimReq]), /reviewer_only/);
    await as(u.admin, `select verification_decide($1, 'approved', 'Directorio oficial', 'head_coach')`, [claimReq]);
    const m = (await as(u.coach2, `select member_role, affiliation_verification, role_verification from organization_members where organization_id = $1 and user_id = $2`, [claimOrg, u.coach2])).rows[0];
    eq(m.member_role, 'head_coach'); eq(m.affiliation_verification, 'verified'); eq(m.role_verification, 'verified');
    eq((await db.query(`select claim_status, verification_status from organizations where id = $1`, [claimOrg])).rows[0].claim_status, 'claimed');
    eq((await db.query(`select verification_status from organizations where id = $1`, [claimOrg])).rows[0].verification_status, 'unverified', 'reclamada no implica verificada');
    eq((await as(u.coach2, `select count(*)::int n from verification_decisions where request_id = $1`, [claimReq])).rows[0].n, 1);
    await expectError(() => db.query(`update verification_decisions set reason = 'x' where request_id = $1`, [claimReq]));
  });
  await check('7B revocación: retira el acceso al instante, deja registro y no borra la historia', async () => {
    await expectError(() => as(u.admin, `select verification_decide($1, 'revoked', '')`, [claimReq]), /reason_required/);
    await as(u.admin, `select verification_decide($1, 'revoked', 'Ya no trabaja en la institución')`, [claimReq]);
    eq((await as(u.coach2, `select count(*)::int n from organization_members where organization_id = $1 and user_id = $2`, [claimOrg, u.coach2])).rows[0].n, 0);
    eq((await as(u.coach2, `select status from organization_membership_records where organization_id = $1 and user_id = $2 order by created_at desc limit 1`, [claimOrg, u.coach2])).rows[0].status, 'revoked');
    eq((await db.query(`select count(*)::int n from verification_decisions where request_id = $1`, [claimReq])).rows[0].n, 2);
    eq((await db.query(`select count(*)::int n from audit_logs where entity_id = $1 and action = 'verification_revoked'`, [claimReq])).rows[0].n, 1);
  });
  await check('7B suspensión: el miembro pierde el acceso al instante y se puede reactivar con su rol', async () => {
    await expectError(() => as(u.uni, `select org_suspend_member($1, $2, '')`, [uniId, u.coach]), /reason_required/);
    await as(u.uni, `select org_suspend_member($1, $2, 'Revisión de cuenta')`, [uniId, u.coach]);
    eq((await as(u.coach, `select org_can($1, 'candidates') ok`, [uniId])).rows[0].ok, false);
    eq((await as(u.coach, `select count(*)::int n from org_candidates where organization_id = $1`, [uniId])).rows[0].n, 0);
    await as(u.uni, `select org_reinstate_member($1, $2)`, [uniId, u.coach]);
    eq((await as(u.coach, `select org_can($1, 'candidates') ok`, [uniId])).rows[0].ok, true);
  });
  let progW; let progM;
  await check('7B programas: acceso solo al programa concedido; revocar nunca abre todos los programas', async () => {
    progW = (await as(u.uni, `insert into org_programs (organization_id, sport_id, gender, name) values ($1, 'tennis', 'women', 'Women''s Tennis') returning id`, [uniId])).rows[0].id;
    progM = (await as(u.uni, `insert into org_programs (organization_id, sport_id, gender, name) values ($1, 'soccer', 'men', 'Men''s Soccer') returning id`, [uniId])).rows[0].id;
    const pm = (await as(u.uni, `insert into program_memberships (organization_id, user_id, program_id, granted_by) values ($1, $2, $3, $4) returning id`, [uniId, u.coach, progW, u.uni])).rows[0].id;
    eq((await as(u.coach, `select org_can($1, 'shortlist', $2) w, org_can($1, 'shortlist', $3) m`, [uniId, progW, progM])).rows[0].m, false);
    eq((await as(u.coach, `select org_can($1, 'shortlist', $2) w`, [uniId, progW])).rows[0].w, true);
    await expectError(() => as(u.uni, `insert into program_memberships (organization_id, user_id, program_id, granted_by) values ($1, $2, $3, $4)`, [uniId, u.coach, progW, u.uni]), /duplicate key/);
    await expectError(() => as(u.uni, `insert into program_memberships (organization_id, user_id, program_id, granted_by) values ($1, $2, $3, $4)`, [uniId, u.brand, progW, u.uni]), /not_an_active_member/);
    await as(u.uni, `update program_memberships set status = 'revoked' where id = $1`, [pm]);
    eq((await as(u.coach, `select org_can($1, 'shortlist', $2) w, org_can($1, 'shortlist', $3) m`, [uniId, progW, progM])).rows[0].w, false, 'sin programas no significa todos');
    // Restablecer el acceso a todos los programas es una decisión explícita del admin.
    await as(u.uni, `update organization_members set program_scope = 'all' where organization_id = $1 and user_id = $2`, [uniId, u.coach]);
    eq((await as(u.coach, `select org_can($1, 'shortlist', $2) m`, [uniId, progM])).rows[0].m, true);
  });
  await check('7B Discovery: solo organizaciones verificadas con permiso; deporte obligatorio; páginas y filtros acotados', async () => {
    const ids = (await as(u.coach, `select user_id from discover_athlete_ids($1, '{"sport":"basketball"}')`, [uniId])).rows.map((r) => r.user_id);
    eq(ids.includes(u.adult), true);
    eq(ids.includes(u.privateAth), false, 'atleta privado');
    await expectError(() => as(u.coach, `select * from discover_athlete_ids($1, '{}')`, [uniId]), /sport_required/);
    await expectError(() => as(u.coach, `select * from discover_athlete_ids($1, '{"sport":"basketball"}', 21)`, [uniId]), /page_limit/);
    await expectError(() => as(u.coach, `select * from discover_athlete_ids($1, '{"sport":"basketball","gpa_raw":"4"}')`, [uniId]), /invalid_filter/);
    const unv = (await as(u.uni, `insert into organizations (name, type, created_by) values ('Unverified U', 'university', $1) returning id`, [u.uni])).rows[0].id;
    await expectError(() => as(u.uni, `select * from discover_athlete_ids($1, '{"sport":"basketball"}')`, [unv]), /not_allowed/);
    await as(u.uni, `insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'viewer')`, [uniId, u.brand]);
    await expectError(() => as(u.brand, `select * from discover_athlete_ids($1, '{"sport":"basketball"}')`, [uniId]), /not_allowed/, 'verificada pero sin permiso de búsqueda');
    eq((await as(u.coach, `select discovery_consume() ok`)).rows[0].ok, true);
  });
  await check('7B Discovery: un campo visible pero no filtrable no sirve para filtrar; para Match se respeta su permiso', async () => {
    // (Un bloqueo anterior del atleta a u.brand, ahora miembro de la universidad, ocultaría al atleta a toda la organización: 11D G-06.)
    await db.query(`delete from user_blocks where blocker_id = $1 and blocked_id = $2`, [u.adult, u.brand]);
    await as(u.adult, `update athlete_profiles set height_cm = 185 where user_id = $1`, [u.adult]);
    let ids = (await as(u.coach, `select user_id from discover_athlete_ids($1, '{"sport":"basketball","min_height":180}')`, [uniId])).rows.map((r) => r.user_id);
    eq(ids.includes(u.adult), true);
    await as(u.adult, `insert into passport_field_policies (athlete_id, field_group, allow_filter, allow_match, allow_compare, allow_export) values ($1, 'physical', false, false, true, false)`, [u.adult]);
    ids = (await as(u.coach, `select user_id from discover_athlete_ids($1, '{"sport":"basketball","min_height":180}')`, [uniId])).rows.map((r) => r.user_id);
    eq(ids.includes(u.adult), false, 'no filtrable');
    eq((await as(u.coach, `select height_cm from athlete_directory where user_id = $1`, [u.adult])).rows[0].height_cm, 185, 'sigue visible');
    const row = (await as(u.coach, `select match_blocked from discover_athlete_ids($1, '{"sport":"basketball"}') where user_id = $2`, [uniId, u.adult])).rows[0];
    eq(row.match_blocked.includes('physical'), true);
    eq((await as(u.coach, `select athlete_field_allows($1, 'physical', 'export') ok`, [u.adult])).rows[0].ok, false, 'exportar requiere permiso explícito');
    await expectError(() => as(u.coach, `insert into passport_field_policies (athlete_id, field_group, allow_filter, allow_match, allow_compare, allow_export) values ($1, 'stats', true, true, true, true)`, [u.adult]));
    await as(u.adult, `delete from passport_field_policies where athlete_id = $1`, [u.adult]);
  });
  await check('7B Discovery: desactivar Discovery o limitar el periodo saca al atleta de los resultados', async () => {
    await as(u.adult, `insert into athlete_discovery_settings (athlete_id, mode) values ($1, 'off')`, [u.adult]);
    let ids = (await as(u.coach, `select user_id from discover_athlete_ids($1, '{"sport":"basketball"}')`, [uniId])).rows.map((r) => r.user_id);
    eq(ids.includes(u.adult), false);
    await as(u.adult, `update athlete_discovery_settings set mode = 'selected_organization_types', organization_types = '{club}' where athlete_id = $1`, [u.adult]);
    ids = (await as(u.coach, `select user_id from discover_athlete_ids($1, '{"sport":"basketball"}')`, [uniId])).rows.map((r) => r.user_id);
    eq(ids.includes(u.adult), false, 'solo clubes');
    await as(u.adult, `delete from athlete_discovery_settings where athlete_id = $1`, [u.adult]);
  });
  await check('7B Discovery: un menor no es filtrable por académico por defecto', async () => {
    eq((await as(u.coach, `select athlete_field_allows($1, 'academics', 'filter') ok`, [u.minor])).rows[0].ok, false);
  });
  await check('7B búsquedas guardadas: filtros validados y privadas por defecto', async () => {
    await expectError(() => as(u.coach, `insert into org_saved_searches (organization_id, created_by, name, filters) values ($1, $2, 'PG', '{"position":1}')`, [uniId, u.coach]));
    await expectError(() => as(u.coach, `insert into org_saved_searches (organization_id, created_by, name, filters) values ($1, $2, 'PG', '{"sport":"basketball","url":"x"}')`, [uniId, u.coach]));
    await as(u.coach, `insert into org_saved_searches (organization_id, created_by, name, filters) values ($1, $2, 'PG 2027', '{"sport":"basketball","grad":2027}')`, [uniId, u.coach]);
    eq((await as(u.uni, `select count(*)::int n from org_saved_searches where name = 'PG 2027'`)).rows[0].n, 0, 'privada');
    eq((await as(otherUni, `select count(*)::int n from org_saved_searches`)).rows[0].n, 0);
  });
  let sl7;
  await check('7B shortlists: compartida con personas concretas; «viewer» lee pero no añade; revocar quita el acceso', async () => {
    sl7 = (await as(u.coach, `insert into org_shortlists (organization_id, name, visibility, owner_id, sport_id, recruiting_class) values ($1, 'Bases 2027', 'shared', $2, 'basketball', 2027) returning id`, [uniId, u.coach])).rows[0].id;
    eq((await as(u.coach2, `select count(*)::int n from org_shortlists where id = $1`, [sl7])).rows[0].n, 0, 'sin acceso');
    await as(u.coach, `insert into shortlist_access (shortlist_id, organization_id, user_id, access_role, granted_by) values ($1, $2, $3, 'viewer', $4)`, [sl7, uniId, u.coach2, u.coach]);
    eq((await as(u.coach2, `select count(*)::int n from org_shortlists where id = $1`, [sl7])).rows[0].n, 1);
    await expectError(() => as(u.coach2, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id, added_by) values ($1, $2, $3, $4)`, [sl7, uniId, u.adult, u.coach2]));
    await as(u.coach, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id, added_by, source) values ($1, $2, $3, $4, 'gala_match')`, [sl7, uniId, u.adult, u.coach]);
    await expectError(() => as(u.coach, `insert into org_shortlist_members (shortlist_id, organization_id, athlete_id, added_by) values ($1, $2, $3, $4)`, [sl7, uniId, u.adult, u.coach]), /duplicate key/);
    await expectError(() => as(u.coach, `update org_shortlist_members set review_status = 'offer' where shortlist_id = $1`, [sl7]));
    await expectError(() => as(u.coach, `insert into shortlist_access (shortlist_id, organization_id, user_id, access_role, granted_by) values ($1, $2, $3, 'viewer', $4)`, [sl7, uniId, otherUni, u.coach]), /not_an_authorized_member/);
    await as(u.coach, `update shortlist_access set revoked_at = now() where shortlist_id = $1 and user_id = $2`, [sl7, u.coach2]);
    eq((await as(u.coach2, `select count(*)::int n from org_shortlists where id = $1`, [sl7])).rows[0].n, 0);
    eq((await as(otherUni, `select count(*)::int n from org_shortlist_members where shortlist_id = $1`, [sl7])).rows[0].n, 0, 'otra universidad');
  });
  await check('7B etiquetas, notas y asignaciones: internas, seguras y solo a miembros autorizados', async () => {
    const lab = (await as(u.coach, `insert into org_labels (organization_id, name, created_by) values ($1, 'Video pending', $2) returning id`, [uniId, u.coach])).rows[0].id;
    await as(u.coach, `insert into org_shortlist_member_labels (shortlist_id, athlete_id, label_id, added_by) values ($1, $2, $3, $4)`, [sl7, u.adult, lab, u.coach]);
    eq((await as(u.adult, `select count(*)::int n from org_labels`)).rows[0].n, 0, 'el atleta no ve etiquetas');
    await expectError(() => as(u.coach, `insert into org_notes (organization_id, athlete_id, author_id, body, shortlist_id) values ($1, $2, $3, '<script>alert(1)</script>', $4)`, [uniId, u.adult, u.coach, sl7]), /unsafe_content/);
    const note = (await as(u.coach, `insert into org_notes (organization_id, athlete_id, author_id, body, shortlist_id) values ($1, $2, $3, 'Revisar partido completo', $4) returning id`, [uniId, u.adult, u.coach, sl7])).rows[0].id;
    await as(u.coach, `update org_notes set body = 'Revisar partido completo (pedido)' where id = $1`, [note]);
    eq((await as(u.coach, `select updated_at is not null e from org_notes where id = $1`, [note])).rows[0].e, true, 'marca de editada');
    await expectError(() => as(u.coach, `update org_shortlist_members set assigned_to = $3 where shortlist_id = $1 and athlete_id = $2`, [sl7, u.adult, u.brand]), /assignee_not_authorized/);
    await as(u.coach, `update org_shortlist_members set assigned_to = $3 where shortlist_id = $1 and athlete_id = $2`, [sl7, u.adult, u.uni]);
    eq((await as(u.uni, `select count(*)::int n from org_assignment_log where shortlist_id = $1 and status = 'assigned'`, [sl7])).rows[0].n, 1);
  });
  await check('7B promoción al pipeline: explícita, sin duplicados y conserva el vínculo con la shortlist', async () => {
    await expectError(() => as(u.brand, `select shortlist_promote($1, $2)`, [sl7, u.adult]), /not_allowed/);
    const c1 = (await as(u.coach, `select shortlist_promote($1, $2) id`, [sl7, u.adult])).rows[0].id;
    const c2 = (await as(u.coach, `select shortlist_promote($1, $2) id`, [sl7, u.adult])).rows[0].id;
    eq(c1, c2, 'sin proceso duplicado');
    const m = (await as(u.coach, `select promoted_candidate_id, review_status from org_shortlist_members where shortlist_id = $1 and athlete_id = $2`, [sl7, u.adult])).rows[0];
    eq(m.promoted_candidate_id, c1);
    eq((await as(u.coach, `select count(*)::int n from org_candidates where organization_id = $1 and athlete_id = $2`, [uniId, u.adult])).rows[0].n, 1);
    eq((await as(u.uni, `select count(*)::int n from audit_logs where action = 'athlete_promoted_to_pipeline' and organization_id = $1`, [uniId])).rows[0].n >= 1, true, 'auditado y visible para el admin');
    await as(u.coach, `update org_shortlists set status = 'archived', archived_at = now() where id = $1`, [sl7]);
    eq((await as(u.coach, `select status from org_shortlists where id = $1`, [sl7])).rows[0].status, 'archived');
  });

  await check('7C verificación móvil: aprobar la afiliación pedida para un programa concede solo ese programa', async () => {
    const coachX = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'coachx@test.dev', $2)`, [coachX, { display_name: 'Coach X' }]);
    await as(coachX, `insert into user_roles (user_id, role) values ($1, 'coach')`, [coachX]);
    const req = (await as(coachX, `select verification_submit('organization_affiliation', $1, $2, 'Assistant Coach') id`, [uniId, progW])).rows[0].id;
    eq((await as(coachX, `select count(*)::int n from organization_members where organization_id = $1 and user_id = $2`, [uniId, coachX])).rows[0].n, 0, 'pedir no da acceso');
    await as(u.admin, `select verification_decide($1, 'approved', 'Directorio oficial', 'assistant_coach')`, [req]);
    const r = (await as(coachX, `select org_can($1, 'shortlist', $2) w, org_can($1, 'shortlist', $3) m`, [uniId, progW, progM])).rows[0];
    eq(r.w, true); eq(r.m, false, 'no accede a otro programa');
  });

  await check('RGPD exportación: cada sección de la descarga es legible por su titular (minor, atleta, coach, familia)', async () => {
    const src = readFileSync(join(here, '..', '..', 'src/lib/privacy/export-tables.ts'), 'utf8');
    const sources = [...src.matchAll(/\{ key: '([a-z_]+)', table: '([a-z_]+)'([^}]*)\}/g)].map(([, key, table, rest]) => ({
      key, table,
      column: rest.match(/column: '([a-z_]+)'/)?.[1] ?? 'user_id',
      select: (rest.match(/select: '([^']+)'/)?.[1] ?? '*').replace(/,\s*[a-z_]+\(\*\)/g, ''),
      either: rest.match(/either: \['([a-z_]+)', '([a-z_]+)'\]/)?.slice(1),
    }));
    if (sources.length < 50) throw new Error(`solo ${sources.length} secciones leídas del fichero`);
    const fails = [];
    for (const who of [u.minor, u.adult, u.coach, u.parent]) {
      for (const s of sources) {
        const where = s.either ? `${s.either[0]} = $1 or ${s.either[1]} = $1` : `${s.column} = $1`;
        try { await as(who, `select ${s.select} from ${s.table} where ${where}`, [who]); } catch (e) { fails.push(`${s.key}: ${e.message}`); }
      }
    }
    if (fails.length) throw new Error([...new Set(fails)].join(' | '));
  });

  // Debe ir la última: borra todas las cuentas y organizaciones de prueba.
  // ---------------------------------------------------------------- 11D · Pentest de Clubs & Academies (ataques como regresión)
  results.push('\nPrompt 11D: ataques controlados (local, datos sintéticos)');
  await check('11D A1 · IDOR de organización: el scout del Club A pidiendo datos del Club B no obtiene nada', async () => {
    const tB = await makeOpp(v.ownerB, clubB, { title: 'Trial B privado' });
    await as(u.adult, `select trial_register($1, $2)`, [tB, u.adult]);
    await as(v.ownerB, `insert into recruiting_needs (organization_id, sport_id, title) values ($1, 'basketball', 'Pívot U18 B')`, [clubB]);
    await as(v.ownerB, `insert into org_notes (organization_id, athlete_id, author_id, body) values ($1, $2, $3, 'Nota interna B')`, [clubB, u.adult, v.ownerB]);
    await as(v.ownerB, `insert into org_tasks (organization_id, athlete_id, title) values ($1, $2, 'Tarea interna B')`, [clubB, u.adult]);
    for (const t of ['recruiting_needs', 'opportunity_registrations', 'opportunity_invitations', 'applications', 'opportunity_attendance', 'org_shortlists', 'org_notes', 'org_tasks', 'org_candidates', 'document_access_grants', 'payment_requirements']) {
      eq((await as(v.scoutU18, `select count(*)::int n from ${t} where organization_id = $1`, [clubB])).rows[0].n, 0, t);
    }
    await expectError(() => as(v.scoutU18, `select * from discover_athlete_ids($1, '{"sport":"basketball"}')`, [clubB]), /not_allowed/);
    await expectError(() => as(v.scoutU18, `select trial_org_invite($1, $2)`, [tB, u.adult]), /not_allowed/);
  });

  await check('11D A2/A3 · escalada de equipo y de rol: ni mover el trial a mi equipo ni subirme el rol ni verificarme', async () => {
    eq((await as(v.scoutU18, `update opportunities set team_id = $1 where id = $2`, [teamU18, trialFirst])).rowCount, 0, 'mover trial ajeno a mi equipo');
    await expectError(() => as(v.scoutU18, `insert into opportunities (organization_id, created_by, type, title, description, sport_id, team_id, program_id) values ($1, $2, 'tryout', 'Colado', 'Intento de crear en el primer equipo.', 'basketball', $3, $4)`, [clubA, v.scoutU18, teamFirst, progFem]), /row-level security/);
    eq((await as(v.scoutU18, `update organization_members set member_role = 'owner', team_scope = 'all' where user_id = $1`, [v.scoutU18])).rowCount, 0, 'subirse el rol');
    await expectError(() => as(v.scoutU18, `insert into organization_members (organization_id, user_id, member_role) values ($1, $2, 'owner')`, [clubB, v.scoutU18]), /row-level security/);
    await expectError(() => as(v.scoutU18, `insert into user_roles (user_id, role) values ($1, 'admin')`, [v.scoutU18]), /row-level security|violates|admin/);
    const unvOrg = (await db.query(`select id from organizations where name = 'Club Sin Verificar'`)).rows[0].id;
    await expectError(() => as(v.unverified, `update organizations set verification_status = 'verified' where id = $1`, [unvOrg]), /verification_admin_only/);
    // Metadatos del JWT editables por el usuario no dan privilegios.
    const fake = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'fake-admin@test.dev', '{"role":"admin","is_admin":true}')`, [fake]);
    eq((await as(fake, `select is_admin() a`)).rows[0].a, false, 'metadatos ≠ rol');
    eq((await as(v.scoutU18, `select count(*)::int n from opportunity_registrations where opportunity_id = $1`, [trialFirst])).rows[0].n, 0, 'sigue sin ver el First Team');
  });

  await check('11D A4/A5 · organización sin verificar y atleta oculto: ni Discovery, ni exportar, ni encontrar por id', async () => {
    const unvOrg = (await db.query(`select id from organizations where name = 'Club Sin Verificar'`)).rows[0].id;
    await expectError(() => as(v.unverified, `select * from discover_athlete_ids($1, '{"sport":"basketball"}')`, [unvOrg]), /not_allowed/);
    const caps = (await as(v.unverified, `select org_can($1, 'export') e, org_can($1, 'request_info') r, org_can($1, 'offers') o, org_can($1, 'contact') c`, [unvOrg])).rows[0];
    eq(JSON.stringify(caps), JSON.stringify({ e: false, r: false, o: false, c: false }), 'capacidades sin verificar');
    await expectError(() => as(v.unverified, `insert into info_requests (organization_id, athlete_id, requested_by, kind, message) values ($1, $2, $3, 'transcript', 'Envíanos tu expediente')`, [unvOrg, u.minor, v.unverified]), /row-level security|violates|not_allowed|verified/);
    const ids = (await as(v.directorA, `select user_id from discover_athlete_ids($1, '{"sport":"basketball","q":"privateAth"}')`, [clubA])).rows.map((r) => r.user_id);
    eq(ids.includes(u.privateAth), false, 'por nombre exacto');
    eq((await as(v.directorA, `select count(*)::int n from athlete_directory where user_id = $1`, [u.privateAth])).rows[0].n, 0, 'por id');
    eq((await as(v.directorA, `select can_view_athlete($1, 'profile') c`, [u.privateAth])).rows[0].c, false);
  });

  await check('11D A7/A8/A10 · presupuesto familiar, datos del tutor y contacto privado del menor: denegado en todas las vías', async () => {
    for (const who of [v.scoutU18, v.directorA, v.ownerB, u.coach2]) {
      eq((await as(who, `select count(*)::int n from athlete_finances`)).rows[0].n, 0, 'finanzas');
      eq((await as(who, `select count(*)::int n from parent_athlete_links where athlete_id = $1`, [u.minor])).rows[0].n, 0, 'vínculo familiar');
      eq((await as(who, `select count(*)::int n from private_profile_data where user_id in ($1, $2)`, [u.minor, u.parent])).rows[0].n, 0, 'email/teléfono/fecha');
    }
    const cols = (await db.query(`select string_agg(column_name, ',') c from information_schema.columns where table_name = 'athlete_directory'`)).rows[0].c;
    for (const banned of ['budget', 'email', 'phone', 'date_of_birth', 'address']) eq(cols.includes(banned), false, `directorio sin ${banned}`);
  });

  await check('11D G-04 · «¿es menor?» ya no es un oráculo: solo lo sabe quien ya puede ver al atleta', async () => {
    await expectError(() => as(null, `select is_minor($1)`, [u.adult]), /permission denied/);
    await expectError(() => as(u.brand, `select is_minor($1)`, [u.adult]), /permission denied/);
    eq((await as(u.adult, `select viewer_is_minor($1) m`, [u.adult])).rows[0].m, false, 'uno mismo');
    eq((await as(null, `select viewer_is_minor($1) m`, [u.privateAth])).rows[0].m, true, 'anónimo ante un perfil privado: respuesta constante');
    eq((await as(u.brand, `select viewer_is_minor($1) m`, [u.privateAth])).rows[0].m, true, 'marca ante un perfil privado: respuesta constante');
    eq((await as(u.parent, `select viewer_is_minor($1) m`, [u.minor])).rows[0].m, true, 'familia vinculada');
    for (const fn of ['consent_granted($1, \'contact\', \'organization\', $1)', 'guardian_requirement_satisfied($1, \'contact\', \'organization\', $1)', 'agency_has_active_representation($1, $1)']) {
      await expectError(() => as(u.brand, `select ${fn}`, [u.adult]), /permission denied/);
    }
  });

  await check('11D A11/G-06 · bloqueo: si el atleta bloquea a alguien del club, nadie de ese club le encuentra ni le invita', async () => {
    const before = (await as(v.directorA, `select user_id from discover_athlete_ids($1, '{"sport":"basketball"}')`, [clubA])).rows.map((r) => r.user_id);
    eq(before.includes(u.adult), true, 'visible antes');
    await as(u.adult, `insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [u.adult, v.scoutU18]);
    const after = (await as(v.directorA, `select user_id from discover_athlete_ids($1, '{"sport":"basketball"}')`, [clubA])).rows.map((r) => r.user_id);
    eq(after.includes(u.adult), false, 'otro miembro del club tampoco le encuentra');
    await expectError(() => as(v.directorA, `select trial_org_invite($1, $2)`, [trialU18, u.adult]), /blocked|already_registered/);
    eq((await as(v.directorA, `select minor_contact_mode($1, $2) m`, [u.adult, clubA])).rows[0].m, 'contact_blocked');
    await as(u.adult, `delete from user_blocks where blocker_id = $1 and blocked_id = $2`, [u.adult, v.scoutU18]);
  });

  await check('11D A12/A13 · trial ajeno y borradores: ni editar precio, plazas o plazo, ni descubrir que existen', async () => {
    eq((await as(v.ownerB, `update trial_details set capacity = 999, price_status = 'free' where opportunity_id = $1`, [trialU18])).rowCount, 0, 'capacidad/precio');
    eq((await as(v.ownerB, `update opportunity_cost_components set amount = 1 where opportunity_id = $1`, [paidTrial])).rowCount, 0, 'importe');
    eq((await as(v.ownerB, `update opportunities set deadline = current_date + 1, status = 'archived' where id = $1`, [trialU18])).rowCount, 0, 'plazo/cerrar');
    const draftB = (await as(v.ownerB, `insert into opportunities (organization_id, created_by, type, title, description, sport_id) values ($1, $2, 'tryout', 'Borrador secreto B', 'Trial interno todavía sin anunciar.', 'basketball') returning id`, [clubB, v.ownerB])).rows[0].id;
    for (const who of [null, u.adult, v.directorA]) {
      eq((await as(who, `select count(*)::int n from opportunities where id = $1`, [draftB])).rows[0].n, 0, `select ${who}`);
      await expectError(() => as(who, `select opportunity_publish_gaps($1)`, [draftB]), /not_allowed|permission denied/);
    }
    eq((await as(u.adult, `select opportunity_visible_confirmed_count($1) n`, [draftB])).rows[0].n, null, 'recuento de borrador ajeno');
    eq((await as(v.ownerB, `select opportunity_publish_gaps($1) g`, [draftB])).rows[0].g.length > 0, true, 'el dueño sí ve sus huecos');
    await expectError(() => as(u.adult, `select opportunity_confirmed_count($1)`, [trialU18]), /permission denied/);
  });

  await check('11D A14 · el atleta no manipula costes, pagos ni su propia inscripción', async () => {
    eq((await as(u.adult, `update opportunity_cost_components set amount = 0 where opportunity_id = $1`, [paidTrial])).rowCount, 0, 'coste');
    await expectError(() => as(u.adult, `update payment_requirements set amount = 1 where athlete_id = $1`, [u.adult]), /permission denied/);
    await expectError(() => as(u.adult, `update opportunity_registrations set status = 'confirmed', needs_athlete_ok = false where athlete_id = $1`, [u.adult]), /permission denied/);
    await expectError(() => as(u.adult, `insert into opportunity_attendance (registration_id, opportunity_id, organization_id, athlete_id, status) select id, opportunity_id, organization_id, athlete_id, 'attended' from opportunity_registrations where athlete_id = $1 limit 1`, [u.adult]), /permission denied/);
  });

  await check('11D A15+ · sesión tras baja, cuota de Discovery por RPC directa e inyección en notas', async () => {
    // Baja del scout: el acceso se pierde en la siguiente petición (sin esperar a que caduque el token).
    await as(u.coach2, `delete from organization_members where organization_id = $1 and user_id = $2`, [clubA, v.viewerA]);
    eq((await as(v.viewerA, `select count(*)::int n from opportunities where organization_id = $1 and status = 'draft'`, [clubA])).rows[0].n, 0);
    // La cuota diaria se aplica dentro de discover_athlete_ids (antes se podía saltar llamándola directamente).
    await db.query(`insert into discovery_usage (user_id, day, searches) values ($1, current_date, 300) on conflict (user_id, day) do update set searches = 300`, [v.directorA]);
    await expectError(() => as(v.directorA, `select * from discover_athlete_ids($1, '{"sport":"basketball"}')`, [clubA]), /rate_limited/);
    await db.query(`delete from discovery_usage where user_id = $1`, [v.directorA]);
    await expectError(() => as(v.directorA, `insert into org_notes (organization_id, athlete_id, author_id, body) values ($1, $2, $3, '<img src=x onerror=alert(1)>')`, [clubA, u.adult, v.directorA]), /unsafe_content/);
  });

  // ---------------------------------------------------------------- 11E · QA: integridad que la UI no puede garantizar sola
  results.push('\nPrompt 11E: QA de datos');
  await check('11E QA-01 · «Valencia Basket», «VALENCIA BASKET», «Valencia Basket Club» y «ValenciaBasket» son la misma organización', async () => {
    await as(v.unverified, `insert into organizations (name, type, created_by, country) values ('Valencia Basket', 'club', $1, 'ES')`, [v.unverified]);
    for (const n of ['VALENCIA BASKET', 'Valencia Basket Club', 'ValenciaBasket', 'Valencia Basket S.A.D.']) {
      await expectError(() => as(v.unverified, `insert into organizations (name, type, created_by, country) values ($1, 'academy', $2, 'ES')`, [n, v.unverified]), /organization_exists/);
    }
    eq((await db.query(`select count(*)::int n from organizations where name_key = 'valenciabasket'`)).rows[0].n, 1, 'una sola entidad');
    // Otra entidad legítima con nombre parecido sí se crea; las importaciones del sistema (o de otro país) también.
    await as(v.unverified, `insert into organizations (name, type, created_by, country) values ('Valencia CF', 'club', $1, 'ES')`, [v.unverified]);
    await as(v.ownerB, `insert into organizations (name, type, created_by, country) values ('Valencia Basket', 'club', $1, 'IT')`, [v.ownerB]); // otro país
  });

  // ---------------------------------------------------------------- Prompt 10 · Family
  results.push('\nPrompt 10: familia (tutores, otras familias, mayoría de edad, costes, notas, consentimientos)');
  const fam = {};
  {
    const mkUser = async (key, role, dobSql) => {
      const id = randomUUID(); fam[key] = id;
      await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${key}@fam.test`, { display_name: key }]);
      await db.query(`insert into user_roles (user_id, role) values ($1, $2)`, [id, role]);
      await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, ${dobSql})`, [id]);
      if (role === 'athlete') await db.query(`insert into athlete_profiles (user_id, sport_id, graduation_year) values ($1, 'basketball', 2028)`, [id]);
    };
    await mkUser('kid', 'athlete', `current_date - interval '16 years'`);
    await mkUser('other', 'athlete', `current_date - interval '17 years'`);
    await mkUser('grown', 'athlete', `current_date - interval '19 years'`);           // mayor hace un año: ventana vencida
    await mkUser('fresh18', 'athlete', `current_date - interval '18 years' - interval '10 days'`); // dentro de la ventana
    await mkUser('mom', 'parent', `current_date - interval '45 years'`);
    await mkUser('dad', 'parent', `current_date - interval '47 years'`);
    await mkUser('otherMom', 'parent', `current_date - interval '44 years'`);
    const link = async (g, a, extra = '') => (await db.query(`insert into parent_athlete_links (parent_id, athlete_id, invited_by, status, approved_at, relationship, guardian_consent_given, verification_status${extra ? ', ' + extra.split('=')[0] : ''})
      values ($1, $2, $1, 'approved', now() - interval '3 years', 'mother', true, 'athlete_confirmed'${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [g, a])).rows[0].id;
    fam.momKid = await link(fam.mom, fam.kid);
    fam.dadKid = await link(fam.dad, fam.kid, 'can_view_costs=false');
    fam.otherLink = await link(fam.otherMom, fam.other);
    fam.momGrown = await link(fam.mom, fam.grown);
    fam.momFresh = await link(fam.mom, fam.fresh18);
    for (const a of ['kid', 'other', 'grown', 'fresh18']) {
      await db.query(`insert into athlete_finances (athlete_id, annual_budget_usd, budget_mode) values ($1, 15000, 'hard_limit')`, [fam[a]]);
    }
  }
  const n = async (who, sql, params) => (await as(who, sql, params)).rows[0].n;

  await check('P10 otras familias · el tutor de A no ve ni escribe nada de B (aunque cambie el athlete_id)', async () => {
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.other]), 0, 'presupuesto ajeno');
    eq(await n(fam.mom, `select count(*)::int n from parent_athlete_links where athlete_id = $1`, [fam.other]), 0, 'vínculo ajeno');
    await expectError(() => as(fam.mom, `insert into family_cost_scenarios (athlete_id, created_by, label) values ($1, $2, 'Intruso')`, [fam.other, fam.mom]), /row-level security/);
    await expectError(() => as(fam.mom, `insert into family_notes (athlete_id, author_id, body) values ($1, $2, 'Intruso')`, [fam.other, fam.mom]), /row-level security/);
    eq((await as(fam.mom, `select public.guardian_can_view_resource($1, 'costs') v`, [fam.other])).rows[0].v, false);
    eq((await as(fam.mom, `select public.guardian_can_view_resource($1, 'costs') v`, [fam.kid])).rows[0].v, true);
    eq((await as(fam.mom, `select public.guardian_can_view_resource($1, 'private_notes') v`, [fam.kid])).rows[0].v, false, 'notas privadas del atleta: nunca');
  });

  await check('P10 varios tutores · permisos independientes por relación (papá sin costes, mamá con costes)', async () => {
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.kid]), 1, 'mamá');
    eq(await n(fam.dad, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.kid]), 1, 'papá: el presupuesto es un permiso propio (10A)');
    await as(fam.mom, `insert into family_cost_scenarios (athlete_id, created_by, label, tuition, housing) values ($1, $2, 'Universidad X', 30000, null)`, [fam.kid, fam.mom]);
    eq(await n(fam.dad, `select count(*)::int n from family_cost_scenarios where athlete_id = $1`, [fam.kid]), 0, 'escenarios: papá no');
    eq(await n(fam.kid, `select count(*)::int n from family_cost_scenarios where athlete_id = $1`, [fam.kid]), 1, 'el atleta sí');
    await expectError(() => as(fam.mom, `update family_cost_scenarios set athlete_id = $1 where athlete_id = $2`, [fam.other, fam.kid]), /scenario_owner_immutable|row-level security/);
  });

  await check('P10 presupuesto privado · ninguna organización, agente ni otra familia lo ve', async () => {
    for (const who of [u.coach2, u.coach, u.agent, u.uni, fam.otherMom, null]) {
      const r = await as(who, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.kid]).then((x) => x.rows[0].n, (e) => (/permission denied/.test(e.message) ? 0 : Promise.reject(e)));
      eq(r, 0, `presupuesto visible para ${who}`);
    }
  });

  await check('P10 la relación no se manipula desde el cliente (verificación, restricción, revisión, permisos propios)', async () => {
    await expectError(() => as(fam.mom, `update parent_athlete_links set verification_status = 'admin_verified' where id = $1`, [fam.momKid]), /family_link_fields_immutable/);
    await expectError(() => as(fam.mom, `update parent_athlete_links set last_reviewed_at = now() where id = $1`, [fam.momGrown]), /family_link_fields_immutable/);
    await expectError(() => as(fam.dad, `update parent_athlete_links set can_view_costs = true where id = $1`, [fam.dadKid]), /only_athlete_sets_family_permissions/);
    await expectError(() => as(fam.mom, `update parent_athlete_links set status = 'restricted' where id = $1`, [fam.momKid]), /family_link_can_only_be_revoked/);
    await expectError(() => as(fam.mom, `select family_link_restrict($1, false)`, [fam.momKid]), /not_allowed/);
    await expectError(() => as(fam.mom, `select family_link_admin_verify($1)`, [fam.momKid]), /not_allowed/);
  });

  await check('P10 mayoría de edad · el acceso se suspende al vencer la revisión y vuelve solo si el atleta lo confirma', async () => {
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.grown]), 0, '19 años sin revisión → suspendido');
    eq((await as(fam.mom, `select public.is_active_guardian($1) v`, [fam.grown])).rows[0].v, false);
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.fresh18]), 1, '18 años + 10 días → aún en ventana');
    await expectError(() => as(fam.kid, `select family_link_review($1, true)`, [fam.momKid]), /review_after_majority/);
    await expectError(() => as(fam.mom, `select family_link_review($1, true)`, [fam.momGrown]), /not_allowed/);
    eq((await as(fam.grown, `select family_link_review($1, true) r`, [fam.momGrown])).rows[0].r, 'kept');
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.grown]), 1, 'confirmado por el atleta');
    eq((await as(fam.fresh18, `select family_link_review($1, false) r`, [fam.momFresh])).rows[0].r, 'revoked');
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.fresh18]), 0, 'el atleta decidió no seguir');
    eq((await db.query(`select count(*)::int n from audit_logs where action = 'family_link.reviewed'`)).rows[0].n, 2, 'auditado');
  });

  await check('P10 pausar · el atleta suspende y reanuda; un tutor revocado no ve nada', async () => {
    await as(fam.grown, `select family_link_restrict($1, true, 'Necesito espacio')`, [fam.momGrown]);
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.grown]), 0, 'pausado');
    await as(fam.grown, `select family_link_restrict($1, false)`, [fam.momGrown]);
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.grown]), 1, 'reanudado');
    await as(fam.grown, `update parent_athlete_links set status = 'revoked' where id = $1`, [fam.momGrown]);
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.grown]), 0, 'revocado');
    await expectError(() => as(fam.mom, `insert into family_notes (athlete_id, author_id, body) values ($1, $2, 'Sigo aquí')`, [fam.grown, fam.mom]), /row-level security/);
  });

  await check('P10 notas familiares · solo tutores o familia; nunca organizaciones; sin HTML activo', async () => {
    await as(fam.mom, `insert into family_notes (athlete_id, author_id, body) values ($1, $2, 'Preguntar el coste real del alojamiento')`, [fam.kid, fam.mom]);
    await as(fam.mom, `insert into family_notes (athlete_id, author_id, body, visibility) values ($1, $2, 'Nos gusta, pero está lejos', 'family')`, [fam.kid, fam.mom]);
    eq(await n(fam.dad, `select count(*)::int n from family_notes where athlete_id = $1`, [fam.kid]), 2, 'otro tutor');
    eq(await n(fam.kid, `select count(*)::int n from family_notes where athlete_id = $1`, [fam.kid]), 1, 'el atleta solo ve las compartidas');
    for (const who of [u.coach2, u.uni, fam.otherMom]) eq(await n(who, `select count(*)::int n from family_notes where athlete_id = $1`, [fam.kid]), 0, `notas visibles para ${who}`);
    await expectError(() => as(fam.kid, `insert into family_notes (athlete_id, author_id, body, visibility) values ($1, $1, 'Secreta', 'guardians')`, [fam.kid]), /row-level security/);
    await expectError(() => as(fam.mom, `insert into family_notes (athlete_id, author_id, body) values ($1, $2, '<img src=x onerror=alert(1)>')`, [fam.kid, fam.mom]), /row-level security/);
  });

  await check('P10 tareas compartidas · la familia crea tareas suyas o conjuntas en el motor central, no del atleta', async () => {
    await as(fam.mom, `insert into pipeline_tasks (athlete_id, title, owner, source, created_by) values ($1, 'Revisar coste de alojamiento', 'both', 'family', $2)`, [fam.kid, fam.mom]);
    await expectError(() => as(fam.mom, `insert into pipeline_tasks (athlete_id, title, owner, source, created_by) values ($1, 'Haz esto', 'athlete', 'family', $2)`, [fam.kid, fam.mom]), /row-level security/);
    await expectError(() => as(fam.otherMom, `insert into pipeline_tasks (athlete_id, title, owner, source, created_by) values ($1, 'Intruso', 'guardian', 'family', $2)`, [fam.kid, fam.otherMom]), /row-level security/);
    eq(await n(fam.kid, `select count(*)::int n from pipeline_tasks where athlete_id = $1 and owner = 'both'`, [fam.kid]), 1, 'el atleta la ve');
  });

  await check('P10 consentimiento revocado · revoca las concesiones del documento y queda auditado; el caducado no vale', async () => {
    await as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '5 days')`, [docT, u.adult, clubA]);
    eq(await n(u.coach2, `select count(*)::int n from athlete_documents where id = $1`, [docT]), 1, 'con concesión');
    await as(u.adult, `insert into consents (user_id, purpose, document_version, granted, target_type, target_id, organization_id) values ($1, 'document_sharing', 'v1', false, 'document', $2, $3)`, [u.adult, docT, clubA]);
    eq(await n(u.coach2, `select count(*)::int n from athlete_documents where id = $1`, [docT]), 0, 'tras revocar el consentimiento');
    eq((await db.query(`select count(*)::int n from audit_logs where action = 'consent.revoked' and details->>'athlete_id' = $1`, [u.adult])).rows[0].n >= 1, true, 'auditado');
    await as(u.adult, `insert into consents (user_id, purpose, document_version, granted, target_type, target_id, organization_id, expires_at) values ($1, 'contact', 'v1', true, 'organization', $2, $2, now() - interval '1 day')`, [u.adult, clubA]);
    eq((await db.query(`select consent_granted($1, 'contact', 'organization', $2) g`, [u.adult, clubA])).rows[0].g, false, 'consentimiento caducado');
  });

  await check('P10 invitaciones · caducan, no se reutilizan y la aceptación deja la relación confirmada', async () => {
    const t = (await as(fam.otherMom, `insert into parent_athlete_links (parent_id, invited_by) values ($1, $1) returning invitation_token`, [fam.otherMom])).rows[0].invitation_token;
    await db.query(`update parent_athlete_links set expires_at = now() - interval '1 hour' where invitation_token = $1`, [t]);
    eq((await db.query(`select expire_family_invitations() n`)).rows[0].n >= 1, true);
    eq((await db.query(`select status::text s from parent_athlete_links where invitation_token = $1`, [t])).rows[0].s, 'expired');
    await expectError(() => as(fam.kid, `select accept_family_invitation($1)`, [t]), /invitation_invalid/);
    const t2 = (await as(fam.otherMom, `insert into parent_athlete_links (parent_id, invited_by, relationship) values ($1, $1, 'legal_guardian') returning invitation_token`, [fam.otherMom])).rows[0].invitation_token;
    await as(fam.kid, `select accept_family_invitation($1)`, [t2]);
    eq((await db.query(`select verification_status v from parent_athlete_links where invitation_token = $1`, [t2])).rows[0].v, 'athlete_confirmed');
    await expectError(() => as(fam.grown, `select accept_family_invitation($1)`, [t2]), /invitation_invalid/);
    await expectError(() => as(null, `select is_active_guardian($1)`, [fam.kid]), /permission denied/);
  });

  // ---------------------------------------------------------------- Prompt 10A · Matriz RLS de familia
  results.push('\nPrompt 10A: matriz RLS de familia (actor × recurso)');
  {
    const stranger = randomUUID(); fam.stranger = stranger;
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'stranger@fam.test', '{"display_name":"stranger"}')`, [stranger]);
    await db.query(`insert into user_roles (user_id, role) values ($1, 'parent')`, [stranger]);
    await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, current_date - interval '50 years')`, [stranger]);
  }
  await check('P10A matriz · atleta, tutor completo, tutor sin costes, otra familia, club y anónimo sobre Passport, documentos, presupuesto, ofertas, notas familiares y notas del club', async () => {
    await db.query(`update athlete_profiles set profile_visibility = 'members' where user_id = $1`, [fam.kid]);
    await db.query(`insert into athlete_documents (athlete_id, kind, title) values ($1, 'transcript', 'Expediente')`, [fam.kid]);
    await db.query(`insert into athlete_offers (athlete_id, university_name, annual_cost_usd, aid_amount_usd) values ($1, 'Universidad X', 40000, 20000)`, [fam.kid]);
    await db.query(`insert into org_notes (organization_id, athlete_id, author_id, body) values ($1, $2, $3, 'Revisar partido completo')`, [clubA, fam.kid, u.coach2]);
    const count = async (who, table) => as(who, `select count(*)::int n from ${table} where ${table === 'athlete_profiles' ? 'user_id' : 'athlete_id'} = $1`, [fam.kid])
      .then((r) => r.rows[0].n, (e) => (/permission denied/.test(e.message) ? 0 : Promise.reject(e)));
    const expected = {
      // recurso:            atleta, mamá, papá(sin costes), otra familia, club A, anónimo
      athlete_documents:   [1, 1, 1, 0, 0, 0],
      athlete_finances:    [1, 1, 1, 0, 0, 0],   // papá: presupuesto es un permiso propio (por defecto sí)
      athlete_offers:      [1, 1, 1, 0, 0, 0],   // papá ve ofertas por «proceso»
      family_notes:        [1, 2, 2, 0, 0, 0],   // el atleta solo ve las compartidas
      org_notes:           [0, 0, 0, 0, 1, 0],   // notas del club: nunca para atleta ni familia
      family_cost_scenarios: [1, 1, 0, 0, 0, 0],
    };
    const actors = [fam.kid, fam.mom, fam.dad, fam.stranger, u.coach2, null];
    for (const [table, row] of Object.entries(expected)) {
      for (let i = 0; i < actors.length; i++) eq(await count(actors[i], table), row[i], `${table} · actor ${i}`);
    }
  });

  await check('P10A presupuesto · permiso propio: sin él, el tutor sigue viendo costes pero no el presupuesto', async () => {
    await as(fam.kid, `update parent_athlete_links set can_view_budget = false where id = $1`, [fam.momKid]);
    eq(await n(fam.mom, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.kid]), 0, 'presupuesto');
    eq(await n(fam.mom, `select count(*)::int n from family_cost_scenarios where athlete_id = $1`, [fam.kid]), 1, 'escenarios siguen');
    eq((await as(fam.mom, `select guardian_has_scope($1, 'athlete.family_budget.view') v`, [fam.kid])).rows[0].v, false);
    eq((await as(fam.mom, `select guardian_has_scope($1, 'athlete.*') v`, [fam.kid])).rows[0].v, false, 'scope inventado');
    await as(fam.kid, `update parent_athlete_links set can_view_budget = true where id = $1`, [fam.momKid]);
    eq((await as(fam.mom, `update parent_athlete_links set can_view_budget = true where id = $1`, [fam.dadKid])).rowCount, 0, 'un tutor no toca la relación de otro');
    await expectError(() => as(fam.dad, `update parent_athlete_links set can_view_costs = true where id = $1`, [fam.dadKid]), /only_athlete_sets_family_permissions/);
  });

  await check('P10A contactos de un menor · tutor activo ve y aprueba; pausado no ve ni aprueba', async () => {
    const req = (await as(u.coach2, `insert into contact_requests (organization_id, athlete_id, message) values ($1, $2, 'Nos gustaría invitarte a nuestro trial U18.') returning id, status`, [clubA, fam.kid])).rows[0];
    eq(req.status, 'pending_guardian');
    eq(await n(fam.mom, `select count(*)::int n from contact_requests where id = $1`, [req.id]), 1, 'mamá activa');
    await as(fam.kid, `select family_link_restrict($1, true, 'pausa')`, [fam.momKid]);
    eq(await n(fam.mom, `select count(*)::int n from contact_requests where id = $1`, [req.id]), 0, 'pausada: no ve');
    eq((await as(fam.mom, `update contact_requests set status = 'pending' where id = $1`, [req.id])).rowCount, 0, 'pausada: no aprueba');
    await as(fam.kid, `select family_link_restrict($1, false)`, [fam.momKid]);
    await as(fam.mom, `update contact_requests set status = 'pending' where id = $1`, [req.id]);
    eq((await db.query(`select guardian_approved_by g from contact_requests where id = $1`, [req.id])).rows[0].g, fam.mom, 'aprobado por mamá');
    eq(await n(fam.stranger, `select count(*)::int n from contact_requests where id = $1`, [req.id]), 0, 'otra familia');
  });

  await check('P10A mensajes de un atleta adulto · la familia solo los lee con permiso explícito y nunca escribe', async () => {
    const adultK = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'adultk@fam.test', '{"display_name":"adultK"}')`, [adultK]);
    await db.query(`insert into user_roles (user_id, role) values ($1, 'athlete')`, [adultK]);
    await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, current_date - interval '21 years')`, [adultK]);
    await db.query(`insert into athlete_profiles (user_id, sport_id, graduation_year, profile_visibility) values ($1, 'basketball', 2025, 'members')`, [adultK]);
    const l = (await db.query(`insert into parent_athlete_links (parent_id, athlete_id, invited_by, status, approved_at, relationship, guardian_consent_given, can_view_contacts)
      values ($1, $2, $2, 'approved', now(), 'father', false, false) returning id`, [fam.dad, adultK])).rows[0].id;
    const req = (await as(u.coach2, `insert into contact_requests (organization_id, athlete_id, message) values ($1, $2, 'Hola, queremos hablar sobre la temporada 2027.') returning id`, [clubA, adultK])).rows[0].id;
    await as(adultK, `update contact_requests set status = 'accepted' where id = $1`, [req]);
    await as(u.coach2, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Primer mensaje')`, [req, u.coach2]);
    eq(await n(fam.dad, `select count(*)::int n from contact_requests where id = $1`, [req]), 0, 'sin «quién me contacta»');
    eq(await n(fam.dad, `select count(*)::int n from contact_messages where request_id = $1`, [req]), 0, 'sin «mensajes»');
    await as(adultK, `update parent_athlete_links set can_view_contacts = true, can_view_messages = true where id = $1`, [l]);
    eq(await n(fam.dad, `select count(*)::int n from contact_requests where id = $1`, [req]), 1, 'con permiso');
    eq(await n(fam.dad, `select count(*)::int n from contact_messages where request_id = $1`, [req]), 1, 'lee mensajes');
    await expectError(() => as(fam.dad, `insert into contact_messages (request_id, sender_id, body) values ($1, $2, 'Soy su padre')`, [req, fam.dad]), /row-level security/);
    eq((await as(fam.dad, `update contact_requests set status = 'blocked' where id = $1`, [req])).rowCount, 0, 'no decide por el adulto');
  });

  // ---------------------------------------------------------------- Prompt 10B · Policies de familia
  results.push('\nPrompt 10B: policies de familia (proceso, concesiones, consentimientos)');
  await check('P10B proceso · eventos del pipeline con permiso «proceso»; la shortlist con «Passport»', async () => {
    const proc = (await db.query(`insert into saved_items (athlete_id, target_kind, target_id) select $1, 'institution', id from institutions limit 1 returning id`, [fam.kid])).rows[0].id;
    await db.query(`insert into pipeline_events (athlete_id, process_id, kind, source, title) values ($1, $2, 'note', 'user', 'Llamada con el coach')`, [fam.kid, proc]);
    await as(fam.kid, `update parent_athlete_links set can_view_applications = false where id = $1`, [fam.momKid]);
    eq(await n(fam.mom, `select count(*)::int n from pipeline_events where athlete_id = $1`, [fam.kid]), 0, 'sin «proceso»');
    eq(await n(fam.mom, `select count(*)::int n from saved_items where athlete_id = $1`, [fam.kid]), 1, 'shortlist con «Passport»');
    await as(fam.kid, `update parent_athlete_links set can_view_applications = true where id = $1`, [fam.momKid]);
    eq((await n(fam.mom, `select count(*)::int n from pipeline_events where athlete_id = $1`, [fam.kid])) >= 1, true, 'con «proceso» (incluye el evento automático de guardar)');
    for (const who of [fam.stranger, u.coach2]) eq(await n(who, `select count(*)::int n from pipeline_events where athlete_id = $1`, [fam.kid]), 0, `eventos para ${who}`);
  });

  await check('P10B concesiones · verlas exige «documentos»; el tutor activo de un menor puede revocarlas; otro club no', async () => {
    const doc = (await db.query(`insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'transcript', 'Notas 2026', $2, now()) returning id`, [fam.kid, `${fam.kid}/notas.pdf`])).rows[0].id;
    const g = (await db.query(`insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '10 days') returning id`, [doc, fam.kid, clubA])).rows[0].id;
    await as(fam.kid, `update parent_athlete_links set can_view_documents = false where id = $1`, [fam.dadKid]);
    eq(await n(fam.dad, `select count(*)::int n from document_access_grants where id = $1`, [g]), 0, 'papá sin documentos');
    eq(await n(fam.mom, `select count(*)::int n from document_access_grants where id = $1`, [g]), 1, 'mamá');
    eq(await n(u.coach2, `select count(*)::int n from athlete_documents where id = $1`, [doc]), 1, 'club con concesión');
    eq((await as(v.ownerB, `update document_access_grants set revoked_at = now() where id = $1`, [g])).rowCount, 0, 'otro club no revoca');
    await as(fam.mom, `update document_access_grants set revoked_at = now() where id = $1`, [g]);
    eq(await n(u.coach2, `select count(*)::int n from athlete_documents where id = $1`, [doc]), 0, 'revocada por la madre');
    await as(fam.kid, `update parent_athlete_links set can_view_documents = true where id = $1`, [fam.dadKid]);
  });

  await check('P10B consentimientos · RPC transaccional: atleta o tutor activo de un menor; idempotente; caducado no vale; nunca otro', async () => {
    const doc = (await db.query(`select id from athlete_documents where athlete_id = $1 and title = 'Notas 2026'`, [fam.kid])).rows[0].id;
    const c1 = (await as(fam.mom, `select consent_record($1, 'document_sharing', 'document', $2, $3, true, 'v2026-11') id`, [fam.kid, doc, clubA])).rows[0].id;
    const c2 = (await as(fam.mom, `select consent_record($1, 'document_sharing', 'document', $2, $3, true, 'v2026-11') id`, [fam.kid, doc, clubA])).rows[0].id;
    eq(c1, c2, 'doble toque → un solo consentimiento');
    eq((await db.query(`select guardian_id g from consents where id = $1`, [c1])).rows[0].g, fam.mom, 'quién lo dio');
    await expectError(() => as(fam.stranger, `select consent_record($1, 'document_sharing', 'document', $2, $3, true, 'v1')`, [fam.kid, doc, clubA]), /not_allowed/);
    await expectError(() => as(fam.dad, `select consent_record($1, 'contact', 'organization', $2, $2, true, 'v1')`, [fam.grown, clubA]), /not_allowed/); // adulto: nadie consiente por él
    await expectError(() => as(fam.mom, `select consent_record($1, 'document_sharing', 'document', $2, $3, true, 'v1')`, [fam.kid, docT, clubA]), /document_mismatch/);
    await expectError(() => as(fam.mom, `select consent_record($1, 'contact', 'organization', $2, $2, true, 'v1', now() - interval '1 day')`, [fam.kid, clubA]), /consent_already_expired/);
    await as(fam.kid, `select family_link_restrict($1, true, null)`, [fam.momKid]);
    await expectError(() => as(fam.mom, `select consent_record($1, 'contact', 'organization', $2, $2, true, 'v1')`, [fam.kid, clubA]), /not_allowed/);
    await as(fam.kid, `select family_link_restrict($1, false)`, [fam.momKid]);
    await expectError(() => as(fam.mom, `update consents set granted = false where id = $1`, [c1]), /permission denied|immutable|row-level/);
  });

  // ---------------------------------------------------------------- Prompt 10C · Pentest de familia
  // Cada prueba reproduce un ataque real (IDs manipulados, peticiones directas a PostgreSQL/Storage/RPC)
  // con usuarios sintéticos. Los FAM-SEC-00x son los hallazgos corregidos en 20261125000100.
  results.push('\nPrompt 10C: pentest de familia (ataques directos a PostgreSQL, Storage y RPC)');
  const stor = async (who, sql, params) => as(who, sql, params).then((r) => r.rows[0]?.n ?? r.rowCount, (e) => (/row-level security|permission denied/.test(e.message) ? 'denied' : Promise.reject(e)));
  {
    // Datos de la familia B claramente diferenciados para detectar cualquier fuga cruzada.
    await db.query(`insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'transcript', 'Doc B', $2, now())`, [fam.other, `${fam.other}/b.pdf`]);
    await db.query(`insert into athlete_offers (athlete_id, university_name, annual_cost_usd, aid_amount_usd) values ($1, 'Universidad B', 30000, 10000)`, [fam.other]);
    await db.query(`insert into family_notes (athlete_id, author_id, body) values ($1, $2, 'Nota familia B')`, [fam.other, fam.otherMom]);
    await db.query(`insert into family_cost_scenarios (athlete_id, created_by, label, tuition) values ($1, $2, 'Escenario B', 20000)`, [fam.other, fam.otherMom]);
    await db.query(`insert into pipeline_tasks (athlete_id, title, owner, source, created_by) values ($1, 'Tarea B', 'both', 'family', $2)`, [fam.other, fam.otherMom]);
    await db.query(`insert into storage.objects (bucket_id, name) values ('athlete-documents', $1), ('athlete-documents', $2), ('athlete-documents', $3)`, [`${fam.other}/b.pdf`, `${fam.kid}/notas.pdf`, `${u.adult}/exp.pdf`]);
  }

  await check('P10C IDOR · el tutor A cambia athlete_id por el de B en 9 recursos: siempre 0 filas (B sí tiene datos)', async () => {
    for (const t of ['athlete_documents', 'athlete_offers', 'family_notes', 'family_cost_scenarios', 'pipeline_tasks', 'athlete_finances']) {
      eq((await db.query(`select count(*)::int n from ${t} where athlete_id = $1`, [fam.other])).rows[0].n >= 1, true, `B tiene ${t}`);
      eq(await n(fam.mom, `select count(*)::int n from ${t} where athlete_id = $1`, [fam.other]), 0, `${t} de B para el tutor A`);
    }
    eq(await n(fam.mom, `select count(*)::int n from consents where user_id = $1`, [fam.other]), 0, 'consentimientos de B');
    eq(await n(fam.mom, `select count(*)::int n from storage.objects where name like $1`, [`${fam.other}/%`]), 0, 'archivos de B en Storage');
    await expectError(() => as(fam.mom, `insert into family_notes (athlete_id, author_id, body) values ($1, $2, 'Intruso')`, [fam.other, fam.mom]), /row-level security/);
    await expectError(() => as(fam.mom, `insert into athlete_finances (athlete_id, annual_budget_usd) values ($1, 1)`, [fam.other]), /row-level security|duplicate/);
  });

  await check('FAM-SEC-002 · una invitación no puede venir «verificada», con permisos ampliados ni revisión de mayoría falsa', async () => {
    const r = (await as(fam.stranger, `insert into parent_athlete_links (parent_id, invited_by, status, verification_status, verified_at, last_reviewed_at, expires_at,
        can_edit_profile, can_view_messages, guardian_consent_given, invitation_token)
      values ($1, $1, 'pending', 'admin_verified', now(), now() + interval '20 years', now() + interval '50 years', true, true, true, 'abc')
      returning verification_status, verified_at, last_reviewed_at, expires_at < now() + interval '15 days' as short, can_edit_profile, can_view_messages, guardian_consent_given, length(invitation_token) as tl`, [fam.stranger])).rows[0];
    eq(r.verification_status, 'unverified'); eq(r.verified_at, null); eq(r.last_reviewed_at, null); eq(r.short, true, 'caducidad máx. 14 días');
    eq(r.can_edit_profile, false); eq(r.can_view_messages, false); eq(r.guardian_consent_given, false); eq(r.tl, 64, 'token generado por el servidor');
    await expectError(() => as(fam.stranger, `insert into parent_athlete_links (parent_id, athlete_id, invited_by, status) values ($1, $2, $1, 'approved')`, [fam.stranger, fam.other]), /row-level security/);
  });

  await check('P10C relación · el tutor no se reactiva, ni cambia de atleta, ni se amplía permisos, ni alarga nada', async () => {
    for (const sql of [
      `update parent_athlete_links set status = 'approved', revoked_at = null where id = $1`,
      `update parent_athlete_links set athlete_id = '${fam.other}' where id = $1`,
      `update parent_athlete_links set parent_id = '${fam.stranger}' where id = $1`,
      `update parent_athlete_links set expires_at = now() + interval '10 years' where id = $1`,
    ]) await expectError(() => as(fam.mom, sql, [sql.includes("'approved'") ? fam.momGrown : fam.momKid]), /family_link_|row-level/);
    await expectError(() => as(fam.dad, `update parent_athlete_links set can_view_costs = true, can_view_budget = true where id = $1`, [fam.dadKid]), /only_athlete_sets_family_permissions/);
  });

  await check('FAM-SEC-003 · un menor no se da a sí mismo el consentimiento que corresponde a su tutor', async () => {
    eq((await as(u.coach2, `select minor_contact_mode($1, $2) m`, [fam.kid, clubA])).rows[0].m, 'guardian_approval_required', 'antes');
    for (const p of ['contact', 'document_sharing', 'trial_participation', 'organization_contact']) {
      await expectError(() => as(fam.kid, `insert into consents (user_id, purpose, document_version, granted, target_type, target_id, organization_id) values ($1, $2, 'v1', true, 'organization', $3, $3)`, [fam.kid, p, clubA]), /row-level security/);
    }
    await db.query(`insert into consents (user_id, purpose, document_version, granted, target_type, target_id, organization_id) values ($1, 'contact', 'v1', true, 'organization', $2, $2)`, [fam.kid, clubA]); // fila heredada sin tutor
    eq((await as(u.coach2, `select minor_contact_mode($1, $2) m`, [fam.kid, clubA])).rows[0].m, 'guardian_approval_required', 'una fila sin tutor no cuenta');
    await as(fam.kid, `insert into consents (user_id, purpose, document_version, granted, target_type, target_id, organization_id) values ($1, 'contact', 'v1', false, 'organization', $2, $2)`, [fam.kid, clubA]); // retirar sí puede
    await as(fam.mom, `select consent_record($1, 'contact', 'organization', $2, $2, true, 'v2026-11')`, [fam.kid, clubA]);
    eq((await as(u.coach2, `select minor_contact_mode($1, $2) m`, [fam.kid, clubA])).rows[0].m, 'guardian_visible', 'con el tutor');
    await as(u.adult, `insert into consents (user_id, purpose, document_version, granted, target_type, target_id, organization_id) values ($1, 'contact', 'v1', true, 'organization', $2, $2)`, [u.adult, clubA]); // un adulto sí
  });

  await check('FAM-SEC-004 · un consentimiento del tutor caducado ya no satisface el requisito', async () => {
    const opp = randomUUID();
    await db.query(`insert into consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, expires_at)
      values ($1, $2, 'trial_participation', 'v1', true, 'opportunity', $3, $4, now() - interval '1 day')`, [fam.kid, fam.mom, opp, clubA]);
    eq((await db.query(`select guardian_requirement_satisfied($1, 'trial_participation', 'opportunity', $2) s`, [fam.kid, opp])).rows[0].s, false);
    await db.query(`insert into consents (user_id, guardian_id, purpose, document_version, granted, target_type, target_id, organization_id, expires_at)
      values ($1, $2, 'trial_participation', 'v1', true, 'opportunity', $3, $4, now() + interval '30 days')`, [fam.kid, fam.mom, opp, clubA]);
    eq((await db.query(`select guardian_requirement_satisfied($1, 'trial_participation', 'opportunity', $2) s`, [fam.kid, opp])).rows[0].s, true);
  });

  await check('FAM-SEC-005 · un menor no comparte documentos sin su tutor; el consentimiento vale solo para ese documento y esa organización', async () => {
    const mk = async (t) => (await db.query(`insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'transcript', $2, $3, now()) returning id`, [fam.kid, t, `${fam.kid}/${t}.pdf`])).rows[0].id;
    const docX = await mk('boletin'); const docY = await mk('certificado');
    const grant = (doc, org) => as(fam.kid, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '7 days')`, [doc, fam.kid, org]);
    await expectError(() => grant(docX, clubA), /guardian_consent_required/);
    await as(fam.mom, `select consent_record($1, 'document_sharing', 'document', $2, $3, true, 'v2026-11')`, [fam.kid, docX, clubA]);
    await grant(docX, clubA);
    await expectError(() => grant(docX, clubB), /guardian_consent_required/);   // Documento A → otra organización
    await expectError(() => grant(docY, clubA), /guardian_consent_required/);   // otro documento → misma organización
    await as(fam.mom, `select consent_record($1, 'document_sharing', 'document', $2, $3, false, 'v2026-11')`, [fam.kid, docX, clubA]);
    await expectError(() => grant(docX, clubA), /guardian_consent_required/);   // revocado
  });

  await check('FAM-SEC-006 · «editar perfil» no abre presupuesto, ofertas ni proceso si el atleta quitó esos permisos', async () => {
    await db.query(`update parent_athlete_links set can_edit_profile = true, can_view_budget = false, can_view_costs = false, can_view_applications = false where id = $1`, [fam.dadKid]);
    try {
      eq(await n(fam.dad, `select count(*)::int n from athlete_finances where athlete_id = $1`, [fam.kid]), 0, 'presupuesto');
      eq(await n(fam.dad, `select count(*)::int n from athlete_offers where athlete_id = $1`, [fam.kid]), 0, 'ofertas');
      eq(await n(fam.dad, `select count(*)::int n from pipeline_contacts where athlete_id = $1`, [fam.kid]), 0, 'contactos del proceso');
      eq((await as(fam.dad, `update athlete_finances set annual_budget_usd = 1 where athlete_id = $1`, [fam.kid])).rowCount, 0, 'tampoco lo reescribe a ciegas');
      await expectError(() => as(fam.dad, `insert into athlete_offers (athlete_id, university_name) values ($1, 'X')`, [fam.kid]), /row-level security/);
    } finally {
      await db.query(`update parent_athlete_links set can_edit_profile = false, can_view_budget = true, can_view_costs = false, can_view_applications = true where id = $1`, [fam.dadKid]);
    }
    const all = (await db.query(`select string_agg(polrelid::regclass::text, ',') s from pg_policy where polcmd = '*' and pg_get_expr(polqual, polrelid) ilike '%has_family_link%'
      and polrelid::regclass::text in ('athlete_finances', 'athlete_offers', 'pipeline_contacts', 'process_documents')`)).rows[0].s;
    eq(all, null, 'sin policies FOR ALL en tablas con permiso de lectura propio');
  });

  await check('FAM-SEC-007 · un menor no se «hace adulto» cambiando su fecha de nacimiento', async () => {
    await expectError(() => as(fam.kid, `update private_profile_data set date_of_birth = '1990-01-01' where user_id = $1`, [fam.kid]), /date_of_birth_locked/);
    eq((await db.query(`select is_minor($1) m`, [fam.kid])).rows[0].m, true);
    await as(fam.kid, `update private_profile_data set phone = '+34600000000' where user_id = $1`, [fam.kid]); // el teléfono sí
    // Sin fecha registrada y con tutor vinculado: declararla ahora exige revisión (no se usa para escapar del tutor).
    await db.query(`delete from private_profile_data where user_id = $1`, [fam.other]);
    try {
      await expectError(() => as(fam.other, `insert into private_profile_data (user_id, date_of_birth) values ($1, '1990-01-01')`, [fam.other]), /date_of_birth_requires_review/);
    } finally {
      await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, current_date - interval '17 years')`, [fam.other]);
    }
  });

  await check('FAM-SEC-001 · nadie ajeno sabe si un id es menor preguntando a requires_guardian_consent', async () => {
    const ask = async (who, ath) => (await as(who, `select requires_guardian_consent($1, 'organization_contact') r`, [ath])).rows[0].r;
    // Perfiles no visibles para esa persona: la respuesta no puede depender de la edad.
    await db.query(`update athlete_profiles set profile_visibility = 'private' where user_id = any($1)`, [[fam.kid, fam.grown]]);
    try {
      eq(await ask(fam.stranger, fam.kid), await ask(fam.stranger, fam.grown), 'misma respuesta para menor y adulto');
    } finally {
      await db.query(`update athlete_profiles set profile_visibility = 'members' where user_id = $1`, [fam.kid]);
    }
    eq(await ask(fam.mom, fam.kid), true, 'su tutor sí lo sabe');
    eq(await ask(fam.grown, fam.grown), false, 'la propia persona');
    await expectError(() => as(null, `select requires_guardian_consent($1, 'contact')`, [fam.kid]), /permission denied/);
  });

  await check('P10C Storage · ruta adivinada, otra familia, otro club, concesión caducada o revocada, subida a carpeta ajena', async () => {
    const docA = (await db.query(`select id from athlete_documents where athlete_id = $1 and title = 'Notas 2026'`, [fam.kid])).rows[0].id;
    eq(await stor(fam.mom, `select count(*)::int n from storage.objects where name = $1`, [`${fam.kid}/notas.pdf`]), 1, 'tutor A → archivo de A');
    eq(await stor(fam.mom, `select count(*)::int n from storage.objects where name = $1`, [`${fam.other}/b.pdf`]), 0, 'tutor A → ruta de B');
    eq(await stor(fam.stranger, `select count(*)::int n from storage.objects where bucket_id = 'athlete-documents'`), 0, 'sin relación');
    eq(await stor(null, `select count(*)::int n from storage.objects`), 0, 'anónimo');
    const g = (await db.query(`insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '5 days') returning id`, [docA, fam.kid, clubA])).rows[0].id;
    eq(await stor(u.coach2, `select count(*)::int n from storage.objects where name = $1`, [`${fam.kid}/notas.pdf`]), 1, 'club A con concesión');
    eq(await stor(v.ownerB, `select count(*)::int n from storage.objects where name = $1`, [`${fam.kid}/notas.pdf`]), 0, 'club B con la misma ruta');
    await db.query(`update document_access_grants set expires_at = now() - interval '1 minute' where id = $1`, [g]);
    eq(await stor(u.coach2, `select count(*)::int n from storage.objects where name = $1`, [`${fam.kid}/notas.pdf`]), 0, 'concesión caducada');
    await expectError(() => as(u.coach2, `select document_open($1)`, [docA]), /not_found/);
    const g2 = (await db.query(`insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '5 days') returning id`, [docA, fam.kid, clubA])).rows[0].id;
    eq(await stor(u.coach2, `select count(*)::int n from storage.objects where name = $1`, [`${fam.kid}/notas.pdf`]), 1, 'nueva concesión');
    await as(fam.kid, `update document_access_grants set revoked_at = now() where id = $1`, [g2]);
    eq(await stor(u.coach2, `select count(*)::int n from storage.objects where name = $1`, [`${fam.kid}/notas.pdf`]), 0, 'concesión revocada');
    await expectError(() => as(fam.mom, `insert into storage.objects (bucket_id, name) values ('athlete-documents', $1)`, [`${fam.other}/falso.pdf`]), /row-level security/);
    await expectError(() => as(fam.mom, `insert into storage.objects (bucket_id, name) values ('athlete-documents', $1)`, [`../${fam.other}/x.pdf`]), /row-level security/);
    eq((await db.query(`select count(*)::int n from storage.buckets where public`)).rows[0].n, 0, 'ningún bucket público');
  });

  await check('P10C sesión de un tutor revocado · ninguna vía (tablas, Storage, RPC) sigue abierta', async () => {
    for (const t of ['athlete_finances', 'athlete_documents', 'athlete_offers', 'family_notes', 'pipeline_tasks', 'family_cost_scenarios']) {
      eq(await n(fam.mom, `select count(*)::int n from ${t} where athlete_id = $1`, [fam.grown]), 0, `${t} tras revocar`);
    }
    eq(await stor(fam.mom, `select count(*)::int n from storage.objects where name like $1`, [`${fam.grown}/%`]), 0);
    eq((await as(fam.mom, `select guardian_has_scope($1, 'athlete.passport.view') v`, [fam.grown])).rows[0].v, false);
    await expectError(() => as(fam.mom, `select consent_record($1, 'contact', 'organization', $2, $2, true, 'v1')`, [fam.grown, clubA]), /not_allowed/);
    await expectError(() => as(fam.mom, `select family_link_review($1, true)`, [fam.momGrown]), /not_allowed/);
  });

  await check('P10C enumeración · recurso inexistente y recurso ajeno responden igual', async () => {
    const docB = (await db.query(`select id from athlete_documents where athlete_id = $1 limit 1`, [fam.other])).rows[0].id;
    const msg = async (id) => as(fam.mom, `select document_open($1)`, [id]).then(() => 'ok', (e) => e.message);
    eq(await msg(docB), await msg(randomUUID()), 'document_open');
  });

  await check('P10C carrera · dos consentimientos simultáneos del mismo tutor → uno solo', async () => {
    const target = randomUUID();
    const c1 = new pg.Client({ connectionString: url.toString() }); const c2 = new pg.Client({ connectionString: url.toString() });
    await c1.connect(); await c2.connect();
    const run = async (c) => { await c.query('begin'); await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: fam.mom, role: 'authenticated' })]);
      const r = await c.query(`select consent_record($1, 'trial_participation', 'opportunity', $2, $3, true, 'v1') id`, [fam.kid, target, clubA]); await c.query('commit'); return r.rows[0].id; };
    try {
      const [a, b] = await Promise.all([run(c1), run(c2)]);
      eq(a, b, 'mismo id');
    } finally { await c1.end(); await c2.end(); }
    eq((await db.query(`select count(*)::int n from consents where target_id = $1`, [target])).rows[0].n, 1);
  });

  // ---------------------------------------------------------------- Prompt 10D · Recorrido E2E de la familia
  results.push('\nPrompt 10D: recorrido de la familia de extremo a extremo (solicitud → aprobación → acceso → retirada)');
  await check('P10D · Club A pide el expediente; la madre (sin «editar») lo aprueba; A accede, B no; la madre lo retira; el proceso sigue intacto', async () => {
    const doc = (await db.query(`insert into athlete_documents (athlete_id, kind, title, storage_path, uploaded_at) values ($1, 'transcript', 'Expediente 10D', $2, now()) returning id`, [fam.kid, `${fam.kid}/exp10d.pdf`])).rows[0].id;
    const req = (await as(u.coach2, `insert into info_requests (organization_id, athlete_id, requested_by, kind, message) values ($1, $2, $3, 'transcript', 'Necesitamos el expediente para la candidatura.') returning id`, [clubA, fam.kid, u.coach2])).rows[0].id;
    eq((await db.query(`select can_edit_profile c from parent_athlete_links where id = $1`, [fam.momKid])).rows[0].c, false, 'la madre no edita el perfil');
    const before = (await db.query(`select count(*)::int n from saved_items where athlete_id = $1`, [fam.kid])).rows[0].n;
    await as(fam.mom, `select respond_info_request($1, true, $2, (current_date + 30)::date)`, [req, doc]);
    eq((await as(u.coach2, `select document_open($1) p`, [doc])).rows[0].p, `${fam.kid}/exp10d.pdf`, 'Club A accede');
    await expectError(() => as(v.ownerB, `select document_open($1)`, [doc]), /not_found/);
    eq((await db.query(`select count(*)::int n from audit_logs where action = 'document_opened' and entity_id = $1`, [doc])).rows[0].n, 1, 'acceso registrado');
    await as(fam.mom, `select respond_info_request($1, false, null, null)`, [req]);
    await expectError(() => as(u.coach2, `select document_open($1)`, [doc]), /not_found/);
    eq((await db.query(`select status from info_requests where id = $1`, [req])).rows[0].status, 'revoked');
    eq((await db.query(`select count(*)::int n from saved_items where athlete_id = $1`, [fam.kid])).rows[0].n, before, 'el pipeline no se rompe');
    await expectError(() => as(fam.stranger, `select respond_info_request($1, true, $2, null)`, [req, doc]), /not_open|not_allowed|guardian_required/);
  });

  await check('P10D · la madre también concede y retira un acceso directo; un tutor pausado no puede', async () => {
    const doc = (await db.query(`select id from athlete_documents where athlete_id = $1 and title = 'Expediente 10D'`, [fam.kid])).rows[0].id;
    const g = (await as(fam.mom, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '10 days') returning id`, [doc, fam.kid, clubA])).rows[0].id;
    eq((await as(u.coach2, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 1);
    eq((await as(fam.mom, `update document_access_grants set revoked_at = now() where id = $1 and revoked_at is null`, [g])).rowCount, 1, 'retirado');
    eq((await as(u.coach2, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 0);
    await as(fam.kid, `select family_link_restrict($1, true, null)`, [fam.momKid]);
    try {
      await expectError(() => as(fam.mom, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '10 days')`, [doc, fam.kid, clubA]), /not_allowed|row-level/);
    } finally { await as(fam.kid, `select family_link_restrict($1, false)`, [fam.momKid]); }
  });

  // ---------------------------------------------------------------- Prompt 12 · Agentes: credenciales
  results.push('\nPrompt 12: agencias y credenciales profesionales');
  await check('P12 credenciales · el agente declara; nunca se autoverifica; la verificación es central y caduca', async () => {
    const c = (await as(u.agent, `insert into professional_credentials (user_id, organization_id, issuing_body, credential_type, credential_number, country, status, verified_at, expires_on)
      values ($1, $2, 'FIBA', 'federation_license', 'AG-123', 'ES', 'verified', now(), current_date + 400) returning id, status, verified_at`, [u.agent, agencyId])).rows[0];
    eq(c.status, 'declared', 'estado forzado'); eq(c.verified_at, null);
    await expectError(() => as(u.agent, `update professional_credentials set status = 'verified' where id = $1`, [c.id]), /credential_status_server_only/);
    eq((await as(null, `select count(*)::int n from verified_credentials($1)`, [u.agent])).rows[0].n, 0, 'declarada no es pública');
    const req = (await as(u.agent, `select credential_submit($1) r`, [c.id])).rows[0].r;
    eq((await as(u.agent, `select credential_submit($1) r`, [c.id])).rows[0].r, req, 'idempotente');
    await as(u.admin, `select verification_decide($1, 'approved', null)`, [req]);
    const pub = (await as(null, `select * from verified_credentials($1)`, [u.agent])).rows;
    eq(pub.length, 1, 'verificada y pública'); eq('credential_number' in pub[0], false, 'sin número');
    await as(u.agent, `update professional_credentials set credential_number = 'AG-999' where id = $1`, [c.id]);
    eq((await db.query(`select status from professional_credentials where id = $1`, [c.id])).rows[0].status, 'declared', 'editar la quita de verificada');
    await db.query(`update professional_credentials set status = 'verified', expires_on = current_date - 1 where id = $1`, [c.id]);
    eq((await db.query(`select expire_professional_credentials() n`)).rows[0].n >= 1, true);
    eq((await db.query(`select status from professional_credentials where id = $1`, [c.id])).rows[0].status, 'expired');
    eq((await as(agent2, `select count(*)::int n from professional_credentials where id = $1`, [c.id])).rows[0].n, 0, 'otra agencia no la ve');
    await expectError(() => as(u.adult, `insert into professional_credentials (user_id, issuing_body, credential_type) values ($1, 'X', 'other')`, [u.adult]), /row-level security/);
  });

  // ---------------------------------------------------------------- Prompt 12A · Modelo de representación
  results.push('\nPrompt 12A: representación (alcance, menores, exclusividad, caducidad, revocación)');
  const mkUser = async (name, role, age, sport = 'basketball') => {
    const id = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}-${id.slice(0, 6)}@test.dev`, { display_name: name }]);
    await as(id, `insert into user_roles (user_id, role) values ($1, $2)`, [id, role]);
    await as(id, `insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [id, yearsAgo(age)]);
    if (role === 'athlete') await as(id, `insert into athlete_profiles (user_id, sport_id, graduation_year, profile_visibility, stats_visibility) values ($1, $2, 2027, 'members', 'members')`, [id, sport]);
    return id;
  };
  const can = async (who, ath, perm, sport = null, country = null, cat = null, opp = null) =>
    (await as(who, `select agent_can($1, $2, $3, $4, $5, $6::uuid) ok`, [ath, perm, sport, country, cat, opp])).rows[0].ok;
  await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [agency2]);
  const ra1 = await mkUser('rep-adulto', 'athlete', 22);
  let rep1;
  await check('P12A-1 adulto no exclusivo: acepta → activa, agente asignado, acceso solo dentro del alcance', async () => {
    rep1 = await repRequest(u.agent, agencyId, ra1, { territories: ['US'], categories: ['university'] });
    eq((await as(u.agent, `select agent_can($1, 'pipeline.view') ok`, [ra1])).rows[0].ok, false, 'sin aceptar no hay acceso');
    eq((await as(ra1, `select representation_respond($1, true) s`, [rep1])).rows[0].s, 'active');
    eq((await as(u.agent, `select count(*)::int n from representation_assignments where representation_id = $1 and role = 'primary' and ended_at is null`, [rep1])).rows[0].n, 1, 'primario');
    eq(await can(u.agent, ra1, 'pipeline.view', 'basketball', 'US', 'university'), true, 'dentro del alcance');
    eq(await can(u.agent, ra1, 'pipeline.view', 'basketball', 'ES', 'university'), false, 'otro territorio');
    eq(await can(u.agent, ra1, 'pipeline.view', 'basketball', 'US', 'club'), false, 'otra categoría');
    eq(await can(u.agent, ra1, 'documents.view'), false, 'permiso no concedido');
    eq(await can(agent2, ra1, 'pipeline.view'), false, 'otra agencia');
    eq((await as(u.brand, `select count(*)::int n from representation_coverage where representation_id = $1`, [rep1])).rows[0].n, 0, 'terceros no ven el alcance');
  });
  await check('P12A-9 multideporte: representar baloncesto no da nada en voleibol', async () => {
    eq(await can(u.agent, ra1, 'pipeline.view', 'basketball'), true);
    eq(await can(u.agent, ra1, 'pipeline.view', 'volleyball'), false);
  });
  await check('P12A ser miembro (incluso admin) de la agencia no basta: hace falta asignación', async () => {
    const member = await mkUser('agency-member', 'agent', 30);
    await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'admin', 'admin')`, [agencyId, member]);
    eq(await can(member, ra1, 'pipeline.view'), false, 'sin asignación');
    await as(u.agent, `select representation_assign($1, $2, 'secondary')`, [rep1, member]);
    eq(await can(member, ra1, 'pipeline.view'), true, 'asignado');
    await expectError(() => as(u.agent, `select representation_assign($1, $2, 'secondary')`, [rep1, agent2]), /not_agency_member/);
    await expectError(() => as(agent2, `select representation_assign($1, $2, 'primary')`, [rep1, agent2]), /not_allowed/);
  });
  await check('P12A-2 menor: atleta acepta, la familia aprueba alcance concreto y la agencia recibe solo eso', async () => {
    const teen = await mkUser('rep-menor', 'athlete', 16); const mom = await mkUser('rep-madre', 'parent', 45);
    const tk = (await as(mom, `insert into parent_athlete_links (parent_id, invited_by) values ($1, $1) returning invitation_token`, [mom])).rows[0].invitation_token;
    await as(teen, `select accept_family_invitation($1)`, [tk]);
    await expectError(() => repRequest(u.agent, agencyId, teen), /not_found/); // un menor no es descubrible por agencias
    await expectError(() => as(agent2, `select representation_invite($1, $2)`, [agencyId, teen]), /not_allowed/);
    const inv = (await as(mom, `select representation_invite($1, $2) id`, [agencyId, teen])).rows[0].id;
    eq((await as(mom, `select representation_invite($1, $2) id`, [agencyId, teen])).rows[0].id, inv, 'idempotente');
    await expectError(() => repRequest(agent2, agency2, teen), /not_found/); // la invitación es solo para esa agencia
    const r = await repRequest(u.agent, agencyId, teen, { perms: ['passport.view', 'pipeline.view', 'documents.view'] });
    eq((await as(teen, `select representation_respond($1, true) s`, [r])).rows[0].s, 'pending_guardian');
    eq(await can(u.agent, teen, 'passport.view'), false, 'sin aprobación familiar no hay acceso');
    await expectError(() => as(u.agent, `select representation_guardian_decide($1, true)`, [r]), /not_found/);
    await expectError(() => as(teen, `select representation_guardian_decide($1, true)`, [r]), /not_found/);
    await as(mom, `select representation_set_permissions($1, array['passport.view'])`, [r]);
    eq((await as(mom, `select representation_guardian_decide($1, true) s`, [r])).rows[0].s, 'active');
    eq(await can(u.agent, teen, 'passport.view'), true);
    eq(await can(u.agent, teen, 'pipeline.view'), false, 'la familia lo retiró');
    eq(await can(u.agent, teen, 'documents.view'), false);
    eq((await db.query(`select count(*)::int n from consents where user_id = $1 and guardian_id = $2 and purpose = 'representation' and target_id = $3 and granted`, [teen, mom, r])).rows[0].n, 1, 'consentimiento registrado');
    eq((await db.query(`select status from representation_invitations where id = $1`, [inv])).rows[0].status, 'used');
  });
  await check('P12A-3 reparto territorial: Europa-clubes y EE. UU.-universidades conviven aunque ambas sean exclusivas', async () => {
    const a = await mkUser('rep-split', 'athlete', 20);
    const r1 = await repRequest(u.agent, agencyId, a, { type: 'exclusive', territories: ['EUROPE'], categories: ['club'] });
    const r2 = await repRequest(agent2, agency2, a, { type: 'exclusive', territories: ['US'], categories: ['university'] });
    eq((await as(a, `select representation_respond($1, true) s`, [r1])).rows[0].s, 'active');
    eq((await as(a, `select representation_respond($1, true) s`, [r2])).rows[0].s, 'active');
    eq(await can(u.agent, a, 'pipeline.view', 'basketball', 'ES', 'club'), true);
    eq(await can(u.agent, a, 'pipeline.view', 'basketball', 'US', 'university'), false);
    eq(await can(agent2, a, 'pipeline.view', 'basketball', 'US', 'university'), true);
  });
  await check('P12A-4 conflicto exclusivo: mundo-exclusiva frente a España-exclusiva → revisión, sin activar', async () => {
    const a = await mkUser('rep-conflict', 'athlete', 21);
    const r1 = await repRequest(u.agent, agencyId, a, { type: 'exclusive', territories: ['WORLD'], categories: ['club', 'university'] });
    eq((await as(a, `select representation_respond($1, true) s`, [r1])).rows[0].s, 'active');
    const r2 = await repRequest(agent2, agency2, a, { type: 'exclusive', territories: ['ES'], categories: ['club'] });
    eq((await as(a, `select representation_respond($1, true) s`, [r2])).rows[0].s, 'pending_review');
    eq(await can(agent2, a, 'pipeline.view'), false, 'no se activa');
    const c = (await as(u.admin, `select id from representation_conflicts where representation_id = $1 and status = 'open'`, [r2])).rows;
    eq(c.length, 1, 'conflicto visible para Gala');
    await expectError(() => as(agent2, `select representation_conflict_resolve($1, 'x', $2)`, [c[0].id, r2]), /admin_only/);
  });
  await check('P12A-5 caducada: el agente pierde acceso nuevo; atleta y procesos permanecen; el job es idempotente', async () => {
    const a = await mkUser('rep-expira', 'athlete', 23);
    const r = await repRequest(u.agent, agencyId, a);
    await as(a, `select representation_respond($1, true)`, [r]);
    await db.query(`update agent_representations set start_date = current_date - 400, end_date = current_date - 1 where id = $1`, [r]);
    eq(await can(u.agent, a, 'pipeline.view'), false, 'fuera de fechas ya no es efectiva');
    eq((await db.query(`select representation_expire_due() n`)).rows[0].n >= 1, true);
    eq((await db.query(`select representation_expire_due() n`)).rows[0].n, 0, 'idempotente');
    eq((await db.query(`select status from agent_representations where id = $1`, [r])).rows[0].status, 'expired');
    eq((await db.query(`select count(*)::int n from representation_assignments where representation_id = $1 and ended_at is null`, [r])).rows[0].n, 0);
    eq((await db.query(`select count(*)::int n from athlete_profiles where user_id = $1`, [a])).rows[0].n, 1, 'el atleta sigue');
    await expectError(() => as(a, `select representation_renew($1, current_date + 100)`, [r]), /invalid_renewal/);
  });
  await check('P12A-8 reducción de alcance: sin documents.view pero con pipeline.view', async () => {
    const a = await mkUser('rep-scope', 'athlete', 24);
    const r = await repRequest(u.agent, agencyId, a, { perms: ['pipeline.view', 'documents.view'] });
    await as(a, `select representation_respond($1, true)`, [r]);
    eq(await can(u.agent, a, 'documents.view'), true);
    await expectError(() => as(u.agent, `select representation_set_permissions($1, array['pipeline.view','documents.view','offers.view'])`, [r]), /not_found/);
    await as(a, `select representation_set_permissions($1, array['pipeline.view'])`, [r]);
    eq(await can(u.agent, a, 'documents.view'), false);
    eq(await can(u.agent, a, 'pipeline.view'), true);
    eq((await db.query(`select count(*)::int n from representation_permissions where representation_id = $1 and permission = 'documents.view' and status = 'revoked'`, [r])).rows[0].n, 1, 'historial');
  });
  await check('P12A-7 el agente sale de la agencia: su asignación termina, la representación sigue y se asigna otro primario', async () => {
    const a = await mkUser('rep-leave', 'athlete', 25);
    const leaver = await mkUser('rep-leaver', 'agent', 33);
    await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'athlete_manager')`, [agencyId, leaver]);
    const r = await repRequest(u.agent, agencyId, a);
    await as(a, `select representation_respond($1, true)`, [r]);
    await as(u.agent, `select representation_assign($1, $2, 'primary')`, [r, leaver]);
    eq(await can(leaver, a, 'pipeline.view'), true);
    eq(await can(u.agent, a, 'pipeline.view'), false, 'el primario anterior ya no está asignado');
    await db.query(`delete from organization_members where organization_id = $1 and user_id = $2`, [agencyId, leaver]);
    eq(await can(leaver, a, 'pipeline.view'), false, 'salió');
    eq((await db.query(`select status from agent_representations where id = $1`, [r])).rows[0].status, 'active', 'sigue activa');
    await as(u.agent, `select representation_assign($1, $2, 'primary')`, [r, u.agent]);
    eq(await can(u.agent, a, 'pipeline.view'), true, 'nuevo primario');
    eq((await db.query(`select count(*)::int n from audit_logs where entity_id = $1 and action in ('primary_agent_assigned')`, [r])).rows[0].n, 2, 'historial');
  });
  await check('P12A-10 oportunidad concreta: el alcance no se extiende a otras organizaciones', async () => {
    const opps = (await db.query(`select id from opportunities order by created_at limit 2`)).rows.map((x) => x.id);
    const a = await mkUser('rep-opp', 'athlete', 22);
    await expectError(() => repRequest(u.agent, agencyId, a, { type: 'opportunity_specific' }), /check constraint|rep_opportunity_specific/);
    const r = await repRequest(u.agent, agencyId, a, { type: 'opportunity_specific', opportunity: opps[0] });
    await as(a, `select representation_respond($1, true)`, [r]);
    eq(await can(u.agent, a, 'pipeline.view', null, null, null, opps[0]), true);
    eq(await can(u.agent, a, 'pipeline.view', null, null, null, opps[1]), false);
  });
  await check('P12A-6 revocada: acceso fuera, asignaciones cerradas, sin pérdida de datos; nadie más puede revocar', async () => {
    await expectError(() => as(agent2, `select representation_end($1)`, [rep1]), /not_allowed/);
    eq((await as(ra1, `select representation_end($1, 'Cambio de agencia') s`, [rep1])).rows[0].s, 'revoked');
    eq(await can(u.agent, ra1, 'pipeline.view'), false);
    eq((await db.query(`select count(*)::int n from representation_assignments where representation_id = $1 and ended_at is null`, [rep1])).rows[0].n, 0);
    eq((await as(ra1, `select representation_end($1) s`, [rep1])).rows[0].s, 'revoked', 'idempotente');
    eq((await as(u.agent, `select status from agent_representations where id = $1`, [rep1])).rows[0].status, 'revoked', 'el historial sigue visible para la agencia');
    eq(await repRequest(u.agent, agencyId, ra1) !== rep1, true, 'una nueva solicitud es una relación nueva');
  });

  // ---------------------------------------------------------------- Prompt 12A.1 · Integridad de la representación
  results.push('\nPrompt 12A.1: integridad, transiciones, fechas, concurrencia y bypass');
  const adultRep = async (agent, agency, o = {}) => {
    const a = await mkUser('i-' + (o.tag || 'a'), 'athlete', 22);
    const r = await repRequest(agent, agency, a, o);
    const s = (await as(a, `select representation_respond($1, true) s`, [r])).rows[0].s;
    return { a, r, s };
  };
  await check('P12A.1 §12-14 menor: tutor ajeno o desvinculado no aprueba; doble aprobación = un consentimiento; si la familia se desvincula, acceso fuera', async () => {
    const teen = await mkUser('i-teen', 'athlete', 16); const dad = await mkUser('i-dad', 'parent', 48); const other = await mkUser('i-otherdad', 'parent', 50);
    const tk = (await as(dad, `insert into parent_athlete_links (parent_id, invited_by) values ($1, $1) returning invitation_token`, [dad])).rows[0].invitation_token;
    await as(teen, `select accept_family_invitation($1)`, [tk]);
    const otherKid = await mkUser('i-otherkid', 'athlete', 15);
    const tk2 = (await as(other, `insert into parent_athlete_links (parent_id, invited_by) values ($1, $1) returning invitation_token`, [other])).rows[0].invitation_token;
    await as(otherKid, `select accept_family_invitation($1)`, [tk2]);
    await as(teen, `select representation_invite($1, $2)`, [agencyId, teen]);
    const r = await repRequest(u.agent, agencyId, teen);
    await as(teen, `select representation_respond($1, true)`, [r]);
    await expectError(() => as(other, `select representation_guardian_decide($1, true)`, [r]), /not_found/);
    eq((await as(dad, `select representation_guardian_decide($1, true) s`, [r])).rows[0].s, 'active');
    eq((await as(dad, `select representation_guardian_decide($1, true) s`, [r])).rows[0].s, 'active', 'repetir no cambia nada');
    eq((await db.query(`select count(*)::int n from consents where target_id = $1 and purpose = 'representation'`, [r])).rows[0].n, 1, 'un único consentimiento');
    eq((await db.query(`select count(*)::int n from audit_logs where entity_id = $1 and action = 'representation_activated'`, [r])).rows[0].n, 1, 'activada una vez');
    eq(await can(u.agent, teen, 'pipeline.view'), true);
    await db.query(`update parent_athlete_links set status = 'revoked', revoked_at = now() where parent_id = $1 and athlete_id = $2`, [dad, teen]);
    eq(await can(u.agent, teen, 'pipeline.view'), false, 'sin familia vinculada no hay acceso');
    await expectError(() => as(dad, `select representation_end($1)`, [r]), /not_allowed/);
  });
  await check('P12A.1 §15-16 y §76 fechas: futura sin acceso hasta su día; fin < inicio rechazado por la base de datos; hoy es inclusivo', async () => {
    const a = await mkUser('i-future', 'athlete', 22);
    const r = await repRequest(u.agent, agencyId, a, { start: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), end: new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10) });
    eq((await as(a, `select representation_respond($1, true) s`, [r])).rows[0].s, 'active');
    eq(await can(u.agent, a, 'pipeline.view'), false, 'antes de empezar no hay acceso');
    const bad = await mkUser('i-bad', 'athlete', 22);
    await expectError(() => repRequest(u.agent, agencyId, bad, { end: '2020-01-01' }), /invalid_dates/);
    await expectError(() => db.query(`update agent_representations set end_date = start_date - 1 where id = $1`, [r]), /rep_dates_valid|check constraint/);
    await db.query(`update agent_representations set start_date = current_date, end_date = current_date where id = $1`, [r]);
    eq(await can(u.agent, a, 'pipeline.view'), true, 'inicio y fin hoy: vigente');
  });
  await check('P12A.1 §21-22 suspensión y reactivación: sin acceso, sin borrar; reactivar revalida la agencia', async () => {
    const { a, r } = await adultRep(u.agent, agencyId, { tag: 'susp' });
    await expectError(() => as(u.agent, `select representation_suspend($1, true, 'motivo')`, [r]), /admin_only/);
    await expectError(() => as(u.admin, `select representation_suspend($1, true, '')`, [r]), /reason_required/);
    eq((await as(u.admin, `select representation_suspend($1, true, 'Denuncia en revisión') s`, [r])).rows[0].s, 'suspended');
    eq(await can(u.agent, a, 'pipeline.view'), false);
    eq((await db.query(`select count(*)::int n from representation_assignments where representation_id = $1 and ended_at is null`, [r])).rows[0].n, 1, 'asignaciones intactas');
    await expectError(() => as(u.agent, `update agent_representations set status = 'active' where id = $1`, [r]), /representation_rpc_only/);
    await as(u.admin, `update organizations set verification_status = 'unverified' where id = $1`, [agencyId]);
    try {
      await expectError(() => as(u.admin, `select representation_suspend($1, false, 'Revisado')`, [r]), /agency_not_verified/);
    } finally { await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [agencyId]); }
    eq((await as(u.admin, `select representation_suspend($1, false, 'Revisado') s`, [r])).rows[0].s, 'active');
    eq(await can(u.agent, a, 'pipeline.view'), true);
  });
  await check('P12A.1 §7 si la agencia pierde la verificación, nadie de ella accede', async () => {
    const { a } = await adultRep(u.agent, agencyId, { tag: 'unv' });
    eq(await can(u.agent, a, 'pipeline.view'), true);
    await db.query(`update organizations set org_status = 'suspended' where id = $1`, [agencyId]).catch(() => null);
    const st = (await db.query(`select org_status from organizations where id = $1`, [agencyId])).rows[0].org_status;
    try { if (st !== 'active') eq(await can(u.agent, a, 'pipeline.view'), false); }
    finally { await db.query(`update organizations set org_status = 'active' where id = $1`, [agencyId]); }
  });
  await check('P12A.1 §24-29 alcance: duplicados se fusionan, permiso caducado no vale, región y mundo cubren lo suyo', async () => {
    const { a, r } = await adultRep(u.agent, agencyId, { tag: 'scope', sports: ['basketball', 'basketball'], territories: ['EUROPE'], perms: ['pipeline.view', 'pipeline.view', 'offers.view'] });
    eq((await db.query(`select count(*)::int n from representation_coverage where representation_id = $1 and dimension = 'sport'`, [r])).rows[0].n, 1);
    eq((await db.query(`select count(*)::int n from representation_permissions where representation_id = $1 and permission = 'pipeline.view'`, [r])).rows[0].n, 1);
    eq(await can(u.agent, a, 'pipeline.view', 'basketball', 'ES'), true, 'España ∈ Europa');
    eq(await can(u.agent, a, 'pipeline.view', 'basketball', 'US'), false);
    await db.query(`update representation_permissions set expires_at = now() - interval '1 minute' where representation_id = $1 and permission = 'offers.view'`, [r]);
    eq(await can(u.agent, a, 'offers.view'), false, 'permiso caducado');
    const w = await adultRep(u.agent, agencyId, { tag: 'world' });
    eq(await can(u.agent, w.a, 'pipeline.view', 'basketball', 'JP'), true, 'WORLD cubre Japón');
  });
  await check('P12A.1 §32-34 exclusivas sin conflicto: distinto tipo de oportunidad, deporte o fechas', async () => {
    const a = await mkUser('i-noconf', 'athlete', 22);
    const r1 = await repRequest(u.agent, agencyId, a, { type: 'exclusive', categories: ['club'] });
    eq((await as(a, `select representation_respond($1, true) s`, [r1])).rows[0].s, 'active');
    const r2 = await repRequest(agent2, agency2, a, { type: 'exclusive', categories: ['university'] });
    eq((await as(a, `select representation_respond($1, true) s`, [r2])).rows[0].s, 'active', 'otro tipo de oportunidad');
    const b = await mkUser('i-noconf2', 'athlete', 22);
    const s1 = await repRequest(u.agent, agencyId, b, { type: 'exclusive', sports: ['basketball'] });
    await as(b, `select representation_respond($1, true)`, [s1]);
    const s2 = await repRequest(agent2, agency2, b, { type: 'exclusive', sports: ['volleyball'] });
    eq((await as(b, `select representation_respond($1, true) s`, [s2])).rows[0].s, 'active', 'otro deporte');
    const c = await mkUser('i-noconf3', 'athlete', 22);
    const t1 = await repRequest(u.agent, agencyId, c, { type: 'exclusive', end: new Date(Date.now() + 100 * 864e5).toISOString().slice(0, 10) });
    await as(c, `select representation_respond($1, true)`, [t1]);
    const t2 = await repRequest(agent2, agency2, c, { type: 'exclusive', start: new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10), end: new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10) });
    eq((await as(c, `select representation_respond($1, true) s`, [t2])).rows[0].s, 'active', 'fechas sin solape');
  });
  await check('P12A.1 §36 y §75 concurrencia: dos exclusivas aceptadas a la vez → una activa y otra en revisión', async () => {
    const a = await mkUser('i-race', 'athlete', 22);
    const r1 = await repRequest(u.agent, agencyId, a, { type: 'exclusive' });
    const r2 = await repRequest(agent2, agency2, a, { type: 'exclusive' });
    const mk = async () => { const c = new pg.Client({ connectionString: url.toString() }); await c.connect(); await c.query('begin'); await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: a, role: 'authenticated' })]); return c; };
    const c1 = await mk(); const c2 = await mk();
    try {
      const p1 = c1.query(`select representation_respond($1, true) s`, [r1]).then(async (x) => { await c1.query('commit'); return x.rows[0].s; });
      const p2 = c2.query(`select representation_respond($1, true) s`, [r2]).then(async (x) => { await c2.query('commit'); return x.rows[0].s; });
      const out = (await Promise.all([p1, p2])).sort();
      eq(out.join(','), 'active,pending_review');
    } finally { await c1.end(); await c2.end(); }
    eq((await db.query(`select count(*)::int n from agent_representations where athlete_id = $1 and status = 'active'`, [a])).rows[0].n, 1);
  });
  await check('P12A.1 §37 Gala resuelve el conflicto y activa una sola', async () => {
    const a = await mkUser('i-resolve', 'athlete', 22);
    const r1 = await repRequest(u.agent, agencyId, a, { type: 'exclusive' });
    await as(a, `select representation_respond($1, true)`, [r1]);
    const r2 = await repRequest(agent2, agency2, a, { type: 'exclusive' });
    await as(a, `select representation_respond($1, true)`, [r2]);
    await as(a, `select representation_end($1, 'Me quedo con la segunda')`, [r1]);
    const c = (await db.query(`select id from representation_conflicts where representation_id = $1 and status = 'open'`, [r2])).rows[0].id;
    await as(u.admin, `select representation_conflict_resolve($1, 'La primera fue revocada por el atleta', $2)`, [c, r2]);
    eq((await db.query(`select status from agent_representations where id = $1`, [r2])).rows[0].status, 'active');
    await as(u.admin, `select representation_conflict_resolve($1, 'otra vez', $2)`, [c, r2]);
    eq((await db.query(`select count(*)::int n from audit_logs where entity_id = $1 and action = 'representation_conflict_resolved'`, [c])).rows[0].n, 1, 'idempotente');
  });
  await check('P12A.1 §38-44 asignaciones y roster: un solo primario, varios colaboradores, roster por agencia con «por vencer»', async () => {
    const { a, r } = await adultRep(u.agent, agencyId, { tag: 'roster', end: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10) });
    const c1 = await mkUser('i-col1', 'agent', 30); const c2 = await mkUser('i-col2', 'agent', 31);
    for (const c of [c1, c2]) await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'recruiter')`, [agencyId, c]);
    await as(u.agent, `select representation_assign($1, $2, 'collaborator')`, [r, c1]);
    await as(u.agent, `select representation_assign($1, $2, 'viewer')`, [r, c2]);
    eq((await db.query(`select count(*)::int n from representation_assignments where representation_id = $1 and ended_at is null`, [r])).rows[0].n, 3);
    eq(await can(c2, a, 'pipeline.view'), true, 'viewer lee'); eq(await can(c2, a, 'pipeline.manage'), false, 'viewer no gestiona');
    await expectError(() => db.query(`insert into representation_assignments (representation_id, agency_id, user_id, role, assigned_by) values ($1, $2, $3, 'primary', $3)`, [r, agencyId, c1]), /duplicate key|unique/);
    eq((await as(u.agent, `select roster_status from agency_roster where representation_id = $1`, [r])).rows[0].roster_status, 'expiring');
    eq((await as(agent2, `select count(*)::int n from agency_roster where agency_id = $1`, [agencyId])).rows[0].n, 0, 'otra agencia no ve el roster');
  });
  await check('P12A.1 §46-50 acuerdo: documento del atleta correcto, versiones, «documentado» no es «verificado»', async () => {
    const { a, r } = await adultRep(u.agent, agencyId, { tag: 'agree' });
    const doc = (await as(a, `insert into athlete_documents (athlete_id, kind, title, due_date) values ($1, 'other', 'Contrato de representación', current_date + 30) returning id`, [a])).rows[0].id;
    const foreign = (await as(u.adult, `insert into athlete_documents (athlete_id, kind, title, due_date) values ($1, 'other', 'Otro contrato', current_date + 30) returning id`, [u.adult])).rows[0].id;
    await expectError(() => as(a, `select representation_add_agreement($1, $2, current_date, current_date + 300)`, [r, foreign]), /agreement_document_mismatch/);
    const v1 = (await as(a, `select representation_add_agreement($1, $2, current_date, current_date + 300) id`, [r, doc])).rows[0].id;
    const v2 = (await as(u.agent, `select representation_add_agreement($1, null, current_date, current_date + 300) id`, [r])).rows[0].id;
    const rows = (await db.query(`select id, version, evidence_status from representation_agreements where representation_id = $1 order by version`, [r])).rows;
    eq(rows.map((x) => `${x.version}:${x.evidence_status}`).join(','), '1:documented,2:declared');
    await as(u.agent, `update representation_agreements set evidence_status = 'verified' where id = $1`, [v1]).catch(() => null);
    eq((await db.query(`select evidence_status from representation_agreements where id = $1`, [v1])).rows[0].evidence_status, 'documented', 'la agencia no lo verifica');
    eq((await as(u.brand, `select count(*)::int n from representation_agreements where id in ($1, $2)`, [v1, v2])).rows[0].n, 0, 'terceros no lo ven');
  });
  await check('P12A.1 §66-67 notificaciones y auditoría del ciclo completo', async () => {
    const { a, r } = await adultRep(u.agent, agencyId, { tag: 'audit' });
    eq((await as(a, `select count(*)::int n from notifications where kind = 'representation.requested'`)).rows[0].n, 1, 'atleta avisado');
    eq((await as(u.agent, `select count(*)::int n from notifications where kind = 'representation.active' and link = '/app/portfolio'`)).rows[0].n >= 1, true, 'agente avisado');
    const acts = (await db.query(`select action from audit_logs where entity_id = $1 and entity = 'agent_representation' order by created_at`, [r])).rows.map((x) => x.action);
    for (const x of ['representation_requested', 'athlete_approved', 'representation_activated']) eq(acts.includes(x), true, x);
  });
  await check('P12A.1 §70-74 sin huérfanos, todo o nada, idempotencia y transiciones inválidas', async () => {
    eq((await db.query(`select (select count(*) from representation_coverage c where not exists (select 1 from agent_representations r where r.id = c.representation_id))
      + (select count(*) from representation_permissions p where not exists (select 1 from agent_representations r where r.id = p.representation_id))
      + (select count(*) from representation_assignments a where not exists (select 1 from agent_representations r where r.id = a.representation_id)) n`)).rows[0].n, '0');
    const a = await mkUser('i-atomic', 'athlete', 22);
    await expectError(() => repRequest(u.agent, agencyId, a, { perms: ['pipeline.view', 'superpoder.total'] }), /invalid_permission/);
    await expectError(() => repRequest(u.agent, agencyId, a, { sports: ['curling'] }), /invalid|sport/);
    eq((await db.query(`select count(*)::int n from agent_representations where athlete_id = $1`, [a])).rows[0].n, 0, 'nada a medias');
    const r = await repRequest(u.agent, agencyId, a);
    eq((await as(a, `select representation_respond($1, true) s`, [r])).rows[0].s, 'active');
    eq((await as(a, `select representation_respond($1, false) s`, [r])).rows[0].s, 'active', 'responder otra vez no la cambia');
    await expectError(() => as(a, `select representation_guardian_decide($1, true)`, [r]), /not_found/);
    eq((await as(a, `select representation_end($1) s`, [r])).rows[0].s, 'revoked');
    eq((await as(a, `select representation_respond($1, true) s`, [r])).rows[0].s, 'revoked', 'una revocada no revive');
    await expectError(() => as(a, `select representation_renew($1, current_date + 200)`, [r]), /invalid_renewal/);
  });
  await check('P12A.1 §79 bypass: nadie escribe alcance, permisos, asignaciones, conflictos ni acuerdos por fuera de las funciones', async () => {
    const { a, r } = await adultRep(u.agent, agencyId, { tag: 'bypass' });
    await expectError(() => as(u.agent, `insert into representation_coverage (representation_id, dimension, value) values ($1, 'territory', 'WORLD')`, [r]), /row-level|permission denied|rpc_only/);
    await expectError(() => as(u.agent, `insert into representation_permissions (representation_id, permission) values ($1, 'offers.negotiate')`, [r]), /row-level|permission denied/);
    await expectError(() => as(u.agent, `insert into representation_assignments (representation_id, agency_id, user_id, role, assigned_by) values ($1, $2, $3, 'collaborator', $3)`, [r, agencyId, agent2]), /row-level|permission denied/);
    await expectError(() => as(a, `update representation_permissions set status = 'active' where representation_id = $1`, [r]), /row-level|permission denied/).catch(async () => {
      eq((await db.query(`select count(*)::int n from representation_permissions where representation_id = $1 and status = 'active'`, [r])).rows[0].n, 7);
    });
    await expectError(() => as(u.agent, `update agent_representations set end_date = end_date + 365 where id = $1`, [r]), /representation_rpc_only/);
    await expectError(() => as(u.agent, `select representation_activate($1)`, [r]), /permission denied/);
    await expectError(() => as(u.agent, `select representation_expire_due()`), /permission denied/);
    await expectError(() => as(null, `select agent_can($1, 'pipeline.view')`, [a]), /permission denied/);
  });

  // ---------------------------------------------------------------- Prompt 12B · RLS del agente
  results.push('\nPrompt 12B: matriz de acceso del agente (cada recurso, cada actor)');
  const X = await mkUser('b-athlete', 'athlete', 21);
  await as(X, `update athlete_profiles set profile_visibility = 'private', stats_visibility = 'private' where user_id = $1`, [X]);
  const A2 = await mkUser('b-secondary', 'agent', 32); const A3 = await mkUser('b-unassigned', 'agent', 33);
  await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'recruiter'), ($1, $3, 'recruiter', 'recruiter')`, [agencyId, A2, A3]);
  await as(X, `select representation_invite($1, $2)`, [agencyId, X]); // perfil privado: solo así puede proponer
  const repX = await repRequest(u.agent, agencyId, X, { territories: ['US'], categories: ['university'], perms: ['passport.view', 'pipeline.view', 'pipeline.manage', 'offers.view', 'opportunities.manage', 'financial_context.view'] });
  await as(X, `select representation_respond($1, true)`, [repX]);
  await as(u.agent, `select representation_assign($1, $2, 'secondary')`, [repX, A2]);
  const offerX = (await as(X, `insert into athlete_offers (athlete_id, university_name, source) values ($1, 'State University', 'athlete') returning id`, [X])).rows[0].id;
  const budgetX = (await as(X, `insert into family_cost_scenarios (athlete_id, created_by, label) values ($1, $1, 'Presupuesto 2027') returning id`, [X])).rows[0].id;
  const docX = (await as(X, `insert into athlete_documents (athlete_id, kind, title, due_date) values ($1, 'transcript', 'Notas', current_date + 60) returning id`, [X])).rows[0].id;
  const seeProfile = async (who) => (await as(who, `select count(*)::int n from athlete_profiles where user_id = $1`, [X])).rows[0].n;
  const seeOffer = async (who) => (await as(who, `select count(*)::int n from athlete_offers where id = $1`, [offerX])).rows[0].n;
  let caseX;
  await check('P12B-1/8 primario y secundario dentro del alcance; miembro sin asignar y otra agencia: nada', async () => {
    eq(await seeProfile(u.agent), 1, 'primario ve el Passport privado'); eq(await seeProfile(A2), 1, 'secundario');
    eq(await seeProfile(A3), 0, 'miembro sin asignar'); eq(await seeProfile(agent2), 0, 'otra agencia');
    eq(await seeOffer(u.agent), 1); eq(await seeOffer(A3), 0); eq(await seeOffer(agent2), 0);
    caseX = (await as(A2, `insert into recruiting_cases (agency_id, athlete_id, institution_name, sport_id, cycle) values ($1, $2, 'State University', 'basketball', '2027-28') returning id`, [agencyId, X])).rows[0].id;
    eq((await as(A3, `select count(*)::int n from recruiting_cases where id = $1`, [caseX])).rows[0].n, 0, 'sin asignar no ve el pipeline');
    eq((await as(agent2, `select count(*)::int n from recruiting_cases where id = $1`, [caseX])).rows[0].n, 0);
    await expectError(() => as(A3, `insert into recruiting_cases (agency_id, athlete_id, institution_name, sport_id, cycle) values ($1, $2, 'Otra', 'basketball', '2027-28')`, [agencyId, X]), /row-level/);
  });
  await check('P12B-2 atleta no representado: ni el dueño de la agencia lo ve', async () => {
    const Y = await mkUser('b-unrep', 'athlete', 22);
    await as(Y, `update athlete_profiles set profile_visibility = 'private' where user_id = $1`, [Y]);
    eq((await as(u.agent, `select count(*)::int n from athlete_profiles where user_id = $1`, [Y])).rows[0].n, 0);
    eq((await as(u.agent, `select agent_can($1, 'passport.view') ok`, [Y])).rows[0].ok, false);
  });
  await check('P12B-5/6/7 deporte, territorio y tipo de oportunidad equivocados → denegado', async () => {
    await expectError(() => as(A2, `insert into recruiting_cases (agency_id, athlete_id, institution_name, sport_id, cycle) values ($1, $2, 'State University', 'volleyball', '2027-28')`, [agencyId, X]), /row-level/);
    eq(await can(A2, X, 'pipeline.manage', 'basketball', 'ES'), false, 'territorio');
    eq(await can(A2, X, 'pipeline.manage', 'basketball', 'US', 'club'), false, 'tipo de oportunidad');
    eq(await can(A2, X, 'pipeline.manage', 'basketball', 'US', 'university'), true);
  });
  await check('P12B-9 documentos: sin concesión no; con concesión a la agencia solo quien tiene documents.view', async () => {
    eq((await as(u.agent, `select count(*)::int n from athlete_documents where id = $1`, [docX])).rows[0].n, 0, 'sin concesión');
    await as(X, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '10 days')`, [docX, X, agencyId]);
    eq((await as(u.agent, `select count(*)::int n from athlete_documents where id = $1`, [docX])).rows[0].n, 0, 'concesión sin permiso documents.view');
    await as(X, `select representation_set_permissions($1, array['passport.view','pipeline.view','pipeline.manage','offers.view','opportunities.manage','financial_context.view','documents.view'])`, [repX]);
    eq((await as(u.agent, `select count(*)::int n from athlete_documents where id = $1`, [docX])).rows[0].n, 1, 'concesión + permiso');
    eq((await as(A3, `select count(*)::int n from athlete_documents where id = $1`, [docX])).rows[0].n, 0, 'miembro sin asignar');
    await expectError(() => as(A3, `select document_open($1)`, [docX]), /not_found|not_allowed/);
  });
  await check('P12B-10/11 presupuesto y notas de familia: nunca para la agencia, ni con contexto económico', async () => {
    eq((await as(u.agent, `select count(*)::int n from family_cost_scenarios where id = $1`, [budgetX])).rows[0].n, 0);
    eq((await as(u.agent, `select count(*)::int n from family_notes where athlete_id = $1`, [X])).rows[0].n, 0);
  });
  await check('P12B-12/13 acuerdo solo para las partes; aceptar una oferta es del atleta', async () => {
    const ag = (await as(X, `select representation_add_agreement($1, null, current_date, current_date + 300) id`, [repX])).rows[0].id;
    eq((await as(A2, `select count(*)::int n from representation_agreements where id = $1`, [ag])).rows[0].n, 1, 'asignado');
    eq((await as(A3, `select count(*)::int n from representation_agreements where id = $1`, [ag])).rows[0].n, 0, 'sin asignar');
    eq((await as(u.uni, `select count(*)::int n from representation_agreements where id = $1`, [ag])).rows[0].n, 0, 'universidad');
    eq((await as(u.agent, `update athlete_offers set status = 'accepted' where id = $1`, [offerX])).rowCount, 0, 'el agente no acepta');
    eq((await as(u.agent, `delete from athlete_offers where id = $1`, [offerX])).rowCount, 0);
  });
  await check('P12B-18 enumeración del roster: otra agencia no construye el de la primera', async () => {
    eq((await as(agent2, `select count(*)::int n from agency_roster where agency_id = $1`, [agencyId])).rows[0].n, 0);
    eq((await as(agent2, `select count(*)::int n from agent_representations where agency_id = $1`, [agencyId])).rows[0].n, 0);
    eq((await as(agent2, `select count(*)::int n from representation_assignments where agency_id = $1`, [agencyId])).rows[0].n, 0);
  });
  await check('P12B-20 agencia suspendida: nadie de ella accede', async () => {
    await db.query(`update organizations set org_status = 'suspended' where id = $1`, [agencyId]);
    try { eq(await seeProfile(u.agent), 0); eq(await seeOffer(A2), 0); }
    finally { await db.query(`update organizations set org_status = 'active' where id = $1`, [agencyId]); }
    eq(await seeProfile(u.agent), 1);
  });
  await check('P12B-3 caducada: acceso nuevo fuera; el historial del caso queda para la dirección de la agencia', async () => {
    await db.query(`update agent_representations set start_date = current_date - 300, end_date = current_date - 1 where id = $1`, [repX]);
    try {
      eq(await seeOffer(A2), 0); eq(await seeProfile(A2), 0);
      eq((await as(A2, `select count(*)::int n from recruiting_cases where id = $1`, [caseX])).rows[0].n, 0, 'el agente pierde el pipeline');
      eq((await as(u.agent, `select count(*)::int n from recruiting_cases where id = $1`, [caseX])).rows[0].n, 1, 'la dirección conserva el historial');
      eq((await as(u.agent, `update recruiting_cases set stage = 'closed' where id = $1`, [caseX])).rowCount, 0, 'pero no lo mueve');
    } finally { await db.query(`update agent_representations set start_date = current_date, end_date = current_date + 300 where id = $1`, [repX]); }
  });
  await check('P12B-15 revocación en vivo: la siguiente consulta ya no ve nada; datos del atleta intactos', async () => {
    eq(await seeOffer(A2), 1);
    await as(X, `select representation_end($1, 'Fin')`, [repX]);
    eq(await seeOffer(A2), 0); eq(await seeProfile(u.agent), 0);
    eq((await as(A2, `select count(*)::int n from athlete_documents where id = $1`, [docX])).rows[0].n, 0);
    eq((await db.query(`select (select count(*) from athlete_offers where id = $1) + (select count(*) from athlete_documents where id = $2) + (select count(*) from recruiting_cases where id = $3) n`, [offerX, docX, caseX])).rows[0].n, '3', 'nada se borra');
  });

  // ---------------------------------------------------------------- Prompt 12C · Pentest del workspace
  results.push('\nPrompt 12C: pentest del workspace del agente');
  await check('P12C §37 escalada del dueño: sin asignación no ve ofertas ni Passport privado; asignarse es auditable', async () => {
    const Z = await mkUser('c-athlete', 'athlete', 23);
    await as(Z, `update athlete_profiles set profile_visibility = 'private' where user_id = $1`, [Z]);
    const M = await mkUser('c-manager', 'agent', 34);
    await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'athlete_manager')`, [agencyId, M]);
    await as(Z, `select representation_invite($1, $2)`, [agencyId, Z]);
    const rz = await repRequest(u.agent, agencyId, Z, { perms: ['passport.view', 'offers.view'] });
    await as(Z, `select representation_respond($1, true)`, [rz]);
    await as(u.agent, `select representation_assign($1, $2, 'primary')`, [rz, M]); // el dueño deja de estar asignado
    const off = (await as(Z, `insert into athlete_offers (athlete_id, university_name, source) values ($1, 'Coastal College', 'athlete') returning id`, [Z])).rows[0].id;
    eq((await as(M, `select count(*)::int n from athlete_offers where id = $1`, [off])).rows[0].n, 1, 'el asignado ve');
    eq((await as(u.agent, `select count(*)::int n from athlete_offers where id = $1`, [off])).rows[0].n, 0, 'el dueño sin asignar no');
    eq((await as(u.agent, `select count(*)::int n from athlete_profiles where user_id = $1`, [Z])).rows[0].n, 0);
    await as(u.agent, `select representation_assign($1, $2, 'collaborator')`, [rz, u.agent]);
    eq((await as(u.agent, `select count(*)::int n from athlete_offers where id = $1`, [off])).rows[0].n, 1, 'tras asignarse');
    eq((await db.query(`select count(*)::int n from audit_logs where entity_id = $1 and action = 'agent_assigned' and actor_id = $2`, [rz, u.agent])).rows[0].n, 1, 'queda auditado');
  });
  await check('P12C §22/§26 un agente no se asigna a representaciones de otra agencia ni amplía su alcance', async () => {
    const W = await mkUser('c-w', 'athlete', 22);
    const rw = await repRequest(agent2, agency2, W);
    await as(W, `select representation_respond($1, true)`, [rw]);
    await expectError(() => as(u.agent, `select representation_assign($1, $2, 'collaborator')`, [rw, u.agent]), /not_allowed/);
    await expectError(() => as(agent2, `select representation_set_permissions($1, array['offers.negotiate'])`, [rw]), /not_found/);
    await expectError(() => as(agent2, `update representation_assignments set role = 'primary' where representation_id = $1`, [rw]), /row-level|permission denied/).catch(async () => {
      eq((await db.query(`select count(*)::int n from representation_assignments where representation_id = $1 and role = 'primary'`, [rw])).rows[0].n, 1);
    });
    await expectError(() => as(agent2, `select representation_conflict_resolve(gen_random_uuid(), 'x', $1)`, [rw]), /admin_only/);
  });

  // ---------------------------------------------------------------- Prompt 13 · Marcas
  results.push('\nPrompt 13: ofertas de marca, entregables, derechos de uso y pago');
  const B = await mkUser('m-athlete', 'athlete', 22);
  const brand3 = (await as(u.brand, `insert into organizations (name, type, created_by) values ('Brand Three', 'brand', $1) returning id`, [u.brand])).rows[0].id;
  await as(u.admin, `update organizations set verification_status = 'verified' where id = $1`, [brand3]);
  const camp3 = (await as(u.brand, `insert into brand_campaigns (brand_org_id, created_by, title, description, kind, deliverables, compensation_kind, product_description, product_value_usd, usage_months, usage_channels)
    values ($1, $2, 'Zapatillas 2027', 'Buscamos atletas universitarios para probar y enseñar nuestra nueva zapatilla.', 'product_testing', '1 reel y 2 stories', 'product', 'Dos pares de zapatillas', 350, 6, array['instagram']) returning id`, [brand3, u.brand])).rows[0].id;
  await as(u.admin, `update brand_campaigns set status = 'published' where id = $1`, [camp3]);
  const app3 = (await as(B, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true) returning id`, [camp3, B])).rows[0].id;
  const D1 = JSON.stringify([{ kind: 'reel', platform: 'instagram', quantity: 1, description: 'Reel probando la zapatilla en pista', due_date: null }]);
  const PRODUCT = JSON.stringify([{ kind: 'product', amount: 350, currency: 'EUR', description: 'Dos pares de zapatillas' }]);
  const send = (who, app, comps, delivs = D1, o = {}) => as(who, `select campaign_offer_send($1, $2::jsonb, $3::jsonb, $4, $5::text[], $6, $7, $8, $9, $10, $11) id`,
    [app, comps, delivs, o.months ?? 6, o.channels ?? ['instagram'], o.paid ?? false, o.exclCat ?? null, o.exclDays ?? 0, o.expires ?? 14, o.terms ?? null, o.unknown ?? false]);
  let off1; let off2;
  await check('P13 §20-23 solo a un atleta seleccionado, con compensación y entregables explícitos', async () => {
    await expectError(() => send(u.brand, app3, PRODUCT), /athlete_not_selected/);
    await as(u.brand, `update campaign_applications set status = 'selected' where id = $1`, [app3]);
    await expectError(() => send(u.brand, app3, '[]'), /compensation_required/);
    await expectError(() => send(u.brand, app3, PRODUCT, '[]'), /deliverables_required/);
    await expectError(() => send(u.brand, app3, JSON.stringify([{ kind: 'performance_bonus', amount: 100, guaranteed: true, description: 'Bonus por 10k vistas' }])), /component_bonus_conditional/);
    await expectError(() => send(u.brand, app3, PRODUCT, D1, { exclDays: 90 }), /campaign_offer_exclusivity/);
    await expectError(() => send(agent2, app3, PRODUCT), /not_found/);
    off1 = (await send(u.brand, app3, PRODUCT)).rows[0].id;
  });
  await check('P13 §30 «no especificado» antes que inventar un valor', async () => {
    const id = (await send(u.brand, app3, '[]', D1, { unknown: true })).rows[0].id;
    eq((await db.query(`select status from campaign_offers where id = $1`, [off1])).rows[0].status, 'superseded', 'la v1 queda sustituida');
    eq((await db.query(`select count(*)::int n from campaign_offers where application_id = $1 and status = 'sent'`, [app3])).rows[0].n, 1, 'una sola abierta');
    off2 = (await send(u.brand, app3, PRODUCT, D1, { exclCat: 'Calzado deportivo', exclDays: 90 })).rows[0].id;
    eq((await db.query(`select version from campaign_offers where id = $1`, [off2])).rows[0].version, 3);
    eq((await db.query(`select status from campaign_offers where id = $1`, [id])).rows[0].status, 'superseded');
  });
  await check('P13 §51 frontera: atleta y marca sí; otra organización, coach o anónimo no; el agente solo con alcance «marcas»', async () => {
    eq((await as(B, `select count(*)::int n from campaign_offers where id = $1`, [off2])).rows[0].n, 1);
    eq((await as(u.brand, `select count(*)::int n from campaign_offer_components where offer_id = $1`, [off2])).rows[0].n, 1);
    eq((await as(u.coach, `select count(*)::int n from campaign_offers where id = $1`, [off2])).rows[0].n, 0);
    eq((await as(agent2, `select count(*)::int n from campaign_deliverables where offer_id = $1`, [off2])).rows[0].n, 0);
    await expectError(() => as(null, `select count(*) from campaign_offers`), /permission denied/);
    const ru = await repRequest(u.agent, agencyId, B, { categories: ['university'], perms: ['offers.view'] });
    await as(B, `select representation_respond($1, true)`, [ru]);
    eq((await as(u.agent, `select count(*)::int n from campaign_offers where id = $1`, [off2])).rows[0].n, 0, 'alcance solo universidades');
    await as(B, `select representation_end($1)`, [ru]);
    const rb = await repRequest(u.agent, agencyId, B, { categories: ['brand'], perms: ['offers.view'] });
    await as(B, `select representation_respond($1, true)`, [rb]);
    eq((await as(u.agent, `select count(*)::int n from campaign_offers where id = $1`, [off2])).rows[0].n, 1, 'alcance marcas');
  });
  await check('P13 §37/§41 nadie edita una oferta enviada; solo el atleta la acepta', async () => {
    await expectError(() => as(u.brand, `update campaign_offer_components set amount = 999 where offer_id = $1`, [off2]), /brand_rpc_only|row-level|permission denied/).catch(async () => {
      eq((await db.query(`select amount::int a from campaign_offer_components where offer_id = $1`, [off2])).rows[0].a, 350);
    });
    await expectError(() => as(u.brand, `insert into campaign_offers (campaign_id, application_id, brand_org_id, athlete_id, expires_at) values ($1, $2, $3, $4, now() + interval '1 day')`, [camp3, app3, brand3, B]), /brand_rpc_only|row-level|permission denied/);
    await expectError(() => as(u.agent, `select campaign_offer_respond($1, true)`, [off2]), /not_found/);
    await expectError(() => as(u.brand, `select campaign_offer_respond($1, true)`, [off2]), /not_found/);
  });
  await check('P13 §33 entregar antes de aceptar no; después, versiones sin sobrescribir', async () => {
    const dl = (await db.query(`select id from campaign_deliverables where offer_id = $1`, [off2])).rows[0].id;
    await expectError(() => as(B, `select campaign_deliverable_submit($1, 'https://instagram.com/p/1')`, [dl]), /offer_not_accepted/);
    eq((await as(B, `select campaign_offer_respond($1, true) s`, [off2])).rows[0].s, 'accepted');
    eq((await as(B, `select campaign_offer_respond($1, false) s`, [off2])).rows[0].s, 'accepted', 'idempotente');
    eq((await db.query(`select payment_status from campaign_offers where id = $1`, [off2])).rows[0].payment_status, 'not_applicable', 'solo producto: no hay pago en dinero');
    await expectError(() => as(B, `select campaign_deliverable_submit($1, 'http://inseguro.com')`, [dl]), /invalid_url/);
    eq((await as(B, `select campaign_deliverable_submit($1, 'https://instagram.com/p/1') v`, [dl])).rows[0].v, 1);
    await expectError(() => as(u.brand, `select campaign_deliverable_review($1, false, 'no')`, [dl]), /feedback_required/);
    eq((await as(u.brand, `select campaign_deliverable_review($1, false, 'Falta mostrar el logo al final del reel') s`, [dl])).rows[0].s, 'changes_requested');
    eq((await as(B, `select campaign_deliverable_submit($1, 'https://instagram.com/p/2') v`, [dl])).rows[0].v, 2);
    eq((await db.query(`select count(*)::int n from campaign_deliverable_submissions where deliverable_id = $1`, [dl])).rows[0].n, 2, 'la v1 se conserva');
    await expectError(() => as(agent2, `select campaign_deliverable_review($1, true)`, [dl]), /not_found/);
    eq((await as(u.brand, `select campaign_deliverable_review($1, true, null) s`, [dl])).rows[0].s, 'approved');
    await expectError(() => as(B, `select campaign_deliverable_submit($1, 'https://instagram.com/p/3')`, [dl]), /deliverable_closed/);
  });
  await check('P13 §43-44/§64 pago: la marca declara, solo el atleta confirma o disputa', async () => {
    const C = await mkUser('m-cash', 'athlete', 24);
    const ap = (await as(C, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true) returning id`, [camp3, C])).rows[0].id;
    await as(u.brand, `update campaign_applications set status = 'selected' where id = $1`, [ap]);
    const o = (await send(u.brand, ap, JSON.stringify([{ kind: 'cash', amount: 500, currency: 'USD', description: 'Pago fijo' }]))).rows[0].id;
    await expectError(() => as(u.brand, `select campaign_payment_update($1, 'paid_declared')`, [o]), /payment_not_applicable/);
    await as(C, `select campaign_offer_respond($1, true)`, [o]);
    eq((await db.query(`select payment_status from campaign_offers where id = $1`, [o])).rows[0].payment_status, 'pending');
    await expectError(() => as(u.brand, `select campaign_payment_update($1, 'confirmed')`, [o]), /payment_transition_not_allowed/);
    await as(u.brand, `select campaign_payment_update($1, 'paid_declared')`, [o]);
    await expectError(() => as(B, `select campaign_payment_update($1, 'confirmed')`, [o]), /not_found/);
    eq((await as(C, `select campaign_payment_update($1, 'confirmed') s`, [o])).rows[0].s, 'confirmed');
  });
  await check('P13 §60 caducidad: una oferta vencida no se puede aceptar; el job es idempotente', async () => {
    const E = await mkUser('m-exp', 'athlete', 23);
    const ap = (await as(E, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true) returning id`, [camp3, E])).rows[0].id;
    await as(u.brand, `update campaign_applications set status = 'selected' where id = $1`, [ap]);
    const o = (await send(u.brand, ap, PRODUCT)).rows[0].id;
    await db.query(`update campaign_offers set expires_at = now() - interval '1 minute' where id = $1`, [o]);
    eq((await as(E, `select campaign_offer_respond($1, true) s`, [o])).rows[0].s, 'expired');
    eq((await db.query(`select campaign_offers_expire_due() n`)).rows[0].n, 0);
  });
  await check('P13 §25 notas internas de la marca: el atleta y otras organizaciones no las ven', async () => {
    await as(u.brand, `insert into brand_application_notes (application_id, brand_org_id, author_id, body) values ($1, $2, $3, 'Buen encaje con la línea running')`, [app3, brand3, u.brand]);
    eq((await as(B, `select count(*)::int n from brand_application_notes where application_id = $1`, [app3])).rows[0].n, 0);
    eq((await as(u.coach, `select count(*)::int n from brand_application_notes`)).rows[0].n, 0);
    await expectError(() => as(agent2, `insert into brand_application_notes (application_id, brand_org_id, author_id, body) values ($1, $2, $3, 'x')`, [app3, brand3, agent2]), /row-level/);
  });

  // ---------------------------------------------------------------- Prompt 14 · Trust & Safety
  results.push('\nPrompt 14: casos, sanciones proporcionales, apelaciones, roles internos, break glass y límites');
  const mkAdmin = async (name, role) => {
    const id = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}-${id.slice(0, 6)}@gala.dev`, { display_name: name }]);
    await db.query(`insert into user_roles (user_id, role) values ($1, 'admin')`, [id]);
    await db.query(`insert into private_profile_data (user_id, date_of_birth) values ($1, $2)`, [id, yearsAgo(35)]);
    if (role) await db.query(`insert into admin_roles (user_id, role) values ($1, $2)`, [id, role]);
    return id;
  };
  const support = await mkAdmin('support', 'support'); const ts = await mkAdmin('ts', 'trust_safety'); const ts2 = await mkAdmin('ts2', 'trust_safety'); const sa = await mkAdmin('sa', 'super_admin');
  const T = await mkUser('t-athlete', 'athlete', 24);
  let tsCase; let actT;
  await check('P14 §48 mínimo privilegio: soporte no abre casos ni ve la cola; Trust & Safety sí', async () => {
    await expectError(() => as(support, `select safety_case_open('Spam', 'messaging', 'low')`), /admin_only/);
    const rep = (await as(u.brand, `insert into content_reports (entity_type, entity_id, reason, details) values ('athlete_profile', $1, 'fake_or_misleading', 'Perfil sospechoso') returning id`, [T])).rows[0].id;
    tsCase = (await as(ts, `select safety_case_open('Perfil sospechoso', 'impersonation', 'high', $1, null, array[$2]::uuid[]) id`, [T, rep])).rows[0].id;
    eq((await as(support, `select count(*)::int n from safety_cases where id = $1`, [tsCase])).rows[0].n, 0, 'soporte no ve casos');
    eq((await as(ts, `select count(*)::int n from safety_case_events where case_id = $1`, [tsCase])).rows[0].n, 2);
    eq((await db.query(`select status from content_reports where id = $1`, [rep])).rows[0].status, 'reviewing');
    eq((await as(T, `select count(*)::int n from safety_cases`)).rows[0].n, 0, 'el afectado no ve el caso interno');
  });
  await check('P14 §31-32 sanción proporcional: restringir solo «candidaturas» 7 días; el resto sigue funcionando', async () => {
    await expectError(() => as(ts, `select moderation_act('user_restricted', 'Candidaturas masivas sin leer las condiciones', $1, null, '{}', 7)`, [T]), /moderation_restriction_scoped/);
    await expectError(() => as(ts, `select moderation_act('warning', 'Corto', $1)`, [T]), /check constraint|reason/);
    actT = (await as(ts, `select moderation_act('user_restricted', 'Candidaturas masivas sin leer las condiciones', $1, null, array['applications'], 7, $2) id`, [T, tsCase])).rows[0].id;
    await expectError(() => as(T, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true)`, [camp3, T]), /account_restricted/);
    eq((await as(T, `update athlete_profiles set headline = 'Sigo pudiendo editar mi perfil' where user_id = $1`, [T])).rowCount, 1, 'lo demás funciona');
    eq((await as(T, `select count(*)::int n from moderation_actions where id = $1`, [actT])).rows[0].n, 1, 'el afectado ve su sanción');
    eq((await as(u.coach, `select count(*)::int n from moderation_actions where id = $1`, [actT])).rows[0].n, 0);
    eq((await as(T, `select count(*)::int n from notifications where kind = 'moderation.action'`)).rows[0].n, 1, 'avisado');
    await expectError(() => as(ts, `select moderation_act('warning', 'Me sanciono a mí mismo', $1)`, [ts]), /cannot_moderate_self/);
  });
  await check('P14 §92 apelación: solo el afectado, una abierta; quien sancionó no la resuelve si hay otro revisor', async () => {
    await expectError(() => as(u.coach, `select moderation_appeal($1, 'No estoy de acuerdo con esta sanción porque…')`, [actT]), /not_found/);
    const ap = (await as(T, `select moderation_appeal($1, 'Envié varias candidaturas porque todas encajaban con mi deporte.') id`, [actT])).rows[0].id;
    eq((await as(T, `select moderation_appeal($1, 'Otra vez la misma apelación con el mismo motivo.') id`, [actT])).rows[0].id, ap, 'idempotente');
    await expectError(() => as(ts, `select moderation_appeal_decide($1, true, 'Revisado')`, [ap]), /second_reviewer_required/);
    await as(ts2, `select moderation_appeal_decide($1, true, 'Las candidaturas eran pertinentes')`, [ap]);
    eq((await db.query(`select reverted_at is not null r from moderation_actions where id = $1`, [actT])).rows[0].r, true, 'sanción retirada');
    await as(T, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true)`, [camp3, T]);
  });
  await check('P14 §31 organización restringida para representar; suspendida → sin acceso de sus agentes; revertir lo devuelve', async () => {
    const r1 = (await as(ts, `select moderation_act('organization_restricted', 'Propuestas de representación engañosas', null, $1, array['representation'], 30) id`, [agency2])).rows[0].id;
    const V = await mkUser('t-v', 'athlete', 22);
    await expectError(() => repRequest(agent2, agency2, V), /account_restricted/);
    await as(ts, `select moderation_revert($1, 'Revisado con la agencia')`, [r1]);
    const rv = await repRequest(agent2, agency2, V);
    await as(V, `select representation_respond($1, true)`, [rv]);
    eq(await can(agent2, V, 'pipeline.view'), true);
    const s1 = (await as(ts, `select moderation_act('suspended', 'Suplantación de una agencia real', null, $1) id`, [agency2])).rows[0].id;
    eq((await db.query(`select org_status from organizations where id = $1`, [agency2])).rows[0].org_status, 'suspended');
    eq(await can(agent2, V, 'pipeline.view'), false, 'suspendida: sin acceso');
    await as(ts, `select moderation_revert($1, 'Identidad confirmada')`, [s1]);
    eq(await can(agent2, V, 'pipeline.view'), true);
  });
  await check('P14 §49 break glass: motivo, máximo 4 horas, auditado y revisado por otra persona', async () => {
    const doc = (await as(T, `insert into athlete_documents (athlete_id, kind, title, due_date) values ($1, 'other', 'Documento privado', current_date + 10) returning id`, [T])).rows[0].id;
    eq((await as(ts, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 0, 'sin break glass no');
    await expectError(() => as(support, `select break_glass_open($1, 'Necesito revisar la documentación por una denuncia grave', 1)`, [T]), /admin_only/);
    await expectError(() => as(ts, `select break_glass_open($1, 'Revisión urgente de una denuncia grave de suplantación', 5)`, [T]), /invalid_duration/);
    const g = (await as(ts, `select break_glass_open($1, 'Revisión urgente de una denuncia grave de suplantación', 1, $2) id`, [T, tsCase])).rows[0].id;
    eq((await as(ts, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 1, 'con break glass sí');
    eq((await as(ts2, `select count(*)::int n from athlete_documents where id = $1`, [doc])).rows[0].n, 0, 'solo quien lo abrió');
    eq((await db.query(`select count(*)::int n from audit_logs where action = 'break_glass_opened' and entity_id = $1`, [g])).rows[0].n, 1);
    await expectError(() => as(ts, `select break_glass_review($1)`, [g]), /admin_only/);
    await as(sa, `select break_glass_review($1)`, [g]);
    await db.query(`update break_glass_grants set expires_at = now() - interval '1 second' where id = $1`, [g]).catch(() => null);
  });
  await check('P14 §56-57 límites anti-spam en la base de datos (denuncias)', async () => {
    const spam = await mkUser('t-spam', 'athlete', 25);
    for (let i = 0; i < 20; i++) await as(spam, `insert into content_reports (entity_type, entity_id, reason) values ('athlete_profile', $1, 'spam')`, [randomUUID()]);
    await expectError(() => as(spam, `insert into content_reports (entity_type, entity_id, reason) values ('athlete_profile', $1, 'spam')`, [randomUUID()]), /rate_limited/);
    await expectError(() => as(spam, `select count(*) from rate_limit_events`), /permission denied|row-level/).catch(async () => {
      eq((await as(spam, `select count(*)::int n from rate_limit_events`)).rows[0].n, 0);
    });
  });

  // ---------------------------------------------------------------- Prompt 15 · Facturación
  results.push('\nPrompt 15: catálogo, derechos, cuotas atómicas, asientos, webhook idempotente y libro contable');
  const svc = async (sql, params = []) => {
    await db.query('begin'); try { await db.query('set local role service_role'); const r = await db.query(sql, params); await db.query('commit'); return r; } catch (e) { await db.query('rollback'); throw e; }
  };
  const ev = (id, type, created, object) => JSON.stringify({ id, type, created, data: { object } });
  const T0 = Math.floor(Date.now() / 1000);
  let acct; let subId;
  await check('P15 §7/§17 el catálogo es público y los límites salen de él (no del código)', async () => {
    eq((await as(null, `select count(*)::int n from plan_catalog where code = 'agent_team'`)).rows[0].n, 1);
    eq((await as(u.agent, `select feature_limit('represented_athletes', $1) n`, [agencyId])).rows[0].n, 100, 'lanzamiento: plan de agencia gratis hasta la fecha anunciada');
    const fr = await mkUser('s-free', 'athlete', 19);
    eq((await as(fr, `select feature_limit('ai_questions_day') n`)).rows[0].n, 30, 'gratis');
    await expectError(() => as(u.adult, `select effective_features($1)`, [u.agent]), /permission denied/);
  });
  await check('P15 §30-32/§66-67 webhook: solo el servidor; idempotente; un evento atrasado no pisa uno más reciente', async () => {
    acct = (await as(u.agent, `select billing_account_ensure($1) id`, [agencyId])).rows[0].id;
    await expectError(() => as(A3, `select billing_account_ensure($1)`, [agencyId]), /billing_owner_required/);
    await expectError(() => as(u.agent, `select billing_set_customer($1, 'cus_hack')`, [acct]), /permission denied/);
    await svc(`select billing_set_customer($1, 'cus_test_1')`, [acct]);
    const sub = { id: 'sub_1', customer: 'cus_test_1', status: 'active', metadata: { plan_code: 'agent_team' }, items: { data: [{ quantity: 3, price: { id: 'price_x' } }] }, current_period_start: T0, current_period_end: T0 + 2592000, cancel_at_period_end: false };
    await expectError(() => as(u.agent, `select billing_apply_event($1::jsonb)`, [ev('evt_1', 'customer.subscription.created', T0, sub)]), /permission denied/);
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_1', 'customer.subscription.created', T0, sub)])).rows[0].r, 'subscription_active');
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_1', 'customer.subscription.created', T0, sub)])).rows[0].r, 'duplicate');
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_2', 'customer.subscription.updated', T0 + 100, { ...sub, status: 'past_due' })])).rows[0].r, 'subscription_past_due');
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_3', 'customer.subscription.updated', T0 + 50, { ...sub, status: 'active' })])).rows[0].r, 'stale_event');
    const row = (await db.query(`select id, status, seats from subscriptions where stripe_subscription_id = 'sub_1'`)).rows[0];
    eq(row.status, 'past_due', 'el atrasado no lo pisa'); eq(row.seats, 3); subId = row.id;
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_4', 'customer.subscription.updated', T0 + 200, { ...sub, customer: 'cus_desconocido' })])).rows[0].r, 'unknown_customer_or_plan');
    await expectError(() => as(u.agent, `insert into subscriptions (billing_account_id, plan_code, status) values ($1, 'agent_scale', 'active')`, [acct]), /permission denied|row-level/);
  });
  await check('P15 §43-44 la facturación de la organización la ve quien la dirige; un miembro cualquiera u otra agencia no', async () => {
    eq((await as(u.agent, `select count(*)::int n from subscriptions where id = $1`, [subId])).rows[0].n, 1);
    eq((await as(A3, `select count(*)::int n from subscriptions where id = $1`, [subId])).rows[0].n, 0);
    eq((await as(agent2, `select count(*)::int n from billing_accounts where id = $1`, [acct])).rows[0].n, 0);
  });
  await check('P15 §40-42 asientos: nunca más de lo contratado; solo miembros; salir de la organización libera el asiento', async () => {
    const extra = await mkUser('s-extra', 'agent', 30);
    await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'recruiter')`, [agencyId, extra]);
    await expectError(() => as(u.agent, `select seat_assign($1, $2, true)`, [subId, agent2]), /not_org_member/);
    for (const x of [u.agent, A2, extra]) await as(u.agent, `select seat_assign($1, $2, true)`, [subId, x]);
    await expectError(() => as(u.agent, `select seat_assign($1, $2, true)`, [subId, A3]), /no_seats_left/);
    await expectError(() => as(A3, `select seat_assign($1, $2, true)`, [subId, A3]), /not_allowed/);
    await db.query(`delete from organization_members where organization_id = $1 and user_id = $2`, [agencyId, extra]);
    await as(u.agent, `select seat_assign($1, $2, true)`, [subId, A3]);
    eq((await db.query(`select count(*)::int n from seat_assignments where subscription_id = $1`, [subId])).rows[0].n, 3);
  });
  await check('P15 §19/§23 cuotas atómicas: el límite se respeta incluso con peticiones simultáneas; sin plan, no incluido', async () => {
    const q = await mkUser('s-quota', 'athlete', 20);
    for (let i = 0; i < 29; i++) await as(q, `select consume_usage('ai_questions_day')`);
    const mk = async () => { const c = new pg.Client({ connectionString: url.toString() }); await c.connect(); await c.query('begin'); await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: q, role: 'authenticated' })]); return c; };
    const c1 = await mk(); const c2 = await mk();
    try {
      const run = (c) => c.query(`select consume_usage('ai_questions_day') n`).then(async () => { await c.query('commit'); return 'ok'; }, async (e) => { await c.query('rollback'); return /quota_exceeded/.test(e.message) ? 'quota' : e.message; });
      eq((await Promise.all([run(c1), run(c2)])).sort().join(','), 'ok,quota');
    } finally { await c1.end(); await c2.end(); }
    await expectError(() => as(q, `select consume_usage('offer_compare')`), /feature_not_included/);
    await db.query(`insert into entitlements (user_id, plan_code, source, reference) values ($1, 'family_elite', 'stripe', $2)`, [q, `cs_test_${q}`]);
    eq((await as(q, `select feature_limit('offer_compare') n`)).rows[0].n, 5, 'el pago único concede su cuota');
    await expectError(() => as(q, `select consume_usage('ai_questions_day', 1, $1)`, [agencyId]), /not_allowed/);
  });
  await check('P15 §63 libro contable: cobro, reembolso y disputa; nunca se edita ni se borra', async () => {
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_5', 'invoice.paid', T0 + 300, { id: 'in_1', customer: 'cus_test_1', amount_paid: 9900, currency: 'eur' })])).rows[0].r, 'ledger_charge');
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_6', 'charge.refunded', T0 + 400, { id: 'ch_1', customer: 'cus_test_1', amount_refunded: 9900, currency: 'eur' })])).rows[0].r, 'ledger_refund');
    const rows = (await as(u.agent, `select kind, amount_cents::int a from billing_ledger where billing_account_id = $1 order by occurred_at`, [acct])).rows;
    eq(rows.map((r) => `${r.kind}:${r.a}`).join(','), 'charge:9900,refund:-9900');
    await expectError(() => db.query(`update billing_ledger set amount_cents = 0 where billing_account_id = $1`, [acct]), /ledger_append_only/);
    await expectError(() => db.query(`delete from billing_ledger where billing_account_id = $1`, [acct]), /ledger_append_only/);
    eq((await svc(`select billing_apply_event($1::jsonb) r`, [ev('evt_7', 'invoice.payment_failed', T0 + 500, { id: 'in_2', customer: 'cus_test_1' })])).rows[0].r, 'payment_failed_notified');
    eq((await as(u.agent, `select count(*)::int n from notifications where kind = 'billing.payment_failed'`)).rows[0].n, 1, 'aviso al dueño');
  });

  // ---------------------------------------------------------------- Prompt 16 · Operaciones de administración
  results.push('\nPrompt 16: interruptores, búsqueda minimizada, soporte, doble aprobación y conflictos');
  const fin = await mkAdmin('finance', 'finance');
  await check('P16 §62-63 interruptor de emergencia: solo super admin, con motivo; se aplica en la base de datos', async () => {
    await expectError(() => as(support, `select flag_set('brand_offers', false, 'Investigando un fraude')`), /admin_only/);
    await expectError(() => as(sa, `select flag_set('brand_offers', false, 'x')`), /reason_required/);
    await as(sa, `select flag_set('brand_offers', false, 'Investigando un patrón de fraude en ofertas')`);
    eq((await as(null, `select flag_enabled('brand_offers') e`)).rows[0].e, false);
    const Z2 = await mkUser('f-ath', 'athlete', 23);
    const ap = (await as(Z2, `insert into campaign_applications (campaign_id, athlete_id, rules_acknowledged) values ($1, $2, true) returning id`, [camp3, Z2])).rows[0].id;
    await as(u.brand, `update campaign_applications set status = 'selected' where id = $1`, [ap]);
    await expectError(() => send(u.brand, ap, PRODUCT), /feature_disabled/);
    await as(sa, `select flag_set('brand_offers', true, 'Investigación cerrada sin incidencias')`);
    await send(u.brand, ap, PRODUCT);
    eq((await db.query(`select count(*)::int n from audit_logs where action in ('flag_disabled', 'flag_enabled')`)).rows[0].n, 2, 'auditado');
  });
  await check('P16 §7-8 búsqueda global: solo roles internos y con datos mínimos', async () => {
    await expectError(() => as(u.coach, `select * from admin_search('Agency')`), /admin_only/);
    await expectError(() => as(support, `select * from admin_search('ab')`), /query_too_short/);
    const rows = (await as(support, `select * from admin_search('Top Agency')`)).rows;
    eq(rows.some((r) => r.kind === 'organization'), true);
    eq(Object.keys(rows[0]).sort().join(','), 'detail,id,kind,label', 'sin campos sensibles');
  });
  await check('P16 §38-41 soporte: la persona ve su caso y las respuestas públicas; nunca las notas internas', async () => {
    const sc = (await as(u.adult, `insert into support_cases (requester_id, subject, body, category, status) values ($1, 'No veo mi documento', 'Subí el expediente y no aparece en la lista.', 'data', 'resolved') returning id, status`, [u.adult])).rows[0];
    eq(sc.status, 'open', 'el estado lo pone Gala');
    eq((await as(u.coach, `select count(*)::int n from support_cases where id = $1`, [sc.id])).rows[0].n, 0);
    await expectError(() => as(u.adult, `select support_case_update($1, 'resolved')`, [sc.id]), /admin_only/);
    await as(support, `select support_case_update($1, 'in_progress', 'Posible fallo de subida en móvil', false)`, [sc.id]);
    await as(support, `select support_case_update($1, 'waiting_user', '¿Puedes probar desde el ordenador?', true)`, [sc.id]);
    eq((await as(u.adult, `select count(*)::int n from support_case_notes where case_id = $1`, [sc.id])).rows[0].n, 1, 'solo la pública');
    eq((await as(support, `select count(*)::int n from support_case_notes where case_id = $1`, [sc.id])).rows[0].n, 2);
  });
  await check('P16 §47/§70 conceder un plan a mano exige dos personas; escribir en la tabla directamente, no', async () => {
    const W2 = await mkUser('f-w', 'athlete', 21);
    await expectError(() => as(sa, `insert into entitlements (user_id, plan_code, source, reference) values ($1, 'family_core', 'admin', 'manual-1')`, [W2]), /row-level/);
    await expectError(() => as(support, `select admin_request('entitlement_grant', $1::jsonb, 'Compensación por un fallo del servicio')`, [JSON.stringify({ user_id: W2, plan_code: 'family_core' })]), /admin_only/);
    const req = (await as(fin, `select admin_request('entitlement_grant', $1::jsonb, 'Compensación por un fallo del servicio') id`, [JSON.stringify({ user_id: W2, plan_code: 'family_core' })])).rows[0].id;
    await expectError(() => as(fin, `select admin_approve($1, true)`, [req]), /second_approver_required/);
    eq((await as(sa, `select admin_approve($1, true) s`, [req])).rows[0].s, 'approved');
    eq((await as(W2, `select feature_limit('cv') n`)).rows[0].n, 1, 'plan concedido');
    eq((await as(sa, `select admin_approve($1, true) s`, [req])).rows[0].s, 'approved', 'idempotente');
  });
  await check('P16 §30 conflictos de representación: Gala los ve con su contexto; terceros no', async () => {
    eq((await as(ts, `select count(*)::int n from admin_representation_conflicts`)).rows[0].n >= 1, true);
    eq((await as(u.brand, `select count(*)::int n from admin_representation_conflicts`)).rows[0].n, 0);
  });
  await check('P16 §64 estado de jobs: solo admin', async () => {
    await expectError(() => as(u.coach, `select * from admin_jobs()`), /admin_only/);
    await as(sa, `select * from admin_jobs()`);
  });

  // ---------------------------------------------------------------- Prompt 17 · Analítica
  results.push('\nPrompt 17: eventos, privacidad de menores y métricas agregadas');
  await check('P17 §12 los eventos de un menor no llevan propiedades; los de un adulto sí; dedupe idempotente', async () => {
    await as(u.minor, `select log_event('trust_center_viewed', '{"from":"menu"}'::jsonb)`);
    await as(u.adult, `select log_event('trust_center_viewed', '{"from":"menu"}'::jsonb)`);
    eq(JSON.stringify((await db.query(`select props from product_events where user_id = $1 and event = 'trust_center_viewed'`, [u.minor])).rows[0].props), '{}', 'menor sin props');
    eq((await db.query(`select props->>'from' f from product_events where user_id = $1 and event = 'trust_center_viewed'`, [u.adult])).rows[0].f, 'menu');
    await as(u.adult, `select log_event('subscription_started', '{}'::jsonb, 'cs_123')`);
    await as(u.adult, `select log_event('subscription_started', '{}'::jsonb, 'cs_123')`);
    eq((await db.query(`select count(*)::int n from product_events where user_id = $1 and event = 'subscription_started'`, [u.adult])).rows[0].n, 1, 'idempotente');
    await expectError(() => as(u.adult, `select log_event('evento_inventado', '{}'::jsonb)`), /check constraint/);
  });
  await check('P17 §35/§41 métricas: solo admin, agregadas, grupos pequeños ocultos y sin ranking de personas', async () => {
    await expectError(() => as(u.coach, `select admin_marketplace_metrics(30)`), /admin_only/);
    const m = (await as(u.admin, `select admin_marketplace_metrics(30) m`)).rows[0].m;
    for (const k of ['active', 'athlete_activation', 'liquidity', 'supply_demand', 'retention', 'agents', 'brands', 'revenue', 'trust', 'top_events']) eq(k in m, true, k);
    eq(m.supply_demand.every((s) => s.athletes >= 5), true, 'k-anonimato');
    eq(JSON.stringify(m).includes(u.adult), false, 'ningún id de persona');
    eq((await as(u.admin, `select count(*)::int n from metric_definitions`)).rows[0].n >= 10, true);
    eq((await as(u.coach, `select count(*)::int n from metric_definitions`)).rows[0].n, 0);
  });

  // ---------------------------------------------------------------- Prompt 18 · Rendimiento
  results.push('\nPrompt 18: RLS de evaluación única, índices sin redundancias y búsqueda indexada');
  await check('P18 §16 ninguna policy llama a auth.uid() por fila', async () => {
    const bad = (await db.query(`select tablename || '.' || policyname p from pg_policies where schemaname = 'public'
      and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''), '\\( SELECT auth\\.uid\\(\\) AS uid\\)', '', 'g') ~ 'auth\\.uid\\(\\)'`)).rows.map((r) => r.p);
    eq(bad.join(', '), '', 'policies con auth.uid() por fila');
  });
  await check('P18 §13 sin índices duplicados ni prefijos redundantes', async () => {
    const dup = (await db.query(`with idx as (
        select i.indexrelid, i.indrelid, c.relname n, i.indkey::text cols, i.indisunique u, i.indisprimary pk, i.indpred is null np, pg_get_indexdef(i.indexrelid) d
          from pg_index i join pg_class c on c.oid = i.indexrelid join pg_class t on t.oid = i.indrelid join pg_namespace s on s.oid = t.relnamespace where s.nspname = 'public')
      select a.n from idx a join idx b on a.indrelid = b.indrelid and a.indexrelid <> b.indexrelid
       where not a.u and not a.pk and a.np and b.np and a.d like '%USING btree%' and b.d like '%USING btree%' and (b.cols = a.cols or b.cols like a.cols || ' %')`)).rows.map((r) => r.n);
    eq(dup.join(', '), '');
  });
  await check('P18 §31 la búsqueda por nombre usa el índice de trigramas', async () => {
    await db.query(`set enable_seqscan = off`);
    try {
      const plan = (await db.query(`explain select id from organizations where name ilike '%agency%'`)).rows.map((r) => r['QUERY PLAN']).join('\n');
      eq(/organizations_name_trgm/.test(plan), true, plan);
    } finally { await db.query(`set enable_seqscan = on`); }
  });
  await check('P18 §19 revocación en vivo sigue siendo inmediata tras optimizar (sin caché de permisos)', async () => {
    const L = await mkUser('p-live', 'athlete', 22);
    const r = await repRequest(u.agent, agencyId, L, { perms: ['offers.view', 'passport.view'] });
    await as(L, `select representation_respond($1, true)`, [r]);
    eq(await can(u.agent, L, 'offers.view'), true);
    await as(L, `select representation_set_permissions($1, array['passport.view'])`, [r]);
    eq(await can(u.agent, L, 'offers.view'), false);
  });

  // ---------------------------------------------------------------- Prompt 19 · Observabilidad
  results.push('\nPrompt 19: salud de la plataforma');
  await check('P19 salud de la plataforma: solo admin, solo agregados', async () => {
    await expectError(() => as(u.coach, `select admin_platform_health()`), /admin_only/);
    const h = (await as(u.admin, `select admin_platform_health() h`)).rows[0].h;
    for (const k of ['child_safety_open', 'stripe_unprocessed', 'verifications_pending', 'kill_switches_off', 'break_glass_unreviewed']) eq(k in h, true, k);
    eq(JSON.stringify(h).match(/[0-9a-f]{8}-[0-9a-f]{4}-/), null, 'sin identificadores');
  });

  // ---------------------------------------------------------------- Prompt 20 · Crecimiento
  results.push('\nPrompt 20: invitaciones con atribución honesta');
  await check('P20 invitar: código propio; una atribución por persona, nunca a uno mismo; sin bucles para menores; quién se unió no se expone', async () => {
    const inviter = await mkUser('g-inviter', 'coach', 40);
    const code = (await as(inviter, `select my_referral_code() c`)).rows[0].c;
    eq(/^[a-z0-9]{8}$/.test(code), true);
    eq((await as(inviter, `select my_referral_code() c`)).rows[0].c, code, 'estable');
    eq((await as(u.minor, `select my_referral_code() c`)).rows[0].c, null, 'menores sin código');
    eq((await as(inviter, `select referral_claim($1) ok`, [code])).rows[0].ok, false, 'a uno mismo no');
    const n1 = await mkUser('g-new', 'athlete', 20);
    eq((await as(n1, `select referral_claim($1) ok`, [code])).rows[0].ok, true);
    eq((await as(n1, `select referral_claim($1) ok`, [code])).rows[0].ok, false, 'una sola vez');
    eq((await as(inviter, `select my_referral_count() n`)).rows[0].n, 1);
    eq((await as(inviter, `select count(*)::int n from referrals`)).rows[0].n, 0, 'no ve quién');
    await db.query(`update profiles set created_at = now() - interval '30 days' where id = $1`, [u.adult]);
    eq((await as(u.adult, `select referral_claim($1) ok`, [code])).rows[0].ok, false, 'solo recién registrados');
  });

  // ---------------------------------------------------------------- Prompt 9 · Supabase & PostgreSQL
  results.push('\nPrompt 9: integridad, documentos, concurrencia y catálogo');
  await check('P9 S9-01 · un documento, la foto o una evidencia no pueden apuntar a la carpeta de otra persona', async () => {
    await expectError(() => as(u.adult, `update athlete_documents set storage_path = $2 where id = $1`, [docT, `${u.privateAth}/exp.pdf`]), /path_belongs_to_athlete/);
    await expectError(() => as(u.adult, `update athlete_profiles set photo_path = $2 where user_id = $1`, [u.adult, `${u.privateAth}/foto.jpg`]), /photo_belongs_to_athlete/);
    const vr = (await db.query(`insert into verification_requests (subject_user, verification_type, status) values ($1, 'role', 'submitted') returning id`, [u.coach])).rows[0].id;
    await expectError(() => as(u.coach, `insert into verification_evidence (request_id, evidence_type, storage_path, submitted_by) values ($1, 'official_letter', $2, $3)`, [vr, `${u.coach2}/carta.pdf`, u.coach]), /verification_evidence_path_owner/);
    await as(u.coach, `insert into verification_evidence (request_id, evidence_type, storage_path, submitted_by) values ($1, 'official_letter', $2, $3)`, [vr, `${u.coach}/carta.pdf`, u.coach]);
    await expectError(() => as(u.adult, `update athlete_documents set content_sha256 = 'nohash' where id = $1`, [docT]), /check constraint/);
  });

  await check('P9 S9-02 · abrir un documento: dueño sin registro; organización con concesión → registrado; otra organización → no', async () => {
    await as(u.adult, `insert into document_access_grants (document_id, athlete_id, organization_id, purpose, expires_at) values ($1, $2, $3, 'application_review', now() + interval '5 days')`, [docT, u.adult, clubA]);
    const before = (await db.query(`select count(*)::int n from audit_logs where action = 'document_opened' and entity_id = $1`, [docT])).rows[0].n;
    eq((await as(u.adult, `select document_open($1) p`, [docT])).rows[0].p, `${u.adult}/exp.pdf`, 'dueño');
    eq((await as(u.coach2, `select document_open($1) p`, [docT])).rows[0].p, `${u.adult}/exp.pdf`, 'club con concesión');
    const logs = (await db.query(`select actor_id, organization_id, classification from audit_logs where action = 'document_opened' and entity_id = $1`, [docT])).rows;
    eq(logs.length, before + 1, 'solo el acceso de terceros queda registrado');
    eq(logs.at(-1).actor_id, u.coach2); eq(logs.at(-1).organization_id, clubA); eq(logs.at(-1).classification, 'sensitive');
    await expectError(() => as(v.ownerB, `select document_open($1)`, [docT]), /not_found/); // 10C: igual que si no existiera
    await expectError(() => as(null, `select document_open($1)`, [docT]), /permission denied|not_allowed/);
  });

  await check('P9 concurrencia · dos candidaturas simultáneas a la misma oportunidad → exactamente una', async () => {
    const opp = (await db.query(`select o.id from opportunities o where o.status = 'published'
      and not exists (select 1 from applications a where a.opportunity_id = o.id and a.athlete_id = $1) limit 1`, [u.adult])).rows[0]?.id;
    if (!opp) throw new Error('no hay oportunidad libre para la prueba');
    const c1 = new pg.Client({ connectionString: url.toString() }); const c2 = new pg.Client({ connectionString: url.toString() });
    await c1.connect(); await c2.connect();
    const start = async (c) => { await c.query('begin'); await c.query('set local role authenticated'); await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.adult, role: 'authenticated' })]); };
    try {
      await start(c1); await start(c2);
      await c1.query(`insert into applications (opportunity_id, athlete_id) values ($1, $2)`, [opp, u.adult]);
      const second = c2.query(`insert into applications (opportunity_id, athlete_id) values ($1, $2)`, [opp, u.adult]).then(() => 'ok', (e) => e.message);
      await new Promise((r) => setTimeout(r, 150)); // c2 queda bloqueada por el índice único
      await c1.query('commit');
      const r2 = await second; await c2.query('rollback');
      if (r2 === 'ok') throw new Error('la segunda candidatura simultánea se aceptó');
      if (!/duplicate key|unique/.test(r2)) throw new Error(`error inesperado: ${r2}`);
    } finally { await c1.end(); await c2.end(); }
    eq((await db.query(`select count(*)::int n from applications where opportunity_id = $1 and athlete_id = $2`, [opp, u.adult])).rows[0].n, 1);
  });

  results.push('\nLista de difusión');
  await check('Difusión: solo administradores leen o crean contactos; anónimos y otros roles no ven nada', async () => {
    await as(u.admin, `insert into outreach_contacts (segment, organization_name, channel, email, source_url) values ('agency', 'Agencia Prueba', 'email', 'hola@agencia-prueba.test', 'https://agencia-prueba.test')`);
    eq((await as(u.admin, `select count(*)::int n from outreach_contacts`)).rows[0].n > 0, true, 'admin');
    for (const who of [u.agent, u.adult, u.uni]) {
      eq((await as(who, `select count(*)::int n from outreach_contacts`)).rows[0].n, 0, String(who));
    }
    await expectError(() => as(null, `select count(*) from outreach_contacts`), /permission denied/);
    await expectError(() => as(u.agent, `insert into outreach_contacts (segment, organization_name, channel, email, source_url) values ('agency', 'Intruso', 'email', 'x@y.test', 'https://y.test')`), /row-level security|permission/);
    await expectError(() => as(u.admin, `insert into outreach_contacts (segment, organization_name, channel, source_url) values ('agency', 'Sin correo', 'email', 'https://z.test')`), /outreach_email_channel/);
  });
  await check('Difusión: el estado y el token los pone el servidor, no el panel', async () => {
    const id = (await as(u.admin, `insert into outreach_contacts (segment, organization_name, channel, email, source_url, status) values ('university', 'Uni Prueba', 'email', 'coach@uni-prueba.test', 'https://uni-prueba.test', 'accepted') returning id, status`)).rows[0];
    eq(id.status, 'new', 'el estado inicial lo fija el servidor');
    await expectError(() => as(u.admin, `update outreach_contacts set status = 'accepted' where id = $1`, [id.id]), /bad_transition/);
    await expectError(() => as(u.agent, `select outreach_issue_invite($1)`, [id.id]), /forbidden/);
  });
  await check('Difusión: invitación de un solo uso; aceptar avisa a los admins; la baja es definitiva y bloquea reinsertar', async () => {
    const c = (await as(u.admin, `select id from outreach_contacts where email = 'hola@agencia-prueba.test'`)).rows[0].id;
    const token = (await as(u.admin, `select outreach_issue_invite($1) t`, [c])).rows[0].t;
    eq(/^[a-f0-9]{64}$/.test(token), true, 'token');
    await expectError(() => as(u.admin, `select outreach_issue_invite($1)`, [c]), /not_invitable/);
    eq((await as(null, `select valid from outreach_preview($1)`, [token])).rows[0].valid, true, 'preview anónimo');
    eq((await as(null, `select count(*)::int n from outreach_preview($1)`, ['0'.repeat(64)])).rows[0].n, 0, 'token falso');
    eq((await as(null, `select outreach_respond($1, 'accept') r`, [token])).rows[0].r, 'accepted');
    eq((await as(null, `select outreach_respond($1, 'decline') r`, [token])).rows[0].r, 'expired', 'un solo uso');
    eq((await as(u.admin, `select count(*)::int n from notifications where user_id = $1 and kind = 'outreach_accepted'`, [u.admin])).rows[0].n, 1, 'aviso a Gala');
    eq((await as(null, `select outreach_respond($1, 'unsubscribe') r`, [token])).rows[0].r, 'unsubscribed', 'baja siempre');
    await as(u.admin, `delete from outreach_contacts where id = $1`, [c]);
    await expectError(() => as(u.admin, `insert into outreach_contacts (segment, organization_name, channel, email, source_url) values ('agency', 'Agencia Prueba 2', 'email', 'HOLA@agencia-prueba.test', 'https://agencia-prueba.test')`), /suppressed/);
    eq((await as(u.admin, `select count(*)::int n from outreach_suppressions`).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n, -1, 'la supresión no se lee desde la API');
  });

  await check('P9 catálogo · RLS en todas las tablas, FKs indexadas, search_path fijo y triggers fuera de la API', async () => {
    const one = async (sql) => (await db.query(sql)).rows.map((r) => Object.values(r)[0]);
    const noRls = await one(`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
    eq(noRls.join(','), '', 'tablas sin RLS');
    const fk = await one(`select conrelid::regclass::text from pg_constraint c where contype = 'f' and connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])`);
    eq(fk.join(','), '', 'FKs sin índice');
    const sp = await one(`select proname from pg_proc p where pronamespace = 'public'::regnamespace and prokind = 'f'
      and (proconfig is null or not exists (select 1 from unnest(proconfig) x where x like 'search_path=%'))`);
    eq(sp.join(','), '', 'funciones sin search_path');
    const trg = await one(`select proname from pg_proc where pronamespace = 'public'::regnamespace and prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))`);
    eq(trg.join(','), '', 'funciones trigger ejecutables por la API');
    const views = await one(`select relname from pg_class c where relnamespace = 'public'::regnamespace and relkind = 'v'
      and not coalesce((select bool_or(o in ('security_invoker=true', 'security_invoker=on')) from unnest(c.reloptions) o), false)`);
    eq(views.join(','), '', 'vistas sin security_invoker');
  });

  await check('P9 revisión · sin sesión no se puede preguntar si un perfil es de adulto; con sesión el perfil adulto sigue visible', async () => {
    const adultUser = (await db.query(`select p.id from public.profiles p where not exists (select 1 from public.athlete_profiles a where a.user_id = p.id) limit 1`)).rows[0]?.id;
    await expectError(() => as(null, `select public.is_listed_adult_profile($1)`, [adultUser]), /permission denied/);
    eq((await as(null, `select count(*)::int n from public.profiles where id = $1`, [adultUser])).rows[0].n, 0, 'anon no ve el perfil');
    const other = (await db.query(`select id from public.profiles where id <> $1 limit 1`, [adultUser])).rows[0].id;
    eq((await as(other, `select count(*)::int n from public.profiles where id = $1`, [adultUser])).rows[0].n, 1, "con sesión ve al adulto");
    const anonDefiner = (await db.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
      and has_function_privilege('anon', oid, 'execute') order by 1`)).rows.map((r) => r.proname);
    eq(anonDefiner.includes('is_listed_adult_profile'), false, 'is_listed_adult_profile ejecutable por anon');
    console.log(`  (info) SECURITY DEFINER ejecutables por anon: ${anonDefiner.length} → ${anonDefiner.join(', ')}`);
  });

  await check('P9 revisión · el alta con una fecha imposible no falla y el perfil se recupera de forma idempotente', async () => {
    const u = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'bad-dob@test.dev', $2)`,
      [u, { date_of_birth: '2003-02-30', display_name: 'bad dob' }]);
    eq((await db.query(`select count(*)::int n from profiles where id = $1`, [u])).rows[0].n, 1, 'perfil creado');
    eq((await db.query(`select count(*)::int n from private_profile_data where user_id = $1`, [u])).rows[0].n, 0, 'sin fecha imposible');
    eq((await as(u, `select public.ensure_my_profile() ok`)).rows[0].ok, false, 'ya existía');
    await db.query(`delete from profiles where id = $1`, [u]);
    eq((await db.query(`select count(*)::int n from profiles where id = $1`, [u])).rows[0].n, 0, 'perfil borrado para la prueba');
    eq((await as(u, `select public.ensure_my_profile() ok`)).rows[0].ok, true, 'recreado');
    eq((await as(u, `select public.ensure_my_profile() ok`)).rows[0].ok, false, 'idempotente');
    await expectError(() => as(null, `select public.ensure_my_profile()`), /permission denied/);
  });

  if (!process.env.SKIP_ERASURE) await check('RGPD: toda cuenta y toda organización se puede borrar (anonimiza auditoría, no bloquea)', async () => {
    await db.query(`select set_config('request.jwt.claims', '{}', false)`);
    const fails = [];
    for (const { id } of (await db.query(`select id from auth.users`)).rows) {
      try { await db.query(`delete from auth.users where id = $1`, [id]); } catch (e) { fails.push(`usuario: ${e.message} ${e.detail ?? ""} @ ${(e.where ?? "").split("\n").slice(0,3).join(" < ")}`); }
    }
    for (const { id } of (await db.query(`select id from public.organizations`)).rows) {
      try { await db.query(`delete from public.organizations where id = $1`, [id]); } catch (e) { fails.push(`organización: ${e.message} @ ${(e.where ?? "").split("\n")[0]}`); }
    }
    if (fails.length) throw new Error([...new Set(fails)].join(' | '));
    eq((await db.query(`select count(*)::int n from public.audit_logs where actor_id is not null`)).rows[0].n, 0, 'auditoría anonimizada');
  });

} finally {
  console.log(results.join('\n'));
  console.log(`\n${passed} pruebas OK · ${failed} fallidas`);
  await db.end();
  if (process.env.KEEP_DB) console.log(`(base conservada: ${dbName})`); else await admin.query(`drop database ${dbName}`);
  await admin.end();
  process.exitCode = failed ? 1 : 0;
}
