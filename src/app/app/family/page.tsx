import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { ATHLETE_STATUS_LABEL, usd } from '@/lib/domain/labels';
import { siteUrl } from '@/lib/env';
import type { ApplicationStatus } from '@/lib/types';
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { InviteLink } from '@/components/InviteLink';
import { revokeFamilyLink } from '@/app/actions/family';
import { guardianLinks, loadFamilyChild } from '@/lib/data/family-home';
import { familyNextAction, type FamilyAction } from '@/lib/domain/family';
import { FamilyHome, FamilyOnboarding, FamilyWelcome } from '@/components/family/FamilyHome';
import { FamilyTrialCenter, type FamilyTrialItem } from '@/components/trials/FamilyTrialCenter';

export const metadata: Metadata = { title: 'Familia' };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ child?: string; bienvenida?: string; verificacion?: string; verificar?: string }> }) {
  const session = await requireSession(['parent']);
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayIso();
  const [links, { data: invites }] = await Promise.all([
    guardianLinks(session),
    supabase.from('parent_athlete_links').select('id, expires_at').eq('parent_id', session.userId).eq('status', 'pending'),
  ]);
  const pending = (invites ?? []).filter((l) => (l.expires_at as string) > new Date(`${today}T00:00:00Z`).toISOString());

  const header = (
    <PageHeader
      kicker="Familia · Hoy"
      title={<>Lo que necesita vuestra <em>atención</em></>}
      description="Su proceso, lo que espera tu aprobación y cuánto cuesta de verdad cada opción. Solo ves lo que tu hijo o hija decide compartir contigo."
    />
  );

  if (!links.length) {
    return (
      <>
        {header}
        <FamilyWelcome />
        <Card className="mt-5" id="vincular">
          <CardTitle kicker="Paso 1">Vincula a tu hijo o hija</CardTitle>
          <p className="mb-5 max-w-xl text-sm text-muted">
            Crea un enlace y envíaselo. Cuando acepte con su propia cuenta de atleta, verás aquí su proceso. El enlace es de un solo uso y caduca en 14 días.
          </p>
          <InviteLink siteUrl={siteUrl()} label="Crear enlace de invitación" />
          {pending.length > 0 && <p className="mt-4 text-xs text-faint">{pending.length} invitación(es) pendiente(s).</p>}
        </Card>
      </>
    );
  }

  const current = links.find((l) => l.athleteId === sp.child) ?? links[0];
  const home = current.active ? await loadFamilyChild(session, current) : null;
  const action: FamilyAction = home
    ? familyNextAction({ today, approvals: home.approvals, deadlines: home.deadlines, offers: home.offers,
        incompleteCosts: home.scenarios.incomplete, missingDocuments: home.missingDocuments, hasAthlete: true })
    : { title: 'Acceso en pausa', why: '', href: '/app/family', urgent: false };

  // Trials y programas del hijo/a elegido (RLS: solo con permiso «ver candidaturas»).
  const visible = current.active && current.scopes.applications ? [current.athleteId] : [];
  const nameOf = new Map([[current.athleteId, current.name]]);
  const OPP = 'opportunities(id, title, start_at, timezone, city, organizations(name, verification_status))';
  const [{ data: fRegs }, { data: fInvs }, { data: fEnrs }, { data: apps }] = visible.length ? await Promise.all([
    supabase.from('opportunity_registrations').select(`id, athlete_id, status, guardian_status, needs_athlete_ok, materials_status, ${OPP}`).in('athlete_id', visible).not('status', 'in', '(cancelled,withdrawn)').limit(50),
    supabase.from('opportunity_invitations').select(`id, athlete_id, status, guardian_required, ${OPP}`).in('athlete_id', visible).in('status', ['sent', 'viewed', 'interested']).limit(50),
    supabase.from('program_enrollments').select(`id, athlete_id, status, guardian_status, ${OPP}`).in('athlete_id', visible).not('status', 'in', '(declined,withdrawn,cancelled)').limit(50),
    supabase.from('applications').select('id, status, opportunities(title, annual_cost_usd, aid_amount_usd, deadline, organizations(name))').eq('athlete_id', current.athleteId).neq('status', 'withdrawn'),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: null }];
  type O = { id: string; title: string; start_at: string | null; timezone: string | null; city: string | null; organizations: { name: string; verification_status: string } | null };
  const item = (kind: FamilyTrialItem['kind'], r: Record<string, unknown>, familyAction: boolean): FamilyTrialItem | null => {
    const o = r.opportunities as unknown as O | null;
    if (!o) return null;
    return { key: `${kind}-${r.id}`, kind, opportunityId: o.id, title: o.title, org: o.organizations?.name ?? 'Organización', orgVerified: o.organizations?.verification_status === 'verified',
      athleteName: nameOf.get(r.athlete_id as string) ?? 'Tu hijo/a', startAt: o.start_at, timezone: o.timezone, city: o.city, status: r.status as string, familyAction,
      materials: (r.materials_status as string | undefined) ?? null };
  };
  const trialItems = [
    ...(fInvs ?? []).filter((i) => !(fRegs ?? []).some((r) => (r.opportunities as unknown as O | null)?.id === (i.opportunities as unknown as O | null)?.id && r.athlete_id === i.athlete_id))
      .map((i) => item('invitation', i, !!i.guardian_required)),
    ...(fRegs ?? []).map((r) => item('registration', r, r.guardian_status === 'pending')),
    ...(fEnrs ?? []).map((e) => item('enrollment', e, e.guardian_status === 'pending')),
  ].filter((x): x is FamilyTrialItem => !!x)
   .sort((a, b) => Number(b.familyAction) - Number(a.familyAction) || (a.startAt ?? '9').localeCompare(b.startAt ?? '9'));

  return (
    <>
      {header}
      {sp.bienvenida && <FamilyOnboarding name={current.name} scopes={current.scopes} />}
      <FamilyHome links={links} current={current} home={home} action={action} today={today} switchHref={(id) => `/app/family?child=${id}`} verificationNotice={sp.verificacion ?? (sp.verificar ? 'requerida' : undefined)} />
      {trialItems.length > 0 && <div className="mt-5"><FamilyTrialCenter items={trialItems} /></div>}
      {apps !== null && (
        <Card className="mt-5">
          <CardTitle kicker="Candidaturas">Coste publicado de cada oportunidad</CardTitle>
          {apps.length ? (
            <>
              <ul className="divide-y divide-line">
                {apps.map((a) => {
                  const o = a.opportunities as unknown as { title: string; annual_cost_usd: number | null; aid_amount_usd: number | null; organizations: { name: string } | null } | null;
                  const net = o?.annual_cost_usd != null && o.aid_amount_usd != null ? o.annual_cost_usd - o.aid_amount_usd : null;
                  return (
                    <li key={a.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-paper">{o?.title}</p>
                        <p className="text-xs text-faint">{o?.organizations?.name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <Badge tone="brass">{ATHLETE_STATUS_LABEL[a.status as ApplicationStatus]}</Badge>
                        <span>Coste <span className="tabular-nums text-paper">{usd(o?.annual_cost_usd)}</span></span>
                        <span>Ayuda <span className="tabular-nums text-paper">{usd(o?.aid_amount_usd)}</span></span>
                        <span>Neto {net == null ? <span className="text-warn">sin datos suficientes</span> : <span className="tabular-nums font-semibold text-paper">{usd(net)}</span>}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-faint">«Sin datos suficientes»: la universidad no ha publicado coste y ayuda completos. Nunca estimamos cifras que no existen.</p>
            </>
          ) : (
            <EmptyState title="Aún no hay candidaturas">Cuando presente una, verás aquí su coste publicado y la ayuda.</EmptyState>
          )}
        </Card>
      )}
      <Card className="mt-5" id="vincular">
        <CardTitle kicker="Otro hijo o hija">Vincular a otro atleta</CardTitle>
        <p className="mb-4 max-w-xl text-sm text-muted">Cada hijo o hija decide por separado qué puedes ver. Sus datos nunca se mezclan.</p>
        <InviteLink siteUrl={siteUrl()} label="Crear otro enlace" />
        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer text-xs text-faint hover:text-danger">Dejar de seguir a {current.name}</summary>
          <form action={revokeFamilyLink} className="mt-3 rounded-xl border border-line p-4 text-sm text-muted">
            <input type="hidden" name="id" value={current.id} /><input type="hidden" name="confirm" value="yes" />
            <p>Dejarás de ver su información desde ahora. Su proceso, documentos y ofertas no cambian. Para volver, necesitaréis una invitación nueva.</p>
            <button className="mt-3 min-h-11 rounded-full border border-danger/40 px-5 text-sm font-semibold text-danger">Sí, dejar de seguir</button>
          </form>
        </details>
      </Card>
    </>
  );
}
