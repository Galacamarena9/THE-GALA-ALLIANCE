import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { DecideAppealForm, ModerateForm, OpenCaseForm } from '@/components/safety/SafetyForms';
import { revertModeration } from '@/app/actions/safety';
import { GuardianReviewQueue, type GuardianReviewRow } from '@/components/safety/GuardianReviewQueue';

export const metadata: Metadata = { title: 'Trust & Safety' };

const PRIORITY_TONE: Record<string, 'danger' | 'warn' | 'neutral'> = { critical: 'danger', high: 'warn', medium: 'neutral', low: 'neutral' };
const REASON: Record<string, string> = { child_safety: 'Seguridad infantil', harassment: 'Acoso', fake_or_misleading: 'Falso o engañoso', spam: 'Spam', illegal_content: 'Contenido ilegal', privacy: 'Privacidad', other: 'Otro',
  impersonation: 'Suplantación', unauthorized_representation: 'Representación no autorizada', misleading_fees: 'Honorarios engañosos',
  payment_request: 'Pago sospechoso', unauthorized_document_use: 'Uso no autorizado de documentos',
  false_guarantee: 'Garantía falsa', incorrect_cost: 'Coste incorrecto' };
const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

/**
 * 14 · Cola de Trust & Safety: denuncias sin caso, casos abiertos con su historia y su medida, apelaciones y
 * sanciones activas. Solo la ve quien tiene el rol interno de Trust & Safety (lo decide la base de datos).
 */
export default async function SafetyQueuePage({ searchParams }: { searchParams: Promise<{ tutor?: string }> }) {
  const { tutor } = await searchParams;
  await requireSession(['admin']);
  const supabase = await createClient();
  const { data: canTs } = await supabase.rpc('has_admin_role', { p_role: 'trust_safety' });
  if (!canTs) return (<><PageHeader kicker="Admin" title="Trust & Safety" /><EmptyState title="Sin acceso">Esta cola requiere el rol interno de Trust & Safety.</EmptyState></>);

  const [{ data: reports }, { data: cases }, { data: appeals }, { data: active }, { data: guardians }] = await Promise.all([
    supabase.from('content_reports').select('id, entity_type, entity_id, reason, details, priority, created_at').is('case_id', null).in('status', ['open', 'reviewing']).order('priority').order('created_at').limit(50),
    supabase.from('safety_cases').select('id, title, category, priority, status, subject_user, subject_org, created_at, safety_case_events(id, kind, body, created_at)').in('status', ['open', 'investigating', 'actioned']).order('created_at', { ascending: false }).limit(50),
    supabase.from('moderation_appeals').select('id, body, created_at, moderation_actions(action, reason)').eq('status', 'open').order('created_at').limit(50),
    supabase.from('moderation_actions').select('id, action, scopes, reason, ends_at, subject_user, subject_org, created_at').is('reverted_at', null).not('action', 'in', '(no_action,escalate,warning)').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('guardian_review_queue'),
  ]);
  type Ev = { id: string; kind: string; body: string; created_at: string };
  type Case = { id: string; title: string; category: string; priority: string; status: string; subject_user: string | null; subject_org: string | null; created_at: string; safety_case_events: Ev[] };
  const casesSorted = ((cases ?? []) as unknown as Case[]).sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.priority) - ['critical', 'high', 'medium', 'low'].indexOf(b.priority));

  return (
    <>
      <PageHeader kicker="Admin" title="Trust & Safety" description="Denuncias, casos, apelaciones y medidas activas. Cada decisión necesita un motivo y queda auditada." />
      <div className="mb-6"><GuardianReviewQueue rows={(guardians ?? []) as GuardianReviewRow[]} notice={tutor} /></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle kicker="Denuncias sin caso" action={<Badge>{reports?.length ?? 0}</Badge>}>Para triar</CardTitle>
          {(reports ?? []).length ? (
            <ul className="divide-y divide-line">
              {(reports ?? []).map((r) => (
                <li key={r.id} className="py-3">
                  <p className="text-sm"><Badge tone={r.priority === 0 ? 'danger' : r.priority === 1 ? 'warn' : 'neutral'}>{REASON[r.reason] ?? r.reason}</Badge> <span className="text-paper">{r.entity_type}</span> <span className="text-faint">· {date(r.created_at)}</span></p>
                  {r.details && <p className="mt-1 text-sm text-muted">{r.details}</p>}
                  <details className="mt-2"><summary className="cursor-pointer text-xs text-brass">Abrir caso</summary>
                    <div className="mt-2"><OpenCaseForm reportId={r.id} subjectUser={r.entity_type === 'athlete_profile' ? r.entity_id : undefined} subjectOrg={r.entity_type === 'organization' ? r.entity_id : undefined} defaultTitle={`${REASON[r.reason] ?? r.reason} · ${r.entity_type}`} /></div>
                  </details>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nada pendiente de triar.</p>}
        </Card>

        <Card>
          <CardTitle kicker="Apelaciones" action={<Badge>{appeals?.length ?? 0}</Badge>}>Pendientes</CardTitle>
          {(appeals ?? []).length ? (
            <ul className="divide-y divide-line">
              {(appeals ?? []).map((a) => {
                const act = a.moderation_actions as unknown as { action: string; reason: string } | null;
                return (
                  <li key={a.id} className="py-3">
                    <p className="text-xs text-faint">Medida: {act?.action} · {act?.reason}</p>
                    <p className="mt-1 text-sm text-paper">“{a.body}”</p>
                    <div className="mt-2"><DecideAppealForm id={a.id} /></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted">No hay apelaciones abiertas.</p>}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-bold uppercase text-paper">Casos abiertos</h2>
      {casesSorted.length ? (
        <ul className="space-y-4">
          {casesSorted.map((c) => (
            <li key={c.id}>
              <Card>
                <CardTitle kicker={`${c.category} · ${c.status}`} action={<Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge>}>{c.title}</CardTitle>
                <ol className="mb-3 space-y-1 border-l border-line pl-3 text-xs text-muted">
                  {[...c.safety_case_events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => <li key={e.id}><span className="text-faint">{date(e.created_at)}</span> · {e.body}</li>)}
                </ol>
                {(c.subject_user || c.subject_org) ? <ModerateForm caseId={c.id} subjectUser={c.subject_user} subjectOrg={c.subject_org} /> : <p className="text-xs text-muted">Caso sin persona u organización vinculada: documenta y cierra.</p>}
              </Card>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No hay casos abiertos" />}

      <h2 className="mb-3 mt-8 font-display text-xl font-bold uppercase text-paper">Medidas activas</h2>
      <Card>
        {(active ?? []).length ? (
          <ul className="divide-y divide-line">
            {(active ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><span className="text-paper">{m.action}</span>{m.scopes?.length ? <span className="text-faint"> · {m.scopes.join(', ')}</span> : null}<span className="text-faint"> · {m.ends_at ? `hasta ${date(m.ends_at)}` : 'sin fecha de fin'}</span></span>
                <details><summary className="cursor-pointer text-xs text-muted hover:text-paper">Retirar</summary>
                  <form action={revertModeration} className="mt-2 flex gap-2"><input type="hidden" name="id" value={m.id} /><input name="reason" required minLength={3} placeholder="Motivo" className="rounded-lg border border-line bg-ink px-2 py-1 text-xs text-paper" /><button className="text-xs text-brass">Confirmar</button></form>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No hay medidas activas.</p>}
      </Card>
      <p className="mt-6 text-xs text-faint"><Link href="/app/admin" className="text-brass hover:underline">← Volver a revisión</Link></p>
    </>
  );
}
