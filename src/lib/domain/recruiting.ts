/** Oleada 1 · Enlace privado de reclutamiento: lógica pura (sin Next ni Supabase). */

/** Dominio .edu real (no "edu.com" ni ".edu.es"). */
export function isEduEmail(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase());
  return Boolean(m && /(^|\.)[a-z0-9-]+\.edu$/.test(m[1]));
}

export type VideoEmbed = { kind: 'embed' | 'link'; src: string } | null;

/** YouTube y Vimeo se incrustan en modo privacidad; cualquier otro https queda como enlace. */
export function videoEmbed(url: string | null | undefined): VideoEmbed {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  const yt =
    host === 'youtu.be' ? u.pathname.slice(1) :
    host === 'youtube.com' || host === 'm.youtube.com' ? (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1] ?? '') : '';
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${yt}` };
  const vm = host === 'vimeo.com' ? u.pathname.match(/^\/(\d{5,12})/)?.[1] : undefined;
  if (vm) return { kind: 'embed', src: `https://player.vimeo.com/video/${vm}?dnt=1` };
  return { kind: 'link', src: u.toString() };
}

export type LinkState = 'active' | 'expired' | 'revoked';

export function linkState(l: { expires_at: string; revoked_at: string | null }, now: Date = new Date()): LinkState {
  if (l.revoked_at) return 'revoked';
  return new Date(l.expires_at) > now ? 'active' : 'expired';
}

export function daysLeft(expiresAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}

export interface ShareInput { name: string; sport: string | null; position: string | null; gradYear: number | null; url: string }

/** Textos listos para enviar a un coach de EE. UU. (en inglés). Nunca incluyen datos económicos. */
export function shareTexts(i: ShareInput) {
  const role = [i.position, i.sport].filter(Boolean).join(' · ') || 'Student-athlete';
  const cls = i.gradYear ? `Class of ${i.gradYear}` : '';
  const emailSubject = [i.name, role, cls].filter(Boolean).join(' – ');
  const emailBody = [
    'Hi Coach,',
    '',
    `My name is ${i.name}${cls ? ` (${cls})` : ''}, ${role.toLowerCase()} from Spain. I am very interested in your program and would love to be considered for a roster spot.`,
    '',
    `Here is my recruiting profile with highlights, academics and test scores:`,
    i.url,
    '',
    'Thank you for your time. I look forward to hearing from you.',
    '',
    'Best regards,',
    i.name,
  ].join('\n');
  const whatsapp = `${i.name} – ${role}${cls ? `, ${cls}` : ''}. Recruiting profile: ${i.url}`;
  return {
    emailSubject,
    emailBody,
    whatsapp,
    mailto: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
    whatsappHref: `https://wa.me/?text=${encodeURIComponent(whatsapp)}`,
  };
}
