import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import type { Division } from '@/lib/types';

export interface DirectoryRow {
  user_id: string;
  display_name: string | null;
  country: string | null;
  headline: string | null;
  sport_id: string | null;
  primary_position_id: number | null;
  graduation_year: number | null;
  height_cm: number | null;
  current_team: string | null;
  competitive_level: string | null;
  target_divisions: Division[];
  open_to_opportunities: boolean;
  has_video: boolean;
}

const flag = (cc: string | null) =>
  cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';

export function AthleteCard({ a, positionName, sportName, footer }: { a: DirectoryRow; positionName?: string; sportName?: string; footer?: ReactNode }) {
  const initials = (a.display_name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brass/40 font-display text-sm text-brass" aria-hidden>{initials}</span>
        <div className="min-w-0">
          <Link href={`/athletes/${a.user_id}`} className="block truncate font-display text-lg text-paper hover:text-brass">
            {a.display_name ?? 'Atleta'} <span aria-label={a.country ?? undefined}>{flag(a.country)}</span>
          </Link>
          <p className="truncate text-xs text-muted">{[sportName, positionName, a.graduation_year && `Clase ${a.graduation_year}`].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {a.headline && <p className="mt-3 line-clamp-2 text-sm text-muted">{a.headline}</p>}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-ink/50 px-2 py-2"><dt className="text-xs font-medium text-faint">Altura</dt><dd className="tabular-nums text-sm text-paper">{a.height_cm ? `${a.height_cm} cm` : '—'}</dd></div>
        <div className="col-span-2 rounded-lg bg-ink/50 px-2 py-2"><dt className="text-xs font-medium text-faint">Equipo / nivel</dt><dd className="truncate text-sm text-paper">{a.current_team ?? a.competitive_level ?? '—'}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.has_video && <Badge tone="brass">▶ Vídeo</Badge>}
        {a.open_to_opportunities && <Badge tone="ok">Abierto/a</Badge>}
        {a.target_divisions.slice(0, 2).map((d) => <Badge key={d}>{DIVISION_LABEL[d]}</Badge>)}
      </div>
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </article>
  );
}
