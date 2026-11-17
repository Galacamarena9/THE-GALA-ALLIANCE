/**
 * Taxonomía de estudios (CIP de 4 dígitos del Departamento de Educación de EE. UU.).
 * Convierte lo que escribe el atleta ("Business", "ADE", "Fisioterapia") en códigos para comparar con
 * los programas oficiales de cada universidad. Distingue coincidencia EXACTA de CAMPO RELACIONADO.
 */
export interface MajorDef { key: string; label: string; exact: string[]; family: string; aliases: string[] }

export const MAJORS: MajorDef[] = [
  { key: 'business', label: 'Business', exact: ['5202', '5201'], family: '52', aliases: ['business', 'ade', 'administracion de empresas', 'empresa', 'empresariales', 'business administration', 'management', 'gestion'] },
  { key: 'finance', label: 'Finanzas', exact: ['5208'], family: '52', aliases: ['finance', 'finanzas', 'banca'] },
  { key: 'accounting', label: 'Contabilidad', exact: ['5203'], family: '52', aliases: ['accounting', 'contabilidad', 'auditoria'] },
  { key: 'marketing', label: 'Marketing', exact: ['5214'], family: '52', aliases: ['marketing', 'mercadotecnia', 'publicidad'] },
  { key: 'intl_business', label: 'International Business', exact: ['5211'], family: '52', aliases: ['international business', 'negocios internacionales', 'comercio internacional'] },
  { key: 'economics', label: 'Economía', exact: ['4506'], family: '45', aliases: ['economics', 'economia'] },
  { key: 'sport_management', label: 'Gestión deportiva', exact: ['3105'], family: '31', aliases: ['sport management', 'sports management', 'gestion deportiva', 'direccion deportiva'] },
  { key: 'kinesiology', label: 'Ciencias del deporte', exact: ['3105', '2607'], family: '31', aliases: ['kinesiology', 'exercise science', 'cafyd', 'inef', 'ciencias del deporte', 'ciencias de la actividad fisica'] },
  { key: 'physio', label: 'Fisioterapia', exact: ['5123'], family: '51', aliases: ['fisioterapia', 'physical therapy', 'physiotherapy', 'rehabilitacion'] },
  { key: 'nursing', label: 'Enfermería', exact: ['5138'], family: '51', aliases: ['nursing', 'enfermeria'] },
  { key: 'health', label: 'Ciencias de la salud', exact: ['5100', '5109'], family: '51', aliases: ['health', 'salud', 'ciencias de la salud', 'pre-med', 'premed', 'medicina', 'medicine'] },
  { key: 'psychology', label: 'Psicología', exact: ['4201', '4228'], family: '42', aliases: ['psychology', 'psicologia'] },
  { key: 'communication', label: 'Comunicación', exact: ['0901', '0909'], family: '09', aliases: ['communication', 'communications', 'comunicacion', 'comunicacion audiovisual', 'relaciones publicas'] },
  { key: 'journalism', label: 'Periodismo', exact: ['0904'], family: '09', aliases: ['journalism', 'periodismo'] },
  { key: 'computer_science', label: 'Informática', exact: ['1107', '1101'], family: '11', aliases: ['computer science', 'informatica', 'ingenieria informatica', 'software', 'programacion', 'data science', 'ciencia de datos'] },
  { key: 'engineering', label: 'Ingeniería', exact: ['1401', '1419', '1408', '1410', '1409'], family: '14', aliases: ['engineering', 'ingenieria', 'mechanical engineering', 'ingenieria mecanica', 'civil engineering', 'ingenieria civil', 'electrical engineering', 'ingenieria electrica', 'industrial'] },
  { key: 'biology', label: 'Biología', exact: ['2601'], family: '26', aliases: ['biology', 'biologia', 'biotecnologia', 'biotechnology'] },
  { key: 'chemistry', label: 'Química', exact: ['4005'], family: '40', aliases: ['chemistry', 'quimica'] },
  { key: 'mathematics', label: 'Matemáticas', exact: ['2701'], family: '27', aliases: ['mathematics', 'math', 'matematicas', 'estadistica', 'statistics'] },
  { key: 'education', label: 'Educación', exact: ['1312', '1301'], family: '13', aliases: ['education', 'educacion', 'magisterio', 'teaching'] },
  { key: 'political_science', label: 'Ciencias Políticas', exact: ['4510', '4509'], family: '45', aliases: ['political science', 'ciencias politicas', 'relaciones internacionales', 'international relations'] },
  { key: 'criminal_justice', label: 'Criminología', exact: ['4301'], family: '43', aliases: ['criminal justice', 'criminologia'] },
  { key: 'law', label: 'Derecho (estudios legales)', exact: ['2203', '2200'], family: '22', aliases: ['law', 'derecho', 'pre-law', 'legal studies'] },
  { key: 'architecture', label: 'Arquitectura', exact: ['0402'], family: '04', aliases: ['architecture', 'arquitectura'] },
  { key: 'design', label: 'Diseño', exact: ['5004'], family: '50', aliases: ['design', 'diseno', 'graphic design', 'diseno grafico'] },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Busca la definición para un texto libre. Devuelve null si no lo reconocemos (y lo decimos: no adivinamos). */
export function resolveMajor(text: string): MajorDef | null {
  const t = norm(text);
  if (!t) return null;
  return MAJORS.find((m) => m.aliases.some((a) => t === a || t.includes(a))) ?? null;
}

export type ProgramMatch = 'exact' | 'related' | 'none';

/** Compara un estudio deseado con los programas oficiales (CIP de 4 dígitos) de una universidad. */
export function programMatch(major: MajorDef, programCips: string[]): ProgramMatch {
  if (programCips.some((c) => major.exact.includes(c))) return 'exact';
  if (programCips.some((c) => c.startsWith(major.family))) return 'related';
  return 'none';
}
