/**
 * Guardas de Gala AI (puras): separación de datos/instrucciones, límites y señales de riesgo.
 */

/** Texto de terceros (descripciones de oportunidades, notas…) entra como DATO etiquetado, recortado y sin marcas de control. */
export function asData(value: unknown, max = 4000): string {
  const json = JSON.stringify(value, (_k, v) => (typeof v === 'string' ? v.replace(/<\/?(system|instructions?|untrusted_data)[^>]*>/gi, '').slice(0, 1200) : v));
  return `<untrusted_data>${json.slice(0, max)}</untrusted_data>`;
}

const INJECTION = /(ignore (all |the )?(previous|above) instructions|ignora (todas )?las instrucciones|you are now|act[uú]a como|system prompt|revela (tu|el) prompt|developer mode)/i;
export function looksLikeInjection(text: string) { return INJECTION.test(text); }

/** Peticiones de datos privados de otras personas: se rechazan antes de llamar al modelo. */
const OTHERS_DATA = /(tel[eé]fono|m[oó]vil|email|correo|direcci[oó]n|d[oó]nde vive|n[uú]mero|dni|pasaporte|phone|address|where does .+ live).{0,40}(de (la |el )?(atleta|jugador|jugadora|chica|chico|menor|coach|entrenador)|of (the )?(athlete|player|girl|boy|minor|coach))/i;
export function asksForOthersPrivateData(text: string) { return OTHERS_DATA.test(text); }

/** Señal de riesgo para un menor o de abuso: respuesta fija de seguridad, sin modelo. */
const RISK = /(acoso|me (está|esta) presionando|fotos? (privad|íntim|intim)|me pide(n)? (fotos|dinero)|whatsapp privado|harass|asking (me )?for (photos|money)|groom|amenaz|threat)/i;
export function riskSignal(text: string) { return RISK.test(text); }

export const SAFETY_REPLY = {
  es: 'Esto es importante y no tienes que gestionarlo sola/o. No envíes fotos, dinero ni datos personales, y no sigas la conversación fuera de Gala. Usa «Denunciar» en el perfil o en el mensaje para que el equipo lo revise; si eres menor, cuéntaselo a tu familia o a un adulto de confianza. Si hay peligro inmediato, llama al 112.',
  en: 'This matters and you do not have to handle it alone. Do not send photos, money or personal details, and do not move the conversation outside Gala. Use “Report” on the profile or message so the team can review it; if you are a minor, tell your family or a trusted adult. If there is immediate danger, call your local emergency number.',
};
export const OTHERS_DATA_REPLY = {
  es: 'No puedo compartir datos de contacto ni información privada de otras personas. Si quieres contactar con alguien, hazlo desde Gala: así se aplican los permisos y, con menores, la aprobación de la familia.',
  en: 'I can’t share contact details or private information about other people. To reach someone, use Gala so permissions — and family approval for minors — apply.',
};

/** Límites de coste por petición. */
export const LIMITS = { maxToolRounds: 3, maxOutputTokens: 900, maxHistory: 12, maxInputChars: 2000 } as const;
