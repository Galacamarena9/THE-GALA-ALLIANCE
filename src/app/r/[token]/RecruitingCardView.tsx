import { ExternalLink, PlayCircle, ShieldCheck } from 'lucide-react';
import { feetInches } from '@/lib/i18n/format';
import { Logo } from '@/components/Logo';
import { CoachAccessForm } from '@/components/recruiting-client';
import { videoEmbed } from '@/lib/domain/recruiting';

export interface RecruitingCard {
  display_name: string;
  avatar_url: string | null;
  is_minor: boolean;
  sport_name: string | null;
  position_name: string | null;
  graduation_year: number | null;
  height_cm: number | null;
  dominant_side: string | null;
  current_team: string | null;
  city: string | null;
  country: string | null;
  target_divisions: string[] | null;
  headline: string | null;
  video_url: string | null;
  intended_major: string | null;
  gpa_4: number | string | null;
  english_test: string | null;
  english_score: string | null;
  sat_score: number | null;
  expires_at: string;
}

const DIVISION_EN: Record<string, string> = { ncaa_d1: 'NCAA D-I', ncaa_d2: 'NCAA D-II', ncaa_d3: 'NCAA D-III', naia: 'NAIA', njcaa: 'NJCAA' };
const SIDE_EN: Record<string, string> = { left: 'Left', right: 'Right', both: 'Both' };


/**
 * Ficha de reclutamiento para coaches de EE. UU. Pensada para leerse en el móvil en 10 segundos:
 * vídeo, nombre y cuatro cifras grandes; después el detalle.
 */
export function RecruitingCardView({ card: c }: { card: RecruitingCard }) {
  const video = videoEmbed(c.video_url);
  const sport = c.sport_name;
  const gpa = c.gpa_4 != null ? Number(c.gpa_4).toFixed(2) : null;
  const stats: { label: string; value: string; note?: string }[] = [
    { label: 'Position', value: c.position_name ?? '—' },
    { label: 'Class of', value: c.graduation_year ? String(c.graduation_year) : '—' },
    { label: 'Height', value: c.height_cm ? feetInches(c.height_cm) : '—', note: c.height_cm ? `${c.height_cm} cm` : undefined },
    { label: 'GPA', value: gpa ?? '—', note: gpa ? '4.0 scale, approx.' : undefined },
  ];
  const academics = [
    ['English test', c.english_test && c.english_test !== 'none' ? `${c.english_test.toUpperCase()}${c.english_score ? ` ${c.english_score}` : ''}` : null],
    ['SAT', c.sat_score ? String(c.sat_score) : null],
    ['Intended major', c.intended_major],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  const athletic = [
    ['Sport', sport],
    ['Current team', c.current_team],
    ['Dominant side', c.dominant_side ? SIDE_EN[c.dominant_side] : null],
    ['Target levels', c.target_divisions?.length ? c.target_divisions.map((d) => DIVISION_EN[d] ?? d).join(', ') : null],
    ['Based in', [c.city, c.country].filter(Boolean).join(', ') || null],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  const expires = new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="min-h-dvh" lang="en">
      <header className="mx-auto flex max-w-[720px] items-center justify-between gap-4 px-5 py-5">
        <Logo href="/" />
        <p className="text-right text-xs leading-relaxed text-faint">Private link<span className="block">Active until {expires}</span></p>
      </header>

      <main id="main-content" className="mx-auto max-w-[720px] px-5 pb-20">
        {/* Ficha pública: el vídeo se abre en su web (sin incrustar terceros ni cookies aquí). */}
        {video && (
          <a href={c.video_url ?? video.src} target="_blank" rel="noopener noreferrer" className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-premium)] transition-colors hover:border-brass/50">
            <span className="bg-grid absolute inset-0 opacity-40" aria-hidden />
            <span className="glow-gold absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2" aria-hidden />
            <span className="relative flex flex-col items-center gap-3 text-center">
              <PlayCircle className="h-16 w-16 text-brass transition-transform duration-300 group-hover:scale-110" strokeWidth={1.4} aria-hidden />
              <span className="text-lg font-semibold text-paper">Watch highlights</span>
              <span className="flex items-center gap-1 text-xs text-faint">Opens on {new URL(video.src).hostname.replace(/^www\./, '').replace('youtube-nocookie.com', 'YouTube').replace('player.vimeo.com', 'Vimeo')} <ExternalLink className="h-3 w-3" aria-hidden /></span>
            </span>
          </a>
        )}

        <section className="mt-7" aria-labelledby="athlete-name">
          <p className="text-sm text-brass">{[sport, c.is_minor ? 'High school student-athlete' : 'Student-athlete'].filter(Boolean).join(', ')}</p>
          <h1 id="athlete-name" className="mt-1 font-display text-[40px] font-bold leading-[1.05] tracking-tight text-paper sm:text-5xl">{c.display_name}</h1>
          {c.headline && <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-muted">{c.headline}</p>}
        </section>

        <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-line sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`bg-surface px-4 py-4 ${i % 2 === 1 ? 'border-l border-line' : ''} ${i > 1 ? 'border-t border-line sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}>
              <dt className="text-xs text-faint">{s.label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-paper">{s.value}</dd>
              {s.note && <dd className="text-xs text-faint">{s.note}</dd>}
            </div>
          ))}
        </dl>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {[['Academics', academics], ['Athletics', athletic]].map(([title, rows]) => (
            <section key={title as string}>
              <h2 className="font-display text-lg font-bold text-paper">{title as string}</h2>
              {(rows as [string, string][]).length ? (
                <dl className="mt-2">
                  {(rows as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 text-sm">
                      <dt className="text-faint">{k}</dt><dd className="text-right font-medium text-paper">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p className="mt-2 text-sm text-faint">Not shared yet.</p>}
            </section>
          ))}
        </div>

        {c.is_minor && (
          <p className="mt-8 flex gap-3 rounded-xl bg-surface px-4 py-3 text-sm text-muted ring-1 ring-inset ring-line">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-trust" aria-hidden />
            This athlete is under 18. Some details are hidden and all contact goes through The Gala Alliance with the family copied.
          </p>
        )}

        <section className="mt-10 rounded-2xl border border-brass/30 bg-gradient-to-br from-brass/[0.08] to-transparent p-5 sm:p-6" aria-labelledby="coach-access">
          <h2 id="coach-access" className="font-display text-xl font-bold text-paper">Are you a college coach?</h2>
          <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted">
            Verify with your .edu email and search more international athletes by sport, position, class and academics. Free for college staff, no password.
          </p>
          <div className="mt-5"><CoachAccessForm /></div>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-faint">
          GPA is converted to a 4.0 scale as an estimate; it is not an official NCAA Eligibility Center evaluation. Self-reported data is labeled as such inside the platform.
        </p>
      </main>
    </div>
  );
}
