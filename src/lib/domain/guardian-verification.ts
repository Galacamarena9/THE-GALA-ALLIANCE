/**
 * Fase 5 de la auditoría: verificación del tutor de un menor.
 * Ver lo que el atleta comparte no cambia; DECIDIR por un menor (aprobar contactos, pruebas, matrículas,
 * representación, enlaces de su perfil) exige un tutor verificado: declaración firmada + revisión de The Gala Alliance
 * (o comprobaciones automáticas si administración las activa).
 */
export const GUARDIAN_STATEMENT_VERSION = 'guardian-2026-11';

export type GuardianState = 'not_required' | 'link_inactive' | 'not_guardian' | 'needs_attestation' | 'pending_review' | 'verified';

/** Texto que se declara (versión GUARDIAN_STATEMENT_VERSION). Pendiente de revisión por abogado antes de producción. */
/** Texto revisado por el abogado (OK 25-11-2026, D-28). Si cambia, sube GUARDIAN_STATEMENT_VERSION y la versión en la base de datos. */
export function guardianStatement(athleteName: string): string {
  return `Declaro que soy la madre, el padre o el tutor legal de ${athleteName}, que soy mayor de edad y que tengo autoridad para dar consentimientos en su nombre. Entiendo que una declaración falsa supone el cierre de mi cuenta.`;
}

export function guardianStateCopy(state: GuardianState | null | undefined): { title: string; body: string; tone: 'ok' | 'warn' | 'neutral' } | null {
  switch (state) {
    case 'needs_attestation':
      return { tone: 'warn', title: 'Confirma que eres su tutor legal', body: 'Ya puedes ver lo que comparte. Para aprobar contactos, pruebas o representación en su nombre, primero firma esta declaración y la revisamos.' };
    case 'pending_review':
      return { tone: 'neutral', title: 'Revisando tu declaración', body: 'The Gala Alliance está comprobando que eres su tutor legal. Mientras tanto ves lo mismo que antes, pero las aprobaciones en su nombre esperan.' };
    case 'verified':
      return { tone: 'ok', title: 'Tutor verificado', body: 'Puedes aprobar en su nombre lo que requiera el consentimiento de su familia.' };
    case 'not_guardian':
      return { tone: 'neutral', title: 'Familiar sin poder de decisión', body: 'Solo la madre, el padre o el tutor legal pueden aprobar en nombre de un menor.' };
    default:
      return null;
  }
}

/** Mensaje claro cuando la base de datos frena una decisión por falta de verificación. */
export function guardianErrorMessage(dbMessage: string | null | undefined): string | null {
  return (dbMessage ?? '').includes('guardian_verification_required')
    ? 'Para aprobar en nombre de un menor tienes que estar verificado como su tutor legal. Hazlo desde Familia → «Confirma que eres su tutor legal».'
    : null;
}
