/** Importar la cartera de la agencia desde CSV/Excel («Guardar como CSV»). Lógica pura, sin dependencias. */
import { parseCsv } from './csv-import.ts';

export const PORTFOLIO_IMPORT_MAX = 200;

export interface PortfolioImportRow { full_name: string; email: string | null; sport: string | null; graduation_year: number | null }
export interface PortfolioImportResult { rows: PortfolioImportRow[]; errors: { line: number; message: string }[]; fatal?: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const ALIASES: Record<keyof PortfolioImportRow, string[]> = {
  full_name: ['nombre', 'name', 'atleta', 'athlete', 'jugador', 'jugadora', 'player', 'nombrecompleto', 'fullname', 'nombreyapellidos'],
  email: ['email', 'correo', 'mail', 'correoelectronico'],
  sport: ['deporte', 'sport'],
  graduation_year: ['promocion', 'graduacion', 'graduationyear', 'classof', 'ano', 'anograduacion', 'year', 'clase'],
};
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function parsePortfolioCsv(text: string, thisYear = new Date().getFullYear()): PortfolioImportResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: [], fatal: 'El archivo está vacío o solo tiene la fila de títulos.' };
  const header = table[0].map(norm);
  const col = {} as Record<keyof PortfolioImportRow, number>;
  for (const key of Object.keys(ALIASES) as (keyof PortfolioImportRow)[]) col[key] = header.findIndex((h) => ALIASES[key].includes(h));
  if (col.full_name < 0) return { rows: [], errors: [], fatal: 'Falta la columna «Nombre» en la primera fila.' };
  const pick = (r: string[], k: keyof PortfolioImportRow) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '') || null;
  const rows: PortfolioImportRow[] = [];
  const errors: PortfolioImportResult['errors'] = [];
  const seen = new Set<string>();
  let fatal: string | undefined;
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (rows.length >= PORTFOLIO_IMPORT_MAX) { fatal = `Solo se importan ${PORTFOLIO_IMPORT_MAX} atletas por archivo; divide el resto en otro.`; return; }
    const name = pick(r, 'full_name');
    if (!name || name.length < 2) return void errors.push({ line, message: 'Falta el nombre.' });
    const email = pick(r, 'email')?.toLowerCase() ?? null;
    if (email && !EMAIL_RE.test(email)) return void errors.push({ line, message: `El email «${email}» no es válido.` });
    const rawYear = pick(r, 'graduation_year');
    const year = rawYear ? Number(rawYear.replace(/\D/g, '')) : null;
    if (rawYear && (!year || year < thisYear - 2 || year > thisYear + 8)) return void errors.push({ line, message: `La promoción «${rawYear}» no parece un año válido.` });
    const key = `${norm(name)}|${email ?? ''}`;
    if (seen.has(key)) return void errors.push({ line, message: `«${name}» está repetido.` });
    seen.add(key);
    rows.push({ full_name: name.slice(0, 120), email, sport: pick(r, 'sport')?.slice(0, 60) ?? null, graduation_year: year });
  });
  return { rows, errors, fatal };
}

/** Mensaje listo para WhatsApp o email (español), neutro respecto a la NCAA: «acompañar», nunca «representar». */
export function inviteMessage(p: { athleteFirstName: string; agencyName: string; link: string }): string {
  return `Hola ${p.athleteFirstName}, soy de ${p.agencyName}. Para organizar tu proceso hacia EE. UU. usamos The Gala Alliance: tu perfil es tuyo, gratis, y tú decides qué compartes. Créalo o entra aquí: ${p.link}`;
}
