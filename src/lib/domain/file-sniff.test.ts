import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffMime, uploadMatches } from './file-sniff.ts';

const pdf = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ');
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const html = new TextEncoder().encode('<html><script>alert(1)</script>');

test('reconoce PDF, PNG y JPEG por su firma', () => {
  assert.equal(sniffMime(pdf), 'application/pdf');
  assert.equal(sniffMime(png), 'image/png');
  assert.equal(sniffMime(jpg), 'image/jpeg');
});

test('rechaza lo que no es un tipo admitido, aunque venga «como PDF»', () => {
  assert.equal(sniffMime(html), null);
  assert.equal(sniffMime(new Uint8Array()), null);
  assert.equal(uploadMatches(html, { mime: 'application/pdf', size: html.byteLength }), false);
});

test('el tipo y el tamaño declarados deben coincidir con el archivo', () => {
  assert.equal(uploadMatches(png, { mime: 'image/png', size: png.byteLength }), true);
  assert.equal(uploadMatches(png, { mime: 'application/pdf', size: png.byteLength }), false);
  assert.equal(uploadMatches(png, { mime: 'image/png', size: png.byteLength + 1 }), false);
});
