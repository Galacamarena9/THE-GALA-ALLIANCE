import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sidebarFor } from './navigation.ts';
import type { AppRole } from '../types.ts';

const visible = (roles: AppRole[]) => sidebarFor(roles).filter((s) => !s.collapsed).flatMap((s) => s.items.filter((i) => !i.more));
const labels = (roles: AppRole[]) => sidebarFor(roles).flatMap((s) => s.items.map((i) => i.label));

test('cada rol ve como mucho 8 entradas a la vista', () => {
  for (const r of ['athlete', 'parent', 'coach', 'university', 'agent', 'brand'] as AppRole[]) {
    assert.ok(visible([r]).length <= 8, `${r}: ${visible([r]).map((i) => i.label).join(', ')}`);
  }
});

test('nombres en español: sin Pipeline, Shortlists, Portfolio ni Prospectos', () => {
  const all = (['athlete', 'parent', 'coach', 'university', 'agent', 'brand'] as AppRole[]).flatMap((r) => labels([r])).join(' ');
  assert.doesNotMatch(all, /Pipeline|Shortlist|Portfolio|Prospectos/);
});

test('las notificaciones salen de la barra (están en la campana)', () => {
  assert.ok(!sidebarFor(['athlete']).some((s) => s.items.some((i) => i.href === '/app/notifications')));
});

test('el agente tiene Cartera, Escaparate, Listas y Mensajes a la vista', () => {
  const v = visible(['agent']).map((i) => i.label);
  for (const l of ['Cartera', 'Escaparate de atletas', 'Listas', 'Mensajes']) assert.ok(v.includes(l), l);
});

test('sin duplicados al combinar roles', () => {
  const hrefs = sidebarFor(['athlete', 'parent']).flatMap((s) => s.items.map((i) => i.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
});

const hrefs = (roles: AppRole[], primary?: AppRole) => sidebarFor(roles, primary).flatMap((s) => s.items.map((i) => i.href));

test('«Inicio» es el espacio de trabajo: no se repite con otro nombre', () => {
  for (const [r, ws] of [['parent', '/app/family'], ['coach', '/app/recruit'], ['university', '/app/recruit'], ['brand', '/app/campaigns?view=mine']] as [AppRole, string][]) {
    assert.ok(!hrefs([r]).includes(ws), `${r} repite ${ws}`);
    const inicio = sidebarFor([r])[0].items[0];
    assert.deepEqual(inicio.aliases, [ws.split('?')[0]]);
  }
});

test('coaches y universidades descubren desde su espacio: un solo buscador de talento', () => {
  for (const r of ['coach', 'university'] as AppRole[]) {
    assert.ok(!hrefs([r]).includes('/app/discover'), r);
    assert.ok(hrefs([r]).includes('/app/recruit/discover'), r);
  }
});

test('con el rol principal elegido, ningún espacio queda inaccesible', () => {
  // Familia + coach con coach como principal: el panel familiar sigue en la barra.
  assert.ok(hrefs(['parent', 'coach'], 'coach').includes('/app/family'));
  assert.ok(!hrefs(['parent', 'coach'], 'coach').includes('/app/recruit'));
});

test('el atleta tiene un solo inicio y lo esencial a la vista', () => {
  const v = visible(['athlete']).map((i) => i.label);
  assert.ok(!v.includes('Mi camino'));
  for (const l of ['Inicio', 'Mi Passport', 'Gala Match', 'Mi pipeline', 'Mensajes']) assert.ok(v.includes(l), l);
});

test('las organizaciones gestionan su plan desde la cuenta; atletas y familias ven los planes públicos', () => {
  assert.ok(hrefs(['agent']).includes('/app/billing'));
  assert.ok(!hrefs(['athlete']).includes('/app/billing'));
  assert.ok(hrefs(['parent']).includes('/precios'));
});
