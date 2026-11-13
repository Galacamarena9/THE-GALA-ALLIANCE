/** Edad mínima para tener cuenta propia (COPPA, EE. UU.). */
export const MIN_ACCOUNT_AGE = 13;
/** Por debajo de esta edad el perfil se trata como menor (protección reforzada). */
export const ADULT_AGE = 18;
/** España (art. 7 LOPDGDD): desde 14 años el menor puede consentir por sí mismo cuando la base es el consentimiento. */
export const SPAIN_DIGITAL_CONSENT_AGE = 14;

export function ageOn(dateOfBirth: string, today: Date = new Date()): number {
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export type AgeCheck =
  | { ok: true; age: number; isMinor: boolean; needsGuardianConsent: boolean }
  | { ok: false; reason: 'invalid' | 'future' | 'under_13' };

export function checkAge(dateOfBirth: string, today: Date = new Date()): AgeCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return { ok: false, reason: 'invalid' };
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { ok: false, reason: 'invalid' };
  const age = ageOn(dateOfBirth, today);
  if (Number.isNaN(age)) return { ok: false, reason: 'invalid' };
  if (age < 0) return { ok: false, reason: 'future' };
  if (age < MIN_ACCOUNT_AGE) return { ok: false, reason: 'under_13' };
  return {
    ok: true,
    age,
    isMinor: age < ADULT_AGE,
    needsGuardianConsent: age < SPAIN_DIGITAL_CONSENT_AGE,
  };
}
