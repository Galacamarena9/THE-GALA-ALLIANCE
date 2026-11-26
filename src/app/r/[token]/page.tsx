import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Lock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import { RecruitingCardView, type RecruitingCard } from './RecruitingCardView';

// Enlace privado: nunca indexable ni compartible por buscadores.
export const metadata: Metadata = { title: 'Recruiting profile', robots: { index: false, follow: false, nocache: true } };

export default async function RecruitingCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[a-f0-9]{64}$/.test(token);
  let card: RecruitingCard | null = null;
  if (valid) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('get_recruiting_card', { p_token: token });
    card = ((data as RecruitingCard[] | null) ?? [])[0] ?? null;
  }

  if (!card) {
    return (
      <div className="min-h-dvh">
        <header className="mx-auto flex max-w-[720px] items-center px-5 py-5"><Logo href="/" /></header>
        <main id="main-content" className="mx-auto max-w-[720px] px-5 pt-16 text-center">
          <Lock className="mx-auto h-8 w-8 text-faint" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-bold text-paper">This link is no longer active</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">Recruiting links expire or can be revoked by the athlete and their family. Ask them for a new one.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brass hover:underline">About The Gala Alliance <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>
        </main>
      </div>
    );
  }
  return <RecruitingCardView card={card} />;
}
