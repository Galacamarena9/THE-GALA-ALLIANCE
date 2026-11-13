import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { markNotificationsRead } from '@/app/actions/growth';

export const metadata: Metadata = { title: 'Notificaciones' };

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function NotificationsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        kicker="Cuenta"
        title="Notificaciones"
        description="Solo avisos útiles: contactos, candidaturas y verificaciones. Sin recordatorios para engancharte."
        action={unread ? <form action={markNotificationsRead}><Button variant="secondary">Marcar todo como leído</Button></form> : undefined}
      />
      {items.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-line' : 'bg-brass'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  {n.link ? <Link href={n.link} className="text-sm text-paper hover:text-brass">{n.title}</Link> : <p className="text-sm text-paper">{n.title}</p>}
                  {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                </div>
                <time className="shrink-0 text-xs text-faint" dateTime={n.created_at}>{fmt.format(new Date(n.created_at))}</time>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Todo al día">Aquí verás cuándo una organización verificada quiere contactar contigo, cuándo avanza una candidatura o se resuelve una verificación.</EmptyState>
      )}
    </>
  );
}
