import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { loadPortfolio } from '@/lib/data/portfolio';
import type { MyOrg } from '@/lib/data/orgs';
import type { AgencyRole } from '@/lib/domain/agency-cases';

export interface CaseRow {
  id: string; agencyId: string; athleteId: string; athleteName: string; institutionName: string;
  sportId: string | null; cycle: string; stage: string; ownerId: string | null; ownerName: string | null;
  contactId: string | null; nextAction: string | null; nextActionDue: string | null;
  sharedWithAthlete: boolean; outcomeReason: string | null; updatedAt: string; createdAt: string;
}
export interface ContactRow {
  id: string; agencyId: string; institutionName: string; sportId: string | null; name: string;
  roleTitle: string | null; email: string | null; phone: string | null; notes: string | null; createdAt: string;
}
export interface MemberRow { userId: string; name: string; agencyRole: AgencyRole | null }

export interface AgencyCasesData {
  agencies: MyOrg[];
  myRole: Map<string, AgencyRole | null>;
  members: Map<string, MemberRow[]>;
  athletes: { id: string; name: string; agencyId: string; sportId: string | null }[];
  cases: CaseRow[];
  contacts: ContactRow[];
}

type RawCase = {
  id: string; agency_id: string; athlete_id: string; institution_name: string; sport_id: string | null; cycle: string;
  stage: string; owner_id: string | null; contact_id: string | null; next_action: string | null; next_action_due: string | null;
  shared_with_athlete: boolean; outcome_reason: string | null; updated_at: string; created_at: string;
};
export const CASE_COLUMNS = 'id, agency_id, athlete_id, institution_name, sport_id, cycle, stage, owner_id, contact_id, next_action, next_action_due, shared_with_athlete, outcome_reason, updated_at, created_at';

export function mapCase(r: RawCase, names: Map<string, string>): CaseRow {
  return {
    id: r.id, agencyId: r.agency_id, athleteId: r.athlete_id, athleteName: names.get(r.athlete_id) ?? 'Atleta',
    institutionName: r.institution_name, sportId: r.sport_id, cycle: r.cycle, stage: r.stage, ownerId: r.owner_id,
    ownerName: r.owner_id ? names.get(r.owner_id) ?? null : null, contactId: r.contact_id, nextAction: r.next_action,
    nextActionDue: r.next_action_due, sharedWithAthlete: r.shared_with_athlete, outcomeReason: r.outcome_reason,
    updatedAt: r.updated_at, createdAt: r.created_at,
  };
}

/**
 * Procesos, contactos y equipo de las agencias del usuario. La RLS limita todo a sus agencias.
 * Los atletas elegibles para abrir procesos son los que tienen representación ACTIVA.
 */
export const loadAgencyCases = cache(async (userId: string): Promise<AgencyCasesData> => {
  const supabase = await createClient();
  const { agencies, entries } = await loadPortfolio(userId);
  const ids = agencies.map((a) => a.id);
  const empty: AgencyCasesData = { agencies, myRole: new Map(), members: new Map(), athletes: [], cases: [], contacts: [] };
  if (!ids.length) return empty;

  const [{ data: cases }, { data: contacts }, { data: memberRows }] = await Promise.all([
    supabase.from('recruiting_cases').select(CASE_COLUMNS).in('agency_id', ids).order('updated_at', { ascending: false }).limit(2000),
    supabase.from('agency_contacts').select('id, agency_id, institution_name, sport_id, name, role_title, email, phone, notes, created_at')
      .in('agency_id', ids).order('institution_name').limit(2000),
    supabase.from('organization_members').select('organization_id, user_id, agency_role').in('organization_id', ids),
  ]);

  const mRows = (memberRows ?? []) as { organization_id: string; user_id: string; agency_role: AgencyRole | null }[];
  const { data: profiles } = mRows.length
    ? await supabase.from('profiles').select('id, display_name').in('id', [...new Set(mRows.map((m) => m.user_id))])
    : { data: [] };
  const names = new Map<string, string>();
  for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) names.set(p.id, p.display_name ?? 'Miembro');
  for (const e of entries) names.set(e.athleteId, e.name);

  const members = new Map<string, MemberRow[]>();
  const myRole = new Map<string, AgencyRole | null>();
  for (const m of mRows) {
    const list = members.get(m.organization_id) ?? [];
    list.push({ userId: m.user_id, name: names.get(m.user_id) ?? 'Miembro', agencyRole: m.agency_role });
    members.set(m.organization_id, list);
    if (m.user_id === userId) myRole.set(m.organization_id, m.agency_role);
  }

  return {
    agencies, myRole, members,
    athletes: entries.filter((e) => e.status === 'active').map((e) => ({ id: e.athleteId, name: e.name, agencyId: e.agencyId, sportId: e.sportId })),
    cases: ((cases ?? []) as RawCase[]).map((r) => mapCase(r, names)),
    contacts: ((contacts ?? []) as {
      id: string; agency_id: string; institution_name: string; sport_id: string | null; name: string; role_title: string | null;
      email: string | null; phone: string | null; notes: string | null; created_at: string;
    }[]).map((c) => ({
      id: c.id, agencyId: c.agency_id, institutionName: c.institution_name, sportId: c.sport_id, name: c.name,
      roleTitle: c.role_title, email: c.email, phone: c.phone, notes: c.notes, createdAt: c.created_at,
    })),
  };
});
