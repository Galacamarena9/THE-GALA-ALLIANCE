import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { familyPlan, managedAthletes, PLAN_RANK } from '@/lib/data/family';
import { siteUrl } from '@/lib/env';
import { PrintButton } from '@/components/autonomy';

export const metadata: Metadata = { title: 'Sports CV' };

const ENGLISH_TEST: Record<string, string> = { toefl: 'TOEFL iBT', ielts: 'IELTS', duolingo: 'Duolingo English Test', cambridge: 'Cambridge English' };
const SCHOOL_YEAR: Record<string, string> = { eso_3: 'Grade 9 (3º ESO)', eso_4: 'Grade 10 (4º ESO)', bach_1: 'Grade 11 (1º Bachillerato)', bach_2: 'Grade 12 (2º Bachillerato)', graduated: 'High school graduate', college: 'College' };
const LEVEL: Record<string, string> = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1', c2: 'C2', native: 'Native' };
const DIV: Record<string, string> = { ncaa_d1: 'NCAA D-I', ncaa_d2: 'NCAA D-II', ncaa_d3: 'NCAA D-III', naia: 'NAIA', njcaa: 'NJCAA', other: 'Other' };
const SOURCE: Record<string, string> = { self_reported: 'self-reported', documented: 'documented', club_verified: 'verified by club' };

export default async function SportsCvPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const session = await requireSession(['athlete', 'parent']);
  const sp = await searchParams;
  const athletes = await managedAthletes(session);
  const athlete = athletes.find((a) => a.id === sp.a) ?? athletes[0];
  if (!athlete) redirect('/app');
  if (PLAN_RANK[await familyPlan([session.userId, athlete.id])] < PLAN_RANK.family_core) redirect('/precios');

  const p = await loadPassport(athlete.id);
  const supabase = await createClient();
  const [{ data: sport }, { data: positions }] = await Promise.all([
    p.profile?.sport_id ? supabase.from('sports').select('name_en').eq('id', p.profile.sport_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('sport_positions').select('id, name_en').in('id', [p.profile?.primary_position_id, p.profile?.secondary_position_id].filter((x): x is number => x != null)),
  ]);
  const pos = (id: number | null | undefined) => positions?.find((x) => x.id === id)?.name_en;
  const { data: defs } = await supabase.from('sport_stat_definitions').select('code, label_en').eq('sport_id', p.profile?.sport_id ?? '');
  const a = p.academics;
  const name = p.person?.display_name ?? athlete.name;

  return (
    <main className="mx-auto max-w-3xl px-8 py-10 font-sans text-[13px] leading-relaxed">
      <div className="no-print mb-6 flex items-center justify-between gap-3 rounded-lg bg-neutral-100 p-3 text-sm">
        <span>Revisa los datos y guárdalo en PDF desde el diálogo de impresión.</span>
        <PrintButton />
      </div>
      <header className="border-b-2 border-neutral-900 pb-3">
        <h1 className="font-display text-3xl">{name}</h1>
        <p className="mt-1 text-neutral-600">
          {[sport?.name_en, pos(p.profile?.primary_position_id), p.profile?.graduation_year ? `Class of ${p.profile.graduation_year}` : null, p.person?.country ? `${p.person.country}` : null].filter(Boolean).join(' · ')}
        </p>
        {p.profile?.headline && <p className="mt-2 italic">{p.profile.headline}</p>}
      </header>

      <section className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Athletic profile</h2>
          <dl className="mt-2 space-y-1">
            {p.profile?.current_team && <div><dt className="inline font-medium">Current team: </dt><dd className="inline">{p.profile.current_team}</dd></div>}
            {p.profile?.competitive_level && <div><dt className="inline font-medium">Level: </dt><dd className="inline">{p.profile.competitive_level}</dd></div>}
            {pos(p.profile?.secondary_position_id) && <div><dt className="inline font-medium">Secondary position: </dt><dd className="inline">{pos(p.profile?.secondary_position_id)}</dd></div>}
            {p.profile?.height_cm && <div><dt className="inline font-medium">Height: </dt><dd className="inline">{p.profile.height_cm} cm ({Math.floor(p.profile.height_cm / 30.48)}&apos;{Math.round((p.profile.height_cm / 2.54) % 12)}&quot;)</dd></div>}
            {p.profile?.dominant_side && <div><dt className="inline font-medium">Dominant side: </dt><dd className="inline">{p.profile.dominant_side}</dd></div>}
            {p.profile?.target_divisions.length ? <div><dt className="inline font-medium">Target: </dt><dd className="inline">{p.profile.target_divisions.map((d) => DIV[d] ?? d).join(', ')}</dd></div> : null}
          </dl>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Academics</h2>
          <dl className="mt-2 space-y-1">
            {a?.school_year && <div><dt className="inline font-medium">Year: </dt><dd className="inline">{SCHOOL_YEAR[a.school_year]}</dd></div>}
            {a?.gpa != null && <div><dt className="inline font-medium">GPA: </dt><dd className="inline">{a.gpa} / {a.gpa_scale}</dd></div>}
            {a?.english_test && a.english_test !== 'none' && <div><dt className="inline font-medium">English: </dt><dd className="inline">{ENGLISH_TEST[a.english_test]} {a.english_score}</dd></div>}
            {a?.sat_score && <div><dt className="inline font-medium">SAT: </dt><dd className="inline">{a.sat_score}</dd></div>}
            {a?.act_score && <div><dt className="inline font-medium">ACT: </dt><dd className="inline">{a.act_score}</dd></div>}
            {p.profile?.intended_major && <div><dt className="inline font-medium">Intended major: </dt><dd className="inline">{p.profile.intended_major}</dd></div>}
            {p.languages.length > 0 && <div><dt className="inline font-medium">Languages: </dt><dd className="inline">{p.languages.map((l) => `${l.language_code.toUpperCase()} ${LEVEL[l.level] ?? l.level}`).join(', ')}</dd></div>}
          </dl>
        </div>
      </section>

      {p.stats.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Statistics</h2>
          <table className="mt-2 w-full border-collapse">
            <thead><tr className="border-b border-neutral-300 text-left text-xs text-neutral-500"><th className="py-1 font-normal">Season</th><th className="font-normal">Metric</th><th className="text-right font-normal">Value</th><th className="text-right font-normal">Source</th></tr></thead>
            <tbody>
              {p.stats.slice(0, 16).map((s) => (
                <tr key={s.id} className="border-b border-neutral-100">
                  <td className="py-1">{s.season}</td>
                  <td>{defs?.find((d) => d.code === s.sport_stat_definitions?.code)?.label_en ?? s.sport_stat_definitions?.label_es}</td>
                  <td className="text-right tabular-nums">{s.value}{s.sport_stat_definitions?.unit ? ` ${s.sport_stat_definitions.unit}` : ''}</td>
                  <td className="text-right text-neutral-500">{SOURCE[s.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {p.achievements.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Achievements</h2>
          <ul className="mt-2 space-y-1">{p.achievements.map((x) => <li key={x.id}><span className="font-medium">{x.year}</span> · {x.title}</li>)}</ul>
        </section>
      )}

      <section className="mt-6 border-t border-neutral-300 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Video & contact</h2>
        {p.profile?.highlight_video_url && <p className="mt-1">Highlights: {p.profile.highlight_video_url}</p>}
        <p className="mt-1">Full profile and contact through The Gala Alliance (verified coaches only): {siteUrl()}/athletes/{athlete.id}</p>
        <p className="mt-2 text-xs text-neutral-500">Statistics marked &quot;self-reported&quot; have not been independently verified.</p>
      </section>
    </main>
  );
}
