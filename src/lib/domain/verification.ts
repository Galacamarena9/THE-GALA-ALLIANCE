/**
 * Verificación · textos para personas (nunca estados técnicos como «evidence_required»).
 * El estado efectivo viene de verification_summary(); aquí solo se traduce y se decide el nivel de acceso a mostrar.
 */
export interface VerificationSummary {
  email_verified: boolean; organization_verified: boolean; affiliation_verified: boolean;
  program_verified: boolean; role_verified: boolean; access_active: boolean;
}
export type CheckState = 'done' | 'review' | 'todo';
export const REQUEST_STATUS_TEXT: Record<string, { label: string; tone: CheckState; help?: string }> = {
  draft: { label: 'Sin enviar', tone: 'todo' },
  submitted: { label: 'En revisión', tone: 'review' },
  under_review: { label: 'En revisión', tone: 'review' },
  pending_evidence: { label: 'Necesitamos un paso más', tone: 'todo', help: 'Confirma tu afiliación aportando un enlace al directorio oficial del staff.' },
  approved: { label: 'Verificado', tone: 'done' },
  partially_approved: { label: 'Verificado con límites', tone: 'done' },
  rejected: { label: 'No aprobado', tone: 'todo', help: 'Puedes volver a solicitarlo con más información.' },
  expired: { label: 'Caducado', tone: 'todo' },
  revoked: { label: 'Retirado', tone: 'todo' },
  suspended: { label: 'Suspendido', tone: 'todo' },
};

/** Nivel de acceso que se explica al usuario. «Verified coach» solo cuando todo está verificado. */
export function accessLevel(s: VerificationSummary | null): { key: 'none' | 'limited' | 'full'; label: string; detail: string } {
  if (!s || !s.access_active) return { key: 'none', label: 'Sin acceso a recruiting todavía', detail: 'Cuando se apruebe tu afiliación tendrás acceso según tu rol.' };
  if (s.organization_verified && s.affiliation_verified && s.role_verified) {
    return { key: 'full', label: 'Coach verificado', detail: 'Puedes descubrir atletas, crear shortlists y usar las herramientas de recruiting de tu rol.' };
  }
  return {
    key: 'limited', label: 'Acceso limitado',
    detail: 'Puedes completar el perfil de la organización, programas, necesidades y preferencias. Descubrir atletas, ver datos restringidos, contactar menores o pedir documentos llegará cuando terminemos la verificación.',
  };
}

export function checks(s: VerificationSummary | null): { label: string; state: CheckState }[] {
  return [
    { label: 'Correo institucional', state: s?.email_verified ? 'done' : 'todo' },
    { label: 'Afiliación a la institución', state: s?.affiliation_verified ? 'done' : s?.access_active ? 'review' : 'todo' },
    { label: 'Programa', state: s?.program_verified ? 'done' : 'review' },
    { label: 'Cargo', state: s?.role_verified ? 'done' : 'review' },
    { label: 'Organización verificada', state: s?.organization_verified ? 'done' : 'review' },
  ];
}
