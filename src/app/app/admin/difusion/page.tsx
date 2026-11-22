import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdminMfa } from '@/lib/mfa';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { parseOutreachFilters, type OutreachContact } from '@/lib/domain/outreach';
import { OutreachView } from './OutreachView';

export const metadata: Metadata = { title: 'Difusión' };

export default async function OutreachPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(['admin']);
  await requireAdminMfa();
  if (!session.roles.includes('admin')) redirect('/app');
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('outreach_contacts')
    .select('id, segment, organization_name, country, website, channel, email, role_title, source_url, notes, status, invited_at, responded_at, created_at')
    .order('status').order('organization_name').limit(1000);
  const rows: OutreachContact[] = (data ?? []).map((r) => ({
    id: r.id, segment: r.segment, organizationName: r.organization_name, country: r.country, website: r.website, channel: r.channel,
    email: r.email, roleTitle: r.role_title, sourceUrl: r.source_url, notes: r.notes, status: r.status,
    invitedAt: r.invited_at, respondedAt: r.responded_at, createdAt: r.created_at,
  }));
  const aviso = typeof sp.aviso === 'string' ? sp.aviso.slice(0, 300) : null;
  return <OutreachView rows={rows} filters={parseOutreachFilters(sp)} aviso={aviso} emailReady={Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} />;
}
