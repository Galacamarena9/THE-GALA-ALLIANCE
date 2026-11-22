/**
 * Lista de difusión (Operaciones Gala). Lógica pura: etiquetas, filtros, qué se puede enviar y el texto de la invitación.
 * La invitación PIDE PERMISO (LSSI art. 21): no es publicidad, lleva baja en un clic y solo se envía una vez por contacto.
 */

export const OUTREACH_SEGMENTS = ['agency', 'university', 'federation', 'club', 'academy', 'other'] as const;
export type OutreachSegment = (typeof OUTREACH_SEGMENTS)[number];
export const SEGMENT_LABEL: Record<OutreachSegment, string> = {
  agency: 'Agencia', university: 'Universidad', federation: 'Federación', club: 'Club', academy: 'Academia', other: 'Otra',
};

export const OUTREACH_STATUSES = ['new', 'invited', 'contacted', 'accepted', 'declined', 'unsubscribed', 'registered', 'bounced'] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];
export const STATUS_LABEL: Record<OutreachStatus, string> = {
  new: 'Sin contactar', invited: 'Invitación enviada', contacted: 'Contactada a mano', accepted: 'Quiere probarla',
  declined: 'No le interesa ahora', unsubscribed: 'Baja: no escribir más', registered: 'Ya está dentro', bounced: 'Correo rebotado',
};
export const STATUS_TONE: Record<OutreachStatus, 'neutral' | 'brass' | 'warn' | 'ok' | 'danger'> = {
  new: 'neutral', invited: 'brass', contacted: 'brass', accepted: 'ok', declined: 'neutral', unsubscribed: 'danger', registered: 'ok', bounced: 'warn',
};

export const CHANNELS = ['email', 'web_form', 'phone', 'linkedin'] as const;
export type OutreachChannel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<OutreachChannel, string> = { email: 'Correo', web_form: 'Formulario web', phone: 'Teléfono', linkedin: 'LinkedIn' };

/** Máximo por clic: envíos pequeños, revisables y lejos de parecer spam. */
export const MAX_INVITES_PER_BATCH = 25;

export interface OutreachContact {
  id: string; segment: OutreachSegment; organizationName: string; country: string | null; website: string | null;
  channel: OutreachChannel; email: string | null; roleTitle: string | null; sourceUrl: string; notes: string | null;
  status: OutreachStatus; invitedAt: string | null; respondedAt: string | null; createdAt: string;
}

/** Solo se envía automáticamente a quien tiene correo y nunca ha sido contactado. */
export const canAutoInvite = (c: Pick<OutreachContact, 'status' | 'email' | 'channel'>) => c.status === 'new' && c.channel === 'email' && Boolean(c.email);

export interface OutreachFilters { segment: OutreachSegment | 'all'; status: OutreachStatus | 'all'; q: string }
export const DEFAULT_OUTREACH: OutreachFilters = { segment: 'all', status: 'all', q: '' };

export function parseOutreachFilters(sp: Record<string, string | string[] | undefined>): OutreachFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const seg = one('segmento');
  const st = one('estado');
  return {
    segment: (OUTREACH_SEGMENTS as readonly string[]).includes(seg ?? '') ? (seg as OutreachSegment) : 'all',
    status: (OUTREACH_STATUSES as readonly string[]).includes(st ?? '') ? (st as OutreachStatus) : 'all',
    q: (one('q') ?? '').slice(0, 80),
  };
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterOutreach(rows: OutreachContact[], f: OutreachFilters): OutreachContact[] {
  const q = fold(f.q.trim());
  return rows.filter((r) =>
    (f.segment === 'all' || r.segment === f.segment)
    && (f.status === 'all' || r.status === f.status)
    && (!q || fold([r.organizationName, r.country ?? '', r.notes ?? '', r.roleTitle ?? ''].join(' ')).includes(q)));
}

export function outreachCounts(rows: OutreachContact[]) {
  const by = Object.fromEntries(OUTREACH_STATUSES.map((s) => [s, 0])) as Record<OutreachStatus, number>;
  for (const r of rows) by[r.status] += 1;
  return { total: rows.length, ready: rows.filter(canAutoInvite).length, waiting: by.invited + by.contacted, interested: by.accepted, inside: by.registered, ...by };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const PITCH: Record<OutreachSegment, string> = {
  agency: 'una herramienta de trabajo para agencias: tu cartera de atletas, sus procesos con universidades y clubes, ofertas y documentos en un solo sitio, con búsqueda por posición, altura, país y promoción.',
  university: 'un sitio donde encontrar atletas internacionales verificados (estadísticas validadas por su club, notas e inglés) y gestionar el contacto con ellos y con sus agentes.',
  federation: 'una plataforma para que vuestros deportistas y sus familias preparen con rigor el salto a universidades y clubes, con protección específica para menores.',
  club: 'una forma de dar visibilidad verificada a vuestros jugadores (estadísticas validadas por el club) ante universidades y agencias.',
  academy: 'una forma de dar visibilidad verificada a vuestros deportistas ante universidades y agencias, con la familia siempre al tanto.',
  other: 'una plataforma que conecta atletas, familias, agencias, clubes y universidades.',
};

/**
 * Texto de la invitación. Una sola vez, en primera persona, sin promesas, pidiendo permiso.
 * Incluye siempre: quién escribe, de dónde sale el contacto y cómo darse de baja.
 */
export function invitationEmail(p: { organizationName: string; segment: OutreachSegment; sourceUrl: string; respondUrl: string; senderName?: string }) {
  const sender = p.senderName ?? 'Gala';
  const accept = `${p.respondUrl}?r=accept`;
  const decline = `${p.respondUrl}?r=decline`;
  const unsubscribe = `${p.respondUrl}?r=unsubscribe`;
  const subject = `¿Os interesa probar The Gala Alliance? · ${p.organizationName}`.slice(0, 140);
  const text = [
    `Hola, equipo de ${p.organizationName}:`,
    '',
    `Soy ${sender}, exjugadora NCAA de primera división y fundadora de The Gala Alliance. Estamos preparando ${PITCH[p.segment]}`,
    '',
    'Antes de lanzarla queremos que la prueben unas pocas organizaciones como la vuestra. ¿Os puedo dar acceso de prueba y enseñárosla?',
    '',
    `Sí, quiero probarla: ${accept}`,
    `Ahora no: ${decline}`,
    '',
    `Os escribo porque vuestro contacto aparece publicado en ${p.sourceUrl}. Si no queréis recibir más mensajes, pulsad aquí y no volveremos a escribiros: ${unsubscribe}`,
  ].join('\n');
  const html = `<p>Hola, equipo de ${esc(p.organizationName)}:</p>
<p>Soy ${esc(sender)}, exjugadora NCAA de primera división y fundadora de The Gala Alliance. Estamos preparando ${esc(PITCH[p.segment])}</p>
<p>Antes de lanzarla queremos que la prueben unas pocas organizaciones como la vuestra. ¿Os puedo dar acceso de prueba y enseñárosla?</p>
<p><a href="${esc(accept)}">Sí, quiero probarla</a> &nbsp;·&nbsp; <a href="${esc(decline)}">Ahora no</a></p>
<p style="color:#666;font-size:12px">Os escribo porque vuestro contacto aparece publicado en ${esc(p.sourceUrl)}. Si no queréis recibir más mensajes, <a href="${esc(unsubscribe)}">daos de baja aquí</a> y no volveremos a escribiros.</p>`;
  return { subject, text, html, links: { accept, decline, unsubscribe } };
}

/** Mismo mensaje, para pegar en un formulario web o en LinkedIn (sin enlaces: la respuesta llega por ese canal). */
export function manualMessage(p: { segment: OutreachSegment; senderName?: string }) {
  const sender = p.senderName ?? 'Gala';
  return [
    'Hola:',
    '',
    `Soy ${sender}, exjugadora NCAA de primera división y fundadora de The Gala Alliance. Estamos preparando ${PITCH[p.segment]}`,
    '',
    'Antes de lanzarla queremos que la prueben unas pocas organizaciones como la vuestra. ¿Os puedo dar acceso de prueba y enseñárosla?',
    '',
    'Os escribo porque vuestro contacto aparece publicado. Si no queréis que os volvamos a escribir, decídnoslo y no lo haremos.',
  ].join('\n');
}

export const RESPONSE_ANSWERS = ['accept', 'decline', 'unsubscribe'] as const;
export type ResponseAnswer = (typeof RESPONSE_ANSWERS)[number];
export const RESPONSE_COPY: Record<ResponseAnswer, { ask: string; button: string; done: string }> = {
  accept: { ask: '¿Queréis probar The Gala Alliance antes del lanzamiento?', button: 'Sí, queremos probarla', done: 'Gracias. Gala os escribirá personalmente con el acceso de prueba.' },
  decline: { ask: '¿Preferís que no os escribamos ahora?', button: 'Ahora no, gracias', done: 'Entendido. No os volveremos a escribir por esta invitación.' },
  unsubscribe: { ask: '¿Queréis dejar de recibir mensajes de The Gala Alliance?', button: 'Darme de baja', done: 'Hecho. Vuestro correo queda en nuestra lista de exclusión y no volveremos a escribiros.' },
};
