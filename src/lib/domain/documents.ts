/** Estado de un documento del atleta. No hay «verificado»: nadie revisa documentos todavía y no lo fingimos. */
export type DocStatus = 'missing' | 'overdue' | 'uploaded' | 'expiring' | 'expired';

export const EXPIRING_DAYS = 60;

export const DOC_STATUS_LABEL: Record<DocStatus, { label: string; tone: 'neutral' | 'danger' | 'ok' | 'brass' }> = {
  missing: { label: 'Falta', tone: 'neutral' },
  overdue: { label: 'Fuera de plazo', tone: 'danger' },
  uploaded: { label: 'Subido', tone: 'ok' },
  expiring: { label: 'Caduca pronto', tone: 'brass' },
  expired: { label: 'Caducado', tone: 'danger' },
};

export function documentStatus(
  d: { uploaded_at: string | null; due_date: string | null; expires_on: string | null }, now: Date = new Date(),
): DocStatus {
  const today = now.toISOString().slice(0, 10);
  if (!d.uploaded_at) return d.due_date && d.due_date < today ? 'overdue' : 'missing';
  if (d.expires_on) {
    if (d.expires_on < today) return 'expired';
    const soon = new Date(now.getTime() + EXPIRING_DAYS * 86_400_000).toISOString().slice(0, 10);
    if (d.expires_on <= soon) return 'expiring';
  }
  return 'uploaded';
}
