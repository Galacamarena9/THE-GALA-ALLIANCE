// Tipos de dominio alineados con supabase/migrations. Cuando el proyecto Supabase
// exista, se pueden sustituir por los generados con `supabase gen types typescript`.

export type AppRole = 'athlete' | 'parent' | 'university' | 'coach' | 'agent' | 'brand' | 'admin';
export type Visibility = 'public' | 'members' | 'connections' | 'private';
export type Division = 'ncaa_d1' | 'ncaa_d2' | 'ncaa_d3' | 'naia' | 'njcaa';
export type OrgType = 'university' | 'college' | 'club' | 'academy' | 'agency' | 'brand';
export type VerificationStatus = 'unverified' | 'submitted' | 'verified' | 'rejected';
export type OpportunityType =
  | 'athletic_scholarship'
  | 'university_recruitment'
  | 'club_recruitment'
  | 'academy'
  | 'tryout'
  | 'camp_showcase';
export type OpportunityStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'expired';
export type ApplicationStatus =
  | 'applied'
  | 'reviewed'
  | 'contacted'
  | 'information_requested'
  | 'interview'
  | 'tryout'
  | 'shortlist'
  | 'offer'
  | 'accepted'
  | 'declined'
  | 'withdrawn';

export interface AthleteProfile {
  user_id: string;
  headline: string | null;
  bio: string | null;
  sport_id: string | null;
  primary_position_id: number | null;
  secondary_position_id: number | null;
  graduation_year: number | null;
  height_cm: number | null;
  dominant_side: 'left' | 'right' | 'both' | null;
  current_team: string | null;
  competitive_level: string | null;
  city: string | null;
  target_divisions: Division[];
  intended_major: string | null;
  open_to_opportunities: boolean;
  highlight_video_url: string | null;
  profile_visibility: Visibility;
  academics_visibility: Visibility;
  stats_visibility: Visibility;
  updated_at: string;
}

export interface AthleteAcademics {
  athlete_id: string;
  gpa: number | null;
  gpa_scale: number;
  english_test: 'toefl' | 'ielts' | 'duolingo' | 'cambridge' | 'none' | null;
  english_score: string | null;
  sat_score: number | null;
  act_score: number | null;
  school_year: 'eso_3' | 'eso_4' | 'bach_1' | 'bach_2' | 'graduated' | 'college' | null;
}

export interface Opportunity {
  id: string;
  organization_id: string;
  type: OpportunityType;
  title: string;
  description: string;
  sport_id: string;
  position_ids: number[];
  graduation_years: number[];
  division: Division | null;
  min_gpa_4: number | null;
  english_required: string | null;
  location: string | null;
  start_term: string | null;
  deadline: string | null;
  places: number | null;
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  aid_kind: 'full' | 'partial' | 'unknown' | null;
  financial_source: 'organization_provided' | 'platform_verified' | 'unverified' | null;
  status: OpportunityStatus;
  review_note: string | null;
  published_at: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  country: string | null;
  city: string | null;
  website: string | null;
  division: Division | null;
  description: string | null;
  verification_status: VerificationStatus;
}

export interface SportPosition {
  id: number;
  sport_id: string;
  code: string;
  name_es: string;
}

export interface Sport {
  id: string;
  name_es: string;
}
