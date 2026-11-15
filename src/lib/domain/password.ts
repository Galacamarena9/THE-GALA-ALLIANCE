/** Reglas de contraseña (registro y cambio). Puras: se prueban con node --test. */

const COMMON = new Set([
  '1234567890', '12345678910', '0123456789', '9876543210', '1111111111', 'qwertyuiop', 'qwerty1234', 'password123',
  'password1234', 'contraseña1', 'contrasena123', 'iloveyou123', 'baloncesto1', 'futbol12345', '123456789a', 'abcdefghij',
]);

function isCommon(pw: string) {
  return COMMON.has(pw.toLowerCase()) || new Set(pw).size <= 2;
}

export function checkNewPassword(password: string, confirm: string): { ok: true } | { ok: false; error: string } {
  if (password.length < 10) return { ok: false, error: 'Mínimo 10 caracteres' };
  if (password.length > 72) return { ok: false, error: 'Máximo 72 caracteres' };
  if (isCommon(password)) return { ok: false, error: 'Esa contraseña es demasiado común' };
  if (password !== confirm) return { ok: false, error: 'Las contraseñas no coinciden' };
  return { ok: true };
}

/** 0 muy débil · 1 débil · 2 aceptable · 3 fuerte · 4 muy fuerte. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < 10 || isCommon(pw)) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 20 && classes >= 3) return 4;
  if (classes >= 4 && pw.length >= 12) return 3;
  if (classes >= 3) return 2;
  return 1;
}
