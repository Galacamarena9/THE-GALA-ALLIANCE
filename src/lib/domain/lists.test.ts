import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunk, listSummary, parseListView, sortSaved, type SavedRow } from './lists.ts';

const rows: SavedRow[] = [
  { athlete_id: 'a', list_name: 'Shortlist', created_at: '2026-11-10T10:00:00Z', name: 'Zoe Ruiz', grad: 2027, sport: 'basketball' },
  { athlete_id: 'b', list_name: 'Bases 2027', created_at: '2026-11-12T10:00:00Z', name: 'Ana Gil', grad: 2026, sport: 'basketball' },
  { athlete_id: 'c', list_name: 'Shortlist', created_at: '2026-11-14T10:00:00Z', name: 'Bruno Sanz', grad: 2028, sport: 'football' },
  { athlete_id: 'a', list_name: 'Bases 2027', created_at: '2026-11-13T10:00:00Z', name: 'Zoe Ruiz', grad: 2027, sport: 'basketball' },
];

test('listas: resumen con el número de atletas, Shortlist primero y el resto por orden alfabético', () => {
  assert.deepEqual(listSummary(rows), [
    { name: 'Shortlist', count: 2 },
    { name: 'Bases 2027', count: 2 },
  ]);
  assert.deepEqual(listSummary([]), []);
});

test('listas: la vista por defecto es la primera lista y una lista inexistente no se acepta', () => {
  const names = ['Shortlist', 'Bases 2027'];
  assert.deepEqual(parseListView({}, names), { list: 'Shortlist', sport: null, sort: 'recent' });
  assert.deepEqual(parseListView({ list: 'Bases 2027', sort: 'name', sport: 'basketball' }, names), { list: 'Bases 2027', sport: 'basketball', sort: 'name' });
  assert.deepEqual(parseListView({ list: 'Hackeo', sort: 'drop table', sport: '<x>' }, names), { list: 'Shortlist', sport: null, sort: 'recent' });
  assert.deepEqual(parseListView({ list: ['Bases 2027', 'Shortlist'] }, names).list, 'Bases 2027');
  assert.deepEqual(parseListView({}, []), { list: null, sport: null, sort: 'recent' });
});

test('listas: ordenar por recientes, nombre o promoción', () => {
  const sl = rows.filter((r) => r.list_name === 'Shortlist');
  assert.deepEqual(sortSaved(sl, 'recent').map((r) => r.athlete_id), ['c', 'a']);
  assert.deepEqual(sortSaved(sl, 'name').map((r) => r.athlete_id), ['c', 'a']);
  assert.deepEqual(sortSaved(rows, 'grad').map((r) => r.grad), [2026, 2027, 2027, 2028]);
  assert.deepEqual(sortSaved([{ ...rows[0], name: null, grad: null }, rows[1]], 'grad').map((r) => r.athlete_id), ['b', 'a']);
});

test('listas: consultas por lotes para no superar el límite de la URL con muchos atletas', () => {
  const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
  const parts = chunk(ids, 200);
  assert.deepEqual(parts.map((p) => p.length), [200, 200, 50]);
  assert.deepEqual(parts.flat(), ids);
  assert.deepEqual(chunk([], 200), []);
  assert.throws(() => chunk(ids, 0));
});
