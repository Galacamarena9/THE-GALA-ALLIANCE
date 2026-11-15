/** Qué hacer con el doble factor según el nivel de la sesión (aal1 = solo contraseña, aal2 = contraseña + código). */
export type Aal = 'aal1' | 'aal2' | null;

export function mfaStep({ current, next, admin }: { current: Aal; next: Aal; admin: boolean }): 'ok' | 'challenge' | 'enroll' {
  if (current === 'aal1' && next === 'aal2') return 'challenge';
  if (current === 'aal2') return 'ok';
  return admin ? 'enroll' : 'ok';
}
