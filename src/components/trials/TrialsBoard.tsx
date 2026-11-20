import Link from 'next/link';
import { eventWhen } from '@/lib/domain/trials';

export type TrialSummary = {
  id: string; title: string; type: string; status: string; start_at: string | null; timezone: string | null; place: string | null;
  confirmed: number; pending: number; waitlist: number; missingDocs: number; toReview: number;
};

const TYPE: Record<string, string> = { tryout: 'Trial', camp_showcase: 'Campus / showcase', club_recruitment: 'Captación', academy: 'Programa de academia', development_program: 'Programa de desarrollo' };
const STATUS: Record<string, string> = { draft: 'Borrador', pending_review: 'En revisión', published: 'Publicado', paused: 'En pausa', expired: 'Cerrado', rejected: 'Rechazado' };

/**
 * Tarjetas de trial para el móvil: lo que importa antes de abrirlo (cuándo, dónde, confirmados, pendientes, documentos)
 * y una sola acción principal. Las cifras vienen de la base de datos; si algo es cero no se rellena con nada.
 */
export function TrialsBoard({ trials, past = false }: { trials: TrialSummary[]; past?: boolean }) {
  return (
    <ul className="space-y-3">
      {trials.map((t) => (
        <li key={t.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-faint">{TYPE[t.type] ?? t.type}{t.status !== 'published' ? ` · ${STATUS[t.status] ?? t.status}` : ''}</p>
              <p className="font-display text-lg font-bold uppercase leading-tight text-paper">{t.title}</p>
              <p className="mt-0.5 text-xs text-muted">{eventWhen(t.start_at, t.timezone)}{t.place ? ` · ${t.place}` : ''}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink/40 p-2"><dt className="text-[10px] text-faint">Confirmados</dt><dd className="font-display text-xl font-bold text-paper">{t.confirmed}</dd></div>
            <div className="rounded-xl bg-ink/40 p-2"><dt className="text-[10px] text-faint">Pendientes</dt><dd className="font-display text-xl font-bold text-paper">{t.pending}</dd></div>
            <div className="rounded-xl bg-ink/40 p-2"><dt className="text-[10px] text-faint">{past ? 'Lista de espera' : 'Docs. pendientes'}</dt><dd className={`font-display text-xl font-bold ${!past && t.missingDocs ? 'text-warn' : 'text-paper'}`}>{past ? t.waitlist : t.missingDocs}</dd></div>
          </dl>
          {t.toReview > 0 && <p className="mt-2 text-xs font-semibold text-brass">{t.toReview} candidatura{t.toReview === 1 ? '' : 's'} sin revisar</p>}
          <Link href={`/app/opportunities/${t.id}${t.toReview > 0 ? '#candidaturas' : '#participantes'}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brass px-4 text-sm font-semibold text-ink">
            {past ? 'Ver seguimiento' : t.toReview > 0 ? 'Revisar candidaturas' : 'Abrir trial'}
          </Link>
        </li>
      ))}
    </ul>
  );
}
