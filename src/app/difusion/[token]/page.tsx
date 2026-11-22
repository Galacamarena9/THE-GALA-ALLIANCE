import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { OutreachResponseView, type OutreachPreview } from './OutreachResponseView';
import { RESPONSE_ANSWERS, type ResponseAnswer } from '@/lib/domain/outreach';

export const metadata: Metadata = { title: 'Invitación · The Gala Alliance', robots: { index: false, follow: false } };

export default async function OutreachResponsePage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ r?: string; hecho?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const validFormat = /^[a-f0-9]{64}$/.test(token);
  let preview: OutreachPreview | null = null;
  if (validFormat) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('outreach_preview', { p_token: token });
    const row = (data as { organization_name: string; status: string; valid: boolean }[] | null)?.[0];
    preview = row ? { organizationName: row.organization_name, status: row.status, valid: row.valid } : null;
  }
  const ask = (RESPONSE_ANSWERS as readonly string[]).includes(sp.r ?? '') ? (sp.r as ResponseAnswer) : null;
  return <OutreachResponseView token={validFormat ? token : null} preview={preview} ask={ask} done={sp.hecho ?? null} />;
}
