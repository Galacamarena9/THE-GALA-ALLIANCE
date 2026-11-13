import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { ORG_TYPE_LABEL, VERIFICATION_LABEL, domainOf } from '@/lib/domain/labels';
import type { OrgType, VerificationStatus } from '@/lib/types';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { InstitutionLinksForm, NewsForm, OrganizationForm, TeamInviteForm } from '@/components/forms';
import { removeMember, submitVerification } from '@/app/actions/organization';

export const metadata: Metadata = { title: 'Organización' };

export default async function OrganizationPage() {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('member_role, organizations(*)')
    .eq('user_id', session.userId);

  const orgs = (memberships ?? []).map((m) => ({ role: m.member_role as string, org: m.organizations as unknown as Record<string, unknown> & { id: string; name: string; type: OrgType; verification_status: VerificationStatus; website: string | null; requester_email_domain: string | null; institution_id: string | null } }));

  if (!orgs.length) {
    return (
      <>
        <PageHeader kicker="Organización" title="Aún no perteneces a ninguna organización" />
        <EmptyState title="Crea la tuya o pide una invitación" action={<ButtonLink href="/onboarding?add=1">Dar de alta organización</ButtonLink>}>
          Si eres coach de una universidad, pide a su cuenta oficial un enlace de invitación al equipo.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader kicker="Organización" title="Perfil, verificación y equipo" description="Una organización verificada genera confianza: puede publicar, contactar atletas y aparecer con su sello." />
      <div className="space-y-5">
        {await Promise.all(
          orgs.map(async ({ role, org }) => {
            const isAdmin = role === 'admin';
            const [{ data: members }, { data: inst }] = await Promise.all([
              supabase.from('organization_members').select('user_id, member_role, profiles(display_name)').eq('organization_id', org.id),
              org.institution_id ? supabase.from('institutions').select('*').eq('id', org.institution_id).maybeSingle() : Promise.resolve({ data: null }),
            ]);
            const webDomain = domainOf(org.website);
            const domainMatch = webDomain && org.requester_email_domain ? org.requester_email_domain.endsWith(webDomain) : null;
            return (
              <Card key={org.id}>
                <CardTitle
                  kicker={ORG_TYPE_LABEL[org.type]}
                  action={<Badge tone={org.verification_status === 'verified' ? 'ok' : org.verification_status === 'rejected' ? 'danger' : 'warn'}>{VERIFICATION_LABEL[org.verification_status]}</Badge>}
                >
                  {org.name}
                </CardTitle>

                {org.verification_status !== 'verified' && (
                  <div className="mb-5 space-y-3">
                    <Notice>
                      Para verificarte comprobamos que la web es oficial y que tu email pertenece a ese dominio
                      {domainMatch === false && ' (tu email no coincide con el dominio de la web: puede que te pidamos documentación adicional)'}.
                    </Notice>
                    {isAdmin && (org.verification_status === 'unverified' || org.verification_status === 'rejected') && (
                      <form action={submitVerification}><input type="hidden" name="id" value={org.id} /><button className="rounded-lg bg-brass px-4 py-2 text-sm text-ink">Solicitar verificación</button></form>
                    )}
                  </div>
                )}

                {isAdmin ? <OrganizationForm org={org as never} /> : <p className="text-sm text-muted">Eres miembro ({role}). Solo los administradores pueden editar la organización.</p>}

                {inst && (
                  <div className="mt-6 border-t border-line pt-5">
                    <p className="mb-1 text-sm font-medium text-paper">Ficha oficial vinculada: <Link href={`/app/universities/${inst.id}`} className="text-brass hover:underline">{inst.name}</Link></p>
                    <p className="mb-4 text-xs text-faint">Los datos de coste y la web vienen de College Scorecard (U.S. Department of Education). Tú mantienes los enlaces deportivos y de campus virtual.</p>
                    {isAdmin && org.verification_status === 'verified' && <InstitutionLinksForm inst={inst} />}
                  </div>
                )}

                {(org.type === 'university' || org.type === 'college' || org.type === 'club' || org.type === 'academy') && (
                  <div className="mt-6 border-t border-line pt-5">
                    <p className="mb-3 text-sm font-medium text-paper">Equipo</p>
                    <ul className="mb-4 divide-y divide-line text-sm">
                      {(members ?? []).map((m) => (
                        <li key={m.user_id} className="flex items-center justify-between py-2">
                          <span className="text-paper">{(m.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Miembro'} <span className="text-faint">· {m.member_role}</span></span>
                          {isAdmin && m.member_role !== 'admin' && (
                            <form action={removeMember}><input type="hidden" name="organization_id" value={org.id} /><input type="hidden" name="user_id" value={m.user_id} /><button className="text-xs text-faint hover:text-danger">Quitar</button></form>
                          )}
                        </li>
                      ))}
                    </ul>
                    {isAdmin && <TeamInviteForm organizationId={org.id} siteUrl={siteUrl()} />}
                  </div>
                )}

                {org.verification_status === 'verified' && (
                  <div className="mt-6 border-t border-line pt-5">
                    <p className="mb-3 text-sm font-medium text-paper">Publicar en Actualidad</p>
                    <NewsForm organizations={[{ id: org.id, name: org.name }]} isAdmin={false} />
                  </div>
                )}
                {webDomain && <p className="mt-5 text-xs text-faint">Web oficial: <a href={org.website!} target="_blank" rel="noopener noreferrer" className="text-brass">{webDomain} ↗</a></p>}
              </Card>
            );
          }),
        )}
      </div>
    </>
  );
}
