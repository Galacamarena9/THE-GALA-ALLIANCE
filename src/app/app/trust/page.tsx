import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { logEvent } from '@/lib/events';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, Notice, PageHeader } from '@/components/ui';
import { AppealForm } from '@/components/safety/SafetyForms';

export const metadata: Metadata = { title: 'Confianza y privacidad' };

const ACTION_LABEL: Record<string, string> = {
  warning: 'Aviso', content_removed: 'Contenido retirado', opportunity_paused: 'Oportunidad pausada', user_restricted: 'Restricción parcial',
  organization_restricted: 'Restricción parcial de la organización', suspended: 'Suspensión', verification_revoked: 'Verificación retirada',
};
const SCOPE_LABEL: Record<string, string> = { contact: 'contactar', messaging: 'enviar mensajes', discovery: 'descubrir atletas', publishing: 'publicar', offers: 'enviar ofertas', representation: 'proponer representaciones', applications: 'enviar candidaturas' };
const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

/**
 * 14 · Centro de confianza: quién puede ver tus datos ahora mismo, las medidas que te afecten (con su motivo y
 * cómo apelar) y dónde se controla cada cosa. Todo sale de la base de datos y de su RLS.
 */
export default async function TrustCenterPage() {
  const session = await requireSession();
  void logEvent('trust_center_viewed');
  const supabase = await createClient();
  const isAthlete = session.roles.includes('athlete');
  const now = new Date().toISOString();
  const [{ data: actions }, grants, reps, family, contacts] = await Promise.all([
    supabase.from('moderation_actions').select('id, action, scopes, reason, ends_at, created_at, reverted_at, moderation_appeals(status)').order('created_at', { ascending: false }).limit(20),
    isAthlete ? supabase.from('document_access_grants').select('id, expires_at, organizations(name), athlete_documents(title)').eq('athlete_id', session.userId).is('revoked_at', null).gt('expires_at', now) : Promise.resolve({ data: [] }),
    isAthlete ? supabase.from('agent_representations').select('id, end_date, organizations(name)').eq('athlete_id', session.userId).eq('status', 'active') : Promise.resolve({ data: [] }),
    isAthlete ? supabase.from('parent_athlete_links').select('id, relationship').eq('athlete_id', session.userId).eq('status', 'approved') : Promise.resolve({ data: [] }),
    isAthlete ? supabase.from('contact_requests').select('id, organizations(name)').eq('athlete_id', session.userId).eq('status', 'accepted') : Promise.resolve({ data: [] }),
  ]);
  type A = { id: string; action: string; scopes: string[]; reason: string; ends_at: string | null; created_at: string; reverted_at: string | null; moderation_appeals: { status: string }[] };
  const mine = ((actions ?? []) as unknown as A[]).filter((a) => !['no_action', 'escalate'].includes(a.action));
  const activeMine = mine.filter((a) => !a.reverted_at && (!a.ends_at || a.ends_at > now));
  const name = (x: unknown) => (x as { name?: string } | null)?.name ?? 'Organización';

  return (
    <>
      <PageHeader kicker="Tu cuenta" title="Confianza y privacidad" description="Quién puede ver tus datos ahora mismo, qué medidas te afectan y dónde se controla cada cosa." />

      {activeMine.length > 0 && (
        <Card className="mb-5 border-warn/40">
          <CardTitle kicker="Medidas activas">Lo que el equipo de seguridad ha decidido</CardTitle>
          <ul className="divide-y divide-line">
            {activeMine.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm font-medium text-paper">{ACTION_LABEL[a.action] ?? a.action}{a.scopes?.length ? `: no puedes ${a.scopes.map((s) => SCOPE_LABEL[s] ?? s).join(', ')}` : ''}</p>
                <p className="text-xs text-muted">Desde el {date(a.created_at)}{a.ends_at ? ` hasta el ${date(a.ends_at)}` : ''}. Motivo: {a.reason}</p>
                {a.moderation_appeals.some((x) => x.status === 'open')
                  ? <p className="mt-2 text-xs text-warn">Apelación en revisión. La revisa una persona distinta de quien tomó la medida.</p>
                  : <details className="mt-2"><summary className="cursor-pointer text-sm text-brass">Apelar</summary><div className="mt-2"><AppealForm id={a.id} /></div></details>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isAthlete && (
        <Card className="mb-5">
          <CardTitle kicker="Mapa de acceso">Quién puede ver tus datos ahora</CardTitle>
          <ul className="space-y-3 text-sm">
            <li><p className="font-medium text-paper">Familia</p><p className="text-muted">{(family.data ?? []).length ? `${(family.data ?? []).length} persona(s) vinculada(s). Cada una ve solo lo que tú permites.` : 'Nadie vinculado.'} <Link href="/app/settings" className="text-brass hover:underline">Gestionar</Link></p></li>
            <li><p className="font-medium text-paper">Agencias que te representan</p><p className="text-muted">{(reps.data ?? []).length ? (reps.data ?? []).map((r) => `${name(r.organizations)} (hasta el ${date(r.end_date as string)})`).join(' · ') : 'Ninguna.'} <Link href="/app/agents" className="text-brass hover:underline">Ver permisos</Link></p></li>
            <li><p className="font-medium text-paper">Documentos compartidos</p><p className="text-muted">{(grants.data ?? []).length ? (grants.data ?? []).map((g) => `${name(g.organizations)}: ${(g.athlete_documents as unknown as { title?: string } | null)?.title ?? 'documento'} (hasta el ${date(g.expires_at as string)})`).join(' · ') : 'Ninguno ahora mismo.'} <Link href="/app/documents" className="text-brass hover:underline">Gestionar</Link></p></li>
            <li><p className="font-medium text-paper">Organizaciones con las que hablas</p><p className="text-muted">{(contacts.data ?? []).length ? (contacts.data ?? []).map((c) => name(c.organizations)).join(' · ') : 'Ninguna.'} <Link href="/app/inbox" className="text-brass hover:underline">Bandeja y bloqueos</Link></p></li>
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle kicker="Controles">Todo en un sitio</CardTitle>
        <ul className="space-y-1 text-sm">
          {[
            ['/app/settings', 'Contraseña, verificación en dos pasos y sesiones'],
            ['/app/settings/export', 'Descargar todos tus datos'],
            ['/app/settings#borrar', 'Borrar tu cuenta'],
            ['/app/inbox', 'Bloquear o denunciar a alguien'],
            ['/app/notifications', 'Qué avisos recibes'],
          ].map(([href, label]) => (
            <li key={href}><Link href={href} className="flex min-h-11 items-center justify-between rounded-lg px-2 text-paper hover:bg-surface">{label}<span aria-hidden className="text-faint">›</span></Link></li>
          ))}
        </ul>
        <div className="mt-4"><Notice tone="neutral">Gala no vende tus datos ni crea puntuaciones ocultas sobre ti. Si algo no te cuadra, escríbenos desde la bandeja o denuncia el contenido.</Notice></div>
      </Card>
      {mine.length > activeMine.length && <p className="mt-4 text-xs text-faint">Medidas pasadas o retiradas: {mine.length - activeMine.length}. <Badge>historial</Badge></p>}
    </>
  );
}
