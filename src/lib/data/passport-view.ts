import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import type { PassportViewData } from '@/components/passport/PassportView';

/** URL firmada (1 h) de la foto del atleta. La política de Storage solo la firma para quien puede ver el perfil. */
export async function athletePhotoUrl(path: string | null | undefined) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from('athlete-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Datos de VIEW PASSPORT con el cliente del visitante: lo que la RLS no permite, no llega. */
export async function loadPassportView(athleteId: string): Promise<{ data: PassportViewData; passport: Awaited<ReturnType<typeof loadPassport>> } | null> {
  const supabase = await createClient();
  const passport = await loadPassport(athleteId);
  if (!passport.profile) return null;
  const p = passport.profile;
  const [catalog, { data: recs }, { data: age }] = await Promise.all([
    loadCatalog(),
    supabase.from('club_recommendations').select('id, body, organizations(name, verification_status)').eq('athlete_id', athleteId).eq('status', 'published').limit(4),
    supabase.rpc('athlete_age', { p_athlete: athleteId }),
  ]);
  const photoUrl = await athletePhotoUrl(p.photo_path);
  return {
    passport,
    data: {
      athleteId,
      name: passport.person?.display_name ?? 'Atleta',
      country: passport.person?.country ?? null,
      photoUrl: photoUrl ?? (passport.person?.avatar_url as string | null) ?? null,
      age: typeof age === 'number' ? age : passport.age,
      profile: p,
      academics: passport.academics,
      stats: passport.stats,
      languages: passport.languages,
      achievements: passport.achievements as PassportViewData['achievements'],
      career: passport.career,
      videos: passport.videos,
      goals: passport.goals,
      links: passport.officialLinks,
      recs: (recs ?? []).map((r) => {
        const o = r.organizations as unknown as { name: string; verification_status: string } | null;
        return { id: r.id as string, body: r.body as string, org: o?.name ?? 'Club', verified: o?.verification_status === 'verified' };
      }),
      sportName: catalog.sports.find((s) => s.id === p.sport_id)?.name_es ?? null,
      position: catalog.positions.find((x) => x.id === p.primary_position_id)?.name_es ?? null,
      position2: catalog.positions.find((x) => x.id === p.secondary_position_id)?.name_es ?? null,
    },
  };
}
