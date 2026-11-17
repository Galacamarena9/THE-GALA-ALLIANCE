/**
 * Base de conocimiento de Gala AI: la guía editorial (con fuentes oficiales y fecha de revisión).
 * Búsqueda léxica simple y explicable; devuelve fragmentos, nunca la guía completa.
 */
import { GUIDE } from '../../content/guide.ts';

export interface KnowledgeHit {
  slug: string; chapter: string; heading: string; text: string;
  sources: { label: string; url: string }[]; reviewed: string; stale: boolean; score: number;
}

const STOP = new Set('de la el los las un una y o en para por con que qué es son del al lo como cómo mi mis tu tus se a the of and or in for to is are my what how do i'.split(' '));
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function tokens(s: string) { return norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)); }

/** Una sección se considera pendiente de revisión si su capítulo se revisó hace más de 6 meses. */
export function isStale(reviewed: string, now = new Date()) {
  const [y, m] = reviewed.split('-').map(Number);
  if (!y || !m) return true;
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  return months > 6;
}

export function searchKnowledge(query: string, k = 3, now = new Date()): KnowledgeHit[] {
  const q = tokens(query);
  if (!q.length) return [];
  const hits: KnowledgeHit[] = [];
  for (const c of GUIDE) {
    for (const s of c.sections) {
      const text = [...(s.paragraphs ?? []), ...(s.bullets ?? []).map((b) => `• ${b}`)].join('\n');
      const hay = tokens(`${c.title} ${s.heading} ${text}`);
      const head = new Set(tokens(`${c.title} ${s.heading}`));
      let score = 0;
      for (const t of q) {
        const n = hay.filter((h) => h === t || (t.length > 4 && h.startsWith(t.slice(0, 5)))).length;
        if (n) score += Math.min(n, 3) + (head.has(t) ? 2 : 0);
      }
      if (score > 0) hits.push({ slug: c.slug, chapter: c.title, heading: s.heading, text: text.slice(0, 1400), sources: c.sources, reviewed: c.reviewed, stale: isStale(c.reviewed, now), score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
