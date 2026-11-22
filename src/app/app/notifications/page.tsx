import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { markNotificationsRead } from '@/app/actions/growth';
import { saveNotificationPreferences, toggleNotificationRead } from '@/app/actions/dashboard';

export const metadata: Metadata = { title: 'Notificaciones' };

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Misma clasificación que public.notification_category() en la base de datos. */
function category(kind: string) {
  const family: Record<string, string> = { 'family.offer': 'family_offers', 'family.process': 'family_process', 'family.deadline': 'family_deadlines', 'family.cost': 'family_costs' };
  if (family[kind]) return family[kind];
  if (/^(contact|family|security|account)\./.test(kind)) return 'essential';
  if (kind.startsWith('message.')) return 'messages';
  if (kind.startsWith('application') || kind.startsWith('offer')) return 'applications';
  if (kind.startsWith('deadline')) return 'deadlines';
  if (kind.startsWith('saved_') || kind.startsWith('match') || kind.startsWith('opportunit')) return 'matches';
  return 'platform';
}
const CAT: Record<string, string> = {
  essential: 'Familia y seguridad', messages: 'Mensajes', applications: 'Candidaturas y ofertas',
  deadlines: 'Plazos', matches: 'Universidades y oportunidades', platform: 'Plataforma',
  family_process: 'Familia · proceso', family_offers: 'Familia · ofertas',
};
const PREF_CATS = ['messages', 'applications', 'deadlines', 'matches', 'platform'] as const;
/** Avisos de la familia que se pueden silenciar. Consentimientos, documentos y seguridad llegan siempre. */
const FAMILY_PREF_CATS = ['family_process', 'family_offers'] as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const session = await requireSession();
  const { f } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: prefs }] = await Promise.all([
    supabase.from('notifications').select('id, kind, title, body, link, read_at, created_at').eq('user_id', session.userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('notification_preferences').select('category, in_app').eq('user_id', session.userId),
  ]);
  const all = data ?? [];
  const items = all.filter((n) => (f === 'unread' ? !n.read_at : f && f in CAT ? category(n.kind) === f : true));
  const unread = all.filter((n) => !n.read_at).length;
  const muted = new Set((prefs ?? []).filter((p) => !p.in_app).map((p) => p.category));
  const tabs = [{ k: '', label: 'Todas' }, { k: 'unread', label: `Sin leer (${unread})` }, ...Object.entries(CAT).filter(([k]) => all.some((n) => category(n.kind) === k)).map(([k, label]) => ({ k, label }))];

  return (
    <>
      <PageHeader
        kicker="Cuenta"
        title="Notificaciones"
        description="Solo avisos útiles: contactos, candidaturas, plazos oficiales y verificaciones. Sin recordatorios para engancharte."
        action={unread ? <form action={markNotificationsRead}><Button variant="secondary">Marcar todo como leído</Button></form> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <nav aria-label="Filtrar avisos" className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Link key={t.k} href={t.k ? `/app/notifications?f=${t.k}` : '/app/notifications'} aria-current={(f ?? '') === t.k ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${(f ?? '') === t.k ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted hover:text-paper'}`}>{t.label}</Link>
            ))}
          </nav>
          {items.length ? (
            <Card>
              <ul className="divide-y divide-line">
                {items.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-line' : 'bg-brass'}`} aria-label={n.read_at ? 'Leído' : 'Sin leer'} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{CAT[category(n.kind)]}</p>
                      {n.link ? <Link href={n.link} className={`text-sm hover:text-brass ${n.read_at ? 'text-muted' : 'font-medium text-paper'}`}>{n.title}</Link> : <p className="text-sm text-paper">{n.title}</p>}
                      {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <time className="text-xs text-faint" dateTime={n.created_at}>{fmt.format(new Date(n.created_at))}</time>
                      <form action={toggleNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="read" value={n.read_at ? '0' : '1'} />
                        <button className="text-xs text-muted underline-offset-2 hover:text-brass hover:underline">{n.read_at ? 'Marcar no leído' : 'Marcar leído'}</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState title={f ? 'Nada en este filtro' : 'Todo al día'}>Aquí verás cuándo una organización verificada quiere contactar contigo, cuándo avanza una candidatura, cuándo se acerca un plazo oficial que guardaste o se resuelve una verificación.</EmptyState>
          )}
        </div>
        <Card>
          <h2 className="font-display text-lg font-bold text-paper">Qué avisos recibir</h2>
          <p className="mt-1 text-xs text-muted">Las aprobaciones, las solicitudes de documentos y los avisos de seguridad llegan siempre.</p>
          <form action={saveNotificationPreferences} className="mt-4 space-y-3">
            {[...PREF_CATS, ...(session.roles.includes('parent') ? FAMILY_PREF_CATS : [])].map((c) => (
              <label key={c} className="flex items-center justify-between gap-3 text-sm text-paper">
                {CAT[c]}
                <input type="checkbox" name={c} defaultChecked={!muted.has(c)} className="h-4 w-4 accent-[var(--color-brass)]" />
              </label>
            ))}
            <Button type="submit" variant="secondary" className="w-full">Guardar preferencias</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
