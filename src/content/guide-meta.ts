/**
 * Metadatos de control de la base de conocimiento de Gala AI (Fase 06 · punto 15).
 * Cada capítulo de la guía declara a qué sistema aplica, su versión, su estado editorial y quién lo revisó.
 * - `draft`: no se usa en respuestas.
 * - `review_pending`: se usa, pero Gala avisa y remite a la fuente oficial.
 * - `reviewer`: solo se rellena cuando una persona real lo ha revisado. Si falta, la interfaz lo dice.
 * Al cambiar una norma: sube `version`, actualiza `reviewed` en la guía y, si hace falta, marca `review_pending`.
 */
export type KnowledgeSystem = 'ncaa' | 'naia' | 'njcaa' | 'us_immigration' | 'us_admissions' | 'general';
export type KnowledgeStatus = 'published' | 'review_pending' | 'draft';
export interface GuideMeta {
  version: number;
  systems: KnowledgeSystem[];
  productArea: 'college_recruiting' | 'costs' | 'documents' | 'visa' | 'nil' | 'process';
  status: KnowledgeStatus;
  reviewer?: string;
}

export const SYSTEM_LABEL: Record<KnowledgeSystem, string> = {
  ncaa: 'NCAA', naia: 'NAIA', njcaa: 'NJCAA', us_immigration: 'Inmigración EE. UU.', us_admissions: 'Admisiones EE. UU.', general: 'General',
};

export const GUIDE_META: Record<string, GuideMeta> = {
  'divisiones-y-becas': { version: 1, systems: ['ncaa', 'naia', 'njcaa'], productArea: 'college_recruiting', status: 'published' },
  'requisitos-academicos': { version: 1, systems: ['ncaa', 'naia'], productArea: 'college_recruiting', status: 'published' },
  documentos: { version: 1, systems: ['ncaa', 'naia', 'us_admissions'], productArea: 'documents', status: 'published' },
  'proceso-paso-a-paso': { version: 1, systems: ['general'], productArea: 'process', status: 'published' },
  visado: { version: 1, systems: ['us_immigration'], productArea: 'visa', status: 'published' },
  'coste-real': { version: 1, systems: ['us_admissions', 'general'], productArea: 'costs', status: 'published' },
  'elegir-universidad': { version: 1, systems: ['general'], productArea: 'college_recruiting', status: 'published' },
  'lo-que-te-vas-a-encontrar': { version: 1, systems: ['general'], productArea: 'process', status: 'published' },
  'nil-y-marcas': { version: 1, systems: ['ncaa', 'us_immigration'], productArea: 'nil', status: 'review_pending' },
};
