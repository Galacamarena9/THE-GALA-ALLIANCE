import type { Metadata } from 'next';
import { formatHeight } from '@/lib/i18n/format';
import { notFound } from 'next/navigation';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { DIVISION_LABEL, LINK_KIND_LABEL } from '@/lib/domain/labels';
import { toGpa4 } from '@/lib/domain/match';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Sports CV', robots: { index: false } };

/** Sports CV en inglés (lo que leen los coaches de EE. UU.), optimizado para imprimir o guardar como PDF. */
export default async function SportsCvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const passport = await loadPassport(id);
  if (!passport.profile) notFound();
  const { profile: p, person, academics, stats, languages, achievements } = passport;
  const catalog = await loadCatalog();
  const supabase = await createClient();
  const { data: links } = await supabase.from('athlete_links').select('kind, url, verified').eq('athlete_id', id);
  const sport = catalog.sports.find((s) => s.id === p.sport_id);
  const pos = catalog.positions.find((x) => x.id === p.primary_position_id);
  const gpa4 = toGpa4(academics?.gpa ?? null, academics?.gpa_scale ?? null);
  const row = 'flex justify-between border-b border-neutral-200 py-1.5';

  return (
    <div className="min-h-dvh bg-white text-neutral-900 print:bg-white">
      <div className="mx-auto max-w-[800px] px-8 py-10 print:p-0">
        <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
        <header className="border-b-2 border-neutral-900 pb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Sports CV · The Gala Alliance</p>
          <h1 className="mt-1 text-4xl" style={{ color: '#111' }}>{person?.display_name}</h1>
          <p className="mt-1 text-neutral-700">{[sport?.name_es, pos?.name_es, p.graduation_year && `Class of ${p.graduation_year}`, person?.country].filter(Boolean).join(' · ')}</p>
          {p.headline && <p className="mt-2 text-neutral-800">{p.headline}</p>}
        </header>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 print:grid-cols-2">
          <section>
            <h2 className="mb-2 text-lg" style={{ color: '#111' }}>Athletic profile</h2>
            <div className="text-sm">
              <div className={row}><span>Height</span><span>{formatHeight(p.height_cm, 'en') ?? '—'}</span></div>
              <div className={row}><span>Current team</span><span>{p.current_team ?? '—'}</span></div>
              <div className={row}><span>Level / league</span><span>{p.competitive_level ?? '—'}</span></div>
              <div className={row}><span>Target divisions</span><span>{p.target_divisions.map((d) => DIVISION_LABEL[d]).join(', ') || '—'}</span></div>
            </div>
            <h2 className="mb-2 mt-6 text-lg" style={{ color: '#111' }}>Statistics</h2>
            <div className="text-sm">
              {stats.length ? stats.map((s) => (
                <div key={s.id} className={row}><span>{s.sport_stat_definitions?.label_es} ({s.season})</span><span>{s.value}{s.sport_stat_definitions?.unit ? ` ${s.sport_stat_definitions.unit}` : ''} · {s.source === 'self_reported' ? 'self-reported' : s.source === 'documented' ? 'documented' : 'club-verified'}</span></div>
              )) : <p className="text-neutral-500">Not shared.</p>}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-lg" style={{ color: '#111' }}>Academics</h2>
            <div className="text-sm">
              <div className={row}><span>GPA</span><span>{academics?.gpa != null ? `${academics.gpa} / ${academics.gpa_scale}${gpa4 != null ? ` (≈ ${gpa4} / 4.0, unofficial)` : ''}` : 'Not shared'}</span></div>
              <div className={row}><span>English</span><span>{academics?.english_test && academics.english_test !== 'none' ? `${academics.english_test.toUpperCase()} ${academics.english_score ?? ''}` : '—'}</span></div>
              <div className={row}><span>Intended major</span><span>{p.intended_major ?? '—'}</span></div>
              <div className={row}><span>Languages</span><span>{languages.map((l) => `${l.language_code.toUpperCase()} ${l.level.toUpperCase()}`).join(', ') || '—'}</span></div>
            </div>
            {achievements.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 text-lg" style={{ color: '#111' }}>Achievements</h2>
                <ul className="list-disc pl-5 text-sm">{achievements.map((a) => <li key={a.id}>{a.title}{a.year ? ` (${a.year})` : ''}</li>)}</ul>
              </>
            )}
            <h2 className="mb-2 mt-6 text-lg" style={{ color: '#111' }}>Links</h2>
            <ul className="space-y-1 text-sm break-all">
              {p.highlight_video_url && <li>Highlights: {p.highlight_video_url}</li>}
              {(links ?? []).map((l) => <li key={l.url}>{LINK_KIND_LABEL[l.kind]}: {l.url}{l.verified ? ' (verified)' : ''}</li>)}
            </ul>
          </section>
        </div>
        <footer className="mt-10 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
          Generated by The Gala Alliance. Contact the athlete through the platform. GPA conversion is approximate; official evaluation by the NCAA/NAIA Eligibility Center.
        </footer>
      </div>
    </div>
  );
}
