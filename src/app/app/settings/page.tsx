import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui';
import { InviteLink } from '@/components/InviteLink';
import { restrictFamilyLink, revokeFamilyLink, reviewFamilyLink, updateFamilyPermissions } from '@/app/actions/family';
import { guardianReview } from '@/lib/domain/family';
import { DataRequestForm } from './DataRequestForm';
import { DeleteAccountForm } from '@/components/autonomy';
import { CookiePrefsButton } from './CookiePrefsButton';
import { unblockUser } from '@/app/actions/blocks';
import { TwoFactorCard } from '@/components/TwoFactorCard';

export const metadata: Metadata = { title: 'Privacidad y datos' };

const REQUEST_LABEL: Record<string, string> = {
  access: 'Acceso', rectification: 'Rectificación', erasure: 'Supresión', restriction: 'Limitación', objection: 'Oposición', portability: 'Portabilidad',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const session = await requireSession();
  const { mfa } = await searchParams;
  const supabase = await createClient();
  const isAthlete = session.roles.includes('athlete');

  const [{ data: links }, { data: requests }, { data: consents }] = await Promise.all([
    isAthlete
      ? supabase
          .from('parent_athlete_links')
          .select('id, parent_id, status, relationship, guardian_consent_given, last_reviewed_at, can_view_profile, can_view_applications, can_view_academics, can_edit_profile, can_view_costs, can_view_budget, can_view_documents, can_view_contacts, can_view_messages, profiles!parent_athlete_links_parent_id_fkey(display_name)')
          .eq('athlete_id', session.userId)
          .in('status', ['approved', 'restricted'])
      : Promise.resolve({ data: [] }),
    supabase.from('data_subject_requests').select('id, request_type, status, created_at').eq('user_id', session.userId).order('created_at', { ascending: false }),
    supabase.from('consents').select('purpose, document_version, granted, created_at').eq('user_id', session.userId).order('created_at', { ascending: false }),
  ]);
  const { data: me } = isAthlete ? await supabase.from('private_profile_data').select('date_of_birth').eq('user_id', session.userId).maybeSingle() : { data: null };
  const today = todayIso();
  const { data: blocks } = await supabase.from('user_blocks').select('blocked_id, reason, created_at').eq('blocker_id', session.userId).order('created_at', { ascending: false });
  const blockedIds = (blocks ?? []).map((b) => b.blocked_id);
  const { data: blockedProfiles } = blockedIds.length ? await supabase.from('profiles').select('id, display_name').in('id', blockedIds) : { data: [] };
  const blockedName = new Map((blockedProfiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <>
      <PageHeader kicker="Privacidad" title="Tus datos, tus decisiones" description="Controla quién te ve, descarga tus datos y ejerce tus derechos en cualquier momento." />

      <div className="space-y-5">
        <Card>
          <CardTitle kicker="Seguridad">Verificación en dos pasos</CardTitle>
          <TwoFactorCard required={mfa === 'required' || session.roles.includes('admin')} />
        </Card>
        <Card>
          <CardTitle kicker="Seguridad">Personas bloqueadas</CardTitle>
          {blocks?.length ? (
            <ul className="divide-y divide-line">
              {blocks.map((b) => (
                <li key={b.blocked_id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="font-medium text-paper">{blockedName.get(b.blocked_id) ?? 'Usuario'}</span>
                  {b.reason && <span className="text-muted">· {b.reason}</span>}
                  <span className="text-xs text-faint">desde {new Date(b.created_at).toLocaleDateString('es-ES')}</span>
                  <form action={unblockUser} className="ml-auto">
                    <input type="hidden" name="blocked_id" value={b.blocked_id} />
                    <button className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-paper hover:border-brass/50">Desbloquear</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No has bloqueado a nadie. Puedes bloquear a una persona desde cualquier conversación: no podréis escribiros y, si eres atleta, dejará de ver tu perfil.</p>
          )}
        </Card>
        {isAthlete && (
          <Card id="familia">
            <CardTitle kicker="Familia">Personas vinculadas</CardTitle>
            {links?.length ? (
              <ul className="space-y-4">
                {links.map((l) => {
                  const parent = l.profiles as unknown as { display_name: string } | null;
                  const review = guardianReview({ dob: (me?.date_of_birth as string | null) ?? null, today, minorLink: !!l.guardian_consent_given, lastReviewed: (l.last_reviewed_at as string | null) ?? null });
                  const paused = l.status === 'restricted';
                  return (
                    <li key={l.id} className="rounded-xl border border-line p-4">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-paper">
                        {parent?.display_name ?? 'Familiar'}
                        {paused && <Badge tone="warn">En pausa</Badge>}
                        {review.state === 'lapsed' && <Badge tone="warn">Acceso suspendido</Badge>}
                      </p>
                      {review.state !== 'none' && (
                        <div className="mt-3 rounded-lg border border-brass/40 bg-brass/10 p-3 text-sm">
                          <p className="text-paper">
                            Ya eres mayor de edad. ¿Quieres que {parent?.display_name ?? 'tu familiar'} siga viendo lo que marcas abajo?
                            {review.state === 'due' ? ` Si no respondes antes del ${review.dueDate}, su acceso se suspenderá.` : ' Su acceso está suspendido hasta que lo confirmes.'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={reviewFamilyLink}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="keep" value="yes" />
                              <button className="min-h-11 rounded-full bg-brass px-4 text-sm font-semibold text-ink">Sí, que siga</button></form>
                            <form action={reviewFamilyLink}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="keep" value="no" />
                              <button className="min-h-11 rounded-full border border-line px-4 text-sm text-paper">No, quitar acceso</button></form>
                          </div>
                        </div>
                      )}
                      <form action={updateFamilyPermissions} className="mt-3 grid gap-x-5 gap-y-2 text-sm text-muted sm:grid-cols-2">
                        <input type="hidden" name="id" value={l.id} />
                        {([
                          ['can_view_profile', 'Ver mi Passport y shortlist', l.can_view_profile],
                          ['can_view_applications', 'Ver mis candidaturas y proceso', l.can_view_applications],
                          ['can_view_academics', 'Ver mi académico', l.can_view_academics],
                          ['can_view_costs', 'Ver costes y ofertas', l.can_view_costs],
                          ['can_view_budget', 'Ver el presupuesto familiar', l.can_view_budget],
                          ['can_view_documents', 'Ver mis documentos', l.can_view_documents],
                          ['can_view_contacts', 'Ver quién me contacta', l.can_view_contacts],
                          ['can_view_messages', 'Ver mis mensajes', l.can_view_messages],
                          ['can_edit_profile', 'Editar mi perfil', l.can_edit_profile],
                        ] as const).map(([name, label, checked]) => (
                          <label key={name} className="flex items-center gap-2">
                            <input type="checkbox" name={name} defaultChecked={!!checked} className="accent-[var(--color-brass)]" />
                            {label}
                          </label>
                        ))}
                        <p className="text-xs text-faint sm:col-span-2">Tus notas privadas nunca son visibles para tu familia.</p>
                        <button className="justify-self-start rounded-lg border border-line-strong px-3 py-1 text-xs text-paper hover:border-brass">Guardar permisos</button>
                      </form>
                      <form action={restrictFamilyLink} className="mt-3 inline-block">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="restrict" value={paused ? 'no' : 'yes'} />
                        <button className="mr-4 text-xs text-muted hover:text-paper">{paused ? 'Reanudar acceso' : 'Pausar acceso'}</button>
                      </form>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-faint hover:text-danger">Desvincular</summary>
                        <form action={revokeFamilyLink} className="mt-2 rounded-lg border border-line p-3 text-xs text-muted">
                          <input type="hidden" name="id" value={l.id} /><input type="hidden" name="confirm" value="yes" />
                          <p>Dejará de ver tu información desde ahora. Tus candidaturas, documentos y ofertas no cambian.</p>
                          <button className="mt-2 min-h-11 rounded-full border border-danger/40 px-4 font-semibold text-danger">Sí, desvincular</button>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                <p className="mb-4 max-w-xl text-sm text-muted">
                  Invita a tu madre, padre o tutor. {session.isMinor ? 'Como eres menor, recomendamos vincular a tu familia: es parte del proceso y te protege.' : ''}
                </p>
                <InviteLink siteUrl={siteUrl()} label="Invitar a mi familia" />
              </>
            )}
          </Card>
        )}

        <Card>
          <CardTitle kicker="Portabilidad">Descargar mis datos</CardTitle>
          <p className="mb-4 text-sm text-muted">Un archivo JSON con todo lo que guardamos sobre ti.</p>
          <a href="/app/settings/export" className="inline-flex rounded-lg border border-line-strong px-4 py-2.5 text-sm text-paper hover:border-brass">Descargar (JSON)</a>
        </Card>

        <Card>
          <CardTitle kicker="Derechos RGPD">Ejercer un derecho</CardTitle>
          <DataRequestForm />
          {requests?.length ? (
            <ul className="mt-5 divide-y divide-line border-t border-line text-sm">
              {requests.map((r) => (
                <li key={r.id} className="flex justify-between py-2.5">
                  <span className="text-paper">{REQUEST_LABEL[r.request_type]} · <span className="text-faint">{new Date(r.created_at).toLocaleDateString('es-ES')}</span></span>
                  <Badge tone={r.status === 'completed' ? 'ok' : 'brass'}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <CardTitle kicker="Cuenta">Eliminar mi cuenta</CardTitle>
          <DeleteAccountForm />
        </Card>

        <Card>
          <CardTitle kicker="Cookies">Preferencias de cookies</CardTitle>
          <CookiePrefsButton />
        </Card>

        <Card>
          <CardTitle kicker="Registro">Consentimientos</CardTitle>
          <ul className="space-y-1.5 text-sm text-muted">
            {(consents ?? []).map((c, i) => (
              <li key={i}>{c.granted ? '✓' : '✗'} {c.purpose} · versión {c.document_version} · {new Date(c.created_at).toLocaleDateString('es-ES')}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
