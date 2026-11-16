import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { ATHLETE_STATUS_LABEL } from '@/lib/domain/labels';
import type { ApplicationStatus } from '@/lib/types';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { RosterInviteForm } from '@/components/autonomy';
import { revokeRosterInvite, verifyStatisticAsClub } from '@/app/actions/autonomy';
import { RecommendationForm } from '@/components/RecommendationForm';

export const metadata: Metadata = { title: 'Portal de academia o club' };

interface RosterRow {
  athlete_id: string;
  display_name: string;
  season: string;
  graduation_year: number | null;
  sport_id: string | null;
  shares_progress: boolean;
  applications: number | null;
  best_status: string | null;
  placed: boolean | null;
}

function currentSeason(now = new Date()) {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export default async function ClubPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await requireSession(['coach', 'university']);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('member_role, organizations(id, name, type, verification_status)')
    .eq('user_id', session.userId);
  const orgs = (memberships ?? [])
    .map((m) => ({ role: m.member_role as string, org: m.organizations as unknown as { id: string; name: string; type: string; verification_status: string } }))
    .filter((m) => m.org && ['club', 'academy'].includes(m.org.type));

  if (!orgs.length) {
    return (
      <>
        <PageHeader kicker="Academias y clubes" title="Portal de academia o club" />
        <EmptyState title="Este portal es para academias y clubes" action={<ButtonLink href="/app/organization">Mi organización</ButtonLink>}>
          Registra tu club o academia con el correo de su dominio oficial: se verifica sola y podrás invitar a tu roster.
        </EmptyState>
      </>
    );
  }

  const current = orgs.find((o) => o.org.id === sp.org) ?? orgs[0];
  const org = current.org;
  const verified = org.verification_status === 'verified';
  const isAdmin = current.role === 'admin' || session.roles.includes('admin');

  const [{ data: roster }, { data: invites }] = await Promise.all([
    supabase.rpc('club_roster_summary', { p_org: org.id }),
    supabase.from('club_roster_invites').select('id, season, token, uses, max_uses, status, expires_at').eq('organization_id', org.id)
      .order('created_at', { ascending: false }).limit(10),
  ]);
  const rows = (roster ?? []) as RosterRow[];
  const ids = rows.map((r) => r.athlete_id);
  const { data: stats } = ids.length
    ? await supabase.from('athlete_statistics').select('id, athlete_id, season, value, source, sport_stat_definitions(label_es, unit)')
        .in('athlete_id', ids).neq('source', 'club_verified').order('season', { ascending: false }).limit(40)
    : { data: [] };
  const { data: recs } = await supabase.from('club_recommendations').select('athlete_id, body, status').eq('organization_id', org.id);
  const recBy = new Map((recs ?? []).map((r) => [r.athlete_id as string, r as { body: string; status: string }]));
  const REC_STATUS: Record<string, string> = { pending: 'Pendiente del atleta', published: 'Publicada', hidden: 'Oculta por el atleta' };
  const uniqueAthletes = [...new Map(rows.map((r) => [r.athlete_id, r])).values()];
  const sharing = rows.filter((r) => r.shares_progress);
  const placed = sharing.filter((r) => r.placed).length;
  const withApps = sharing.filter((r) => (r.applications ?? 0) > 0).length;
  const site = siteUrl();

  return (
    <>
      <PageHeader kicker="Academias y clubes" title={org.name} description="Roster por temporada, validación de estadísticas y seguimiento de colocaciones de quien lo comparte." />
      {orgs.length > 1 && (
        <nav className="mb-5 flex flex-wrap gap-2" aria-label="Organización">
          {orgs.map((o) => (
            <Link key={o.org.id} href={`/app/club?org=${o.org.id}`} className={`rounded-full border px-3 py-1 text-sm ${o.org.id === org.id ? 'border-brass text-paper' : 'border-line text-muted'}`}>{o.org.name}</Link>
          ))}
        </nav>
      )}
      {!verified && <div className="mb-5"><Notice tone="warn">La organización aún no está verificada. La verificación es automática si tu correo es del dominio de la web del club.</Notice></div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { k: 'Atletas en el roster', v: rows.length },
          { k: 'Con candidaturas activas', v: withApps },
          { k: 'Colocados', v: placed },
        ].map((s) => (
          <Card key={s.k}><p className="text-xs text-faint">{s.k}</p><p className="font-display text-3xl tabular-nums text-paper">{s.v}</p></Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardTitle kicker="Roster">Atletas</CardTitle>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay atletas. Crea un enlace de roster y compártelo en el grupo del equipo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-faint"><th className="py-2 pr-3 font-normal">Atleta</th><th className="pr-3 font-normal">Promoción</th><th className="pr-3 font-normal">Candidaturas</th><th className="font-normal">Mejor estado</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={`${r.athlete_id}-${r.season}`}>
                      <td className="py-2.5 pr-3"><Link href={`/athletes/${r.athlete_id}`} className="text-paper hover:text-brass">{r.display_name}</Link><span className="ml-2 text-xs text-faint">{r.season}</span></td>
                      <td className="pr-3 tabular-nums text-muted">{r.graduation_year ?? '—'}</td>
                      <td className="pr-3 tabular-nums text-muted">{r.shares_progress ? r.applications : 'Privado'}</td>
                      <td>{r.shares_progress && r.best_status ? <Badge tone={r.placed ? 'ok' : 'neutral'}>{ATHLETE_STATUS_LABEL[r.best_status as ApplicationStatus] ?? r.best_status}</Badge> : <span className="text-xs text-faint">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-faint">Cada atleta decide si comparte su progreso con el club y puede salir del roster cuando quiera.</p>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle kicker="Invitación">Enlace de roster</CardTitle>
            {verified && isAdmin ? <RosterInviteForm organizationId={org.id} defaultSeason={currentSeason()} /> : <p className="text-sm text-muted">Solo los administradores de un club verificado pueden crear enlaces.</p>}
            <ul className="mt-4 space-y-3 text-sm">
              {(invites ?? []).map((i) => {
                const active = i.status === 'active' && new Date(i.expires_at) > new Date() && i.uses < i.max_uses;
                return (
                  <li key={i.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-paper">Temporada {i.season}</span>
                      <Badge tone={active ? 'ok' : 'neutral'}>{active ? `${i.uses} usos` : 'Inactivo'}</Badge>
                    </div>
                    {active && <input readOnly value={`${site}/roster/${i.token}`} aria-label="Enlace de roster" className="mt-2 w-full truncate rounded border border-line bg-ink px-2 py-1 text-xs text-muted" />}
                    {active && isAdmin && (
                      <form action={revokeRosterInvite} className="mt-2"><input type="hidden" name="id" value={i.id} /><button className="text-xs text-faint hover:text-danger">Desactivar</button></form>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle kicker="Validación">Estadísticas por confirmar</CardTitle>
            {(stats ?? []).length === 0 ? (
              <p className="text-sm text-muted">No hay estadísticas pendientes.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(stats ?? []).map((s) => {
                  const def = s.sport_stat_definitions as unknown as { label_es: string; unit: string | null } | null;
                  const who = rows.find((r) => r.athlete_id === s.athlete_id)?.display_name;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-muted"><span className="text-paper">{who}</span> · {def?.label_es} {s.value}{def?.unit ? ` ${def.unit}` : ''} · {s.season}</span>
                      {verified && isAdmin && (
                        <form action={verifyStatisticAsClub}>
                          <input type="hidden" name="stat_id" value={s.id} />
                          <input type="hidden" name="organization_id" value={org.id} />
                          <button className="shrink-0 text-xs text-brass hover:underline">Confirmar</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-faint">Confirma solo lo que el club puede respaldar. Aparecerá como &quot;confirmado por el club&quot;.</p>
          </Card>
        </div>
      </div>

      {verified && isAdmin && uniqueAthletes.length > 0 && (
        <Card className="mt-5">
          <CardTitle kicker="Networking">Recomendaciones del club</CardTitle>
          <p className="mb-4 max-w-2xl text-sm text-muted">Tu respaldo es lo que más valoran los coaches universitarios. Escribe lo que el club puede afirmar de cada atleta: aparecerá en su perfil como &quot;recomendado por {org.name}&quot; solo si el atleta lo aprueba.</p>
          <ul className="grid gap-4 lg:grid-cols-2">
            {uniqueAthletes.map((r) => {
              const rec = recBy.get(r.athlete_id);
              return (
                <li key={r.athlete_id} className="rounded-2xl border border-line p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-paper">{r.display_name}</span>
                    {rec && <Badge tone={rec.status === 'published' ? 'ok' : 'neutral'}>{REC_STATUS[rec.status]}</Badge>}
                  </div>
                  {rec && rec.status !== 'pending' ? <p className="text-sm text-muted">“{rec.body}”</p> : <RecommendationForm athleteId={r.athlete_id} organizationId={org.id} current={rec?.body} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
