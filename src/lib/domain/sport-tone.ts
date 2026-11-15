/**
 * Color de identidad por deporte (identidad v2). Sirve para reconocer el deporte de un atleta de un vistazo
 * en avatares y fichas. Nunca es la única pista: el nombre del deporte siempre se muestra en texto al lado.
 */
export type SportTone = 'basketball' | 'football' | 'volleyball' | 'tennis' | 'athletics' | 'swimming' | 'other';

/** Clases literales para que Tailwind las genere (tokens --color-sport-* en globals.css; texto blanco con contraste ≥ 5:1). */
export const SPORT_TONE_CLASS: Record<SportTone, string> = {
  basketball: 'bg-sport-basketball text-white',
  football: 'bg-sport-football text-white',
  volleyball: 'bg-sport-volleyball text-white',
  tennis: 'bg-sport-tennis text-white',
  athletics: 'bg-sport-athletics text-white',
  swimming: 'bg-sport-swimming text-white',
  other: 'bg-sport-other text-white',
};

const RULES: Array<[RegExp, SportTone]> = [
  [/american|americano/, 'other'],
  [/basket|baloncesto/, 'basketball'],
  [/volley|voley|voleibol/, 'volleyball'],
  [/futbol|football|soccer/, 'football'],
  [/tenis|tennis/, 'tennis'],
  [/atletismo|athletics|track/, 'athletics'],
  [/natacion|swim/, 'swimming'],
];

export function sportTone(name: string | null | undefined): SportTone {
  if (!name) return 'other';
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const [re, tone] of RULES) if (re.test(n)) return tone;
  return 'other';
}
