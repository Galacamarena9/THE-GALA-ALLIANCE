import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadPassportViews } from '@/lib/data/athlete';
import { athletePhotoUrl } from '@/lib/data/passport-view';
import { loadAthleteContext, loadInstitutionMatches, loadOpportunityMatches, loadSaved, type ScoredInstitution, type ScoredOpportunity } from '@/lib/data/gala-match';
import { DIVISION_PATHWAYS } from '@/lib/domain/passport';
import { loadOpenTasks } from '@/lib/data/pipeline';
import { explainChange, parseSnapshot, type MatchChange } from '@/lib/domain/gala-match/changes';
import { daysUntil, journey, prioritize, stageOf, type DashboardInput } from '@/lib/domain/dashboard';

export type MatchChangeItem = { id: string; name: string; href: string; change: MatchChange };

/** Resultado de un módulo: si falla, el resto del panel sigue funcionando. */
export type Mod<T> = { ok: true; data: T } | { ok: false };
async function safe<T>(p: Promise<T>): Promise<Mod<T>> {
  try { return { ok: true, data: await p }; } catch (e) {
    console.error('[dashboard] módulo no disponible', e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

/**
 * Todo lo que necesita el Athlete Command Center en paralelo y con el cliente del usuario (RLS).
 * Nada se calcula dos veces: el encaje sale del motor de Gala Match y la preparación del Passport de Readiness.
 */
export async function loadAthleteDashboard(userId: string, isMinor: boolean) {
  const supabase = await createClient();
  const loaded = await loadAthleteContext(userId);
  if (!loaded) return null;
  const { ctx, passport } = loaded;
  const goals = passport.goals?.pathways ?? passport.profile?.target_divisions ?? [];
  const seeksUSCollege = goals.length === 0 || goals.some((g) => (DIVISION_PATHWAYS as readonly string[]).includes(g));

  const [instM, oppM, saved, apps, offers, viewed, views, linkViews, activity, photo, taskState, ptasks, pnext] = await Promise.all([
    safe(loadInstitutionMatches(userId, ctx, {})),
    safe(loadOpportunityMatches(userId, ctx)),
    safe(loadSaved(userId)),
    safe(Promise.resolve(supabase.from('applications').select('id, status, updated_at, created_at, opportunities(id, title, deadline)').eq('athlete_id', userId).order('updated_at', { ascending: false }).limit(50)).then((r) => { if (r.error) throw r.error; return r.data ?? []; })),
    safe(Promise.resolve(supabase.from('athlete_offers').select('id, university_name, deadline, in_writing, created_at').eq('athlete_id', userId).order('deadline', { ascending: true, nullsFirst: false })).then((r) => { if (r.error) throw r.error; return r.data ?? []; })),
    safe(Promise.resolve(supabase.from('match_signals').select('target_kind, target_id').eq('athlete_id', userId).eq('signal', 'viewed').limit(2000)).then((r) => new Set((r.data ?? []).map((x) => `${x.target_kind}:${x.target_id}`)))),
    safe(loadPassportViews(userId)),
    safe(Promise.resolve(supabase.from('recruiting_link_views').select('id, recruiting_links!inner(athlete_id)', { count: 'exact', head: true }).eq('recruiting_links.athlete_id', userId).gte('viewed_at', new Date(Date.now() - 7 * 86400000).toISOString())).then((r) => r.count ?? 0)),
    safe(Promise.resolve(supabase.from('notifications').select('id, kind, title, link, created_at, read_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8)).then((r) => r.data ?? [])),
    athletePhotoUrl(passport.profile?.photo_path),
    safe(Promise.resolve(supabase.from('athlete_task_state').select('task_key, status, snoozed_until, updated_at').eq('athlete_id', userId)).then((r) => r.data ?? [])),
    safe(loadOpenTasks(userId)),
    safe(Promise.resolve(supabase.from('saved_items').select('id, next_action, next_action_due').eq('athlete_id', userId).is('archived_at', null).not('next_action_due', 'is', null).not('status', 'in', '(committed,closed)').order('next_action_due').limit(20)).then((r) => r.data ?? [])),
  ]);
  const personalDue = [
    ...(ptasks.ok ? ptasks.data : []).map((t) => ({ id: `t-${t.id}`, title: t.title as string, date: t.due_date as string, href: t.process_id ? `/app/process/${t.process_id}` : '/app/process' })),
    ...(pnext.ok ? pnext.data : []).filter((x) => x.next_action).map((x) => ({ id: `n-${x.id}`, title: x.next_action as string, date: x.next_action_due as string, href: `/app/process/${x.id}` })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const hiddenTasks = new Set((taskState.ok ? taskState.data : []).filter((t) => t.status !== 'snoozed' || (t.snoozed_until ?? '') > today).map((t) => t.task_key));
  const doneRecently = (taskState.ok ? taskState.data : []).filter((t) => t.status === 'done' && Date.now() - new Date(t.updated_at).getTime() < 14 * 86400000);

  const applications = apps.ok ? apps.data.map((a) => {
    const o = a.opportunities as unknown as { id: string; title: string; deadline: string | null } | null;
    return { id: a.id as string, status: a.status as string, title: o?.title ?? 'Candidatura', deadline: o?.deadline ?? null, opportunityId: o?.id ?? null, updated_at: a.updated_at as string };
  }) : [];
  const offerRows = offers.ok ? offers.data : [];
  const savedRows = saved.ok ? saved.data : [];
  const viewedSet = viewed.ok ? viewed.data : new Set<string>();

  // Matches sin revisar: encaje ≥ 70 %, sin bloqueo, ni vistos, ni guardados.
  const unseen: ScoredInstitution[] = instM.ok ? instM.data.scored.filter((x) => (x.m.score ?? 0) >= 70 && !x.m.blocked && !x.saved && !viewedSet.has(`institution:${x.inst.id}`)) : [];
  const topMatches: ScoredInstitution[] = instM.ok ? instM.data.scored.filter((x) => !x.m.blocked && x.m.score != null).slice(0, 3) : [];
  const activeOpps: ScoredOpportunity[] = oppM.ok ? oppM.data.scored.filter((x) => !x.m.blocked) : [];
  const highOpps = activeOpps.filter((x) => (x.m.score ?? 0) >= 80 && !x.saved);

  // Plazos oficiales: oportunidades guardadas o con candidatura + ofertas. Solo fechas que existen.
  const savedOppIds = new Set(savedRows.filter((s) => s.target_kind === 'opportunity').map((s) => s.target_id));
  const official: DashboardInput['officialDeadlines'] = [];
  for (const o of activeOpps) if (o.opp.deadline && (savedOppIds.has(o.opp.id) || applications.some((a) => a.opportunityId === o.opp.id))) official.push({ id: o.opp.id, title: o.opp.title, date: o.opp.deadline, href: `/app/opportunities/${o.opp.id}` });
  for (const a of applications) if (a.deadline && a.opportunityId && !official.some((d) => d.id === a.opportunityId)) official.push({ id: a.opportunityId, title: a.title, date: a.deadline, href: `/app/opportunities/${a.opportunityId}` });
  const deadlines = [
    ...official.map((d) => ({ ...d, kind: 'official' as const, label: 'Plazo oficial' })),
    ...offerRows.filter((o) => o.deadline).map((o) => ({ id: `offer-${o.id}`, title: `Oferta de ${o.university_name}`, date: o.deadline as string, href: '/app/offers', kind: 'official' as const, label: 'Fecha límite de la oferta' })),
  ].filter((d) => daysUntil(d.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const personal = personalDue.map((t) => ({ ...t, kind: 'personal' as const, label: daysUntil(t.date) < 0 ? 'Fecha personal (vencida)' : 'Fecha personal' }));
  // Fecha recomendada por Gala: 5 días antes de cada plazo oficial (claramente separada).
  const recommended = deadlines.filter((d) => daysUntil(d.date) > 7).map((d) => {
    const r = new Date(`${d.date}T12:00:00`); r.setDate(r.getDate() - 5);
    return { id: `rec-${d.id}`, title: `Tenlo listo: ${d.title}`, date: r.toISOString().slice(0, 10), href: d.href, kind: 'recommended' as const, label: 'Fecha recomendada por Gala' };
  });

  // Cambios reales de encaje: guardadas cuyo resultado actual difiere del congelado al guardar.
  // Con foto se explica el porqué factor a factor; sin foto (guardados antiguos) solo se muestra la cifra.
  const changes: MatchChangeItem[] = [];
  for (const s of savedRows) {
    const cur = s.target_kind === 'institution'
      ? (instM.ok ? instM.data.scored.find((x) => x.inst.id === s.target_id)?.m : undefined)
      : (oppM.ok ? oppM.data.scored.find((x) => x.opp.id === s.target_id)?.m : undefined);
    if (!cur) continue;
    const snap = parseSnapshot(s.match_snapshot);
    const href = `/app/match/${s.target_kind}/${s.target_id}`;
    if (snap) {
      const c = explainChange(snap, cur);
      if (c) changes.push({ id: s.target_id, name: s.name, href, change: c });
    } else if (s.match_score_at_save != null && cur.score != null && cur.score !== s.match_score_at_save) {
      changes.push({ id: s.target_id, name: s.name, href, change: { from: s.match_score_at_save, to: cur.score, confidenceFrom: cur.confidence, confidenceTo: cur.confidence, reasons: [], methodChanged: false } });
    }
  }
  // Primero los que tienen explicación y los que más se mueven.
  changes.sort((a, b) => (b.change.reasons.length > 0 ? 1 : 0) - (a.change.reasons.length > 0 ? 1 : 0)
    || Math.abs((b.change.to ?? 0) - (b.change.from ?? 0)) - Math.abs((a.change.to ?? 0) - (a.change.from ?? 0)));

  const input: DashboardInput = {
    readiness: passport.readiness,
    unseenMatches: unseen.length,
    savedUniversities: savedRows.filter((s) => s.target_kind === 'institution').length,
    savedOpportunities: savedRows.filter((s) => s.target_kind === 'opportunity').length,
    applications: applications.map((a) => ({ id: a.id, status: a.status, deadline: a.deadline, title: a.title })),
    offers: offerRows.map((o) => ({ id: o.id as string, university_name: o.university_name as string, deadline: o.deadline as string | null, in_writing: Boolean(o.in_writing) })),
    officialDeadlines: official,
    highMatchOpportunities: highOpps.length,
    isMinor,
    seeksUSCollege,
    personalDue,
  };

  // Shortlist con su encaje actual.
  const shortlist = savedRows.filter((s) => s.target_kind === 'institution').slice(0, 4).map((s) => ({ ...s, m: instM.ok ? instM.data.scored.find((x) => x.inst.id === s.target_id)?.m ?? null : null }));

  return {
    passport, ctx, photo, seeksUSCollege,
    stage: stageOf(input),
    // Las tareas que dependen de un dato (Passport, plazos) desaparecen solas al resolverse; el resto se puede completar o posponer.
    actions: prioritize(input).filter((a) => !hiddenTasks.has(a.key)),
    doneRecently: doneRecently.length,
    journey: journey(input),
    modules: {
      matches: instM.ok ? { ok: true as const, data: { unseen: unseen.slice(0, 3), unseenCount: unseen.length, top: topMatches, directoryEmpty: instM.data.totalInDirectory === 0 } } : { ok: false as const },
      opportunities: oppM.ok ? { ok: true as const, data: activeOpps.slice(0, 3) } : { ok: false as const },
      shortlist: saved.ok ? { ok: true as const, data: { items: shortlist, total: input.savedUniversities, withActive: instM.ok ? shortlist.filter((s) => instM.data.scored.find((x) => x.inst.id === s.target_id)?.activeOpps).length : 0 } } : { ok: false as const },
      deadlines: { ok: true as const, data: [...deadlines, ...recommended, ...personal].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8) },
      changes,
      views: views.ok ? views.data : null,
      linkViews: linkViews.ok ? linkViews.data : null,
      activity: activity.ok ? { ok: true as const, data: activity.data } : { ok: false as const },
      applications,
      offers: offerRows,
    },
  };
}

export type AthleteDashboard = NonNullable<Awaited<ReturnType<typeof loadAthleteDashboard>>>;
