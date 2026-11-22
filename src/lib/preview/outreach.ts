/** Lista de difusión con datos FICTICIOS para /preview (la lista inicial real, con estados de ejemplo). */
import { OUTREACH_SEED } from '@/content/outreach-seed';
import type { OutreachContact, OutreachStatus } from '@/lib/domain/outreach';

const STATES: OutreachStatus[] = ['accepted', 'invited', 'contacted', 'new', 'new', 'declined', 'registered', 'new', 'new', 'new', 'unsubscribed', 'new', 'new', 'new', 'new', 'new'];
const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export function previewOutreach(): OutreachContact[] {
  return OUTREACH_SEED.map((s, i) => {
    const status = STATES[i] ?? 'new';
    return {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, segment: s.segment, organizationName: s.organizationName,
      country: s.country, website: null, channel: i === 3 || i === 4 ? 'email' : s.channel,
      email: s.email ?? (i === 3 || i === 4 ? `contacto@ejemplo-${i}.test` : null), roleTitle: null, sourceUrl: s.sourceUrl, notes: s.notes,
      status, invitedAt: status === 'new' ? null : ago(6 - (i % 4)), respondedAt: ['accepted', 'declined', 'unsubscribed', 'registered'].includes(status) ? ago(1) : null,
      createdAt: ago(10),
    };
  });
}
