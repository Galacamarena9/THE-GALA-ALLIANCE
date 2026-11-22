// Datos FICTICIOS solo para el probador interno (ENABLE_PREVIEW=1). Nunca se muestran en pantallas reales.
// Pasan por la MISMA proyección que producción (scoreOpportunity → projectCard → sortCards).
import {
  projectCard, scoreOpportunity, sortCards, type AthleteBase, type DiscoveryCard, type DiscoveryOpportunity,
} from '@/lib/domain/opportunity-discovery';

/** Valores «protegidos» de la atleta ficticia: las pruebas comprueban que nunca llegan al navegador. */
export const PREVIEW_PROTECTED = { budget: 77777, gpa: '8.7' };

const base: AthleteBase = {
  country: 'ES',
  ctx: {
    sport_id: 'basketball', primary_position_id: 1, secondary_position_id: 2, graduation_year: 2027,
    pathways: ['ncaa_d1', 'ncaa_d2'], countries: ['US'], regions: [], intended_majors: [], school_size: null, sport_level: 'competitive',
    campus_setting: null, scholarship_need: 'partial', annual_budget_usd: PREVIEW_PROTECTED.budget, gpa: 8.7, gpa_scale: 10, education_system: 'es',
    has_english_certificate: true, has_highlight: true, has_full_game: false, verified_stats: 1,
  },
};

const org = (name: string, verified = true) => ({ name, verified, institutionId: null });
const O = (o: Partial<DiscoveryOpportunity> & Pick<DiscoveryOpportunity, 'id' | 'title' | 'organization'>): DiscoveryOpportunity => ({
  type: 'athletic_scholarship', sport_id: 'basketball', position_ids: [], graduation_years: [2027], division: 'ncaa_d2', min_gpa_4: null, english_required: null,
  deadline: null, annual_cost_usd: null, aid_amount_usd: null, aid_kind: 'unknown', financial_source: null, international_eligible: 'yes', country: 'US', location: null,
  published_at: '2026-11-20T09:00:00Z', ...o,
});

const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export function previewDiscoveryOpportunities(): DiscoveryOpportunity[] {
  return [
    O({ id: '00000000-0000-4000-8000-0000000000a1', title: 'Beca parcial · base o escolta (ejemplo)', organization: org('Universidad Ficticia del Lago'), position_ids: [1, 2], deadline: day(40), aid_kind: 'partial', aid_amount_usd: 22000, financial_source: 'organization_provided', english_required: 'TOEFL 79' }),
    O({ id: '00000000-0000-4000-8000-0000000000a2', title: 'Recruiting femenino 2027 (ejemplo)', type: 'university_recruitment', organization: org('College Ficticio de Ohio'), division: 'ncaa_d1', deadline: day(10), international_eligible: 'conditional', min_gpa_4: 3.0, aid_kind: 'full' }),
    O({ id: '00000000-0000-4000-8000-0000000000a3', title: 'Plaza solo nacional (ejemplo)', organization: org('Universidad Ficticia Estatal'), international_eligible: 'no', deadline: day(25), aid_kind: 'full' }),
    O({ id: '00000000-0000-4000-8000-0000000000a4', title: 'Prueba de verano · academia (ejemplo)', type: 'tryout', organization: org('Academia de Ejemplo', false), country: 'ES', division: null, graduation_years: [], deadline: day(70) }),
    O({ id: '00000000-0000-4000-8000-0000000000a5', title: 'Promoción 2029 (ejemplo)', organization: org('Universidad Ficticia del Norte'), graduation_years: [2029], aid_kind: 'partial', deadline: day(90) }),
  ];
}

export function previewDiscoveryCards(): DiscoveryCard[] {
  const today = new Date().toISOString().slice(0, 10);
  const rows = previewDiscoveryOpportunities().map((o) => {
    const m = scoreOpportunity(base, o, null);
    return { m, card: projectCard(o, m, { today, lastSeenAt: '2026-11-15T00:00:00Z' }) };
  });
  return sortCards(rows).map((r) => r.card);
}

export const previewDiscoveryRoster = [
  { id: '00000000-0000-4000-8000-00000000b001', name: 'Lucía Martínez', sub: 'Baloncesto · Promoción 2027' },
  { id: '00000000-0000-4000-8000-00000000b002', name: 'Pablo Gil', sub: 'Fútbol · Promoción 2028' },
];
