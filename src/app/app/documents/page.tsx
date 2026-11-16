import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { familyPlan, managedAthletes, PLAN_RANK } from '@/lib/data/family';
import { daysUntil } from '@/lib/domain/labels';
import { DOC_CHECKLIST, DOC_KIND_LABEL, VISA_KINDS, type DocKind } from '@/content/documents';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Meter, Notice, PageHeader } from '@/components/ui';
import { CustomDocumentForm, DocumentUpload } from '@/components/autonomy';
import { removeDocumentFile, seedDocumentChecklist, setDocumentDueDate, setDocumentExpiry } from '@/app/actions/autonomy';
import { documentStatus, DOC_STATUS_LABEL } from '@/lib/domain/documents';

/** Documentos que caducan: pasaporte, exámenes de inglés y SAT/ACT, visados. */
const EXPIRING_KINDS = new Set<string>(['passport', 'english_test', 'sat_act', 'i20', 'ds160']);

export const metadata: Metadata = { title: 'Documentos' };

interface DocRow {
  id: string;
  kind: DocKind;
  title: string;
  due_date: string | null;
  expires_on: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  if (!athletes.length) {
    return (
      <>
        <PageHeader kicker="Centro de documentos" title="Documentos del proceso" />
        <EmptyState title="Vincula primero a tu hijo o hija" action={<ButtonLink href="/app/family">Ir a Familia</ButtonLink>}>
          Cuando el atleta apruebe el vínculo con permiso de edición, podréis preparar juntos su documentación.
        </EmptyState>
      </>
    );
  }
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  const supabase = await createClient();
  const [{ data }, plan] = await Promise.all([
    supabase.from('athlete_documents').select('id, kind, title, due_date, expires_on, storage_path, mime_type, size_bytes, uploaded_at')
      .eq('athlete_id', athlete.id).order('due_date', { ascending: true, nullsFirst: false }),
    familyPlan([session.userId, athlete.id]),
  ]);
  const docs = (data ?? []) as DocRow[];
  const done = docs.filter((d) => d.storage_path).length;
  const order = new Map(DOC_CHECKLIST.map((d, i) => [d.kind, i]));
  const hasVisa = PLAN_RANK[plan] >= PLAN_RANK.family_elite;
  const visible = docs.filter((d) => hasVisa || !VISA_KINDS.includes(d.kind) || d.storage_path);
  const hiddenVisa = docs.length - visible.length;

  return (
    <>
      <PageHeader
        kicker="Centro de documentos"
        title={athletes.length > 1 || athlete.id !== session.userId ? `Documentos de ${athlete.name}` : 'Tus documentos'}
        description="Privado: solo lo ven el atleta y la familia con permiso. Las organizaciones no tienen acceso."
      />
      {athletes.length > 1 && (
        <nav className="mb-5 flex flex-wrap gap-2" aria-label="Atleta">
          {athletes.map((a) => (
            <Link key={a.id} href={`/app/documents?a=${a.id}`} className={`rounded-full border px-3 py-1 text-sm ${a.id === athlete.id ? 'border-brass text-paper' : 'border-line text-muted hover:text-paper'}`}>{a.name}</Link>
          ))}
        </nav>
      )}

      {docs.length === 0 ? (
        <Card>
          <CardTitle kicker="Empieza aquí">Crea tu checklist</CardTitle>
          <p className="text-sm text-muted">
            Te preparamos la lista estándar del proceso ({DOC_CHECKLIST.length} documentos)
            {athlete.graduationYear ? ` con fechas recomendadas para la promoción ${athlete.graduationYear}` : ''}. Puedes cambiar cualquier fecha.
          </p>
          {athlete.canEdit ? (
            <form action={seedDocumentChecklist} className="mt-4">
              <input type="hidden" name="athlete_id" value={athlete.id} />
              <button className="rounded-lg bg-brass px-4 py-2.5 text-sm font-medium text-ink">Crear mi checklist</button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-faint">Necesitas permiso de edición del atleta para crearla.</p>
          )}
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardTitle kicker={`${done} de ${docs.length} listos`}>Checklist</CardTitle>
            <ul className="divide-y divide-line">
              {visible
                .sort((x, y) => (x.due_date ?? '9999').localeCompare(y.due_date ?? '9999') || (order.get(x.kind) ?? 99) - (order.get(y.kind) ?? 99))
                .map((d) => {
                  const left = d.due_date ? daysUntil(d.due_date) : null;
                  const tone = d.storage_path ? 'ok' : left != null && left < 0 ? 'danger' : left != null && left <= 30 ? 'warn' : 'neutral';
                  const help = DOC_CHECKLIST.find((c) => c.kind === d.kind);
                  const st = documentStatus(d);
                  return (
                    <li key={d.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-paper">{d.title}</p>
                        <p className="mt-0.5 text-xs text-faint">{help ? `${help.when}. ${help.why}` : DOC_KIND_LABEL[d.kind]}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={tone}>
                            {d.storage_path ? 'Subido' : left == null ? 'Sin fecha' : left < 0 ? `Vencido hace ${-left} días` : `Faltan ${left} días`}
                          </Badge>
                          {d.storage_path && (st === 'expired' || st === 'expiring') && (
                            <Badge tone={DOC_STATUS_LABEL[st].tone === 'danger' ? 'danger' : 'warn'}>{DOC_STATUS_LABEL[st].label}{d.expires_on ? ` · ${d.expires_on.split('-').reverse().join('/')}` : ''}</Badge>
                          )}
                          {d.storage_path && <a href={`/api/documents/${d.id}`} className="text-xs text-brass hover:underline">Descargar</a>}
                        </div>
                      </div>
                      {athlete.canEdit && (
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={setDocumentDueDate} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="athlete_id" value={athlete.id} />
                            <input type="date" name="due_date" defaultValue={d.due_date ?? ''} aria-label={`Fecha objetivo de ${d.title}`} className="rounded-lg border border-line bg-ink px-2 py-1 text-xs text-paper" />
                            <button className="text-xs text-muted hover:text-paper">Guardar</button>
                          </form>
                          {d.storage_path && EXPIRING_KINDS.has(d.kind) && (
                            <form action={setDocumentExpiry} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="athlete_id" value={athlete.id} />
                              <label className="text-xs text-faint" htmlFor={`exp-${d.id}`}>Caduca</label>
                              <input id={`exp-${d.id}`} type="date" name="expires_on" defaultValue={d.expires_on ?? ''} className="rounded-lg border border-line bg-ink px-2 py-1 text-xs text-paper" />
                              <button className="text-xs text-muted hover:text-paper">Guardar</button>
                            </form>
                          )}
                          <DocumentUpload docId={d.id} athleteId={athlete.id} hasFile={Boolean(d.storage_path)} />
                          {d.storage_path && (
                            <form action={removeDocumentFile}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="athlete_id" value={athlete.id} />
                              <button className="text-xs text-faint hover:text-danger">Quitar archivo</button>
                            </form>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
            {athlete.canEdit && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-2 text-sm text-paper">Añadir otro documento</p>
                <CustomDocumentForm athleteId={athlete.id} />
              </div>
            )}
          </Card>
          <div className="space-y-5">
            <Card>
              <Meter value={docs.length ? Math.round((done / docs.length) * 100) : 0} label="Documentación lista" />
            </Card>
            {hiddenVisa > 0 && (
              <Notice tone="brass">
                El calendario de visado y llegada (I-20, SEVIS, DS-160, financiero y médico) forma parte de Elite. <Link href="/precios" className="underline">Ver planes</Link>
              </Notice>
            )}
            <Notice tone="neutral">
              Solo PDF, JPG o PNG de hasta 10 MB. No subas documentos de terceros sin su permiso. Puedes borrar cualquier archivo cuando quieras.
            </Notice>
          </div>
        </div>
      )}
    </>
  );
}
