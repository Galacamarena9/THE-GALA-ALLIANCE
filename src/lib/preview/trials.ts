import type { TrialSummary } from '@/components/trials/TrialsBoard';
import type { FamilyTrialItem } from '@/components/trials/FamilyTrialCenter';
import type { PanelRegistration } from '@/components/trials/TrialPanel';
import type { CostComponent } from '@/lib/domain/trials';
import type { PanelEnrollment, ProgramDetails } from '@/components/trials/ProgramPanel';

/** Datos FICTICIOS solo para el probador interno (ENABLE_PREVIEW=1). Nunca se usan en producción. */
const inDays = (d: number, h = 10) => { const x = new Date(Date.now() + d * 86400000); x.setUTCHours(h - 1, 0, 0, 0); return x.toISOString(); };

export const previewTrials: TrialSummary[] = [
  { id: '00000000-0000-0000-0000-0000000000t1', title: 'Trial U18 bases (ejemplo)', type: 'tryout', status: 'published', start_at: inDays(3), timezone: 'Europe/Madrid', place: 'Pabellón Ficticio · Madrid', confirmed: 14, pending: 3, waitlist: 2, missingDocs: 2, toReview: 5 },
  { id: '00000000-0000-0000-0000-0000000000t2', title: 'Campus de verano (ejemplo)', type: 'camp_showcase', status: 'draft', start_at: inDays(40), timezone: 'Europe/Madrid', place: 'Valencia', confirmed: 0, pending: 0, waitlist: 0, missingDocs: 0, toReview: 0 },
];

const reg = (id: string, name: string, status: PanelRegistration['status'], extra: Partial<PanelRegistration> = {}): PanelRegistration => ({
  id, athlete_id: id, status, origin: 'application', needs_athlete_ok: false, guardian_status: 'not_required', name,
  athlete_update: null, attendance: null, check_in_at: null, outcome: null, materials_status: 'complete', ...extra,
});
const costs: CostComponent[] = [
  { id: 'c1', component_type: 'registration', label: 'Inscripción', amount: 150, currency: 'EUR', required: true, included: false, period: 'one_off', notes: null, sort: 1 },
  { id: 'c2', component_type: 'accommodation', label: 'Alojamiento', amount: 80, currency: 'EUR', required: false, included: false, period: 'one_off', notes: null, sort: 2 },
  { id: 'c3', component_type: 'meals', label: 'Comidas', amount: null, currency: null, required: true, included: true, period: 'one_off', notes: null, sort: 3 },
  { id: 'c4', component_type: 'transport', label: 'Viaje', amount: null, currency: null, required: false, included: false, period: 'one_off', notes: null, sort: 4 },
] as unknown as CostComponent[];

export const previewTrialPanel = {
  opportunityId: '00000000-0000-0000-0000-0000000000t1', open: true, confirmed: 2,
  details: { registration_mode: 'application_required' as const, capacity: 20, price_status: 'paid' as const, refundable: 'partial', refund_policy: 'Reembolso del 50 % hasta 7 días antes.', accommodation: 'optional', meals: 'included', travel: 'not_included', minor_policy: 'guardian_required', equipment_requirements: 'Zapatillas y ropa de entrenamiento', video_requirements: null, additional_conditions: null },
  core: { start_at: inDays(3), end_at: inDays(3, 14), timezone: 'Europe/Madrid', city: 'Madrid', region: null, country: 'ES', venue_name: 'Pabellón Ficticio', age_category: 'U18' },
  costs,
  requirements: [{ kind: 'age', strength: 'required' as const, label: 'Edad', params: { min: 16, max: 18 } }],
  materials: [{ material: 'highlight_video', label: null, required: true, sensitivity: 'normal' }],
  registrations: [
    reg('00000000-0000-0000-0000-0000000000r1', 'Lucía M. (ficticia)', 'confirmed', { guardian_status: 'approved' }),
    reg('00000000-0000-0000-0000-0000000000r2', 'Ana P. (ficticia)', 'registered', { materials_status: 'pending' }),
    reg('00000000-0000-0000-0000-0000000000r3', 'Sara G. (ficticia)', 'waitlisted'),
    reg('00000000-0000-0000-0000-0000000000r4', 'Marta R. (ficticia)', 'confirmed', { attendance: 'attended', check_in_at: inDays(0, 9) }),
  ],
  invitations: [],
  applications: [
    { id: '00000000-0000-0000-0000-0000000000a1', athlete_id: 'x1', status: 'applied', name: 'Elena F. (ficticia)', guardian_consent_status: 'pending', materials_complete: false },
    { id: '00000000-0000-0000-0000-0000000000a2', athlete_id: 'x2', status: 'applied', name: 'Irene C. (ficticia)', guardian_consent_status: 'granted', materials_complete: true },
  ],
};

export const previewFamilyTrials: FamilyTrialItem[] = [
  { key: 'i1', kind: 'invitation', opportunityId: '00000000-0000-0000-0000-0000000000t1', title: 'Trial U18 bases (ejemplo)', org: 'Club Ficticio', orgVerified: true, athleteName: 'Lucía', startAt: inDays(12), timezone: 'Europe/Madrid', city: 'Madrid', status: 'interested', familyAction: true },
  { key: 'r1', kind: 'registration', opportunityId: '00000000-0000-0000-0000-0000000000t2', title: 'Campus de verano (ejemplo)', org: 'Academia Ficticia', orgVerified: true, athleteName: 'Lucía', startAt: inDays(30), timezone: 'Europe/Madrid', city: 'Valencia', status: 'confirmed', familyAction: false, materials: 'complete' },
];

/** Programa de academia FICTICIO (11E): cuota 8.000 € + alojamiento 4.500 € + matrícula 250 €, comidas incluidas, viaje sin dato. */
export const previewProgram = {
  opportunityId: '00000000-0000-0000-0000-0000000000p1',
  details: { program_kind: 'full_time_academy', calendar_type: 'fixed_term', competition_level: 'Liga junior nacional', training_sessions_per_week: 8, residential: 'residential', accommodation: 'available_paid', meals: 'included', education_support: 'yes', language_support: ['es', 'en'], capacity: 24, price_status: 'paid' as const, financial_aid: 'available', minor_policy: 'guardian_required', requirements_note: null } satisfies ProgramDetails,
  core: { start_at: '2027-09-01T08:00:00Z', end_at: '2028-06-15T08:00:00Z', timezone: 'Europe/Madrid', city: 'Madrid', region: null, country: 'ES', venue_name: 'Academia Ficticia', age_category: 'U18' },
  costs: [
    { component_type: 'program_fee', label: 'Cuota del programa', amount: 8000, currency: 'EUR', required: true, included: false, period: 'per_season' },
    { component_type: 'accommodation', label: 'Alojamiento', amount: 4500, currency: 'EUR', required: true, included: false, period: 'per_season' },
    { component_type: 'registration', label: 'Matrícula', amount: 250, currency: 'EUR', required: true, included: false, period: 'one_off' },
    { component_type: 'meals', label: 'Comidas', amount: null, currency: null, required: true, included: true, period: 'per_season' },
  ] as unknown as CostComponent[],
  requirements: [{ kind: 'age', strength: 'required' as const, label: 'Edad 16–18', params: { min: 16, max: 18 } }],
  materials: [{ material: 'highlight_video', label: null, required: true, sensitivity: 'normal' }],
  enrollments: [{ id: '00000000-0000-0000-0000-0000000000e1', athlete_id: '00000000-0000-0000-0000-00000000a001', status: 'offered', guardian_status: 'pending', name: 'Lucía (ficticia)', aid_amount: null, aid_currency: null, starts_on: null, ends_on: null }] as PanelEnrollment[],
};
