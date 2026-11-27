import Link from 'next/link';
import { ExternalLink, Mail, Send, Trash2 } from 'lucide-react';
import { Badge, Card, CardTitle, Field, Notice, PageHeader, buttonClass, cx, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { addOutreachContact, deleteOutreachContact, importOutreachSeed, sendOutreachInvites, setOutreachStatus } from '@/app/actions/outreach';
import {
  CHANNELS, CHANNEL_LABEL, MAX_INVITES_PER_BATCH, OUTREACH_SEGMENTS, OUTREACH_STATUSES, SEGMENT_LABEL, STATUS_LABEL, STATUS_TONE,
  canAutoInvite, filterOutreach, manualMessage, outreachCounts, type OutreachContact, type OutreachFilters,
} from '@/lib/domain/outreach';

const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—');

/** Lista de difusión: quién está, en qué estado, invitar con un clic y ver quién ha respondido. */
export function OutreachView({ rows, filters, aviso, emailReady, demo = false }: {
  rows: OutreachContact[]; filters: OutreachFilters; aviso: string | null; emailReady: boolean; demo?: boolean;
}) {
  const counts = outreachCounts(rows);
  const shown = filterOutreach(rows, filters);
  const act = <T,>(fn: T) => (demo ? undefined : fn);
  const manual = manualMessage({ segment: 'agency' });
  const q = (patch: Partial<OutreachFilters>) => {
    const f = { ...filters, ...patch };
    const sp = new URLSearchParams();
    if (f.segment !== 'all') sp.set('segmento', f.segment);
    if (f.status !== 'all') sp.set('estado', f.status);
    if (f.q) sp.set('q', f.q);
    const s = sp.toString();
    return `/app/admin/difusion${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <PageHeader
        kicker="Operaciones Gala"
        title="Difusión"
        description="Organizaciones a las que invitar a probar la plataforma. La invitación pide permiso, se envía una sola vez y lleva baja en un clic. Cuando alguien responde, te llega un aviso."
      />
      <div className="space-y-5">
        {aviso && <div role="status"><Notice tone="brass">{aviso}</Notice></div>}
        {!emailReady && (
          <Notice tone="warn">El envío de correo no está configurado en este entorno (faltan RESEND_API_KEY y EMAIL_FROM). Puedes preparar la lista; las invitaciones no saldrán hasta configurarlo.</Notice>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Resumen de la lista">
          {[
            ['En la lista', counts.total], ['Listas para invitar', counts.ready], ['Esperando respuesta', counts.waiting],
            ['Quieren probarla', counts.interested], ['Ya dentro', counts.inside],
          ].map(([k, v], i) => (
            <div key={k} className={cx('stat-tile flex flex-col', i === 0 && 'is-hero')}>
              <dt className="stat-tile-label !mt-0 mb-1.5">{k}</dt>
              <dd className="stat-tile-value">{v}</dd>
            </div>
          ))}
        </dl>

        <Card>
          <CardTitle
            kicker={`${shown.length} de ${rows.length}`}
            action={rows.length === 0 ? undefined : (
              <form action={act(importOutreachSeed)}><SubmitButton variant="ghost" size="sm" pendingText="Cargando…">Cargar lista inicial</SubmitButton></form>
            )}
          >Organizaciones</CardTitle>

          <nav aria-label="Filtrar por tipo" className="mb-3 flex flex-wrap gap-1.5">
            {(['all', ...OUTREACH_SEGMENTS] as const).map((s) => (
              <Link key={s} href={q({ segment: s })} aria-current={filters.segment === s ? 'page' : undefined}
                className={cx('rounded-full border px-3 py-1 text-xs', filters.segment === s ? 'border-brass bg-brass/10 text-paper' : 'border-line text-muted hover:text-paper')}>
                {s === 'all' ? 'Todas' : SEGMENT_LABEL[s]}
              </Link>
            ))}
          </nav>
          <form method="get" action="/app/admin/difusion" className="mb-4 flex flex-wrap items-end gap-2">
            {filters.segment !== 'all' && <input type="hidden" name="segmento" value={filters.segment} />}
            <label className="text-xs text-faint">Estado
              <select name="estado" defaultValue={filters.status} className={cx(inputClass, 'mt-1 w-48')}>
                <option value="all">Todos</option>
                {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="text-xs text-faint">Buscar
              <input type="search" name="q" defaultValue={filters.q} placeholder="Nombre, país o nota" className={cx(inputClass, 'mt-1 w-56')} />
            </label>
            <button className={buttonClass('secondary', 'sm')}>Filtrar</button>
          </form>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" data-empty>
              <p className="font-display text-[22px] uppercase text-paper">La lista está vacía</p>
              <p className="max-w-md text-sm text-muted">Carga la lista inicial del informe (16 agencias y federaciones, cada una con su fuente pública) o añade organizaciones a mano.</p>
              <form action={act(importOutreachSeed)}><SubmitButton pendingText="Cargando…">Cargar lista inicial</SubmitButton></form>
            </div>
          ) : !shown.length ? (
            <p className="px-2 py-8 text-center text-sm text-muted">Ninguna organización coincide con estos filtros. <Link href="/app/admin/difusion" className="text-brass hover:underline">Quitar filtros</Link></p>
          ) : (
            <>
              <form id="invite-form" action={act(sendOutreachInvites)} />
              <div className="overflow-x-auto">
                <table className="data-table w-full min-w-[760px] text-sm">
                  <caption className="sr-only">Organizaciones de la lista de difusión</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-faint">
                      <th scope="col" className="w-10 py-2 pl-2"><span className="sr-only">Elegir</span></th>
                      <th scope="col" className="py-2">Organización</th>
                      <th scope="col" className="py-2">Canal</th>
                      <th scope="col" className="py-2">Estado</th>
                      <th scope="col" className="py-2">Invitada / respondió</th>
                      <th scope="col" className="py-2 pr-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id} className="border-b border-line/70 align-top" data-outreach={r.status}>
                        <td className="py-3 pl-2">
                          {canAutoInvite(r) && (
                            <input type="checkbox" name="id" value={r.id} form="invite-form" aria-label={`Invitar a ${r.organizationName}`} className="h-4 w-4 accent-[var(--color-brass)]" />
                          )}
                        </td>
                        <th scope="row" className="py-3 pr-3 text-left font-normal">
                          <span className="font-semibold text-paper">{r.organizationName}</span>
                          <span className="block text-xs text-muted">{SEGMENT_LABEL[r.segment]}{r.country ? ` · ${r.country}` : ''}{r.roleTitle ? ` · ${r.roleTitle}` : ''}</span>
                          {r.notes && <span className="mt-0.5 block text-xs text-faint">{r.notes}</span>}
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-brass hover:underline">
                            Fuente <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </th>
                        <td className="py-3 pr-3 text-xs text-muted">
                          {CHANNEL_LABEL[r.channel]}
                          {r.email && <span className="block break-all text-paper">{r.email}</span>}
                          {!r.email && r.channel === 'email' && <span className="block text-warn">Falta el correo</span>}
                          {r.channel !== 'email' && <span className="block text-faint">Contactar a mano</span>}
                        </td>
                        <td className="py-3 pr-3"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                        <td className="py-3 pr-3 text-xs text-muted tabular-nums">{dateFmt(r.invitedAt)} / {dateFmt(r.respondedAt)}</td>
                        <td className="py-3 pr-2 text-right">
                          <RowActions r={r} demo={demo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <SubmitButton form="invite-form" pendingText="Enviando…" disabled={counts.ready === 0}>
                  <Send className="h-4 w-4" aria-hidden /> Enviar invitación a las marcadas
                </SubmitButton>
                <p className="text-xs text-faint">Solo se marcan las que tienen correo y nunca se han contactado. Máximo {MAX_INVITES_PER_BATCH} por envío.</p>
              </div>
            </>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardTitle kicker="Nueva">Añadir organización</CardTitle>
            <form action={act(addOutreachContact)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre de la organización" htmlFor="o-name"><input id="o-name" name="organization_name" required minLength={2} maxLength={160} className={inputClass} /></Field>
              <Field label="Tipo" htmlFor="o-seg">
                <select id="o-seg" name="segment" className={inputClass} defaultValue="agency">
                  {OUTREACH_SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABEL[s]}</option>)}
                </select>
              </Field>
              <Field label="Canal" htmlFor="o-ch">
                <select id="o-ch" name="channel" className={inputClass} defaultValue="email">
                  {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </Field>
              <Field label="Correo de contacto (público, de la organización)" htmlFor="o-mail"><input id="o-mail" name="email" type="email" maxLength={200} className={inputClass} /></Field>
              <Field label="País (código de 2 letras)" htmlFor="o-cc"><input id="o-cc" name="country" maxLength={2} placeholder="ES" className={inputClass} /></Field>
              <Field label="Cargo o departamento (opcional)" htmlFor="o-role"><input id="o-role" name="role_title" maxLength={120} placeholder="Cuerpo técnico de baloncesto" className={inputClass} /></Field>
              <Field label="Web (opcional)" htmlFor="o-web"><input id="o-web" name="website" type="url" placeholder="https://" className={inputClass} /></Field>
              <Field label="Página pública donde aparece el contacto" hint="Obligatoria: es la fuente que se cita en la invitación." htmlFor="o-src"><input id="o-src" name="source_url" type="url" required placeholder="https://" className={inputClass} /></Field>
              <div className="sm:col-span-2"><Field label="Notas" htmlFor="o-notes"><textarea id="o-notes" name="notes" maxLength={1000} rows={2} className={inputClass} /></Field></div>
              <label className="flex items-start gap-2 text-sm text-muted sm:col-span-2">
                <input type="checkbox" name="is_organization" required className="mt-1 h-4 w-4" />
                Es una organización (agencia, universidad, federación, club o academia), no un atleta ni un menor.
              </label>
              <div className="sm:col-span-2"><SubmitButton>Añadir a la lista</SubmitButton></div>
            </form>
          </Card>
          <Card>
            <CardTitle kicker="Formulario web o LinkedIn">Mensaje para contactar a mano</CardTitle>
            <p className="mb-2 text-sm text-muted">Para organizaciones sin correo publicado: copia este texto en su formulario y después marca «Contactada a mano».</p>
            <pre className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2/40 p-3 text-xs text-paper" data-manual-message>{manual}</pre>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Mail className="h-3.5 w-3.5" aria-hidden /> Las invitaciones por correo usan este mismo texto con los botones «Sí, quiero probarla», «Ahora no» y la baja.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function RowActions({ r, demo }: { r: OutreachContact; demo: boolean }) {
  const moves: { status: 'contacted' | 'accepted' | 'declined' | 'registered' | 'bounced'; label: string }[] = [];
  if (r.status === 'new' || r.status === 'invited') moves.push({ status: 'contacted', label: 'Contactada a mano' });
  if (r.status === 'invited' || r.status === 'contacted') moves.push({ status: 'accepted', label: 'Dijo que sí' }, { status: 'declined', label: 'Dijo que no' });
  if (r.status === 'accepted' || r.status === 'contacted' || r.status === 'invited') moves.push({ status: 'registered', label: 'Ya está dentro' });
  if (r.status === 'invited') moves.push({ status: 'bounced', label: 'Rebotó' });
  return (
    <details className="relative inline-block text-left">
      <summary className={cx(buttonClass('ghost', 'sm'), 'cursor-pointer list-none')} aria-label={`Acciones para ${r.organizationName}`}>Acciones</summary>
      <div className="absolute right-0 z-20 mt-1 w-52 space-y-0.5 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-elevated)]">
        {moves.map((m) => (
          <form key={m.status} action={demo ? undefined : setOutreachStatus}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value={m.status} />
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-surface-2/60">{m.label}</button>
          </form>
        ))}
        {r.status === 'unsubscribed' && <p className="px-3 py-2 text-xs text-faint">Pidió no recibir más mensajes. No se puede volver a contactar.</p>}
        <form action={demo ? undefined : deleteOutreachContact}>
          <input type="hidden" name="id" value={r.id} />
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" aria-hidden /> Quitar de la lista</button>
        </form>
      </div>
    </details>
  );
}
