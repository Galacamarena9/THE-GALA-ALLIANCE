import { getT } from '@/lib/i18n/server-t';
import { formatHeight } from '@/lib/i18n/format';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg } from '@/lib/data/recruit';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Comparar atletas') };
}

/** Comparación por secciones (legible en móvil). Datos medibles y visibles; nunca declara una "ganadora". */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; diff?: string }> }) {
  const tx = await getT();
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId);
  const ids = (sp.ids ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 3);
  const supabase = await createClient();
  const [catalog, { data: dir }, { data: acad }, { data: stats }] = await Promise.all([
    loadCatalog(),
    ids.length ? supabase.from('athlete_directory').select('user_id, display_name, primary_position_id, graduation_year, height_cm, country, has_video, competitive_level').in('user_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('athlete_academics').select('athlete_id, gpa_source, english_test').in('athlete_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('athlete_statistics').select('athlete_id, source').in('athlete_id', ids) : Promise.resolve({ data: [] }),
  ]);
  const people = ids.map((id) => (dir ?? []).find((d) => d.user_id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  const pos = new Map(catalog.positions.map((p) => [p.id, p.name_es]));
  const rows: [string, (p: (typeof people)[number]) => string][] = [
    [tx('Posición'), (p) => (p.primary_position_id ? pos.get(p.primary_position_id) ?? '—' : '🔒')],
    [tx('Clase'), (p) => String(p.graduation_year ?? '—')],
    [tx('Altura'), (p) => (formatHeight(p.height_cm, tx.locale) ?? '🔒 / —')],
    [tx('País'), (p) => p.country ?? '—'],
    [tx('Nivel competitivo'), (p) => p.competitive_level ?? '—'],
    [tx('Highlight'), (p) => (p.has_video ? '✓' : '—')],
    [tx('Académico'), (p) => { const a = (acad ?? []).find((x) => x.athlete_id === p.user_id); return !a ? tx('🔒 No compartido') : a.gpa_source !== 'self_reported' ? '✓ Documentado' : tx('Declarado'); }],
    [tx('Inglés'), (p) => { const a = (acad ?? []).find((x) => x.athlete_id === p.user_id); return !a ? '🔒' : a.english_test ?? tx('Sin certificado'); }],
    [tx('Estadísticas'), (p) => { const s = (stats ?? []).filter((x) => x.athlete_id === p.user_id); if (!s.length) return '🔒 / —'; const v = s.filter((x) => x.source !== 'self_reported').length; return v === s.length ? '✓ Verificadas' : v ? tx('Parcialmente verificadas') : tx('Declaradas'); }],
  ];
  const shown = sp.diff ? rows.filter(([, fn]) => new Set(people.map(fn)).size > 1) : rows;

  return (
    <>
      <PageHeader kicker={tx('Recruiting')} title={tx('Comparar atletas')} description={tx('Datos objetivos lado a lado. La decisión es del staff: Gala no ordena ni elige.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/shortlists">
        {people.length < 2 ? <EmptyState title={tx('Elige 2 o 3 atletas')}>{tx('Desde una shortlist pulsa «Comparar».')}</EmptyState> : (
          <div className="space-y-4">
            <Link href={`/app/recruit/compare?ids=${ids.join(',')}${sp.diff ? '' : '&diff=1'}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper">{sp.diff ? tx('Mostrar todo') : tx('Mostrar solo diferencias')}</Link>
            {shown.map(([label, fn]) => (
              <Card key={label}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{label}</h2>
                <dl className="grid gap-1.5 sm:grid-cols-3">
                  {people.map((p) => <div key={p.user_id} className="flex justify-between gap-2 sm:block"><dt className="text-sm text-muted">{p.display_name}</dt><dd className="font-semibold text-paper">{fn(p)}</dd></div>)}
                </dl>
              </Card>
            ))}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
