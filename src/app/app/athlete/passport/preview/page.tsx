import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { loadPassportView } from '@/lib/data/passport-view';
import { PassportView, type PassportViewData } from '@/components/passport/PassportView';
import { AUDIENCE_LABEL, visibleBlocks, type Audience } from '@/lib/domain/passport';

export const metadata: Metadata = { title: 'Ver mi Passport' };

/**
 * VIEW PASSPORT del propio atleta y previsualización por audiencia.
 * La previsualización aplica en puro las mismas reglas que la base de datos; quien manda de verdad es la RLS.
 */
export default async function PassportPreviewPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const session = await requireSession(['athlete']);
  const { as } = await searchParams;
  const audience = (['anonymous', 'member', 'verified_org'] as const).find((a) => a === as) ?? null;
  const view = await loadPassportView(session.userId);
  if (!view) notFound();
  let d: PassportViewData = view.data;
  let hidden = false;

  if (audience) {
    const p = d.profile;
    const v = visibleBlocks({ profile: p.profile_visibility, sport: p.sport_visibility, stats: p.stats_visibility, academics: p.academics_visibility, videos: p.videos_visibility, goals: p.goals_visibility }, audience, session.isMinor);
    hidden = !v.profile;
    d = {
      ...d,
      age: v.profile ? d.age : null,
      career: v.sport ? d.career : [],
      achievements: d.achievements.filter((x) => (x.kind === 'academic' ? v.academics : v.sport)),
      stats: v.stats ? d.stats : [],
      academics: v.academics ? d.academics : null,
      languages: v.profile ? d.languages : [],
      videos: v.videos ? d.videos : [],
      goals: v.goals ? d.goals : null,
    };
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/athlete/passport" className="text-sm text-brass hover:underline">← Editar Passport</Link>
        <nav aria-label="Ver como" className="flex flex-wrap gap-1 rounded-full border border-line p-1">
          <Link href="/app/athlete/passport/preview" aria-current={!audience ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-xs ${!audience ? 'bg-paper text-ink' : 'text-muted hover:text-paper'}`}>Yo</Link>
          {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
            <Link key={a} href={`?as=${a}`} aria-current={audience === a ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-xs ${audience === a ? 'bg-paper text-ink' : 'text-muted hover:text-paper'}`}>{AUDIENCE_LABEL[a]}</Link>
          ))}
        </nav>
      </div>
      {audience && <p className="mb-4 text-sm text-muted">Así ve tu Passport: <strong className="text-paper">{AUDIENCE_LABEL[audience]}</strong>. Cámbialo en <Link href="/app/athlete/passport?s=privacidad" className="text-brass hover:underline">Privacidad</Link>.</p>}
      {hidden ? (
        <div className="carbon rounded-[28px] p-10 text-center">
          <p className="font-display text-3xl font-bold uppercase text-white">Perfil no visible</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/70">{session.isMinor ? 'Eres menor: solo las organizaciones verificadas pueden ver tu Passport.' : 'Con tu configuración actual, esta persona no puede ver tu Passport.'}</p>
        </div>
      ) : <PassportView d={d} mode={audience ? 'public' : 'owner'} />}
    </>
  );
}
