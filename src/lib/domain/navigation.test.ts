import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { breadcrumbsFor, flattenMode, navModeFor, sidebarFor, topLevelCount, type NavMode } from './navigation.ts';
import { LEGACY_REDIRECTS } from './legacy-routes.ts';
import type { AppRole } from '../types.ts';

const mode = (roles: AppRole[], primaryRole?: AppRole, x: { isMinor?: boolean; clubStaff?: boolean } = {}) => navModeFor({ roles, primaryRole, ...x });
const labels = (m: NavMode) => m.primary.map((i) => i.label);
const ROOT = join(import.meta.dirname, '../../..');

test('Agent OS: Inicio, Atletas, Oportunidades, Recruiting, Mensajes, Más (≤ 6 destinos)', () => {
  const m = mode(['agent']);
  assert.deepEqual(labels(m), ['Inicio', 'Atletas', 'Oportunidades', 'Recruiting', 'Mensajes']);
  assert.ok(m.more.length > 0);
  assert.ok(topLevelCount(m) <= 6, String(topLevelCount(m)));
});

test('Athlete OS: exactamente 5 destinos, sin «Más»', () => {
  for (const isMinor of [false, true]) {
    const m = mode(['athlete'], 'athlete', { isMinor });
    assert.deepEqual(labels(m), ['Inicio', 'Oportunidades', 'Mi camino', 'Mensajes', 'Perfil']);
    assert.equal(topLevelCount(m), 5);
  }
});

test('University OS: Inicio, Descubrir, Candidatos, Oportunidades, Recruiting, Más', () => {
  for (const r of ['university', 'coach'] as AppRole[]) {
    const m = mode([r]);
    assert.deepEqual(labels(m), ['Inicio', 'Descubrir', 'Candidatos', 'Oportunidades', 'Recruiting']);
    assert.ok(topLevelCount(m) <= 6);
  }
});

test('Operaciones Gala: Verificación, Cumplimiento, Confianza, Moderación, Soporte', () => {
  assert.deepEqual(labels(mode(['admin'])), ['Verificación', 'Cumplimiento', 'Confianza', 'Moderación', 'Soporte']);
});

test('Match, ofertas, documentos, tareas y analítica no son destinos de primer nivel', () => {
  for (const r of ['agent', 'athlete', 'parent', 'university', 'coach', 'brand', 'admin'] as AppRole[]) {
    const top = mode([r]).primary.map((i) => i.href.split('?')[0]);
    for (const ctx of ['/app/match', '/app/offers', '/app/documents', '/app/recruit/tasks', '/app/admin/analytics']) assert.ok(!top.includes(ctx), `${r}: ${ctx}`);
  }
});

test('ningún destino no autorizado: cada enlace del modo lo permite el guard de su página', () => {
  // Lee el requireSession([...]) real de cada página: si la página limita roles, el rol del modo debe estar.
  const pageFile = (href: string) => join(ROOT, 'src/app', href.split('?')[0], 'page.tsx');
  const allowed = (href: string): AppRole[] | 'any' | 'missing' => {
    const f = pageFile(href);
    if (!existsSync(f)) return 'missing';
    const src = readFileSync(f, 'utf8');
    const m = src.match(/requireSession\(\[([^\]]*)\]\)/);
    if (!m) return 'any';
    return m[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean) as AppRole[];
  };
  const cases: [AppRole, AppRole[], { isMinor?: boolean; clubStaff?: boolean }][] = [
    ['agent', ['agent'], {}], ['athlete', ['athlete'], {}], ['athlete', ['athlete'], { isMinor: true }], ['parent', ['parent'], {}],
    ['university', ['university'], {}], ['coach', ['coach'], { clubStaff: true }], ['brand', ['brand'], {}], ['admin', ['admin'], {}],
  ];
  for (const [primary, roles, x] of cases) {
    for (const i of flattenMode(mode(roles, primary, x))) {
      if (!i.href.startsWith('/app')) continue;
      const a = allowed(i.href);
      assert.notEqual(a, 'missing', `${primary}: ${i.href} no existe`);
      if (a !== 'any') assert.ok(roles.some((r) => (a as AppRole[]).includes(r)), `${primary}: ${i.href} solo para ${(a as AppRole[]).join(',')}`);
    }
  }
});

test('menores: sin marcas ni colaboraciones en su navegación', () => {
  const hrefs = flattenMode(mode(['athlete'], 'athlete', { isMinor: true })).map((i) => i.href);
  assert.ok(!hrefs.includes('/app/campaigns') && !hrefs.includes('/app/collaborations'));
  assert.ok(flattenMode(mode(['athlete'], 'athlete')).some((i) => i.href === '/app/campaigns'), 'adultos sí');
});

test('el agente llega a cualquier atleta en ≤ 2 interacciones (Atletas → fila, o ⌘K → nombre)', () => {
  const m = mode(['agent']);
  assert.ok(m.primary.some((i) => i.href === '/app/portfolio'), 'Atletas es destino de primer nivel');
  assert.ok(m.tabs.some((i) => i.href === '/app/portfolio'), 'y está en la barra móvil');
});

test('varios roles: el rol principal decide el modo y los demás espacios quedan en «Más»', () => {
  const m = mode(['parent', 'coach'], 'coach');
  assert.equal(m.id, 'university');
  assert.ok(m.more.some((i) => i.href === '/app/family'), 'panel familiar accesible');
  const hrefs = flattenMode(m).map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length, 'sin duplicados');
  assert.ok(mode(['agent', 'admin'], 'agent').more.some((i) => i.href === '/app/admin'), 'admin con otro rol llega a Operaciones');
});

test('barra móvil: 4 accesos, todos destinos del modo', () => {
  for (const r of ['agent', 'athlete', 'parent', 'university', 'brand', 'admin'] as AppRole[]) {
    const m = mode([r]);
    const all = new Set(flattenMode(m).map((i) => i.href));
    assert.equal(m.tabs.length, 4, r);
    for (const t of m.tabs) assert.ok(all.has(t.href), `${r}: ${t.href}`);
  }
});

test('nombres en castellano en el primer nivel (sin Pipeline, Shortlists, Portfolio)', () => {
  for (const r of ['agent', 'athlete', 'parent', 'university', 'brand', 'admin'] as AppRole[]) {
    assert.doesNotMatch(labels(mode([r])).join(' '), /Pipeline|Shortlist|Portfolio|Workspace/);
  }
});

test('migas de pan: destino › vista contextual', () => {
  const m = mode(['agent']);
  assert.deepEqual(breadcrumbsFor(m, '/app/discover').map((c) => c.label), ['Atletas', 'Buscar talento']);
  assert.deepEqual(breadcrumbsFor(m, '/app/portfolio/abc').map((c) => c.label), ['Atletas'], 'la ficha añade «Detalle»');
  assert.deepEqual(breadcrumbsFor(m, '/app/inbox').map((c) => c.label), ['Mensajes']);
  const ops = mode(['admin']);
  assert.deepEqual(breadcrumbsFor(ops, '/app/admin', 'view=moderation').map((c) => c.label), ['Moderación']);
  assert.deepEqual(breadcrumbsFor(ops, '/app/admin').map((c) => c.label), ['Verificación']);
});

test('redirecciones: sin bucles, destino existente y sin tapar páginas reales', () => {
  const sources = new Set(LEGACY_REDIRECTS.map((r) => r.source));
  for (const r of LEGACY_REDIRECTS) {
    const dest = r.destination.split('?')[0];
    assert.ok(!sources.has(dest), `bucle: ${r.source} → ${r.destination}`);
    const file = join(ROOT, 'src/app', dest.replace(/:id/, '[athleteId]').replace(/:slug/, '[slug]'), 'page.tsx');
    assert.ok(existsSync(file), `destino inexistente: ${r.destination}`);
    if (!r.source.includes(':')) assert.ok(!existsSync(join(ROOT, 'src/app', r.source, 'page.tsx')), `tapa una página real: ${r.source}`);
  }
});

test('compatibilidad: sidebarFor devuelve el modo como secciones', () => {
  const s = sidebarFor(['agent']);
  assert.equal(s[0].items.length, 5);
  assert.equal(s[1].title, 'Más');
});
