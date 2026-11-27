import { attestationLine, feeAttestationMap } from '@/lib/domain/fee-attestation';
import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, buttonClass } from '@/components/ui';
import { respondRepresentation } from '@/app/actions/marketplace';
import { StatusPill } from '@/components/portfolio';
import { REP_PERMISSIONS, REP_TYPE_LABEL, repStatusDetail, toRepStatus } from '@/lib/domain/portfolio';
import { RepPermissionsForm } from '@/components/agency/RepPermissionsForm';
import { InviteAgencyForm } from '@/components/agency/InviteAgencyForm';
import { CASE_PHASES, casePhaseLabel, casePhaseOf, stageLabel } from '@/lib/domain/agency-cases';
import { ReportButton } from '@/components/forms';
import { AGENT_REPORT_REASONS } from '@/lib/domain/reports';

export const metadata: Metadata = { title: 'Agentes' };

export default async function AthleteAgentsPage() {
  const session = await requireSession(['athlete']);
  const supabase = await createClient();
  const { data: reps } = await supabase
    .from('agent_representations')
    .select('id, status, message, created_at, representation_type, start_date, end_date, agency_id, organizations(name, website, verification_status), representation_coverage(dimension, value), representation_permissions(permission, status)')
    .eq('athlete_id', session.userId)
    .order('created_at', { ascending: false });
  const repIds = (reps ?? []).map((r) => r.id);
  const { data: attRows } = repIds.length
    ? await supabase.from('representation_fee_attestations').select('representation_id, statement, statement_version, attested_at').in('representation_id', repIds).order('attested_at', { ascending: false })
    : { data: [] };
  const attestations = feeAttestationMap(attRows);
  const { data: verifiedAgencies } = await supabase.from('organizations').select('id, name')
    .eq('type', 'agency').eq('verification_status', 'verified').eq('org_status', 'active').order('name').limit(100);
  // Solo llegan los procesos que la agencia ha decidido compartir (lo garantiza la RLS).
  const { data: cases } = await supabase
    .from('recruiting_cases')
    .select('id, agency_id, institution_name, cycle, stage, updated_at')
    .eq('athlete_id', session.userId)
    .order('updated_at', { ascending: false });
  const caseIds = (cases ?? []).map((c) => c.id);
  const { data: changes } = caseIds.length
    ? await supabase.from('recruiting_case_activities').select('case_id, from_stage, to_stage, created_at')
      .in('case_id', caseIds).eq('kind', 'stage_change').order('created_at', { ascending: false })
    : { data: [] };

  return (
    <>
      <PageHeader kicker="Agencias" title={<>Quién quiere <em>acompañarte</em></>} description="Tú decides. Una agencia solo puede compartir tu perfil y acompañarte en el proceso si la autorizas, y puedes retirar la autorización cuando quieras." />
      <Notice tone="warn">
        <strong className="text-paper">Si vas a competir en la NCAA:</strong> no firmes acuerdos cuya tarifa dependa de conseguir una beca o de su importe, ni aceptes regalos o viajes de una agencia. Ante la duda, pregunta al departamento de cumplimiento (compliance) de la universidad. The Gala Alliance es software: no representa a atletas ni garantiza becas.
      </Notice>
      {session.isMinor && <div className="mb-5"><Notice tone="neutral">Las agencias no pueden encontrarte mientras seas menor. Si quieres una propuesta, tu familia o tú podéis invitar a una agencia verificada, y nada se activa sin la aprobación de tu familia.</Notice></div>}
      <Card className="mb-5">
        <CardTitle kicker="Tú eliges">Invitar a una agencia</CardTitle>
        <p className="mb-3 text-sm text-muted">Si ya sabes con quién quieres trabajar, invítala a enviarte su propuesta. Verás el alcance exacto antes de aceptar{session.isMinor ? ', y tu familia tendrá que aprobarla' : ''}.</p>
        <InviteAgencyForm agencies={(verifiedAgencies ?? []) as { id: string; name: string }[]} />
      </Card>
      <div className="mb-5"><Notice tone="neutral">Antes de firmar con un agente, consulta las normas de agentes de la NCAA/NAIA y de tu federación: algunos acuerdos pueden afectar a tu elegibilidad.</Notice></div>
      {reps?.length ? (
        <ul className="space-y-4">
          {reps.map((r) => {
            const org = r.organizations as unknown as { name: string; website: string | null; verification_status: string } | null;
            const ui = toRepStatus(r.status);
            const detail = repStatusDetail(r.status);
            const cov = (r.representation_coverage ?? []) as { dimension: string; value: string }[];
            const perms = ((r.representation_permissions ?? []) as { permission: string; status: string }[]).filter((p) => p.status === 'active').map((p) => p.permission);
            const scope = (d: string) => cov.filter((c) => c.dimension === d).map((c) => (c.value === 'WORLD' ? 'Todo el mundo' : c.value)).join(', ');
            const open = r.status === 'active' || r.status === 'suspended' || r.status === 'pending_review' || r.status === 'pending_guardian';
            return (
              <li key={r.id}>
                <Card>
                  <CardTitle kicker={org?.verification_status === 'verified' ? 'Agencia verificada ✓' : 'Agencia sin verificar'} action={ui ? <StatusPill status={ui} /> : <Badge>{r.status}</Badge>}>
                    {org?.name}
                  </CardTitle>
                  {detail && <p className="mb-2 text-sm text-warn">{detail}</p>}
                  {r.message && <p className="text-sm text-muted">“{r.message}”</p>}
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div><dt className="inline text-faint">Tipo: </dt><dd className="inline text-paper">{REP_TYPE_LABEL[r.representation_type] ?? r.representation_type}</dd></div>
                    <div><dt className="inline text-faint">Vigencia: </dt><dd className="inline text-paper">{r.start_date} → {r.end_date}</dd></div>
                    {scope('sport') && <div><dt className="inline text-faint">Deporte: </dt><dd className="inline text-paper">{scope('sport')}</dd></div>}
                    {scope('territory') && <div><dt className="inline text-faint">Territorio: </dt><dd className="inline text-paper">{scope('territory')}</dd></div>}
                  </dl>
                  {r.status !== 'ended' && r.status !== 'declined' && (() => {
                    const line = attestationLine(attestations.get(r.id));
                    return <p data-testid="fee-attestation" className={`mt-3 text-sm ${line.tone === 'ok' ? 'text-muted' : 'text-warn'}`}>{line.tone === 'ok' ? '✓ ' : ''}{line.text}</p>;
                  })()}
                  {r.status === 'requested' && perms.length > 0 && (
                    <p className="mt-2 text-sm text-muted">Si aceptas, podrá: {REP_PERMISSIONS.filter((p) => perms.includes(p.id)).map((p) => p.label.toLowerCase()).join(' · ')}. Podrás quitar cualquiera después.</p>
                  )}
                  {org?.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-brass hover:underline">Web de la agencia ↗</a>}
                  <div className="mt-2"><ReportButton entityType="organization" entityId={r.agency_id} label="Denunciar a esta agencia" reasons={AGENT_REPORT_REASONS} /></div>
                  <div className="mt-4 flex gap-2">
                    {r.status === 'requested' && (
                      <>
                        <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="active" /><button className={buttonClass('primary', 'sm')}>Autorizar</button></form>
                        <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="declined" /><button className={buttonClass('secondary', 'sm')}>Rechazar</button></form>
                      </>
                    )}
                    {open && <form action={respondRepresentation}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="ended" /><button className="text-sm text-faint hover:text-danger">{r.status === 'active' ? 'Revocar representación' : 'Cancelar'}</button></form>}
                  </div>
                  {(r.status === 'active' || r.status === 'suspended') && (
                    <details className="mt-4 rounded-lg border border-line p-3">
                      <summary className="cursor-pointer text-sm font-medium text-paper">Qué puede hacer esta agencia</summary>
                      <div className="mt-3"><RepPermissionsForm id={r.id} active={perms} /></div>
                    </details>
                  )}
                  {r.status === 'active' && (
                    <p className="mt-3 text-xs text-faint">Si terminas la relación, la agencia conserva el historial de lo hecho, pero no puede abrir procesos nuevos con tu nombre.</p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
      {(cases ?? []).length > 0 && (
        <section className="mt-8" aria-labelledby="my-cases">
          <h2 id="my-cases" className="mb-1 font-display text-2xl font-bold uppercase text-paper">Tus procesos con universidades</h2>
          <p className="mb-4 text-sm text-muted">Lo que tu agencia ha decidido compartir contigo: universidad, temporada, fase y cada cambio con su fecha. Si echas en falta algo, pregúntale a tu agente.</p>
          <ul className="space-y-3">
            {(cases ?? []).map((c) => {
              const phase = casePhaseOf(c.stage);
              const idx = phase ? CASE_PHASES.findIndex((p) => p.id === phase.id) : -1;
              const history = (changes ?? []).filter((h) => h.case_id === c.id);
              return (
                <li key={c.id}>
                  <Card>
                    <CardTitle kicker={c.cycle} action={<Badge tone={c.stage === 'committed' ? 'ok' : c.stage === 'closed' ? 'danger' : 'neutral'}>{casePhaseLabel(c.stage)}</Badge>}>{c.institution_name}</CardTitle>
                    <div className="mb-3 flex gap-1" aria-hidden>
                      {CASE_PHASES.map((s, i) => <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= idx && c.stage !== 'closed' ? 'bg-brass' : 'bg-line'}`} />)}
                    </div>
                    <ul className="space-y-1 text-xs text-muted">
                      {history.slice(0, 5).map((h, i) => (
                        <li key={i}>{h.created_at.slice(0, 10)} · {h.from_stage ? `De «${stageLabel(h.from_stage)}» a «${stageLabel(h.to_stage ?? '')}»` : `Abierto en «${stageLabel(h.to_stage ?? '')}»`}</li>
                      ))}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {!reps?.length && <EmptyState title="Ninguna propuesta por ahora">No necesitas agente para usar la plataforma: tu Passport ya es visible para universidades verificadas.</EmptyState>}
    </>
  );
}
