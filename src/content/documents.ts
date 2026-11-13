/** Checklist documental del proceso (fuente: guía oficial de la plataforma, capítulo "Documentos"). */
export const DOC_KINDS = [
  'passport', 'transcript', 'translation', 'graduation_proof', 'english_test', 'sat_act',
  'highlight_video', 'i20', 'sevis_receipt', 'ds160', 'financial', 'medical', 'other',
] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/** Documentos de visado y llegada: su calendario forma parte de Elite. */
export const VISA_KINDS: DocKind[] = ['i20', 'sevis_receipt', 'ds160', 'financial', 'medical'];

export interface DocItem {
  kind: DocKind;
  title: string;
  when: string;
  /** Meses antes del 1 de agosto del año de graduación en que conviene tenerlo. */
  monthsBefore: number;
  why: string;
}

export const DOC_CHECKLIST: DocItem[] = [
  { kind: 'highlight_video', title: 'Vídeo de highlights', when: 'Desde 1.º de Bachillerato', monthsBefore: 20, why: 'Es lo primero que mira un coach.' },
  { kind: 'transcript', title: 'Certificados oficiales de notas (ESO y Bachillerato)', when: 'Al final de cada curso', monthsBefore: 14, why: 'Los pide el centro de elegibilidad y la admisión.' },
  { kind: 'translation', title: 'Traducción de los certificados', when: 'Cuando la universidad o el centro de elegibilidad lo pida', monthsBefore: 12, why: 'Debe ser la que acepte la institución.' },
  { kind: 'passport', title: 'Pasaporte en vigor', when: 'Antes de inscribirte en exámenes', monthsBefore: 12, why: 'Identificación para SAT/TOEFL y para el visado.' },
  { kind: 'english_test', title: 'Resultado de inglés (TOEFL, IELTS o Duolingo)', when: 'Antes de las solicitudes de admisión', monthsBefore: 10, why: 'Lo exige cada universidad para la admisión.' },
  { kind: 'sat_act', title: 'Resultado SAT/ACT (si te lo piden)', when: 'Antes de las solicitudes de admisión', monthsBefore: 10, why: 'No lo exige la NCAA, sí algunas universidades o becas académicas.' },
  { kind: 'graduation_proof', title: 'Prueba de graduación del instituto', when: 'Al terminar Bachillerato', monthsBefore: 1, why: 'Cierra la certificación académica.' },
  { kind: 'financial', title: 'Documentación económica', when: 'Antes de que la universidad emita el I-20', monthsBefore: 5, why: 'Debe coincidir con lo que figura en el I-20.' },
  { kind: 'i20', title: 'Formulario I-20', when: 'Tras aceptar la oferta', monthsBefore: 4, why: 'Lo emite la universidad; sin él no hay visado.' },
  { kind: 'sevis_receipt', title: 'Justificante de la tasa SEVIS I-901', when: 'Tras recibir el I-20', monthsBefore: 3, why: 'Obligatorio antes de la entrevista del visado.' },
  { kind: 'ds160', title: 'Confirmación del DS-160', when: 'Tras pagar la tasa SEVIS', monthsBefore: 3, why: 'Formulario del visado F-1.' },
  { kind: 'medical', title: 'Informe médico y vacunas', when: 'Antes de viajar', monthsBefore: 2, why: 'Lo piden la universidad y el departamento de deportes.' },
];

/** Fecha recomendada (ISO) para un documento según el año de graduación del atleta. */
export function suggestedDueDate(kind: DocKind, graduationYear: number | null): string | null {
  const item = DOC_CHECKLIST.find((d) => d.kind === kind);
  if (!item || !graduationYear) return null;
  const d = new Date(Date.UTC(graduationYear, 7, 1));
  d.setUTCMonth(d.getUTCMonth() - item.monthsBefore);
  return d.toISOString().slice(0, 10);
}

export const DOC_KIND_LABEL: Record<DocKind, string> = Object.fromEntries(
  [...DOC_CHECKLIST.map((d) => [d.kind, d.title]), ['other', 'Otro documento']],
) as Record<DocKind, string>;
