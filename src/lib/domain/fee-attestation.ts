/**
 * Ciclo 3 · Declaración de tarifas de la agencia (riesgo NCAA bylaws 12.02.1 / 12.3.3, sin validación legal).
 * El texto canónico lo guarda la base de datos (public.fee_statement); aquí solo la versión vigente y cómo se enseña.
 */
export const FEE_STATEMENT_VERSION = '2026-11';

export interface FeeAttestation { statement: string; attestedAt: string; version: string }

/** Línea que ve el atleta o su familia en la propuesta. */
export function attestationLine(a: FeeAttestation | null | undefined): { tone: 'ok' | 'warn'; text: string } {
  if (!a) return { tone: 'warn', text: 'Esta agencia no ha registrado su declaración de tarifas. Pídesela antes de autorizar.' };
  const date = new Date(a.attestedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
  return { tone: 'ok', text: `${a.statement} Declarado el ${date} (versión ${a.version}).` };
}

type Row = { representation_id: string; statement: string; statement_version: string; attested_at: string };
/** Última declaración por representación (las filas llegan de la más reciente a la más antigua). */
export function feeAttestationMap(rows: Row[] | null | undefined): Map<string, FeeAttestation> {
  const m = new Map<string, FeeAttestation>();
  for (const r of rows ?? []) if (!m.has(r.representation_id)) m.set(r.representation_id, { statement: r.statement, attestedAt: r.attested_at, version: r.statement_version });
  return m;
}

// ---------- Cupo fundador (15 agencias, −40 % de por vida) ----------
/** Precio fundador por plan (céntimos). La base de datos (plan_catalog v3) es la fuente que se cobra. */
export const FOUNDER_PRICE_CENTS: Record<string, number> = { agent_solo: 4700, agent_team: 11900 };


export function founderSeats(s: { cap: number; taken: number; remaining: number } | null | undefined): { open: boolean; remaining: number; text: string } {
  if (!s) return { open: false, remaining: 0, text: 'Precio fundador −40 % de por vida para las 15 primeras agencias.' };
  if (s.remaining <= 0) return { open: false, remaining: 0, text: `Las ${s.cap} plazas de precio fundador están ocupadas. Se aplica la tarifa.` };
  return { open: true, remaining: s.remaining, text: `Precio fundador −40 % de por vida: quedan ${s.remaining} de ${s.cap} plazas.` };
}
