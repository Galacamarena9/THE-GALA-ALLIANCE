import { getT } from '@/lib/i18n/server-t';
import { formatHeight } from '@/lib/i18n/format';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg } from '@/lib/data/recruit';
import { compareRows, type CompareInput } from '@/lib/domain/recruit-search';
import { EmptyState, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { CompareTable } from '@/components/recruit/CompareTable';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Comparar atletas') };
}

const GROUPS = ['physical', 'academics', 'stats', 'videos'] as const;

/**
 * Comparación con valores reales (altura, posición, promoción, nota si es visible, inglés, vídeo, estadísticas,
 * verificación). Todo con el cliente del usuario: la RLS decide qué se ve y, además, se respeta si el atleta permite
 * usar cada bloque para comparar (passport_field_policies.allow_compare). Nunca declara una «ganadora».
 */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; diff?: string; org?: string }> }) {
  const tx = await getT();
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const ids = (sp.ids ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 3);
  const supabase = await createClient();
  const none = Promise.resolve({ data: [] });
  const [catalog, { data: dir }, { data: acad }, { data: stats }, { data: videos }, { data: block }, allows] = await Promise.all([
    loadCatalog(tx.locale),
    ids.length ? supabase.from('athlete_directory').select('user_id, display_name, sport_id, primary_position_id, graduation_year, height_cm, country, has_video, competitive_level, english_level, has_verified_stats').in('user_id', ids) : none,
    ids.length ? supabase.from('athlete_academics').select('athlete_id, gpa, gpa_scale, grade_display, gpa_source, english_test, english_score').in('athlete_id', ids) : none,
    ids.length ? supabase.from('athlete_statistics').select('athlete_id, season, value, source, sport_stat_definitions(label_es, label_en, unit)').in('athlete_id', ids).order('season', { ascending: false }).limit(60) : none,
    ids.length ? supabase.from('athlete_videos').select('athlete_id, kind, url, is_featured').in('athlete_id', ids).order('is_featured', { ascending: false }).limit(30) : none,
    ids.length ? supabase.rpc('athlete_block_fields_many', { p_athletes: ids }) : none,
    Promise.all(ids.flatMap((id) => GROUPS.map(async (g) => [`${id}:${g}`, (await supabase.rpc('athlete_field_allows', { p_athlete: id, p_group: g, p_purpose: 'compare' })).data === true] as const))),
  ]);
  const ok = new Map(allows);
  const may = (id: string, g: (typeof GROUPS)[number]) => ok.get(`${id}:${g}`) === true;
  type Dir = { user_id: string; display_name: string; sport_id: string | null; primary_position_id: number | null; graduation_year: number | null; height_cm: number | null; country: string | null; has_video: boolean; competitive_level: string | null; english_level: string | null; has_verified_stats: boolean | null };
  const dirRows = (dir ?? []) as Dir[];
  const pos = new Map(catalog.positions.map((p) => [p.id, p.name_es]));
  const people: CompareInput[] = ids.map((id) => dirRows.find((d) => d.user_id === id)).filter((x): x is Dir => !!x).map((d) => {
    const a = (acad ?? []).find((x) => x.athlete_id === d.user_id) as CompareInput['academics'] & { athlete_id: string } | undefined;
    const st = ((stats ?? []) as unknown as { athlete_id: string; value: number; source: string; sport_stat_definitions: { label_es: string; label_en: string | null; unit: string | null } | null }[])
      .filter((s) => s.athlete_id === d.user_id);
    const vids = ((videos ?? []) as { athlete_id: string; kind: string; url: string }[]).filter((v) => v.athlete_id === d.user_id);
    const featured = ((block ?? []) as { user_id: string; highlight_video_url: string | null }[]).find((b) => b.user_id === d.user_id)?.highlight_video_url ?? null;
    const videoUrl = may(d.user_id, 'videos') ? featured ?? (vids.find((v) => v.kind === 'highlight') ?? vids[0])?.url ?? null : null;
    const academics = a && may(d.user_id, 'academics') ? a : null;
    const statsOk = may(d.user_id, 'stats');
    return {
      user_id: d.user_id, display_name: d.display_name,
      position: d.primary_position_id ? pos.get(d.primary_position_id) ?? null : null,
      graduation_year: d.graduation_year,
      height: may(d.user_id, 'physical') ? formatHeight(d.height_cm, tx.locale) ?? null : null,
      country: d.country, competitive_level: d.competitive_level,
      has_video: may(d.user_id, 'videos') && d.has_video, video_url: videoUrl,
      academics, english_level: d.english_level,
      stats: statsOk && st.length ? st.map((s) => ({ label: (tx.locale === 'en' ? s.sport_stat_definitions?.label_en : null) ?? s.sport_stat_definitions?.label_es ?? '—', value: s.value, unit: s.sport_stat_definitions?.unit ?? null, source: s.source })) : statsOk ? [] : null,
      verified: !!d.has_verified_stats || (statsOk && st.some((s) => s.source !== 'self_reported')) || (!!academics && !!academics.gpa_source && academics.gpa_source !== 'self_reported'),
    };
  });
  const rows = compareRows(people, tx);
  const shown = sp.diff ? rows.filter((r) => new Set(r.cells.map((c) => c.text)).size > 1) : rows;
  const orgQ = sp.org ? `&org=${sp.org}` : '';

  return (
    <>
      <PageHeader kicker={tx('Recruiting')} title={tx('Comparar atletas')} description={tx('Datos objetivos lado a lado. La decisión es del staff: Gala no ordena ni elige.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/shortlists">
        {people.length < 2 ? <EmptyState title={tx('Elige 2 o 3 atletas')}>{tx('Desde una shortlist pulsa «Comparar».')}</EmptyState> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/app/recruit/compare?ids=${ids.join(',')}${orgQ}${sp.diff ? '' : '&diff=1'}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper">{sp.diff ? tx('Mostrar todo') : tx('Mostrar solo diferencias')}</Link>
              <p className="text-xs text-muted">{tx('🔒 = el atleta no lo comparte contigo o no permite usarlo para comparar. «✓» junto a una estadística = verificada por su club.')}</p>
            </div>
            <CompareTable people={people} rows={shown} caption={tx('Comparación de atletas')} />
            <ul className="flex flex-wrap gap-2">
              {people.map((p) => <li key={p.user_id}><Link href={`/app/recruit/candidates/${p.user_id}${sp.org ? `?org=${sp.org}` : ''}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper hover:border-brass">{tx('Ver ficha')}: {p.display_name}</Link></li>)}
            </ul>
          </div>
        )}
      </RecruitShell>
    </>
  );
}
