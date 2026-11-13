import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui';
import { InviteLink } from '@/components/InviteLink';
import { revokeFamilyLink, updateFamilyPermissions } from '@/app/actions/family';
import { DataRequestForm } from './DataRequestForm';
import { DeleteAccountForm } from '@/components/autonomy';
import { CookiePrefsButton } from './CookiePrefsButton';

export const metadata: Metadata = { title: 'Privacidad y datos' };

const REQUEST_LABEL: Record<string, string> = {
  access: 'Acceso', rectification: 'Rectificación', erasure: 'Supresión', restriction: 'Limitación', objection: 'Oposición', portability: 'Portabilidad',
};

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const isAthlete = session.roles.includes('athlete');

  const [{ data: links }, { data: requests }, { data: consents }] = await Promise.all([
    isAthlete
      ? supabase
          .from('parent_athlete_links')
          .select('id, parent_id, status, can_view_profile, can_view_applications, can_view_academics, can_edit_profile, profiles!parent_athlete_links_parent_id_fkey(display_name)')
          .eq('athlete_id', session.userId)
          .eq('status', 'approved')
      : Promise.resolve({ data: [] }),
    supabase.from('data_subject_requests').select('id, request_type, status, created_at').eq('user_id', session.userId).order('created_at', { ascending: false }),
    supabase.from('consents').select('purpose, document_version, granted, created_at').eq('user_id', session.userId).order('created_at', { ascending: false }),
  ]);

  return (
    <>
      <PageHeader kicker="Privacidad" title="Tus datos, tus decisiones" description="Controla quién te ve, descarga tus datos y ejerce tus derechos en cualquier momento." />

      <div className="space-y-5">
        {isAthlete && (
          <Card id="familia">
            <CardTitle kicker="Familia">Personas vinculadas</CardTitle>
            {links?.length ? (
              <ul className="space-y-4">
                {links.map((l) => {
                  const parent = l.profiles as unknown as { display_name: string } | null;
                  return (
                    <li key={l.id} className="rounded-xl border border-line p-4">
                      <p className="font-medium text-paper">{parent?.display_name ?? 'Familiar'}</p>
                      <form action={updateFamilyPermissions} className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                        <input type="hidden" name="id" value={l.id} />
                        {([
                          ['can_view_profile', 'Ver mi Passport', l.can_view_profile],
                          ['can_view_applications', 'Ver mis candidaturas', l.can_view_applications],
                          ['can_view_academics', 'Ver mi académico', l.can_view_academics],
                          ['can_edit_profile', 'Editar mi perfil', l.can_edit_profile],
                        ] as const).map(([name, label, checked]) => (
                          <label key={name} className="flex items-center gap-2">
                            <input type="checkbox" name={name} defaultChecked={checked} className="accent-[var(--color-brass)]" />
                            {label}
                          </label>
                        ))}
                        <button className="rounded-lg border border-line-strong px-3 py-1 text-xs text-paper hover:border-brass">Guardar permisos</button>
                      </form>
                      <form action={revokeFamilyLink} className="mt-3">
                        <input type="hidden" name="id" value={l.id} />
                        <button className="text-xs text-faint hover:text-danger">Desvincular</button>
                      </form>
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
