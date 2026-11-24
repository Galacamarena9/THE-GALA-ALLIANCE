/**
 * Fase 3 de la auditoría (H3): ninguna escritura a la base de datos se da por buena sin mirar su error.
 * - must(): la escritura es parte de lo que el usuario pidió. Si falla, se corta la acción y el usuario ve la
 *   pantalla de error (no un «guardado» falso). El detalle técnico va solo al registro del servidor.
 * - bestEffort(): la escritura es secundaria (analítica, historial accesorio, limpieza). Si falla, se registra y la
 *   acción principal sigue.
 * Una prueba (writes-checked.test.ts) impide añadir escrituras sin pasar por uno de los dos.
 */
type DbResult = { error: { message: string; code?: string } | null };

export class WriteFailedError extends Error {
  readonly what: string;
  constructor(what: string) {
    super(`write_failed:${what}`);
    this.what = what;
    this.name = 'WriteFailedError';
  }
}

export function must<T extends DbResult>(res: T, what: string): T {
  if (res.error) {
    console.error(`[write-failed] ${what}: ${res.error.code ?? ''} ${res.error.message}`);
    throw new WriteFailedError(what);
  }
  return res;
}

export function bestEffort(res: DbResult, what: string): void {
  if (res.error) console.error(`[best-effort-failed] ${what}: ${res.error.code ?? ''} ${res.error.message}`);
}
