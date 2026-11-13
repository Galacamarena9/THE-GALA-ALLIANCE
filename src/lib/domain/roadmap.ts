import type { Division } from '@/lib/types';

/**
 * Roadmap familiar dinámico: cruza el curso actual (años hasta la graduación)
 * con las divisiones objetivo y devuelve las tareas de la etapa.
 *
 * Los requisitos de elegibilidad cambian: cada tarea enlaza a la fuente oficial
 * y la plataforma no garantiza elegibilidad. Revisar con el Eligibility Center.
 */
export type Stage = 'explore' | 'profile' | 'contact' | 'apply' | 'commit';

export interface RoadmapTask {
  id: string;
  stage: Stage;
  title: string;
  why: string;
  owner: 'atleta' | 'familia' | 'ambos';
  divisions?: Division[];
  source?: { label: string; url: string };
}

const NCAA_ELIGIBILITY = { label: 'NCAA Eligibility Center', url: 'https://web3.ncaa.org/ecwr3/' };
const NCAA_INTERNATIONAL = {
  label: 'NCAA · International students',
  url: 'https://www.ncaa.org/sports/2021/2/8/international-student-athletes.aspx',
};
const NAIA_ELIGIBILITY = { label: 'NAIA Eligibility Center', url: 'https://play.mynaia.org/' };
const F1_VISA = { label: 'EducationUSA · Visado de estudiante', url: 'https://educationusa.state.gov/' };

const TASKS: RoadmapTask[] = [
  { id: 'explore-divisions', stage: 'explore', title: 'Entender las divisiones (NCAA D1/D2/D3, NAIA, JUCO)', why: 'Cada división tiene nivel deportivo, ayudas y requisitos académicos distintos.', owner: 'ambos' },
  { id: 'explore-budget', stage: 'explore', title: 'Fijar un presupuesto anual familiar realista', why: 'Pocas becas cubren el 100 %: el coste neto decide qué universidades son viables.', owner: 'familia' },
  { id: 'profile-video', stage: 'profile', title: 'Grabar y montar el vídeo de highlights', why: 'Es lo primero que mira un coach. 3-5 minutos, tus mejores acciones al principio.', owner: 'atleta' },
  { id: 'profile-english', stage: 'profile', title: 'Preparar y hacer el examen de inglés', why: 'Las universidades lo piden para la admisión académica de estudiantes internacionales.', owner: 'atleta' },
  { id: 'profile-transcripts', stage: 'profile', title: 'Reunir notas oficiales y traducción', why: 'Las certificaciones académicas suelen tener que ir traducidas y con validez oficial.', owner: 'familia', divisions: ['ncaa_d1', 'ncaa_d2'], source: NCAA_INTERNATIONAL },
  { id: 'register-ncaa', stage: 'profile', title: 'Registrarse en el NCAA Eligibility Center', why: 'Necesario para competir en NCAA D1 y D2. Hazlo con tiempo: la revisión de documentos tarda.', owner: 'ambos', divisions: ['ncaa_d1', 'ncaa_d2'], source: NCAA_ELIGIBILITY },
  { id: 'register-naia', stage: 'profile', title: 'Registrarse en el NAIA Eligibility Center', why: 'La NAIA tiene su propio proceso de elegibilidad.', owner: 'ambos', divisions: ['naia'], source: NAIA_ELIGIBILITY },
  { id: 'contact-shortlist', stage: 'contact', title: 'Hacer una lista de 20-30 programas con encaje', why: 'Mezcla programas de encaje fuerte, posible y exigente.', owner: 'ambos' },
  { id: 'contact-coaches', stage: 'contact', title: 'Contactar a los coaches con un mensaje personalizado', why: 'Respuestas cualificadas = mensajes concretos con vídeo y datos, no plantillas masivas.', owner: 'atleta' },
  { id: 'apply-admissions', stage: 'apply', title: 'Solicitar la admisión académica en cada universidad', why: 'La beca deportiva no sustituye a la admisión académica.', owner: 'ambos' },
  { id: 'apply-compare', stage: 'apply', title: 'Comparar ofertas por coste neto, no por el titular', why: '"Beca del 50 %" puede significar costes muy distintos según matrícula, alojamiento y seguro.', owner: 'familia' },
  { id: 'commit-visa', stage: 'commit', title: 'Tramitar el I-20 y el visado de estudiante', why: 'La universidad emite el I-20 tras la admisión; después, cita en el consulado.', owner: 'ambos', source: F1_VISA },
  { id: 'commit-final-eligibility', stage: 'commit', title: 'Confirmar la certificación final de elegibilidad', why: 'Tras graduarte hay que enviar la documentación final al centro de elegibilidad.', owner: 'ambos', divisions: ['ncaa_d1', 'ncaa_d2', 'naia'] },
];

/** Etapa recomendada según los años que faltan para graduarse del instituto. */
export function stageFor(graduationYear: number | null, today: Date = new Date()): Stage {
  if (!graduationYear) return 'explore';
  // El curso académico cambia en verano: a partir de julio cuenta el siguiente.
  const academicYearEnd = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
  const yearsLeft = graduationYear - academicYearEnd;
  if (yearsLeft >= 3) return 'explore';
  if (yearsLeft === 2) return 'profile';
  if (yearsLeft === 1) return 'contact';
  if (yearsLeft === 0) return 'apply';
  return 'commit';
}

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'explore', label: 'Explorar' },
  { id: 'profile', label: 'Preparar perfil' },
  { id: 'contact', label: 'Contactar' },
  { id: 'apply', label: 'Solicitar' },
  { id: 'commit', label: 'Comprometerse' },
];

export function roadmapFor(graduationYear: number | null, divisions: Division[], today: Date = new Date()) {
  const current = stageFor(graduationYear, today);
  const currentIdx = STAGES.findIndex((s) => s.id === current);
  const relevant = TASKS.filter(
    (t) => !t.divisions || divisions.length === 0 || t.divisions.some((d) => divisions.includes(d)),
  );
  return STAGES.map((s, idx) => ({
    ...s,
    state: idx < currentIdx ? ('past' as const) : idx === currentIdx ? ('current' as const) : ('upcoming' as const),
    tasks: relevant.filter((t) => t.stage === s.id),
  }));
}
