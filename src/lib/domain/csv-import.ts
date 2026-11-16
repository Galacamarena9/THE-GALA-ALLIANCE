/** Importación desde CSV/Excel (Guardar como CSV). Lógica pura, sin dependencias. */

/** Parser RFC 4180: comillas, comillas dobles escapadas, saltos dentro de comillas, BOM, CRLF. Detecta ; o , */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export const CONTACT_IMPORT_MAX = 500;

export interface ContactImportRow {
  institution_name: string; name: string; role_title: string | null; email: string | null; phone: string | null; notes: string | null;
}
export interface ContactImportResult {
  rows: ContactImportRow[];
  errors: { line: number; message: string }[];
  fatal?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const ALIASES: Record<keyof ContactImportRow, string[]> = {
  institution_name: ['universidad', 'university', 'programa', 'program', 'school', 'college', 'institucion', 'institution', 'escuela'],
  name: ['nombre', 'name', 'contacto', 'contact', 'coach', 'coachname', 'nombrecompleto', 'fullname'],
  role_title: ['cargo', 'puesto', 'title', 'role', 'position', 'rol'],
  email: ['email', 'correo', 'mail', 'correoelectronico'],
  phone: ['telefono', 'phone', 'movil', 'tel', 'mobile'],
  notes: ['notas', 'notes', 'comentarios', 'comments', 'observaciones'],
};
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function parseContactsCsv(text: string): ContactImportResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: [], fatal: 'El archivo está vacío o solo tiene la fila de títulos.' };
  const header = table[0].map(norm);
  const col = {} as Record<keyof ContactImportRow, number>;
  for (const key of Object.keys(ALIASES) as (keyof ContactImportRow)[]) col[key] = header.findIndex((h) => ALIASES[key].includes(h));
  if (col.institution_name < 0 || col.name < 0) {
    return { rows: [], errors: [], fatal: 'Faltan columnas: el archivo necesita al menos «Universidad» y «Nombre» en la primera fila.' };
  }
  const pick = (r: string[], k: keyof ContactImportRow) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '') || null;
  const rows: ContactImportRow[] = [];
  const errors: ContactImportResult['errors'] = [];
  let fatal: string | undefined;
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (rows.length >= CONTACT_IMPORT_MAX) { fatal = `Solo se importan ${CONTACT_IMPORT_MAX} contactos por archivo; divide el resto en otro.`; return; }
    const inst = pick(r, 'institution_name');
    const name = pick(r, 'name');
    const email = pick(r, 'email');
    if (!inst || inst.length < 2) return errors.push({ line, message: 'Falta la universidad.' });
    if (!name || name.length < 2) return errors.push({ line, message: 'Falta el nombre del contacto.' });
    if (email && !EMAIL_RE.test(email)) return errors.push({ line, message: `El email «${email}» no es válido.` });
    rows.push({
      institution_name: inst.slice(0, 200), name: name.slice(0, 120), role_title: pick(r, 'role_title')?.slice(0, 120) ?? null,
      email, phone: pick(r, 'phone')?.slice(0, 40) ?? null, notes: pick(r, 'notes')?.slice(0, 2000) ?? null,
    });
  });
  return { rows, errors, ...(fatal ? { fatal } : {}) };
}
