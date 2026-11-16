import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import type { Division } from '@/lib/types';
import { SPORT_TONE_CLASS, sportTone } from '@/lib/domain/sport-tone';

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
  const tone = SPORT_TONE_CLASS[sportTone(a.sport_id ?? sportName ?? '')];
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-elevated)]">
      {/* Cabecera tipo cromo: color del deporte y pista de marca (sin foto del atleta por privacidad). */}
      <div className={`court-lines relative h-28 overflow-hidden ${tone}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-night/60 to-transparent" aria-hidden />
        <span className="absolute left-4 top-3 rounded-md bg-white/20 px-2 py-1 text-xs font-semibold text-white backdrop-blur">{sportName ?? 'Deporte'}</span>
        {a.graduation_year && <span className="absolute -bottom-3 right-3 font-display text-7xl font-bold leading-none text-white/25 transition-transform duration-500 group-hover:-translate-y-1" aria-hidden>{String(a.graduation_year).slice(2)}</span>}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <span className="relative -mt-7 mb-3 grid h-14 w-14 place-items-center rounded-2xl border-4 border-surface bg-night font-display text-lg font-bold text-lime shadow-md" aria-hidden>{initials}</span>
        <Link href={`/athletes/${a.user_id}`} className="block truncate font-display text-2xl font-bold uppercase leading-none text-paper hover:text-brass">
          {a.display_name ?? 'Atleta'} <span aria-label={a.country ?? undefined}>{flag(a.country)}</span>
        </Link>
        <p className="mt-1 truncate text-sm text-muted">{[positionName, a.current_team ?? a.competitive_level].filter(Boolean).join(' · ') || 'Perfil en construcción'}</p>
        {a.headline && <p className="mt-2 line-clamp-2 text-sm text-muted">{a.headline}</p>}
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line border-y border-line py-3 text-center">
          <div><dt className="text-xs text-faint">Altura</dt><dd className="font-display text-xl font-bold tabular-nums text-paper">{a.height_cm ? `${a.height_cm}` : '—'}<span className="text-xs font-normal text-faint">{a.height_cm ? ' cm' : ''}</span></dd></div>
          <div><dt className="text-xs text-faint">Promoción</dt><dd className="font-display text-xl font-bold tabular-nums text-paper">{a.graduation_year ?? '—'}</dd></div>
          <div><dt className="text-xs text-faint">Objetivo</dt><dd className="truncate font-display text-xl font-bold text-paper">{a.target_divisions[0] ? DIVISION_LABEL[a.target_divisions[0]] : '—'}</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.has_video && <Badge tone="brass">▶ Vídeo</Badge>}
          {a.open_to_opportunities && <Badge tone="ok">Abierto/a a ofertas</Badge>}
        </div>
        {footer && <div className="mt-auto pt-4">{footer}</div>}
      </div>
    </article>
  );
}
