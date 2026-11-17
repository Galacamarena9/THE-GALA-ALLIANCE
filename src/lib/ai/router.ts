/**
 * GALA AI · enrutador de intenciones (determinista, ES/EN).
 * Decide qué herramientas internas necesita una pregunta para recuperar el MÍNIMO contexto.
 * Si no hay modelo configurado, la intención también decide la respuesta de respaldo.
 */
export type Lang = 'es' | 'en';
export type Intent =
  | 'next_action' | 'match_explain' | 'search_universities' | 'compare' | 'pipeline' | 'deadlines'
  | 'passport' | 'draft_message' | 'offers' | 'knowledge' | 'safety' | 'general';

export const INTENT_TOOLS: Record<Intent, string[]> = {
  next_action: ['get_next_best_action'],
  match_explain: ['explain_match'],
  search_universities: ['search_universities'],
  compare: ['compare_universities'],
  pipeline: ['get_pipeline_summary'],
  deadlines: ['get_deadlines'],
  passport: ['get_passport_gaps'],
  draft_message: ['present_drafts'],
  offers: ['get_pipeline_summary', 'search_knowledge'],
  knowledge: ['search_knowledge'],
  safety: ['search_knowledge'],
  general: ['search_knowledge'],
};

const EN_HINTS = /\b(the|what|how|which|should|my|is|are|can|do|does|why|when|where|university|universities|scholarship|help)\b/gi;
const ES_HINTS = /\b(el|la|los|las|qué|que|cómo|como|cuál|cual|debo|mi|mis|es|son|puedo|por qué|cuándo|dónde|universidad|universidades|beca|ayuda)\b/gi;
export function detectLang(text: string): Lang {
  const en = (text.match(EN_HINTS) ?? []).length;
  const es = (text.match(ES_HINTS) ?? []).length + (/[ñáéíóú¿¡]/i.test(text) ? 2 : 0);
  return en > es ? 'en' : 'es';
}

// Orden importante: lo más específico primero. La seguridad siempre gana.
const RULES: [Intent, RegExp][] = [
  ['safety', /(acoso|me (está|esta) presionando|fotos? (privad|íntim|intim)|me pide(n)? (fotos|dinero|mi direcci)|whatsapp privado|harass|asking (me )?for (photos|money)|groom|amenaz|threat)/i],
  ['draft_message', /(redact|escrib(e|ir|eme)|borrador|draft|write (a|an|me)|email|correo|mensaje (al|a la|para)|message (to|for))/i],
  ['compare', /(compar|vs\.?|versus|diferencia entre .+ y )/i],
  ['match_explain', /(por qué|porque|why).*(match|encaj|compatib|%|porcentaje)|(match|encaje).*(explica|explain|significa|mean)/i],
  ['next_action', /(siguiente paso|qué hago|que hago|por dónde empiezo|qué me toca|next (step|best action)|what should i do|where do i start|prioridad)/i],
  ['deadlines', /(plazo|fecha l[ií]mite|deadline|vence|cu[aá]ndo cierra|due)/i],
  ['pipeline', /(pipeline|proceso|procesos|seguimiento|candidatur|application status|my applications)/i],
  ['offers', /(oferta|offer|beca completa|full ride|coste neto|net cost)/i],
  ['passport', /(passport|perfil|me falta|completar|readiness|prepar|what am i missing)/i],
  ['search_universities', /(busca|encuentra|recomi[eé]nda|qu[eé] universidades|universidades (en|de|con|que)|find|search|recommend|universities (in|with|for))/i],
  ['knowledge', /(ncaa|naia|njcaa|juco|division|divisi[oó]n|visado|visa|i-?20|sevis|toefl|ielts|duolingo|sat\b|act\b|eligib|elegib|amateur|nil\b|transcript|expediente|homolog)/i],
];

export function routeIntent(text: string): { intent: Intent; lang: Lang; tools: string[] } {
  const lang = detectLang(text);
  const hit = RULES.find(([, re]) => re.test(text));
  const intent: Intent = hit ? hit[0] : 'general';
  return { intent, lang, tools: INTENT_TOOLS[intent] };
}
