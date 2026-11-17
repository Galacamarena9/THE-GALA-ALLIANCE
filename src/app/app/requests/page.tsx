import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { managedAthletes } from '@/lib/data/family';
import { INFO_KIND_LABEL } from '@/lib/domain/recruit';
import { Badge, Card, EmptyState, Notice, PageHeader, inputClass } from '@/components/ui';
import { respondInfoRequest } from '@/app/actions/recruit';

export const metadata: Metadata = { title: 'Solicitudes de información' };

const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const STATUS: Record<string, string> = { pending: 'Pendiente', pending_guardian: 'Pendiente de la familia', shared: 'Compartido', declined: 'Rechazada', revoked: 'Retirado', expired: 'Caducado' };

/** El atleta (o su familia) decide qué comparte, con quién y hasta cuándo. Nada se envía solo. */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  const ids = athletes.map((a) => a.id);
  const supabase = await createClient();
  const [{ data: reqs }, { data: docs }] = ids.length ? await Promise.all([
    supabase.from('info_requests').select('id, athlete_id, kind, message, status, shared_until, created_at, organizations(name, verification_status)').in('athlete_id', ids).order('created_at', { ascending: false }),
    supabase.from('athlete_documents').select('id, athlete_id, title, kind, uploaded_at').in('athlete_id', ids).not('uploaded_at', 'is', null),
  ]) : [{ data: [] }, { data: [] }];
  const name = new Map(athletes.map((a) => [a.id, a.name]));
  const in30 = isoIn(30);

  return (
    <>
      <PageHeader kicker="Privacidad" title="Solicitudes de información" description="Universidades verificadas que te piden algo concreto. Tú decides si lo compartes y hasta cuándo; puedes retirarlo en cualquier momento." />
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      {!(reqs ?? []).length ? <EmptyState title="Sin solicitudes">Cuando una universidad verificada te pida un documento o vídeo, aparecerá aquí.</EmptyState> : (
        <ul className="space-y-3">
          {(reqs ?? []).map((r) => {
            const o = r.organizations as unknown as { name: string; verification_status: string } | null;
            const own = (docs ?? []).filter((d) => d.athlete_id === r.athlete_id);
            const open = ['pending', 'pending_guardian'].includes(r.status);
            return (
              <li key={r.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-paper">{o?.name ?? 'Organización'} {o?.verification_status === 'verified' && <Badge tone="ok">Verificada</Badge>}</p>
                      <p className="text-sm text-paper">Pide: <strong>{INFO_KIND_LABEL[r.kind]}</strong>{athletes.length > 1 ? ` · para ${name.get(r.athlete_id)}` : ''}</p>
                      <p className="mt-1 text-sm text-muted">“{r.message}”</p>
                      <p className="mt-1 text-xs text-faint">Propósito: proceso de recruiting · {new Date(r.created_at).toLocaleDateString('es-ES')}</p>
                    </div>
                    <Badge tone={r.status === 'shared' ? 'ok' : open ? 'warn' : 'neutral'}>{STATUS[r.status]}{r.status === 'shared' && r.shared_until ? ` hasta ${r.shared_until}` : ''}</Badge>
                  </div>
                  {open && (
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <form action={respondInfoRequest} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="share" value="1" />
                        {own.length > 0 && (
                          <label className="text-xs text-muted">Documento de tu bóveda
                            <select name="document" className={inputClass}><option value="">Solo confirmar (sin documento)</option>{own.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
                          </label>
                        )}
                        <label className="text-xs text-muted">Compartir hasta<input type="date" name="until" defaultValue={in30} className={inputClass} /></label>
                        <button className="min-h-11 rounded-full bg-brass px-4 text-sm font-semibold text-ink">Compartir</button>
                      </form>
                      <form action={respondInfoRequest}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="share" value="0" /><button className="min-h-11 rounded-full border border-line px-4 text-sm text-paper">Rechazar</button></form>
                    </div>
                  )}
                  {r.status === 'shared' && (
                    <form action={respondInfoRequest} className="mt-3"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="share" value="0" /><button className="text-xs text-danger underline">Dejar de compartir</button></form>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-faint">Tener un documento en tu Passport no lo comparte con nadie: cada acceso requiere tu permiso y queda registrado.</p>
    </>
  );
}
