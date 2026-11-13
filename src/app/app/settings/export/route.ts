import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Derecho de acceso y portabilidad: descarga en JSON de todos los datos propios.
 * Usa el cliente del usuario, así que solo puede devolver lo que la RLS le permite ver de sí mismo.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const own = (table: string, column = 'user_id') => supabase.from(table).select('*').eq(column, uid);
  const [profile, privateData, roles, athlete, academics, finances, stats, languages, achievements, links, applications, saved, consents, requests,
    updates, academyProgress, academyAttempts, searches, notifications, serviceRequests, feedback] =
    await Promise.all([
      own('profiles', 'id'),
      own('private_profile_data'),
      own('user_roles'),
      own('athlete_profiles'),
      own('athlete_academics', 'athlete_id'),
      own('athlete_finances', 'athlete_id'),
      own('athlete_statistics', 'athlete_id'),
      own('athlete_languages', 'athlete_id'),
      own('athlete_achievements', 'athlete_id'),
      supabase.from('parent_athlete_links').select('id, parent_id, athlete_id, status, relationship, created_at, approved_at, revoked_at').or(`parent_id.eq.${uid},athlete_id.eq.${uid}`),
      supabase.from('applications').select('*, application_status_history(*)').eq('athlete_id', uid),
      own('saved_athletes', 'owner_id'),
      own('consents'),
      own('data_subject_requests'),
      own('athlete_updates', 'athlete_id'),
      own('academy_progress'),
      own('academy_attempts'),
      own('saved_searches', 'owner_id'),
      own('notifications'),
      own('service_requests'),
      own('user_feedback'),
    ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: auth.user?.email, created_at: auth.user?.created_at },
    profile: profile.data,
    private_data: privateData.data,
    roles: roles.data,
    athlete_profile: athlete.data,
    academics: academics.data,
    finances: finances.data,
    statistics: stats.data,
    languages: languages.data,
    achievements: achievements.data,
    family_links: links.data,
    applications: applications.data,
    saved_athletes: saved.data,
    consents: consents.data,
    data_requests: requests.data,
    athlete_updates: updates.data,
    academy: { progress: academyProgress.data, attempts: academyAttempts.data },
    saved_searches: searches.data,
    notifications: notifications.data,
    service_requests: serviceRequests.data,
    feedback: feedback.data,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="the-gala-alliance-mis-datos-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
