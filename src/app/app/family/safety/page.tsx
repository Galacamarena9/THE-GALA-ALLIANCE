import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { guardianLinks } from '@/lib/data/family-home';
import { revokeDocumentGrant } from '@/app/actions/family';
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Seguridad · Familia' };

const date = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
const PURPOSE: Record<string, string> = { application_review: 'Revisión de candidatura', recruiting: 'Proceso de recruiting', trial: 'Trial', enrollment: 'Inscripción' };

/**
 * 10D · Centro de seguridad de la familia: quién tiene acceso a qué, quién contacta y dónde se controla todo.
 * Una sola pantalla, sin tecnicismos. La base de datos decide qué se ve y quién puede retirar un acceso.
 */
export default async function FamilySafetyPage({ searchParams }: { searchParams: Promise<{ child?: string; revoked?: string; error?: string }> }) {
  const session = await requireSession(['parent']);
  const sp = await searchParams;
  const links = await guardianLinks(session);
  if (!links.length) {
    return (
      <>
        <PageHeader kicker="Familia" title="Seguridad" />
        <EmptyState title="Todavía no hay nadie vinculado" action={<Link href="/app/family#vincular" className="text-sm text-brass hover:underline">Vincular a tu hijo o hija</Link>}>
          Cuando lo estéis, aquí verás quién tiene acceso a sus documentos y quién le contacta.
        </EmptyState>
      </>
    );
  }
  const current = links.find((l) => l.athleteId === sp.child) ?? links[0];
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: grants }, { data: contacts }] = current.active ? await Promise.all([
    current.scopes.documents
      ? supabase.from('document_access_grants').select('id, purpose, expires_at, revoked_at, athlete_documents(title), organizations(name, verification_status)')
          .eq('athlete_id', current.athleteId).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
    current.scopes.contacts
      ? supabase.from('contact_requests').select('id, status, organizations(name, verification_status)').eq('athlete_id', current.athleteId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: null }),
  ]) : [{ data: null }, { data: null }];
  type G = { id: string; purpose: string; expires_at: string; revoked_at: string | null; athlete_documents: { title: string } | null; organizations: { name: string; verification_status: string } | null };
  const all = (grants ?? []) as unknown as G[];
  const active = all.filter((g) => !g.revoked_at && g.expires_at > now);
  const past = all.filter((g) => g.revoked_at || g.expires_at <= now).slice(0, 10);
  type C = { id: string; status: string; organizations: { name: string; verification_status: string } | null };
  const waiting = ((contacts ?? []) as unknown as C[]).filter((c) => c.status === 'pending_guardian');

  return (
    <>
      <PageHeader kicker="Familia" title={`Seguridad de ${current.name}`} description="Quién puede ver sus documentos, quién quiere contactar y dónde se controla todo." />

      {links.length > 1 && (
        <nav aria-label="Elegir hijo o hija" className="mb-5 flex flex-wrap gap-2">
          {links.map((l) => (
            <Link key={l.id} href={`/app/family/safety?child=${l.athleteId}`} aria-current={l.id === current.id ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${l.id === current.id ? 'border-brass bg-brass/10 text-paper' : 'border-line text-muted hover:text-paper'}`}>{l.name}</Link>
          ))}
        </nav>
      )}
      {sp.revoked && <div className="mb-5"><Notice tone="ok">Acceso retirado. Esa organización ya no puede abrir el documento.</Notice></div>}
      {sp.error && <div className="mb-5"><Notice tone="warn">No se ha podido retirar. Puede que ya no estuviera activo o que no tengas permiso para hacerlo.</Notice></div>}
      {!current.active && <Notice tone="warn">Tu acceso a {current.name} está en pausa, así que ahora no ves esta información.</Notice>}

      {current.active && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardTitle kicker="Documentos">Quién tiene acceso ahora</CardTitle>
              {grants === null ? (
                <p className="text-sm text-muted">{current.name} no comparte sus documentos contigo.</p>
              ) : active.length ? (
                <ul className="divide-y divide-line">
                  {active.map((g) => (
                    <li key={g.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-paper">{g.organizations?.name ?? 'Organización'}
                            {g.organizations?.verification_status === 'verified' && <span className="ml-2 text-xs text-ok">Verificada ✓</span>}</p>
                          <p className="text-xs text-muted">{g.athlete_documents?.title ?? 'Documento'} · {PURPOSE[g.purpose] ?? 'Recruiting'} · hasta el {date(g.expires_at)}</p>
                        </div>
                        <details>
                          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted hover:text-danger">Retirar acceso</summary>
                          <form action={revokeDocumentGrant} className="mt-2 max-w-xs rounded-xl border border-line p-3 text-xs text-muted">
                            <input type="hidden" name="id" value={g.id} /><input type="hidden" name="child" value={current.athleteId} /><input type="hidden" name="confirm" value="yes" />
                            <p>{g.organizations?.name ?? 'La organización'} no podrá volver a abrir este documento. Lo que ya descargó legítimamente no se puede borrar desde Gala.</p>
                            <button className="mt-2 min-h-11 rounded-full border border-danger/40 px-4 font-semibold text-danger">Sí, retirar</button>
                          </form>
                        </details>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Ninguna organización tiene acceso a sus documentos ahora mismo.</p>
              )}
              {past.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-faint">Accesos terminados ({past.length})</summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {past.map((g) => <li key={g.id}>{g.organizations?.name} · {g.athlete_documents?.title} · {g.revoked_at ? `retirado el ${date(g.revoked_at)}` : `caducó el ${date(g.expires_at)}`}</li>)}
                  </ul>
                </details>
              )}
            </Card>

            <Card>
              <CardTitle kicker="Contacto" action={<Link href="/app/inbox" className="text-sm text-brass hover:underline">Abrir bandeja</Link>}>Quién quiere hablar con {current.name}</CardTitle>
              {contacts === null ? (
                <p className="text-sm text-muted">{current.name} no comparte contigo quién le contacta.</p>
              ) : waiting.length ? (
                <ul className="divide-y divide-line">
                  {waiting.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm text-paper">{c.organizations?.name}</span>
                      <Badge tone="warn">Espera tu aprobación</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nadie espera vuestra aprobación para contactar.</p>
              )}
              <p className="mt-3 text-xs text-faint">Desde la bandeja puedes aprobar, rechazar o bloquear a una organización. Bloquear corta mensajes, invitaciones y solicitudes de documentos.</p>
            </Card>
          </div>

          <Card>
            <CardTitle kicker="Controles">Todo en un sitio</CardTitle>
            <ul className="space-y-1 text-sm">
              {[
                ['/app/requests', 'Solicitudes de documentos'],
                ['/app/inbox', 'Mensajes, contactos y bloqueos'],
                ['/app/notifications', 'Qué avisos recibes'],
                ['/app/settings', 'Contraseña y seguridad de tu cuenta'],
              ].map(([href, label]) => (
                <li key={href}><Link href={href} className="flex min-h-11 items-center justify-between rounded-lg px-2 text-paper hover:bg-surface">{label}<span aria-hidden className="text-faint">›</span></Link></li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-faint">«Verificada» significa que hemos comprobado la identidad de la organización. No es una recomendación ni una garantía.</p>
          </Card>
        </div>
      )}
    </>
  );
}
