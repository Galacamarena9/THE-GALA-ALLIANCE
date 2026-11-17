import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AthletePassportPage, athleteMetadata } from './AthletePage';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return athleteMetadata(id);
}

export default async function AthleteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <AthletePassportPage id={id} />;
}
