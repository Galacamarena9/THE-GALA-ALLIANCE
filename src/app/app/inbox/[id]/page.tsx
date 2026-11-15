import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader, cx } from '@/components/ui';
import { MessageForm, ReportButton } from '@/components/forms';
import { BlockButton } from '@/components/BlockButton';

export const metadata: Metadata = { title: 'Conversación' };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await requireSession();
  const supabase = await createClient();
  const { data: req } = await supabase
    .from('contact_requests')
    .select('id, status, message, athlete_id, requested_by, is_minor_at_request, organizations(name)')
    .eq('id', id)
    .maybeSingle();
  if (!req) notFound();
  const { data: messages } = await supabase.from('contact_messages').select('id, sender_id, body, created_at').eq('request_id', id).order('created_at');
  const senderIds = [...new Set((messages ?? []).map((m) => m.sender_id))];
  const { data: senders } = senderIds.length ? await supabase.from('profiles').select('id, display_name').in('id', senderIds) : { data: [] };
  const nameOf = new Map((senders ?? []).map((s) => [s.id, s.display_name]));
  const org = req.organizations as unknown as { name: string } | null;

  // La otra persona de la conversación: para el atleta o su familia, quien la abrió; para la organización, el atleta.
  const onAthleteSide = session.userId === req.athlete_id || session.roles.includes('parent');
  const otherId: string = onAthleteSide ? req.requested_by : req.athlete_id;
  const [{ data: otherProfile }, { data: blocked }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', otherId).maybeSingle(),
    supabase.rpc('has_block_with', { p_other: otherId }),
  ]);
  const otherName = otherProfile?.display_name ?? (onAthleteSide ? 'esta persona' : 'este atleta');

  return (
    <>
      <PageHeader kicker="Conversación" title={org?.name ?? 'Organización'} description={req.is_minor_at_request ? 'Conversación con un menor: la familia vinculada la ve. No se permiten emails, teléfonos ni redes.' : undefined} />
      <Card className="mb-4">
        <p className="text-xs text-faint">Mensaje inicial</p>
        <p className="mt-1 text-sm text-muted">{req.message}</p>
      </Card>
      <ul className="mb-5 space-y-3" aria-live="polite">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === session.userId;
          return (
            <li key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm', mine ? 'bg-brass/15 text-paper' : 'border border-line bg-surface text-paper')}>
                <p className="mb-0.5 text-xs text-faint">{mine ? 'Tú' : nameOf.get(m.sender_id) ?? 'Participante'} · {new Date(m.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</p>
                <p className="whitespace-pre-line">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {blocked ? (
        <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">Hay un bloqueo entre vosotros: no se pueden enviar mensajes. Si lo pusiste tú, puedes quitarlo en Ajustes.</p>
      ) : req.status === 'accepted' ? <MessageForm requestId={id} isMinor={req.is_minor_at_request} /> : <p className="text-sm text-muted">La conversación no está abierta.</p>}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <Link href="/app/inbox" className="text-sm text-muted hover:text-paper">← Mensajes</Link>
        <div className="flex flex-wrap items-start gap-4">
          {!blocked && otherId !== session.userId && <BlockButton userId={otherId} name={otherName} />}
          <ReportButton entityType="contact_request" entityId={id} label="Denunciar esta conversación" />
        </div>
      </div>
    </>
  );
}
