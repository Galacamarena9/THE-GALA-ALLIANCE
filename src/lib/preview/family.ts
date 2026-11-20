// Datos FICTICIOS solo para /preview (ENABLE_PREVIEW). Nunca se muestran en pantallas reales.
import type { FamilyChildHome, GuardianLink } from '@/lib/data/family-home';
import type { ScenarioRow } from '@/components/family/CostComparison';

const scopes = { profile: true, applications: true, academics: true, edit: false, costs: true, documents: true, contacts: true, messages: false };
export const previewFamilyLinks: GuardianLink[] = [
  { id: 'l1', athleteId: '00000000-0000-0000-0000-00000000f001', name: 'Lucía', relationship: 'mother', verification: 'athlete_confirmed', status: 'approved', active: true, scopes },
  { id: 'l2', athleteId: '00000000-0000-0000-0000-00000000f002', name: 'Carlos', relationship: 'mother', verification: 'athlete_confirmed', status: 'approved', active: true, scopes: { ...scopes, costs: false } },
];

export const previewFamilyToday = '2026-11-20';
export const previewFamilyChild: FamilyChildHome = {
  approvals: [{ kind: 'document', athleteName: 'Lucía', what: 'Universidad Ficticia del Norte pide el expediente académico', href: '/app/requests' }],
  deadlines: [
    { date: '2026-11-25', label: 'Plazo: Beca de baloncesto 2027', athleteName: 'Lucía', kind: 'official', href: '#' },
    { date: '2026-12-05', label: 'Revisión financiera en familia', athleteName: 'Lucía', kind: 'personal', href: '#' },
  ],
  offers: [],
  process: { saved: 7, applications: 2, offers: 0 },
  scenarios: { total: 2, incomplete: 1 },
  missingDocuments: 2,
  pendingDocRequests: 1,
  contacts: [
    { id: 'c1', org: 'Universidad Ficticia del Norte', orgVerified: true, status: 'accepted', createdAt: '2026-11-14T10:00:00Z' },
    { id: 'c2', org: 'Club Inventado', orgVerified: false, status: 'pending_guardian', createdAt: '2026-11-18T10:00:00Z' },
  ],
  notes: [{ id: 'n1', body: 'Preguntar cuánto cuesta de verdad el alojamiento.', visibility: 'guardians', mine: true, author: 'Marta', createdAt: '2026-11-15T10:00:00Z' }],
};

export const previewScenarios: ScenarioRow[] = [
  { id: 's1', label: 'Universidad A', currency: 'USD', tuition: 30000, fees: 1200, housing: 11000, meals: 5000, insurance: null, travel: null, other_costs: null,
    athletic_aid: 18000, academic_aid: 5000, other_aid: null, housing_included: false, source_note: 'Web oficial y carta de oferta' },
  { id: 's2', label: 'Universidad B', currency: 'USD', tuition: 27000, fees: null, housing: null, meals: null, insurance: null, travel: null, other_costs: null,
    athletic_aid: 12000, academic_aid: null, other_aid: null, housing_included: null, source_note: 'Web oficial' },
];
