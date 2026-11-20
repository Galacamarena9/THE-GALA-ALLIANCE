import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { TRIAL_TYPES, trialFit, type CostComponent, type PriceStatus, type RegistrationStatus, type InvitationStatus, type TrialFit } from '@/lib/domain/trials';

const OPP_COLS = 'id, title, type, sport_id, position_ids, graduation_years, deadline, expires_at, start_at, timezone, city, country, organizations(name, verification_status)';

export type TrialOpp = {
  id: string; title: string; type: string; sport_id: string; position_ids: number[]; graduation_years: number[]; deadline: string | null;
  start_at: string | null; timezone: string | null; city: string | null; country: string | null;
  org_name: string; org_verified: boolean; price_status: PriceStatus | null; costs: CostComponent[];
};
export type AgentAthlete = { id: string; agencyId: string; name: string; sport_id: string | null; primary_position_id: number | null; secondary_position_id: number | null; graduation_year: number | null };
/** Participación en el tablero del agente: una inscripción o, si aún no la hay, la invitación del club. */
export type AgentRegistration = {
  id: string; kind: 'registration' | 'invitation'; status: RegistrationStatus | InvitationStatus; origin: string; needs_athlete_ok: boolean; guardian_status: string;
  athlete_update: string | null; updated_at: string; athlete: AgentAthlete | null; opp: TrialOpp | null;
};

type OppRow = { id: string; title: string; type: string; sport_id: string; position_ids: number[] | null; graduation_years: number[] | null; deadline: string | null;
  start_at: string | null; timezone: string | null; city: string | null; country: string | null; organizations: unknown };

/** Detalles de precio y costes de varias oportunidades en 2 consultas (sin N+1). */
export async function loadPricing(ids: string[]) {
  const supabase = await createClient();
  if (!ids.length) return { price: new Map<string, PriceStatus>(), costs: new Map<string, CostComponent[]>() };
  const [{ data: details }, { data: costs }] = await Promise.all([
    supabase.from('trial_details').select('opportunity_id, price_status').in('opportunity_id', ids),
    supabase.from('opportunity_cost_components').select('opportunity_id, component_type, label, amount, currency, required, included, period').in('opportunity_id', ids).order('sort'),
  ]);
  const price = new Map((details ?? []).map((d) => [d.opportunity_id as string, d.price_status as PriceStatus]));
  const byOpp = new Map<string, CostComponent[]>();
  for (const c of costs ?? []) byOpp.set(c.opportunity_id as string, [...(byOpp.get(c.opportunity_id as string) ?? []), c as unknown as CostComponent]);
  return { price, costs: byOpp };
}

/**
 * Todo lo que necesita el agente para trabajar trials: sus representados ACTIVOS, sus inscripciones e invitaciones (RLS)
 * y los trials abiertos de organizaciones verificadas que encajan con cada uno. Consultas en paralelo, sin N+1.
 */
export async function loadAgentTrials(userId: string) {
  const supabase = await createClient();
  const agencies = (await myOrganizations(userId)).filter((o) => o.type === 'agency');
  if (!agencies.length) return { agencies, athletes: [] as AgentAthlete[], registrations: [] as AgentRegistration[], suggestions: [] as { opp: TrialOpp; fits: { athlete: AgentAthlete; fit: TrialFit; registered: boolean }[] }[] };

  const { data: reps } = await supabase.from('agent_representations').select('agency_id, athlete_id').in('agency_id', agencies.map((a) => a.id)).eq('status', 'active');
  const ids = [...new Set((reps ?? []).map((r) => r.athlete_id))];
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: dir }, { data: profiles }, { data: regs }, { data: invs }, { data: opps }] = await Promise.all([
    ids.length ? supabase.from('athlete_directory').select('user_id, display_name, sport_id, primary_position_id, secondary_position_id, graduation_year').in('user_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('profiles').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('opportunity_registrations').select('id, opportunity_id, athlete_id, status, origin, needs_athlete_ok, guardian_status, athlete_update, updated_at').in('athlete_id', ids).order('updated_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('opportunity_invitations').select('id, opportunity_id, athlete_id, status, updated_at').in('athlete_id', ids).in('status', ['sent', 'viewed', 'interested']).limit(300) : Promise.resolve({ data: [] }),
    supabase.from('opportunities').select(OPP_COLS)
      .in('type', TRIAL_TYPES as unknown as string[]).eq('status', 'published').or(`deadline.is.null,deadline.gte.${today}`).order('start_at', { ascending: true, nullsFirst: false }).limit(200),
  ]);

  const dirById = new Map((dir ?? []).map((d) => [d.user_id as string, d]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
  const athletes: AgentAthlete[] = (reps ?? []).map((r) => {
    const d = dirById.get(r.athlete_id) as { display_name?: string; sport_id?: string; primary_position_id?: number; secondary_position_id?: number; graduation_year?: number } | undefined;
    return {
      id: r.athlete_id, agencyId: r.agency_id, name: d?.display_name ?? nameById.get(r.athlete_id) ?? 'Atleta',
      sport_id: d?.sport_id ?? null, primary_position_id: d?.primary_position_id ?? null, secondary_position_id: d?.secondary_position_id ?? null, graduation_year: d?.graduation_year ?? null,
    };
  }).filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);

  // Oportunidades: abiertas (sugerencias) + las de participaciones existentes (aunque ya hayan cerrado).
  const known = new Set((opps ?? []).map((o) => o.id as string));
  const extraIds = [...new Set([...(regs ?? []), ...(invs ?? [])].map((r) => r.opportunity_id as string))].filter((id) => !known.has(id));
  const { data: extraOpps } = extraIds.length ? await supabase.from('opportunities').select(OPP_COLS).in('id', extraIds) : { data: [] };
  const allOpps = [...(opps ?? []), ...(extraOpps ?? [])] as OppRow[];
  const pricing = await loadPricing(allOpps.map((o) => o.id));
  const toOpp = (o: OppRow): TrialOpp => {
    const org = o.organizations as { name: string; verification_status: string } | null;
    return {
      id: o.id, title: o.title, type: o.type, sport_id: o.sport_id, position_ids: o.position_ids ?? [], graduation_years: o.graduation_years ?? [], deadline: o.deadline,
      start_at: o.start_at, timezone: o.timezone, city: o.city, country: o.country,
      org_name: org?.name ?? 'Organización', org_verified: org?.verification_status === 'verified',
      price_status: pricing.price.get(o.id) ?? null, costs: pricing.costs.get(o.id) ?? [],
    };
  };
  const oppById = new Map(allOpps.map((o) => [o.id, toOpp(o)]));
  const athleteById = new Map(athletes.map((a) => [a.id, a]));

  const regKey = new Set((regs ?? []).map((r) => `${r.opportunity_id}:${r.athlete_id}`));
  const registrations: AgentRegistration[] = [
    ...(regs ?? []).map((r) => ({
      id: r.id as string, kind: 'registration' as const, status: r.status as RegistrationStatus, origin: r.origin as string, needs_athlete_ok: r.needs_athlete_ok as boolean,
      guardian_status: r.guardian_status as string, athlete_update: r.athlete_update as string | null, updated_at: r.updated_at as string,
      athlete: athleteById.get(r.athlete_id as string) ?? null, opp: oppById.get(r.opportunity_id as string) ?? null,
    })),
    ...(invs ?? []).filter((i) => !regKey.has(`${i.opportunity_id}:${i.athlete_id}`)).map((i) => ({
      id: i.id as string, kind: 'invitation' as const, status: i.status as InvitationStatus, origin: 'club_invite', needs_athlete_ok: false, guardian_status: 'not_required',
      athlete_update: null, updated_at: i.updated_at as string, athlete: athleteById.get(i.athlete_id as string) ?? null, opp: oppById.get(i.opportunity_id as string) ?? null,
    })),
  ];

  // Solo se sugieren trials de organizaciones verificadas (las únicas que aceptan inscripciones) y que no han empezado.
  const now = Date.now();
  const suggestions = (opps ?? []).map((o) => toOpp(o as OppRow))
    .filter((o) => o.org_verified && (!o.start_at || new Date(o.start_at).getTime() >= now))
    .map((opp) => ({ opp, fits: athletes.map((a) => ({ athlete: a, fit: trialFit(a, opp), registered: regKey.has(`${opp.id}:${a.id}`) })).filter((x) => x.fit.ok) }))
    .filter((s) => s.fits.length > 0);

  return { agencies, athletes, registrations, suggestions };
}
