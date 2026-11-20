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
  await check('el agente crea su agencia y pide representar a un adulto', async () => {
    agencyId = (await as(u.agent, `insert into organizations (name, type, created_by) values ('Top Agency', 'agency', $1) returning id`, [u.agent])).rows[0].id;
    repId = (await as(u.agent, `insert into agent_representations (agency_id, agent_id, athlete_id, status) values ($1, $2, $3, 'active') returning id, status`,
      [agencyId, u.agent, u.adult])).rows[0].id;
    eq((await as(u.agent, `select status from agent_representations where id = $1`, [repId])).rows[0].status, 'requested', 'no puede autoactivarse:');
  });
  await check('un agente no puede pedir representar a un menor', async () => {
    await expectError(() => as(u.agent, `insert into agent_representations (agency_id, agent_id, athlete_id) values ($1, $2, $3)`, [agencyId, u.agent, u.minor]));
  });
  await check('el agente no puede aceptar en nombre del atleta', async () => {
    await expectError(() => as(u.agent, `update agent_representations set status = 'active' where id = $1`, [repId]), /transition_not_allowed/);
  });
  await check('el atleta acepta y la representación queda activa', async () => {
    await as(u.adult, `update agent_representations set status = 'active' where id = $1`, [repId]);
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
  await check('una organización sin verificar no puede contactar', async () => {
    await expectError(() => as(u.agent, `insert into contact_requests (organization_id, requested_by, athlete_id, message)
      values ($1, $2, $3, 'Quiero representarte, hablemos por favor.')`, [agencyId, u.agent, u.adult]), /verified_organization_required/);
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
    await expectError(() => as(u.agent, `insert into news_posts (organization_id, author_id, kind, title, body) values ($1, $2, 'announcement', 'Nueva agencia', 'Abrimos oficina en Valencia para atletas.')`, [agencyId, u.agent]), /verified_organization_required/);
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
  await check('rol de solo lectura: ve pero no escribe', async () => {
    await db.query(`set session_replication_role = replica`);
    await db.query(`insert into organization_members (organization_id, user_id, member_role, agency_role) values ($1, $2, 'recruiter', 'viewer')`, [agencyId, u.coach2]);
    await db.query(`set session_replication_role = default`);
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
    await as(u.adult, `update agent_representations set status = 'ended' where id = $1`, [repId]);
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

} finally {
  console.log(results.join('\n'));
  console.log(`\n${passed} pruebas OK · ${failed} fallidas`);
  await db.end();
  await admin.query(`drop database ${dbName}`);
  await admin.end();
  process.exitCode = failed ? 1 : 0;
}
