import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { roadmapFor } from '@/lib/domain/roadmap';
import { ATHLETE_STATUS_LABEL, usd } from '@/lib/domain/labels';
import { siteUrl } from '@/lib/env';
import type { ApplicationStatus } from '@/lib/types';
import { Badge, Card, CardTitle, EmptyState, Meter, PageHeader } from '@/components/ui';
import { InviteLink } from '@/components/InviteLink';
import { revokeFamilyLink } from '@/app/actions/family';

export const metadata: Metadata = { title: 'Familia' };

export default async function FamilyPage() {
  const session = await requireSession(['parent']);
  const supabase = await createClient();
  const { data: links } = await supabase
    .from('parent_athlete_links')
    .select('id, athlete_id, status, can_view_applications, created_at, expires_at')
    .eq('parent_id', session.userId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });

  const approved = (links ?? []).filter((l) => l.status === 'approved' && l.athlete_id);
  const pending = (links ?? []).filter((l) => l.status === 'pending' && new Date(l.expires_at) > new Date());

  const athletes = await Promise.all(
    approved.map(async (l) => {
      const passport = await loadPassport(l.athlete_id!);
      const { data: apps } = l.can_view_applications
        ? await supabase
            .from('applications')
            .select('id, status, opportunities(title, annual_cost_usd, aid_amount_usd, deadline, organizations(name))')
            .eq('athlete_id', l.athlete_id!)
            .neq('status', 'withdrawn')
        : { data: null };
      return { link: l, passport, apps };
    }),
  );

  return (
    <>
      <PageHeader
        kicker="Family Command Center"
        title="El proceso, de un vistazo"
        description="Plazos, candidaturas y coste real de cada opción. Solo ves lo que tu hijo o hija ha decidido compartir contigo."
      />

      {athletes.length === 0 && (
        <Card>
          <CardTitle kicker="Paso 1">Vincula a tu hijo o hija</CardTitle>
          <p className="mb-5 max-w-xl text-sm text-muted">
            Crea un enlace y envíaselo. Cuando acepte con su cuenta de atleta, verás su progreso aquí. Si tiene menos de 14 años, su perfil
            permanece privado hasta que estéis vinculados.
          </p>
          <InviteLink siteUrl={siteUrl()} label="Crear enlace de invitación" />
          {pending.length > 0 && <p className="mt-4 text-xs text-faint">{pending.length} invitación(es) pendiente(s).</p>}
        </Card>
      )}

      <div className="space-y-5">
        {athletes.map(({ link, passport, apps }) => {
          const roadmap = roadmapFor(passport.profile?.graduation_year ?? null, passport.profile?.target_divisions ?? []);
          const current = roadmap.find((s) => s.state === 'current');
          return (
            <Card key={link.id}>
              <CardTitle
                kicker={`Graduación ${passport.profile?.graduation_year ?? '—'}`}
                action={<Link href={`/athletes/${link.athlete_id}`} className="text-sm text-brass hover:underline">Ver Passport</Link>}
              >
                {passport.person?.display_name ?? 'Atleta'}
              </CardTitle>

              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <Meter value={passport.readiness.score} label="Passport preparado" />
                  {passport.readiness.nextAction && (
                    <p className="mt-3 text-sm text-muted">Siguiente paso: <span className="text-paper">{passport.readiness.nextAction.action}</span></p>
                  )}
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-2 text-sm font-medium text-paper">Etapa: {current?.label}</p>
                  <ul className="space-y-1.5 text-sm text-muted">
                    {current?.tasks.filter((t) => t.owner !== 'atleta').map((t) => <li key={t.id}>· {t.title}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-3 text-sm font-medium text-paper">Candidaturas y coste</p>
                {apps === null ? (
                  <p className="text-sm text-faint">Tu hijo o hija no comparte sus candidaturas contigo.</p>
                ) : apps.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="text-left text-xs text-faint">
                        <tr><th className="py-2 font-normal">Oportunidad</th><th className="font-normal">Estado</th><th className="text-right font-normal">Coste anual</th><th className="text-right font-normal">Ayuda</th><th className="text-right font-normal">Neto familia</th></tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {apps.map((a) => {
                          const o = a.opportunities as unknown as { title: string; annual_cost_usd: number | null; aid_amount_usd: number | null; organizations: { name: string } | null } | null;
                          const net = o?.annual_cost_usd != null && o.aid_amount_usd != null ? o.annual_cost_usd - o.aid_amount_usd : null;
                          return (
                            <tr key={a.id}>
                              <td className="py-2.5 text-paper">{o?.title}<span className="block text-xs text-faint">{o?.organizations?.name}</span></td>
                              <td><Badge tone="brass">{ATHLETE_STATUS_LABEL[a.status as ApplicationStatus]}</Badge></td>
                              <td className="text-right tabular-nums">{usd(o?.annual_cost_usd)}</td>
                              <td className="text-right tabular-nums">{usd(o?.aid_amount_usd)}</td>
                              <td className="text-right tabular-nums text-paper">{net == null ? <span className="text-warn">Incompleto</span> : usd(net)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs text-faint">&quot;Incompleto&quot; significa que la universidad no ha publicado coste y ayuda completos. Nunca estimamos cifras que no existen.</p>
                  </div>
                ) : (
                  <EmptyState title="Aún no hay candidaturas" />
                )}
              </div>

              <form action={revokeFamilyLink} className="mt-6 text-right">
                <input type="hidden" name="id" value={link.id} />
                <button className="text-xs text-faint hover:text-danger">Desvincular</button>
              </form>
            </Card>
          );
        })}
      </div>

      {athletes.length > 0 && (
        <Card className="mt-5">
          <CardTitle kicker="Otro hijo o hija">Vincular a otro atleta</CardTitle>
          <InviteLink siteUrl={siteUrl()} label="Crear otro enlace" />
        </Card>
      )}
    </>
  );
}
