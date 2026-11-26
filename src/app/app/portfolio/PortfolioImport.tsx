'use client';

import { useActionState, useState } from 'react';
import { Copy, FileUp, Mail, MessageCircle, Upload } from 'lucide-react';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { importPortfolio, reissueInvite, revokeInvite, type ImportState } from '@/app/actions/portfolio-invites';
import { inviteMessage } from '@/lib/domain/portfolio-import';
import { useT } from '@/lib/i18n/client';

export interface InviteRow { id: string; full_name: string; email: string | null; sport: string | null; graduation_year: number | null; status: string; expires_at: string; created_at: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Enviada', cls: 'text-muted' },
  opened: { label: 'La ha abierto', cls: 'text-warn' },
  claimed: { label: 'Ya está dentro · envíale tu propuesta', cls: 'text-ok' },
  revoked: { label: 'Cancelada', cls: 'text-faint' },
};

function ShareLinks({ name, email, link, agencyName }: { name: string; email: string | null; link: string; agencyName: string }) {
  const [copied, setCopied] = useState(false);
  const msg = inviteMessage({ athleteFirstName: name.split(' ')[0], agencyName, link });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-paper hover:border-brass">
        <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? 'Copiado' : 'Copiar enlace'}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-paper hover:border-brass">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp<span className="sr-only"> (abre en otra pestaña)</span>
      </a>
      {email && (
        <a href={`mailto:${email}?subject=${encodeURIComponent('Tu perfil para el proceso hacia EE. UU.')}&body=${encodeURIComponent(msg)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-paper hover:border-brass">
          <Mail className="h-3.5 w-3.5" aria-hidden /> Email
        </a>
      )}
    </div>
  );
}

function PendingRow({ r, agencyName }: { r: InviteRow; agencyName: string }) {
  const [state, action] = useActionState(reissueInvite, {});
  const st = STATUS[r.status] ?? STATUS.sent;
  const open = r.status === 'sent' || r.status === 'opened';
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center" data-invite-status={r.status}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-paper">{r.full_name}</p>
        <p className="text-xs text-muted">{[r.sport, r.graduation_year ? `Promoción ${r.graduation_year}` : null, r.email].filter(Boolean).join(' · ') || 'Sin más datos'}</p>
        <p className={`mt-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</p>
      </div>
      {open && (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {state.link ? <ShareLinks name={r.full_name} email={r.email} link={state.link} agencyName={agencyName} /> : (
            <form action={action}><input type="hidden" name="id" value={r.id} /><SubmitButton size="sm" variant="secondary" pendingText="Generando…">Generar enlace para compartir</SubmitButton></form>
          )}
          {state.error && <p className="text-xs text-danger" role="alert">{state.error}</p>}
          <form action={revokeInvite}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-faint underline-offset-2 hover:text-danger hover:underline">Cancelar invitación</button></form>
        </div>
      )}
    </li>
  );
}

/**
 * Importar la cartera: la agencia sube o pega su Excel (CSV) y comparte un enlace personal con cada atleta.
 * El atleta decide: al reclamarlo con su cuenta, la agencia puede enviarle su propuesta de acompañamiento.
 */
export function PortfolioImport({ agencyId, agencyName, invites }: { agencyId: string; agencyName: string; invites: InviteRow[] }) {
  const [state, action] = useActionState<ImportState, FormData>(importPortfolio, {});
  const [csv, setCsv] = useState('');
  const pending = invites.filter((i) => i.status !== 'revoked');
  const tx = useT();
  return (
    <section id="importar" aria-labelledby="import-h" className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5" data-testid="portfolio-import">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow flex items-center gap-3 text-brass"><span aria-hidden className="h-px w-8 bg-brass" />Tu cartera actual</p>
          <h2 id="import-h" className="mt-2 font-display text-3xl text-paper">Trae a tus <em>atletas</em> en un minuto</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{tx('Sube tu Excel guardado como CSV (columnas: Nombre, Email, Deporte, Promoción) o pégalo aquí. Te damos un enlace personal por atleta para que se lo envíes tú (copiar, WhatsApp o email): la plataforma no lo envía por ti. Cuando entra con su cuenta, ya puedes enviarle tu propuesta. Nada se comparte sin su permiso.')}</p>
        </div>
        {pending.length > 0 && <p className="text-sm text-muted"><span className="font-display text-2xl text-paper">{pending.filter((i) => i.status === 'claimed').length}</span> de {pending.length} ya están dentro</p>}
      </div>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="agency_id" value={agencyId} />
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-paper hover:border-brass">
          <FileUp className="h-4 w-4" aria-hidden /> Elegir archivo CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="csv">O pégalo aquí</label>
        <textarea id="csv" name="csv" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Nombre;Email;Deporte;Promoción\nLucía Marín;lucia@correo.com;Baloncesto;2027'}
          className="w-full rounded-xl border border-line bg-ink p-3 font-mono text-xs text-paper placeholder:text-faint focus:border-brass focus:outline-none" />
        <SubmitButton pendingText="Importando…"><Upload className="h-4 w-4" aria-hidden /> {tx('Importar y crear enlaces')}</SubmitButton>
      </form>

      {state.error && <div className="mt-3"><Notice tone="danger">{state.error}</Notice></div>}
      {state.errors && state.errors.length > 0 && (
        <div className="mt-3"><Notice tone="warn">{state.errors.length} fila(s) sin importar: {state.errors.slice(0, 5).map((e) => `línea ${e.line} (${e.message})`).join('; ')}{state.errors.length > 5 ? '…' : ''}</Notice></div>
      )}
      {state.created && state.created.length > 0 && (
        <div className="mt-4 rounded-xl border border-ok/40 p-4" role="status">
          <p className="text-sm font-semibold text-paper">{state.created.length} atletas importados. Comparte ahora su enlace (solo se muestra esta vez; luego puedes generar otro).</p>
          <ul className="mt-3 divide-y divide-line">
            {state.created.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-paper">{c.name}</span>
                <ShareLinks name={c.name} email={c.email} link={c.link} agencyName={agencyName} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line" aria-label="Invitaciones de tu cartera">
          {pending.map((r) => <PendingRow key={r.id} r={r} agencyName={agencyName} />)}
        </ul>
      )}
    </section>
  );
}
