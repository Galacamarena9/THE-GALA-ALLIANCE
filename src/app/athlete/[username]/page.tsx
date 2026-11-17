import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validUsername } from '@/lib/domain/passport';
import { AthletePassportPage, athleteMetadata } from '@/app/athletes/[id]/AthletePage';

/** Enlace personal: thegalaalliance.com/athlete/<username>. La RLS decide qué ve cada visitante. */
async function resolve(username: string) {
  if (!validUsername(username)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('athlete_profiles').select('user_id').eq('username', username).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const id = await resolve(username);
  return id ? athleteMetadata(id) : { title: 'Atleta', robots: { index: false, follow: false } };
}

export default async function AthleteByUsername({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const id = await resolve(username);
  if (!id) notFound();
  return <AthletePassportPage id={id} />;
}
