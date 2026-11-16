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
