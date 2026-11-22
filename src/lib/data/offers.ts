import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { assessOpportunity, decisionMemo, redFlags, type RedFlag, type TrustLevel } from '@/lib/domain/trust';

export interface OfferView {
  key: string;
  id: string;
  source: 'platform' | 'external';
  title: string;
  orgName: string;
  costUsd: number | null;
  aidUsd: number | null;
  netUsd: number | null;
  deadline: string | null;
  status: string | null;
  trust: TrustLevel | null;
  flags: RedFlag[];
  missing: string[];
  renewable: 'yes' | 'no' | 'unknown' | null;
}

const ORDER = ['accepted', 'offer', 'shortlist', 'tryout', 'interview', 'information_requested', 'contacted', 'reviewed', 'applied'];

/** Ofertas comparables de un atleta: candidaturas en la plataforma + ofertas recibidas por otras vías. */
export async function loadOffers(athleteId: string): Promise<OfferView[]> {
  const supabase = await createClient();
  const [{ data: apps }, { data: ext }] = await Promise.all([
    supabase.from('applications')
      .select('id, status, opportunities(id, title, description, deadline, annual_cost_usd, aid_amount_usd, financial_source, is_reviewed, updated_at, status, organizations(name, verification_status, website, type))')
      .eq('athlete_id', athleteId).not('status', 'in', '(withdrawn,declined)'),
    supabase.from('athlete_offers').select('id, university_name, annual_cost_usd, aid_amount_usd, renewable, in_writing, deadline, source_text').eq('athlete_id', athleteId).order('created_at'),
  ]);

  const platform: OfferView[] = (apps ?? []).flatMap((a) => {
    const o = a.opportunities as unknown as (Parameters<typeof assessOpportunity>[0] & { id: string; title: string; organizations: { name: string; verification_status: string; website: string | null; type: string } | null }) | null;
    if (!o) return [];
    const assessed = assessOpportunity(o);
    const net = o.annual_cost_usd != null && o.aid_amount_usd != null ? o.annual_cost_usd - o.aid_amount_usd : null;
    const missing: string[] = [];
    if (o.financial_source !== 'platform_verified') missing.push('pide la oferta por escrito con el desglose del coste y de la ayuda.');
    return [{
      key: `app:${a.id}`, id: a.id, source: 'platform' as const, title: o.title, orgName: o.organizations?.name ?? 'Organización',
      costUsd: o.annual_cost_usd, aidUsd: o.aid_amount_usd, netUsd: net, deadline: o.deadline, status: a.status as string,
      trust: assessed.level, flags: assessed.flags, missing, renewable: null,
    }];
  }).sort((x, y) => ORDER.indexOf(x.status ?? '') - ORDER.indexOf(y.status ?? ''));

  const external: OfferView[] = (ext ?? []).map((e) => {
    const flags = redFlags({
      description: e.source_text ?? '', deadline: e.deadline, aidUsd: e.aid_amount_usd, costUsd: e.annual_cost_usd,
      financialSource: e.in_writing ? 'organization_provided' : null, orgVerified: true,
    }).map((f) => f);
    // Fuera de la plataforma no podemos verificar a quien envía: aviso de atención, no grave.
    flags.unshift({ code: 'external', severity: 'medium', text: 'Recibida fuera de la plataforma: comprueba que el email llega de un dominio .edu de la universidad.' });
    if (!e.in_writing) flags.push({ code: 'not_written', severity: 'medium', text: 'No la tienes por escrito: una ayuda solo cuenta cuando figura en la oferta firmada.' });
    const missing: string[] = [];
    if (e.renewable !== 'yes') missing.push('¿la beca se renueva los 4 años y con qué condiciones (nota, rendimiento)?');
    return {
      key: `ext:${e.id}`, id: e.id, source: 'external' as const, title: e.university_name, orgName: e.university_name,
      costUsd: e.annual_cost_usd, aidUsd: e.aid_amount_usd,
      netUsd: e.annual_cost_usd != null && e.aid_amount_usd != null ? e.annual_cost_usd - e.aid_amount_usd : null,
      deadline: e.deadline, status: null, trust: null, flags, missing, renewable: e.renewable as OfferView['renewable'],
    };
  });

  return [...platform, ...external];
}

export function memoFor(offers: OfferView[]) {
  return decisionMemo(offers.map((o) => ({ title: o.title, orgName: o.orgName, netCostUsd: o.netUsd, matchScore: o.trust, deadline: o.deadline, flags: o.flags, missing: o.missing })));
}
