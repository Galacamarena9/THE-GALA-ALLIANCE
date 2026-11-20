import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, Notice, PageHeader, inputClass, buttonClass } from '@/components/ui';
import { FlagForm } from '@/components/admin/OpsForms';
import { decideApproval, resolveConflict, updateSupportCase } from '@/app/actions/admin-ops';

export const metadata: Metadata = { title: 'Operaciones' };

const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const SUPPORT_STATUS: Record<string, string> = { open: 'Abierto', waiting_user: 'Esperando a la persona', in_progress: 'En curso', resolved: 'Resuelto', closed: 'Cerrado' };

/**
 * 16 · Operaciones de Gala: interruptores, búsqueda, soporte, aprobaciones dobles, conflictos de representación y
 * jobs. Cada bloque solo aparece con el rol interno que lo permite; la base de datos lo vuelve a comprobar.
 */
export default async function AdminOpsPage({ searchParams }: { searchParams: Promise<{ q?: string; aprobacion?: string }> }) {
  await requireSession(['admin']);
  const sp = await searchParams;
  const supabase = await createClient();
  const roles = await Promise.all(['super_admin', 'support', 'finance', 'trust_safety'].map((r) => supabase.rpc('has_admin_role', { p_role: r }).then((x) => [r, x.data === true] as const)));
  const can = Object.fromEntries(roles) as Record<string, boolean>;
  const q = (sp.q ?? '').trim();
  const [{ data: flags }, search, { data: cases }, { data: approvals }, { data: conflicts }, { data: jobs }] = await Promise.all([
    supabase.from('feature_flags').select('key, enabled, description, kill_switch, updated_at').order('key'),
    q.length >= 3 && (can.support || can.trust_safety) ? supabase.rpc('admin_search', { p_query: q }) : Promise.resolve({ data: null }),
    can.support ? supabase.from('support_cases').select('id, subject, body, category, status, created_at').in('status', ['open', 'waiting_user', 'in_progress']).order('created_at').limit(30) : Promise.resolve({ data: [] }),
    can.finance || can.super_admin ? supabase.from('admin_approvals').select('id, action, payload, reason, status, created_at').eq('status', 'pending').order('created_at') : Promise.resolve({ data: [] }),
    can.trust_safety ? supabase.from('admin_representation_conflicts').select('*').eq('status', 'open').order('detected_at') : Promise.resolve({ data: [] }),
    supabase.rpc('admin_jobs'),
  ]);
  const { data: healthRaw } = await supabase.rpc('admin_platform_health');
  const h = (healthRaw ?? {}) as Record<string, number | boolean | string[] | null>;
  const alarms = [
    (h.child_safety_oldest_hours as number) >= 24 && `Hay una denuncia de seguridad infantil sin atender desde hace ${h.child_safety_oldest_hours} h (objetivo: < 24 h).`,
    (h.stripe_unprocessed as number) > 0 && `${h.stripe_unprocessed} evento(s) de Stripe sin procesar: revisa el webhook.`,
    (h.break_glass_unreviewed as number) > 0 && `${h.break_glass_unreviewed} acceso(s) de emergencia sin revisar.`,
    Array.isArray(h.kill_switches_off) && h.kill_switches_off.length > 0 && `Funcionalidades apagadas: ${(h.kill_switches_off as string[]).join(', ')}.`,
    h.cron_available === false && 'pg_cron no está activo: las caducidades y limpiezas no corren solas.',
  ].filter(Boolean) as string[];
  const results = (search.data ?? []) as { kind: string; id: string; label: string; detail: string | null }[];

  return (
    <>
      <PageHeader kicker="Admin" title="Operaciones" description="Interruptores, soporte, aprobaciones y conflictos. Gala opera: no curiosea." />
      {sp.aprobacion === 'misma_persona' && <div className="mb-5"><Notice tone="warn">Una aprobación la da otra persona distinta de quien la pidió.</Notice></div>}
      {sp.aprobacion === 'ok' && <div className="mb-5"><Notice tone="ok">Decisión registrada.</Notice></div>}

      <Card className="mb-5">
        <CardTitle kicker="Salud" action={<Badge tone={alarms.length ? 'warn' : 'ok'}>{alarms.length ? `${alarms.length} alerta(s)` : 'Todo en orden'}</Badge>}>Estado de la plataforma</CardTitle>
        {alarms.length ? <ul className="space-y-1 text-sm text-warn">{alarms.map((a) => <li key={a}>• {a}</li>)}</ul> : <p className="text-sm text-muted">Sin colas atascadas, pagos sin procesar ni alarmas de seguridad.</p>}
        <p className="mt-2 text-xs text-faint">Denuncias abiertas: {String(h.reports_open ?? 0)} · verificaciones pendientes: {String(h.verifications_pending ?? 0)} · representaciones en revisión: {String(h.representations_pending_review ?? 0)} · pagos en disputa: {String(h.payments_disputed ?? 0)}</p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle kicker="Interruptores">Funcionalidades</CardTitle>
          <ul className="divide-y divide-line">
            {(flags ?? []).map((f) => (
              <li key={f.key} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-paper">{f.description}</p>
                  <Badge tone={f.enabled ? 'ok' : 'danger'}>{f.enabled ? 'Activa' : 'Desactivada'}</Badge>
                </div>
                {can.super_admin && <details className="mt-2"><summary className="cursor-pointer text-xs text-brass">{f.enabled ? 'Desactivar (interruptor de emergencia)' : 'Volver a activar'}</summary><div className="mt-2"><FlagForm flagKey={f.key} enabled={f.enabled} /></div></details>}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle kicker="Búsqueda">Personas y organizaciones</CardTitle>
          {can.support || can.trust_safety ? (
            <>
              <form className="flex gap-2"><input name="q" defaultValue={q} minLength={3} placeholder="Nombre (mín. 3 letras)" aria-label="Buscar" className={inputClass} /><button className="rounded-lg bg-brass px-4 text-sm text-ink">Buscar</button></form>
              <p className="mt-1 text-xs text-faint">Datos mínimos. Cada búsqueda queda auditada.</p>
              {results.length > 0 && <ul className="mt-3 divide-y divide-line text-sm">{results.map((r) => <li key={`${r.kind}-${r.id}`} className="py-2"><span className="text-paper">{r.label}</span> <span className="text-faint">· {r.kind === 'user' ? 'persona' : 'organización'} · {r.detail ?? '—'}</span></li>)}</ul>}
              {q.length >= 3 && !results.length && <p className="mt-3 text-sm text-muted">Sin resultados.</p>}
            </>
          ) : <p className="text-sm text-muted">Requiere el rol de soporte o de Trust &amp; Safety.</p>}
        </Card>
      </div>

      {can.support && (
        <Card className="mt-5">
          <CardTitle kicker="Soporte" action={<Badge>{cases?.length ?? 0}</Badge>}>Casos abiertos</CardTitle>
          <ul className="divide-y divide-line">
            {(cases ?? []).map((c) => (
              <li key={c.id} className="py-3">
                <p className="text-sm text-paper">{c.subject} <span className="text-faint">· {c.category} · {SUPPORT_STATUS[c.status]} · {date(c.created_at)}</span></p>
                <p className="mt-1 text-sm text-muted">{c.body}</p>
                <form action={updateSupportCase} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="status" defaultValue={c.status} aria-label="Estado" className={`${inputClass} w-auto py-1.5`}>{Object.entries(SUPPORT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input name="note" placeholder="Nota" aria-label="Nota" className={`${inputClass} flex-1 py-1.5`} />
                  <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" name="public" /> Respuesta visible para la persona</label>
                  <button className={buttonClass('primary', 'sm')}>Guardar</button>
                </form>
              </li>
            ))}
            {!(cases ?? []).length && <li className="py-3 text-sm text-muted">No hay casos abiertos.</li>}
          </ul>
        </Card>
      )}

      {(can.finance || can.super_admin) && (
        <Card className="mt-5">
          <CardTitle kicker="Doble aprobación" action={<Badge>{approvals?.length ?? 0}</Badge>}>Pendientes</CardTitle>
          <ul className="divide-y divide-line">
            {(approvals ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><span className="text-paper">{a.action === 'entitlement_grant' ? `Conceder ${(a.payload as { plan_code?: string }).plan_code}` : 'Borrar organización'}</span> <span className="text-faint">· {a.reason}</span></span>
                <span className="flex gap-2">
                  <form action={decideApproval}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="approve" /><button className={buttonClass('primary', 'sm')}>Aprobar</button></form>
                  <form action={decideApproval}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="reject" /><button className={buttonClass('secondary', 'sm')}>Rechazar</button></form>
                </span>
              </li>
            ))}
            {!(approvals ?? []).length && <li className="py-3 text-sm text-muted">Nada pendiente.</li>}
          </ul>
        </Card>
      )}

      {can.trust_safety && (
        <Card className="mt-5">
          <CardTitle kicker="Representación" action={<Badge>{conflicts?.length ?? 0}</Badge>}>Conflictos de exclusividad</CardTitle>
          <p className="mb-2 text-xs text-muted">Gala resuelve el conflicto operativo; no decide qué contrato es válido. Si hace falta, pide aclaración a las partes antes de activar ninguna.</p>
          <ul className="divide-y divide-line">
            {(conflicts ?? []).map((c) => (
              <li key={c.id} className="py-3 text-sm">
                <p className="text-paper">A: {c.type_a} · {c.status_a} · {c.start_a} → {c.end_a}</p>
                <p className="text-paper">B: {c.type_b} · {c.status_b} · {c.start_b} → {c.end_b}</p>
                <form action={resolveConflict} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="resolution" required minLength={10} placeholder="Resolución (qué se ha comprobado)" aria-label="Resolución" className={`${inputClass} flex-1 py-1.5`} />
                  <select name="activate" aria-label="Activar" className={`${inputClass} w-auto py-1.5`} defaultValue="">
                    <option value="">No activar ninguna</option>
                    {c.status_a === 'pending_review' && <option value={c.representation_a}>Activar A</option>}
                    {c.status_b === 'pending_review' && <option value={c.representation_b}>Activar B</option>}
                  </select>
                  <button className={buttonClass('primary', 'sm')}>Resolver</button>
                </form>
              </li>
            ))}
            {!(conflicts ?? []).length && <li className="py-3 text-sm text-muted">No hay conflictos abiertos.</li>}
          </ul>
        </Card>
      )}

      <Card className="mt-5">
        <CardTitle kicker="Sistema">Jobs programados</CardTitle>
        {(jobs ?? []).length ? (
          <ul className="divide-y divide-line text-sm">{(jobs as { jobname: string; schedule: string; last_status: string | null; last_run: string | null }[]).map((j) => <li key={j.jobname} className="flex justify-between py-2"><span className="text-paper">{j.jobname}</span><span className="text-faint">{j.schedule} · {j.last_status ?? 'sin ejecuciones'}{j.last_run ? ` · ${date(j.last_run)}` : ''}</span></li>)}</ul>
        ) : <p className="text-sm text-muted">pg_cron no está activo en este entorno: los jobs (caducidades, limpieza) no se ejecutan solos. Actívalo en Supabase.</p>}
      </Card>
      <p className="mt-6 text-xs text-faint"><Link href="/app/admin" className="text-brass hover:underline">Revisión</Link> · <Link href="/app/admin/safety" className="text-brass hover:underline">Trust &amp; Safety</Link> · <Link href="/app/admin/panel" className="text-brass hover:underline">Panel de mando</Link></p>
    </>
  );
}
