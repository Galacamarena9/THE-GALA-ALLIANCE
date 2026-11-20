import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { ShareView, type ShareAthlete, type ShareLink } from './ShareView';

export const metadata: Metadata = { title: 'Compartir mi perfil' };

/** Atleta adulto: sus enlaces. Menor: los ve y revoca, los crea su familia. Familia: los de sus hijos. */
export default async function SharePage() {
  const session = await requireSession(['athlete', 'parent']);
  const supabase = await createClient();

  const ids = new Set<string>();
  if (session.roles.includes('athlete')) ids.add(session.userId);
  if (session.roles.includes('parent')) {
    const { data: kids } = await supabase
      .from('parent_athlete_links')
      .select('athlete_id, relationship')
      .eq('parent_id', session.userId)
      .eq('status', 'approved')
      .in('relationship', ['parent', 'legal_guardian']);
    for (const k of kids ?? []) if (k.athlete_id) ids.add(k.athlete_id as string);
  }
  const athleteIds = [...ids];

  const [{ data: profiles }, { data: aps }, { data: links }, minors] = await Promise.all([
    athleteIds.length ? supabase.from('profiles').select('id, display_name').in('id', athleteIds) : Promise.resolve({ data: [] }),
    athleteIds.length ? supabase.from('athlete_profiles').select('user_id, sport_id, primary_position_id, graduation_year').in('user_id', athleteIds) : Promise.resolve({ data: [] }),
    athleteIds.length
      ? supabase.from('recruiting_links').select('id, athlete_id, label, token, expires_at, revoked_at, created_at, recruiting_link_views(count)').in('athlete_id', athleteIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    Promise.all(athleteIds.map(async (id) => [id, (await supabase.rpc('viewer_is_minor', { p_user: id })).data === true] as const)),
  ]);
  const sportIds = [...new Set((aps ?? []).map((a) => a.sport_id).filter(Boolean))] as string[];
  const posIds = [...new Set((aps ?? []).map((a) => a.primary_position_id).filter((p) => p != null))] as number[];
  const [{ data: sports }, { data: positions }] = await Promise.all([
    sportIds.length ? supabase.from('sports').select('id, name_en').in('id', sportIds) : Promise.resolve({ data: [] }),
    posIds.length ? supabase.from('sport_positions').select('id, name_en').in('id', posIds) : Promise.resolve({ data: [] }),
  ]);

  const minorById = new Map(minors);
  const athletes: ShareAthlete[] = athleteIds
    .map((id) => {
      const p = (profiles ?? []).find((x) => x.id === id);
      const ap = (aps ?? []).find((x) => x.user_id === id);
      if (!ap) return null; // sin Passport no hay ficha que compartir
      return {
        id,
        name: (p?.display_name as string) || 'Atleta',
        sport: (sports ?? []).find((s) => s.id === ap.sport_id)?.name_en as string | undefined ?? null,
        position: (positions ?? []).find((x) => x.id === ap.primary_position_id)?.name_en as string | undefined ?? null,
        gradYear: (ap.graduation_year as number | null) ?? null,
        isMinor: minorById.get(id) ?? true,
        isSelf: id === session.userId,
      };
    })
    .filter((a): a is ShareAthlete => a !== null);

  const shareLinks: ShareLink[] = (links ?? []).map((l) => ({
    id: l.id as string,
    athleteId: l.athlete_id as string,
    label: l.label as string,
    url: `${siteUrl()}/r/${l.token as string}`,
    expiresAt: l.expires_at as string,
    revokedAt: (l.revoked_at as string | null) ?? null,
    createdAt: l.created_at as string,
    views: ((l.recruiting_link_views as unknown as { count: number }[] | null)?.[0]?.count) ?? 0,
  }));

  return <ShareView athletes={athletes} links={shareLinks} isParent={session.roles.includes('parent')} />;
}
