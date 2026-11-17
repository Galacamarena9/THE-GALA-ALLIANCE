import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { ORG_TYPE_LABEL, VERIFICATION_LABEL, domainOf } from '@/lib/domain/labels';
import type { OrgType, VerificationStatus } from '@/lib/types';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { InstitutionLinksForm, NewsForm, OrganizationForm, TeamInviteForm } from '@/components/forms';
import { submitVerification } from '@/app/actions/organization';
import { setMemberPrograms, updateMember } from '@/app/actions/recruit';
import { ProgramForm } from '@/components/recruit/RecruitForms';
import { loadCatalog } from '@/lib/data/athlete';
import { ASSIGNABLE_ROLES, ROLE_LABEL, type OrgRole } from '@/lib/domain/recruit';

export const metadata: Metadata = { title: 'Organización' };

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const sp = await searchParams;
  const catalog = await loadCatalog();
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
      {sp.error && <div className="mb-4"><Notice tone="danger">{sp.error}</Notice></div>}
      <div className="space-y-5">
        {await Promise.all(
          orgs.map(async ({ role, org }) => {
            const isAdmin = role === 'admin' || role === 'owner';
            const isOwner = role === 'owner';
            const [{ data: members }, { data: inst }, { data: programs }] = await Promise.all([
              supabase.from('organization_members').select('user_id, member_role, title, program_ids, profiles(display_name)').eq('organization_id', org.id),
              org.institution_id ? supabase.from('institutions').select('*').eq('id', org.institution_id).maybeSingle() : Promise.resolve({ data: null }),
              supabase.from('org_programs').select('id, name, sport_id, gender').eq('organization_id', org.id).is('archived_at', null).order('name'),
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
                    <p id="programas" className="mb-2 text-sm font-medium text-paper">Programas deportivos</p>
                    {(programs ?? []).length ? <ul className="mb-3 flex flex-wrap gap-2 text-xs">{(programs ?? []).map((p) => <li key={p.id} className="rounded-full border border-line px-3 py-1 text-paper">{p.name}</li>)}</ul> : <p className="mb-3 text-xs text-muted">Sin programas. Crea uno por equipo (p. ej. Women&apos;s Basketball) para organizar necesidades, shortlists y permisos.</p>}
                    {isAdmin && <div className="mb-6"><ProgramForm org={org.id} sports={catalog.sports.map((x) => ({ id: x.id, name: x.name_es }))} /></div>}
                    <p id="equipo" className="mb-3 text-sm font-medium text-paper">Equipo</p>
                    <ul className="mb-4 divide-y divide-line text-sm">
                      {(members ?? []).map((m) => {
                        const r = m.member_role as OrgRole;
                        const progs = (m.program_ids as string[]) ?? [];
                        const hidden = (op: string) => (<><input type="hidden" name="org" value={org.id} /><input type="hidden" name="user" value={m.user_id} /><input type="hidden" name="op" value={op} /></>);
                        return (
                          <li key={m.user_id} className="space-y-2 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-paper">{(m.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Miembro'} <span className="text-faint">· {ROLE_LABEL[r] ?? r}{m.title ? ` · ${m.title}` : ''}{progs.length ? ` · ${progs.length} programa${progs.length > 1 ? 's' : ''}` : ' · todos los programas'}</span></span>
                              {isAdmin && r !== 'owner' && m.user_id !== session.userId && (
                                <span className="flex flex-wrap items-center gap-2">
                                  <form action={updateMember} className="flex items-center gap-1">{hidden('role')}
                                    <label className="sr-only" htmlFor={`role-${m.user_id}`}>Rol</label>
                                    <select id={`role-${m.user_id}`} name="role" defaultValue={ASSIGNABLE_ROLES.includes(r) ? r : ''} className="min-h-9 rounded-lg border border-line bg-ink/40 px-2 text-xs text-paper">{!ASSIGNABLE_ROLES.includes(r) && <option value="">{ROLE_LABEL[r] ?? r}</option>}{ASSIGNABLE_ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select>
                                    <button className="min-h-9 px-2 text-xs text-brass">Cambiar</button>
                                  </form>
                                  {isOwner && <form action={updateMember}>{hidden('transfer')}<button className="text-xs text-muted hover:text-paper">Transferir propiedad</button></form>}
                                  <form action={updateMember}>{hidden('remove')}<button className="text-xs text-faint hover:text-danger">Dar de baja</button></form>
                                </span>
                              )}
                            </div>
                            {isAdmin && (programs ?? []).length > 0 && r !== 'owner' && r !== 'admin' && (
                              <form action={setMemberPrograms} className="flex flex-wrap items-center gap-2 text-xs">
                                <input type="hidden" name="org" value={org.id} /><input type="hidden" name="user" value={m.user_id} />
                                <span className="text-muted">Acceso a programas:</span>
                                {(programs ?? []).map((p) => <label key={p.id} className="inline-flex items-center gap-1 text-paper"><input type="checkbox" name="programs" value={p.id} defaultChecked={progs.includes(p.id)} className="h-4 w-4" />{p.name}</label>)}
                                <button className="text-brass">Guardar</button>
                                <span className="text-faint">(ninguno marcado = todos)</span>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mb-3 text-xs text-faint">Quien deja la organización pierde el acceso al momento; sus shortlists, notas y tareas quedan en la organización y todo queda en el registro de actividad.</p>
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
