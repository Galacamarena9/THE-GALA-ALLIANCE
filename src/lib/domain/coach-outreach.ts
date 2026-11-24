/**
 * Ciclo 2 · Email al coach desde un proceso.
 * Plantilla en inglés que la agencia edita antes de enviarla desde su propio buzón. Nunca promete
 * resultados ni habla de tarifas o becas a cambio de nada (NCAA 12.3.3): solo presenta al atleta y
 * enlaza su Passport privado. Siempre incluye una forma de darse de baja.
 */

export type OutreachStatus = 'draft' | 'sent' | 'replied' | 'no_reply' | 'bounced';

/** Fases desde las que se puede escribir al coach (las mismas que acepta la base de datos). */
export const OUTREACH_STAGES = [
  'approved_to_contact', 'contacted', 'response_received', 'active_conversation',
  'evaluation_visit', 'academic_review', 'offer_discussion', 'decision_pending',
] as const;
export const canOutreachFrom = (stage: string) => (OUTREACH_STAGES as readonly string[]).includes(stage);

/** Días sin respuesta a partir de los cuales el proceso pide atención. */
export const NO_REPLY_DAYS = 10;

const SPORT_EN: Record<string, string> = {
  basketball: 'basketball', soccer: 'soccer', football: 'soccer', volleyball: 'volleyball', tennis: 'tennis',
  baseball: 'baseball', softball: 'softball', golf: 'golf', swimming: 'swimming', track: 'track & field',
  athletics: 'track & field', rowing: 'rowing', lacrosse: 'lacrosse', field_hockey: 'field hockey', handball: 'handball',
  water_polo: 'water polo',
};
export const sportEn = (id: string | null | undefined) => (id ? SPORT_EN[id] ?? id.replace(/_/g, ' ') : 'their sport');

/** Para menores, solo nombre e inicial (igual que la ficha compartida). */
export function prospectName(fullName: string, minor: boolean): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'our prospect';
  if (!minor || parts.length === 1) return minor ? parts[0] : fullName.trim();
  return `${parts[0]} ${parts[1][0]}.`;
}

export interface OutreachDraftInput {
  athleteName: string;
  minor: boolean;
  sportId: string | null;
  gradYear: number | null;
  position?: string | null;
  institutionName: string;
  coachName?: string | null;
  agencyName: string;
  senderName: string;
}

export interface OutreachDraft { subject: string; body: string }

/** Marcador que se sustituye por el enlace privado al preparar el envío. */
export const LINK_PLACEHOLDER = '{{passport_link}}';

export function coachEmailDraft(i: OutreachDraftInput): OutreachDraft {
  const name = prospectName(i.athleteName, i.minor);
  const sport = sportEn(i.sportId);
  const cls = i.gradYear ? `class of ${i.gradYear}` : 'upcoming class';
  const pos = i.position?.trim() ? `${i.position.trim()}, ` : '';
  const greeting = i.coachName?.trim() ? `Hi Coach ${i.coachName.trim().split(/\s+/).slice(-1)[0]},` : 'Hi Coach,';
  const subject = `European ${sport} prospect – ${name} (${pos}${cls})`;
  const body = [
    greeting,
    '',
    `I'm ${i.senderName} from ${i.agencyName}, and I work with European student-athletes who want to compete and study in the US. I'd like to introduce ${name}, a ${cls} ${sport} player${i.position?.trim() ? ` (${i.position.trim().toLowerCase()})` : ''} who is interested in ${i.institutionName}.`,
    '',
    `You can see the profile, highlights and academic details here (private link, no account needed):`,
    LINK_PLACEHOLDER,
    '',
    `If ${name} could fit your plans for the ${cls}, I'd be glad to set up a call or send full game footage and transcripts.`,
    '',
    'Thank you for your time,',
    i.senderName,
    i.agencyName,
    '',
    "If you'd rather not receive emails like this, just reply and let me know.",
  ].join('\n');
  return { subject, body };
}

export function fillLink(body: string, link: string): string {
  return body.includes(LINK_PLACEHOLDER) ? body.split(LINK_PLACEHOLDER).join(link) : `${body.trimEnd()}\n\n${link}`;
}

/** Enlace mailto para abrir el correo ya escrito en el programa de la agencia. */
export function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  draft: 'Preparado, sin enviar', sent: 'Enviado', replied: 'Ha respondido', no_reply: 'Sin respuesta', bounced: 'Rebotado',
};

/** ¿Lleva demasiados días enviado sin respuesta? */
export function awaitingTooLong(o: { status: string; sentAt: string | null }, now: Date = new Date(), days = NO_REPLY_DAYS): boolean {
  if (o.status !== 'sent' || !o.sentAt) return false;
  return now.getTime() - new Date(o.sentAt).getTime() >= days * 864e5;
}

/** Tasa de respuesta (línea base, sin objetivo inventado): respondidos / enviados. */
export function replyRate(rows: { status: string }[]): { sent: number; replied: number; rate: number | null } {
  const sent = rows.filter((r) => r.status !== 'draft').length;
  const replied = rows.filter((r) => r.status === 'replied').length;
  return { sent, replied, rate: sent ? replied / sent : null };
}
