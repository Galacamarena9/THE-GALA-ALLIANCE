import Link from 'next/link';
import { Badge, Card, CardTitle } from '@/components/ui';
import { ENROLLMENT_STATUS_LABEL, INVITATION_STATUS_LABEL, REGISTRATION_STATUS_LABEL, eventWhen, type InvitationStatus, type RegistrationStatus } from '@/lib/domain/trials';

export type FamilyTrialItem = {
  key: string; kind: 'registration' | 'invitation' | 'enrollment'; opportunityId: string; title: string; org: string; orgVerified: boolean;
  athleteName: string; startAt: string | null; timezone: string | null; city: string | null; status: string;
  familyAction: boolean; materials?: string | null;
};

/**
 * Centro de trials de la familia: primero lo que necesita su decisión (con contexto completo al abrir), después lo
 * próximo y lo completado. Nunca muestra datos internos del club (notas, resultados internos, otros candidatos).
 */
export function FamilyTrialCenter({ items }: { items: FamilyTrialItem[] }) {
  if (!items.length) return null;
  const action = items.filter((i) => i.familyAction);
  const rest = items.filter((i) => !i.familyAction);
  const label = (i: FamilyTrialItem) => i.kind === 'registration' ? REGISTRATION_STATUS_LABEL[i.status as RegistrationStatus] ?? i.status
    : i.kind === 'invitation' ? INVITATION_STATUS_LABEL[i.status as InvitationStatus] ?? i.status
    : (ENROLLMENT_STATUS_LABEL as Record<string, string>)[i.status] ?? i.status;
  const row = (i: FamilyTrialItem, cta: string) => (
    <li key={i.key} className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-paper">{i.title}</p>
          <p className="text-xs text-muted">{i.org} {i.orgVerified ? '· Verificado ✓' : ''} · {i.athleteName}</p>
          <p className="text-xs text-muted">{eventWhen(i.startAt, i.timezone)}{i.city ? ` · ${i.city}` : ''}</p>
          {i.materials === 'pending' && <p className="text-xs text-warn">Documentos pendientes</p>}
        </div>
        <Badge tone={i.familyAction ? 'warn' : i.status === 'confirmed' || i.status === 'enrolled' || i.status === 'active' ? 'ok' : 'neutral'}>{label(i)}</Badge>
      </div>
      <Link href={`/app/opportunities/${i.opportunityId}`} className={`mt-2 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold ${i.familyAction ? 'w-full bg-brass text-ink' : 'border border-line text-paper'}`}>{cta}</Link>
    </li>
  );
  return (
    <Card>
      <CardTitle kicker="Trials y programas">{action.length ? `Tu revisión es necesaria (${action.length})` : 'Ninguna acción pendiente'}</CardTitle>
      {action.length > 0 && <ul className="divide-y divide-line">{action.map((i) => row(i, 'Revisar y decidir'))}</ul>}
      {rest.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-faint">Seguimiento</p>
          <ul className="divide-y divide-line">{rest.map((i) => row(i, 'Ver detalles'))}</ul>
        </>
      )}
      <p className="mt-3 text-[11px] text-muted">Antes de aprobar verás quién organiza, fecha, lugar, coste (obligatorio y opcional), qué información se comparte y las reglas de contacto.</p>
    </Card>
  );
}
