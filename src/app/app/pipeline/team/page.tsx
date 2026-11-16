import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { AGENCY_ROLES } from '@/lib/domain/agency-cases';
import { setAgencyRole } from '@/app/actions/agency-cases';
import { Card, CardTitle, EmptyState, PageHeader, inputClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Equipo de la agencia' };

export default async function AgencyTeamPage() {
  const session = await requireSession(['agent']);
  const data = await loadAgencyCases(session.userId);
  const roleLabel = new Map(AGENCY_ROLES.map((r) => [r.id, r.label]));

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/app/pipeline" className="text-brass hover:underline">← Procesos</Link></p>
      <PageHeader kicker="Agencia" title="Equipo y permisos" description="Qué puede hacer cada persona. Solo los administradores de la agencia cambian roles; para invitar a alguien, ve a Agencia." />
      {!data.agencies.length && <EmptyState title="Sin agencia">Crea o únete a una agencia para gestionar su equipo.</EmptyState>}
      <div className="space-y-6">
        {data.agencies.map((a) => {
          const isAdmin = a.member_role === 'admin';
          const members = data.members.get(a.id) ?? [];
          return (
            <Card key={a.id}>
              <CardTitle kicker={`${members.length} miembro${members.length === 1 ? '' : 's'}`}>{a.name}</CardTitle>
              <ul className="divide-y divide-line">
                {members.map((m) => (
                  <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold text-paper">{m.name}{m.userId === session.userId ? ' (tú)' : ''}</p>
                      <p className="text-xs text-muted">{AGENCY_ROLES.find((r) => r.id === (m.agencyRole ?? 'recruiter'))?.desc}</p>
                    </div>
                    {isAdmin ? (
                      <form action={setAgencyRole} className="flex items-center gap-2">
                        <input type="hidden" name="organization_id" value={a.id} />
                        <input type="hidden" name="user_id" value={m.userId} />
                        <label className="sr-only" htmlFor={`role-${a.id}-${m.userId}`}>Rol de {m.name}</label>
                        <select id={`role-${a.id}-${m.userId}`} name="agency_role" defaultValue={m.agencyRole ?? 'recruiter'} className={`${inputClass} py-1.5`}>
                          {AGENCY_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        <button className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-paper hover:border-brass">Guardar</button>
                      </form>
                    ) : (
                      <span className="text-sm text-muted">{roleLabel.get(m.agencyRole ?? 'recruiter')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      <Card className="mt-6">
        <CardTitle kicker="Referencia">Qué puede hacer cada rol</CardTitle>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {AGENCY_ROLES.map((r) => (
            <div key={r.id}><dt className="font-semibold text-paper">{r.label}</dt><dd className="text-muted">{r.desc}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-faint">Hoy la plataforma distingue entre quien puede escribir (todos menos «Solo lectura») y quien solo lee. El resto de roles sirve para organizar el equipo; los permisos finos por rol llegarán cuando las agencias que lo usen nos digan qué necesitan.</p>
      </Card>
    </>
  );
}
