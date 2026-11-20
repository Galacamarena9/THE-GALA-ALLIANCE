import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui';
import { SupportForm } from '@/components/admin/OpsForms';

export const metadata: Metadata = { title: 'Ayuda' };

const STATUS: Record<string, string> = { open: 'Recibido', waiting_user: 'Te hemos respondido', in_progress: 'En curso', resolved: 'Resuelto', closed: 'Cerrado' };
const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

/** 16 · Ayuda: abrir un caso y ver las respuestas. Gala nunca te pedirá tu contraseña. */
export default async function SupportPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from('support_cases').select('id, subject, status, created_at, support_case_notes(body, created_at)').eq('requester_id', session.userId).order('created_at', { ascending: false }).limit(20);
  type C = { id: string; subject: string; status: string; created_at: string; support_case_notes: { body: string; created_at: string }[] };
  const cases = (data ?? []) as unknown as C[];
  return (
    <>
      <PageHeader kicker="Ayuda" title="¿En qué te ayudamos?" description="Escríbenos y te respondemos aquí. Nunca te pediremos tu contraseña ni códigos de acceso." />
      <Card className="mb-5"><CardTitle kicker="Nuevo caso">Cuéntanos qué pasa</CardTitle><SupportForm /></Card>
      {cases.length > 0 && (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Card>
                <CardTitle kicker={date(c.created_at)} action={<Badge tone={c.status === 'waiting_user' ? 'warn' : c.status === 'resolved' ? 'ok' : 'neutral'}>{STATUS[c.status]}</Badge>}>{c.subject}</CardTitle>
                {c.support_case_notes.length ? <ul className="space-y-2 text-sm text-muted">{[...c.support_case_notes].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((n, i) => <li key={i} className="rounded-xl bg-surface-2 p-3"><span className="text-xs text-faint">Equipo de Gala · {date(n.created_at)}</span><p className="mt-1 text-paper">{n.body}</p></li>)}</ul> : <p className="text-sm text-muted">Aún sin respuesta. Te avisaremos.</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
