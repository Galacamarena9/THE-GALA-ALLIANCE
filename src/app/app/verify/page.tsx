import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { REQUEST_STATUS_TEXT, accessLevel, checks, type VerificationSummary } from '@/lib/domain/verification';
import { ButtonLink, Card, PageHeader } from '@/components/ui';
import { ResendEmailButton } from '@/components/verify/ResendEmailButton';

export const metadata: Metadata = { title: 'Mi verificación' };

const ICON = { done: '✓', review: '⏳', todo: '○' } as const;
const TEXT = { done: 'Verificado', review: 'En revisión', todo: 'Pendiente' } as const;
const TYPE: Record<string, string> = {
  organization_claim: 'Representar la institución', organization_affiliation: 'Afiliación a la institución', program_affiliation: 'Afiliación al programa', role: 'Cargo',
};

/** Estado de verificación en lenguaje claro, calculado (no un booleano). Funciona igual en el móvil. */
export default async function VerifyPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: members }, { data: requests }, { data: emails }] = await Promise.all([
    supabase.from('organization_members').select('organization_id, member_role, organizations(name, verification_status)').eq('user_id', session.userId),
    supabase.from('verification_requests').select('id, organization_id, verification_type, status, decision_reason, created_at, organizations(name), org_programs(name)').eq('subject_user', session.userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('email_verifications').select('id, email, result, verified_at, created_at').eq('user_id', session.userId).order('created_at', { ascending: false }).limit(5),
  ]);
  const orgIds = [...new Set([...(members ?? []).map((m) => m.organization_id as string), ...(requests ?? []).map((r) => r.organization_id as string).filter(Boolean)])];
  const summaries = await Promise.all(orgIds.map(async (id) => [id, (await supabase.rpc('verification_summary', { p_org: id })).data as VerificationSummary | null] as const));
  const nameOf = new Map<string, string>([
    ...(members ?? []).map((m) => [m.organization_id as string, (m.organizations as unknown as { name: string } | null)?.name ?? 'Organización'] as [string, string]),
    ...(requests ?? []).filter((r) => r.organization_id).map((r) => [r.organization_id as string, (r.organizations as unknown as { name: string } | null)?.name ?? 'Organización'] as [string, string]),
  ]);
  const pendingEmail = (emails ?? []).find((e) => e.result === 'pending');
  const full = summaries.find(([, s]) => accessLevel(s).key === 'full');

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader kicker="Verificación" title={full ? '¡Estás verificado! ✓' : 'Tu verificación'}
        description={full ? 'Ya puedes descubrir atletas, crear shortlists y usar las herramientas de recruiting de tu rol.' : 'Cada parte se verifica por separado. Te avisamos cuando cambie algo.'} />

      {full && <div className="mb-6"><ButtonLink href="/app/recruit/discover" className="min-h-12 w-full justify-center">Descubrir atletas</ButtonLink></div>}

      {!orgIds.length && (
        <Card>
          <p className="text-sm text-paper">Aún no has pedido verificar tu afiliación a una universidad o club.</p>
          <ButtonLink href="/app/verify/start" className="mt-4 min-h-12 w-full justify-center">Empezar (2 minutos)</ButtonLink>
        </Card>
      )}

      <div className="space-y-4">
        {summaries.map(([orgId, s]) => {
          const access = accessLevel(s);
          return (
            <Card key={orgId}>
              <h2 className="font-display text-lg font-bold text-paper">{nameOf.get(orgId)}</h2>
              <ul className="mt-3 divide-y divide-line">
                {checks(s).map((c) => (
                  <li key={c.label} className="flex min-h-12 items-center justify-between gap-3 text-sm">
                    <span className="text-paper">{c.label}</span>
                    <span className={c.state === 'done' ? 'font-semibold text-ok' : c.state === 'review' ? 'text-warn' : 'text-muted'}><span aria-hidden>{ICON[c.state]} </span>{TEXT[c.state]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-xl bg-ink/50 p-3">
                <p className="text-xs text-faint">Acceso actual</p>
                <p className="font-semibold text-paper">{access.label}</p>
                <p className="mt-1 text-xs text-muted">{access.detail}</p>
              </div>
            </Card>
          );
        })}

        {(requests ?? []).length > 0 && (
          <Card>
            <h2 className="mb-2 font-display text-lg font-bold text-paper">Solicitudes</h2>
            <ul className="space-y-3">
              {(requests ?? []).map((r) => {
                const t = REQUEST_STATUS_TEXT[r.status] ?? { label: 'En revisión', tone: 'review' as const };
                const prog = (r.org_programs as unknown as { name: string } | null)?.name;
                return (
                  <li key={r.id} className="text-sm">
                    <p className="text-paper">{TYPE[r.verification_type] ?? 'Verificación'}{prog ? ` · ${prog}` : ''}</p>
                    <p className={t.tone === 'done' ? 'text-ok' : t.tone === 'review' ? 'text-warn' : 'text-muted'}>{t.label}</p>
                    {t.help && <p className="text-xs text-muted">{t.help}</p>}
                    {r.status === 'rejected' && r.decision_reason && <p className="text-xs text-muted">Motivo: {r.decision_reason}</p>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {pendingEmail && (
          <Card>
            <p className="text-sm text-paper">Correo pendiente de confirmar: <strong>{pendingEmail.email}</strong></p>
            <div className="mt-3"><ResendEmailButton id={pendingEmail.id} /></div>
          </Card>
        )}
        {orgIds.length > 0 && <Link href="/app/verify/start" className="block text-center text-sm text-brass underline">Solicitar otra afiliación</Link>}
      </div>
    </div>
  );
}
