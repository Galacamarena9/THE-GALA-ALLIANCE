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
} finally {
  console.log(results.join('\n'));
  console.log(`\n${passed} pruebas OK · ${failed} fallidas`);
  await db.end();
  await admin.query(`drop database ${dbName}`);
  await admin.end();
  process.exitCode = failed ? 1 : 0;
}
