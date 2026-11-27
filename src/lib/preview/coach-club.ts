import type { CompareInput } from '@/lib/domain/recruit-search';
import type { PublicOppRow, PublicOrg } from '@/lib/data/public-seo';

/** Datos FICTICIOS para /preview (probador de interfaz, nunca en producción): buscador, comparar y organización pública. */
export const previewCompare: CompareInput[] = [
  {
    user_id: '00000000-0000-4000-8000-00000000c001', display_name: 'Lucía M. (ficticia)', position: 'Base', graduation_year: 2025, height: '1,78 m',
    country: 'ES', competitive_level: 'Liga Femenina 2', has_video: true, video_url: 'https://example.com/highlight-lucia',
    academics: { gpa: 8.4, gpa_scale: 10, grade_display: '8,4/10', gpa_source: 'document_verified', english_test: 'toefl', english_score: '96' },
    english_level: 'c1', stats: [{ label: 'Puntos por partido', value: 14.2, unit: null, source: 'club_verified' }], verified: true,
  },
  {
    user_id: '00000000-0000-4000-8000-00000000c002', display_name: 'Marta R. (ficticia)', position: 'Escolta', graduation_year: 2027, height: null,
    country: 'FR', competitive_level: null, has_video: false, video_url: null,
    academics: null, english_level: 'b2', stats: null, verified: false,
  },
];

export const previewOrg: PublicOrg = {
  id: '00000000-0000-4000-8000-00000000o001', name: 'Demo State University (ficticia)', type: 'university', website: 'https://example.edu',
  country: 'US', city: 'Springfield', state: 'IL', division: 'ncaa_d2', conference: 'Great Lakes Valley Conference',
  description: 'Universidad pública de ejemplo con 12 programas deportivos. Texto ficticio para el probador.',
  international_support: 'Oficina internacional con ayuda para el visado F-1 y el Eligibility Center.', sport_ids: ['basketball', 'soccer'],
  logo_url: null, verified_at: '2026-10-01T10:00:00Z', sports: ['Baloncesto', 'Fútbol'],
};
export const previewOrgOpps: PublicOppRow[] = [
  { id: '00000000-0000-4000-8000-00000000p001', title: 'Beca de baloncesto femenino 2027', type: 'athletic_scholarship', sport_id: 'basketball', deadline: '2027-03-01', location: 'Springfield, IL', updated_at: null, organization_id: previewOrg.id },
];
