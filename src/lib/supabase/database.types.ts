// Generado desde el proyecto Supabase STAGING (fkbnznccsoqdniaqviev) el 22-11-2026, tras aplicar las 80 migraciones.
// No editar a mano: regenerar con el conector de Supabase o `supabase gen types typescript --linked`.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academy_attempts: {
        Row: {
          correct: number
          created_at: string
          duration_seconds: number | null
          exam: string
          id: string
          total: number
          user_id: string
        }
        Insert: {
          correct: number
          created_at?: string
          duration_seconds?: number | null
          exam: string
          id?: string
          total: number
          user_id: string
        }
        Update: {
          correct?: number
          created_at?: string
          duration_seconds?: number | null
          exam?: string
          id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_program_details: {
        Row: {
          accommodation: string
          calendar_type: string
          capacity: number | null
          competition_exposure: string | null
          competition_level: string | null
          education_support: string
          financial_aid: string
          language_support: string[]
          meals: string
          minor_policy: string
          opportunity_id: string
          price_status: string
          program_kind: string
          requirements_note: string | null
          residential: string
          training_sessions_per_week: number | null
          updated_at: string
        }
        Insert: {
          accommodation?: string
          calendar_type?: string
          capacity?: number | null
          competition_exposure?: string | null
          competition_level?: string | null
          education_support?: string
          financial_aid?: string
          language_support?: string[]
          meals?: string
          minor_policy?: string
          opportunity_id: string
          price_status?: string
          program_kind?: string
          requirements_note?: string | null
          residential?: string
          training_sessions_per_week?: number | null
          updated_at?: string
        }
        Update: {
          accommodation?: string
          calendar_type?: string
          capacity?: number | null
          competition_exposure?: string | null
          competition_level?: string | null
          education_support?: string
          financial_aid?: string
          language_support?: string[]
          meals?: string
          minor_policy?: string
          opportunity_id?: string
          price_status?: string
          program_kind?: string
          requirements_note?: string | null
          residential?: string
          training_sessions_per_week?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_program_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_progress: {
        Row: {
          completed_at: string
          exam: string
          topic_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          exam: string
          topic_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          exam?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_approvals: {
        Row: {
          action: string
          approved_by: string | null
          created_at: string
          decided_at: string | null
          expires_at: string
          id: string
          payload: Json
          reason: string
          requested_by: string
          status: string
        }
        Insert: {
          action: string
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          payload: Json
          reason: string
          requested_by: string
          status?: string
        }
        Update: {
          action?: string
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          reason?: string
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      age_categories: {
        Row: {
          code: string
          kind: string
          label: string
          max_age: number | null
          min_age: number | null
          sort: number
        }
        Insert: {
          code: string
          kind?: string
          label: string
          max_age?: number | null
          min_age?: number | null
          sort?: number
        }
        Update: {
          code?: string
          kind?: string
          label?: string
          max_age?: number | null
          min_age?: number | null
          sort?: number
        }
        Relationships: []
      }
      guardian_attestations: {
        Row: { id: string; link_id: string; parent_id: string; athlete_id: string; statement_version: string; relationship: string; created_at: string }
        Insert: { id?: string; link_id: string; parent_id: string; athlete_id: string; statement_version: string; relationship: string; created_at?: string }
        Update: { id?: string; link_id?: string; parent_id?: string; athlete_id?: string; statement_version?: string; relationship?: string; created_at?: string }
        Relationships: []
      }
      agency_trials: {
        Row: { organization_id: string; ends_at: string; extended_by: string | null; reason: string | null; updated_at: string }
        Insert: { organization_id: string; ends_at: string; extended_by?: string | null; reason?: string | null; updated_at?: string }
        Update: { organization_id?: string; ends_at?: string; extended_by?: string | null; reason?: string | null; updated_at?: string }
        Relationships: []
      }
      agency_athlete_invites: {
        Row: { id: string; agency_id: string; invited_by: string; full_name: string; email: string | null; sport: string | null; graduation_year: number | null; token_hash: string; status: string; opened_at: string | null; claimed_at: string | null; claimed_by: string | null; expires_at: string; created_at: string }
        Insert: { id?: string; agency_id?: string; invited_by?: string; full_name?: string; email?: string | null; sport?: string | null; graduation_year?: number | null; token_hash?: string; status?: string; opened_at?: string | null; claimed_at?: string | null; claimed_by?: string | null; expires_at?: string; created_at?: string }
        Update: { id?: string; agency_id?: string; invited_by?: string; full_name?: string; email?: string | null; sport?: string | null; graduation_year?: number | null; token_hash?: string; status?: string; opened_at?: string | null; claimed_at?: string | null; claimed_by?: string | null; expires_at?: string; created_at?: string }
        Relationships: []
      }
      agency_athlete_notes: {
        Row: {
          agency_id: string
          athlete_id: string
          author_id: string
          body: string
          created_at: string
          done: boolean
          done_at: string | null
          due_date: string | null
          id: string
          kind: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          athlete_id: string
          author_id: string
          body: string
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          athlete_id?: string
          author_id?: string
          body?: string
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_athlete_notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_athlete_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agency_athlete_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agency_athlete_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_contacts: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          institution_id: string | null
          institution_name: string
          name: string
          notes: string | null
          phone: string | null
          role_title: string | null
          sport_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          institution_id?: string | null
          institution_name: string
          name: string
          notes?: string | null
          phone?: string | null
          role_title?: string | null
          sport_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role_title?: string | null
          sport_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_contacts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_contacts_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_representations: {
        Row: {
          accepted_at: string | null
          activated_at: string | null
          agency_id: string
          agent_id: string
          athlete_id: string
          created_at: string
          end_date: string
          ended_at: string | null
          exclusivity_evidence: string
          guardian_approved_at: string | null
          guardian_approved_by: string | null
          id: string
          message: string | null
          opportunity_id: string | null
          representation_type: string
          responded_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          source: string
          start_date: string
          status: string
          status_reason: string | null
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          activated_at?: string | null
          agency_id: string
          agent_id: string
          athlete_id: string
          created_at?: string
          end_date: string
          ended_at?: string | null
          exclusivity_evidence?: string
          guardian_approved_at?: string | null
          guardian_approved_by?: string | null
          id?: string
          message?: string | null
          opportunity_id?: string | null
          representation_type?: string
          responded_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          start_date?: string
          status?: string
          status_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          activated_at?: string | null
          agency_id?: string
          agent_id?: string
          athlete_id?: string
          created_at?: string
          end_date?: string
          ended_at?: string | null
          exclusivity_evidence?: string
          guardian_approved_at?: string | null
          guardian_approved_by?: string | null
          id?: string
          message?: string | null
          opportunity_id?: string | null
          representation_type?: string
          responded_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          start_date?: string
          status?: string
          status_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_representations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agent_representations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agent_representations_guardian_approved_by_fkey"
            columns: ["guardian_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_events: {
        Row: {
          created_at: string
          id: string
          input_tokens: number
          intent: string
          latency_ms: number
          mode: string
          model: string | null
          outcome: string
          output_tokens: number
          page: string | null
          provider: string | null
          tool_calls: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          input_tokens?: number
          intent: string
          latency_ms?: number
          mode: string
          model?: string | null
          outcome: string
          output_tokens?: number
          page?: string | null
          provider?: string | null
          tool_calls?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number
          intent?: string
          latency_ms?: number
          mode?: string
          model?: string | null
          outcome?: string
          output_tokens?: number
          page?: string | null
          provider?: string | null
          tool_calls?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          created_at: string
          rating: number
          reason: string | null
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          rating: number
          reason?: string | null
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          rating?: number
          reason?: string | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ai_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: number
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: never
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: never
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_preferences: {
        Row: {
          answer_style: string
          language: string
          save_history: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_style?: string
          language?: string
          save_history?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_style?: string
          language?: string
          save_history?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          day: string
          minute_count: number
          minute_start: string | null
          requests: number
          user_id: string
        }
        Insert: {
          day?: string
          minute_count?: number
          minute_start?: string | null
          requests?: number
          user_id: string
        }
        Update: {
          day?: string
          minute_count?: number
          minute_start?: string | null
          requests?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          created_at: string
          id: number
          new_status: Database["public"]["Enums"]["application_status"]
          old_status: Database["public"]["Enums"]["application_status"] | null
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          created_at?: string
          id?: never
          new_status: Database["public"]["Enums"]["application_status"]
          old_status?: Database["public"]["Enums"]["application_status"] | null
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          created_at?: string
          id?: never
          new_status?: Database["public"]["Enums"]["application_status"]
          old_status?: Database["public"]["Enums"]["application_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          athlete_id: string
          athlete_message: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_message: string | null
          guardian_consent_status: string
          id: string
          invitation_id: string | null
          materials_complete: boolean | null
          opportunity_id: string
          organization_id: string
          source: string
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_message?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_message?: string | null
          guardian_consent_status?: string
          id?: string
          invitation_id?: string | null
          materials_complete?: boolean | null
          opportunity_id: string
          organization_id: string
          source?: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_message?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_message?: string | null
          guardian_consent_status?: string
          id?: string
          invitation_id?: string | null
          materials_complete?: boolean | null
          opportunity_id?: string
          organization_id?: string
          source?: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "applications_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_invitation_fk"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "opportunity_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_academics: {
        Row: {
          act_score: number | null
          athlete_id: string
          cambridge_level: string | null
          duolingo_score: number | null
          education_system: string | null
          english_score: string | null
          english_source: Database["public"]["Enums"]["data_source"]
          english_test: string | null
          gpa: number | null
          gpa_4: number | null
          gpa_scale: number
          gpa_source: Database["public"]["Enums"]["data_source"]
          grade_display: string | null
          ielts_score: number | null
          sat_score: number | null
          school_name: string | null
          school_year: string | null
          tests_source: Database["public"]["Enums"]["data_source"]
          toefl_score: number | null
          updated_at: string
        }
        Insert: {
          act_score?: number | null
          athlete_id: string
          cambridge_level?: string | null
          duolingo_score?: number | null
          education_system?: string | null
          english_score?: string | null
          english_source?: Database["public"]["Enums"]["data_source"]
          english_test?: string | null
          gpa?: number | null
          gpa_4?: number | null
          gpa_scale?: number
          gpa_source?: Database["public"]["Enums"]["data_source"]
          grade_display?: string | null
          ielts_score?: number | null
          sat_score?: number | null
          school_name?: string | null
          school_year?: string | null
          tests_source?: Database["public"]["Enums"]["data_source"]
          toefl_score?: number | null
          updated_at?: string
        }
        Update: {
          act_score?: number | null
          athlete_id?: string
          cambridge_level?: string | null
          duolingo_score?: number | null
          education_system?: string | null
          english_score?: string | null
          english_source?: Database["public"]["Enums"]["data_source"]
          english_test?: string | null
          gpa?: number | null
          gpa_4?: number | null
          gpa_scale?: number
          gpa_source?: Database["public"]["Enums"]["data_source"]
          grade_display?: string | null
          ielts_score?: number | null
          sat_score?: number | null
          school_name?: string | null
          school_year?: string | null
          tests_source?: Database["public"]["Enums"]["data_source"]
          toefl_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_academics_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_academics_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_achievements: {
        Row: {
          athlete_id: string
          created_at: string
          description: string | null
          id: string
          kind: string
          level: string | null
          source: Database["public"]["Enums"]["data_source"]
          title: string
          year: number | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          level?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          title: string
          year?: number | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          level?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_achievements_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_achievements_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_career: {
        Row: {
          athlete_id: string
          country: string | null
          created_at: string
          id: string
          league: string | null
          role: string | null
          season_from: string
          season_to: string | null
          team: string
        }
        Insert: {
          athlete_id: string
          country?: string | null
          created_at?: string
          id?: string
          league?: string | null
          role?: string | null
          season_from: string
          season_to?: string | null
          team: string
        }
        Update: {
          athlete_id?: string
          country?: string | null
          created_at?: string
          id?: string
          league?: string | null
          role?: string | null
          season_from?: string
          season_to?: string | null
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_career_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_career_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_discovery_settings: {
        Row: {
          athlete_id: string
          mode: string
          opportunity_types: Database["public"]["Enums"]["opportunity_type"][]
          organization_types: Database["public"]["Enums"]["org_type"][]
          regions: string[]
          updated_at: string
          visible_from: string | null
          visible_until: string | null
        }
        Insert: {
          athlete_id: string
          mode?: string
          opportunity_types?: Database["public"]["Enums"]["opportunity_type"][]
          organization_types?: Database["public"]["Enums"]["org_type"][]
          regions?: string[]
          updated_at?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Update: {
          athlete_id?: string
          mode?: string
          opportunity_types?: Database["public"]["Enums"]["opportunity_type"][]
          organization_types?: Database["public"]["Enums"]["org_type"][]
          regions?: string[]
          updated_at?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_discovery_settings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_discovery_settings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_documents: {
        Row: {
          athlete_id: string
          content_sha256: string | null
          created_at: string
          due_date: string | null
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          athlete_id: string
          content_sha256?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          athlete_id?: string
          content_sha256?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_finances: {
        Row: {
          annual_budget_usd: number | null
          athlete_id: string
          budget_mode: string
          updated_at: string
        }
        Insert: {
          annual_budget_usd?: number | null
          athlete_id: string
          budget_mode?: string
          updated_at?: string
        }
        Update: {
          annual_budget_usd?: number | null
          athlete_id?: string
          budget_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_finances_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_finances_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_goals: {
        Row: {
          athlete_id: string
          campus_setting: string | null
          countries: string[]
          intended_majors: string[]
          pathways: string[]
          regions: string[]
          scholarship_need: string | null
          school_size: string | null
          sport_level: string | null
          start_term: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          campus_setting?: string | null
          countries?: string[]
          intended_majors?: string[]
          pathways?: string[]
          regions?: string[]
          scholarship_need?: string | null
          school_size?: string | null
          sport_level?: string | null
          start_term?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          campus_setting?: string | null
          countries?: string[]
          intended_majors?: string[]
          pathways?: string[]
          regions?: string[]
          scholarship_need?: string | null
          school_size?: string | null
          sport_level?: string | null
          start_term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_languages: {
        Row: {
          athlete_id: string
          language_code: string
          level: string
        }
        Insert: {
          athlete_id: string
          language_code: string
          level: string
        }
        Update: {
          athlete_id?: string
          language_code?: string
          level?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_languages_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_languages_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_links: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          kind: string
          label: string | null
          url: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          url: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          url?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_links_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_links_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_links_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_offers: {
        Row: {
          aid_amount_usd: number | null
          annual_cost_usd: number | null
          athlete_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          in_writing: boolean
          institution_id: string | null
          process_id: string | null
          renewable: string
          scholarship_type: string
          source: string
          source_text: string | null
          status: string
          university_name: string
        }
        Insert: {
          aid_amount_usd?: number | null
          annual_cost_usd?: number | null
          athlete_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          in_writing?: boolean
          institution_id?: string | null
          process_id?: string | null
          renewable?: string
          scholarship_type?: string
          source?: string
          source_text?: string | null
          status?: string
          university_name: string
        }
        Update: {
          aid_amount_usd?: number | null
          annual_cost_usd?: number | null
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          in_writing?: boolean
          institution_id?: string | null
          process_id?: string | null
          renewable?: string
          scholarship_type?: string
          source?: string
          source_text?: string | null
          status?: string
          university_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_offers_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_offers_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_offers_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_offers_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          academics_visibility: Database["public"]["Enums"]["visibility_level"]
          bio: string | null
          city: string | null
          competitive_level: string | null
          created_at: string
          current_team: string | null
          dominant_side: string | null
          goals_visibility: Database["public"]["Enums"]["visibility_level"]
          graduation_year: number | null
          headline: string | null
          height_cm: number | null
          highlight_video_url: string | null
          intended_major: string | null
          league: string | null
          nationality: string | null
          open_to_opportunities: boolean
          photo_path: string | null
          primary_position_id: number | null
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          secondary_position_id: number | null
          sport_id: string | null
          sport_visibility: Database["public"]["Enums"]["visibility_level"]
          stats_visibility: Database["public"]["Enums"]["visibility_level"]
          target_divisions: Database["public"]["Enums"]["division"][]
          updated_at: string
          user_id: string
          username: string | null
          videos_visibility: Database["public"]["Enums"]["visibility_level"]
          weight_kg: number | null
          years_experience: number | null
        }
        Insert: {
          academics_visibility?: Database["public"]["Enums"]["visibility_level"]
          bio?: string | null
          city?: string | null
          competitive_level?: string | null
          created_at?: string
          current_team?: string | null
          dominant_side?: string | null
          goals_visibility?: Database["public"]["Enums"]["visibility_level"]
          graduation_year?: number | null
          headline?: string | null
          height_cm?: number | null
          highlight_video_url?: string | null
          intended_major?: string | null
          league?: string | null
          nationality?: string | null
          open_to_opportunities?: boolean
          photo_path?: string | null
          primary_position_id?: number | null
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          secondary_position_id?: number | null
          sport_id?: string | null
          sport_visibility?: Database["public"]["Enums"]["visibility_level"]
          stats_visibility?: Database["public"]["Enums"]["visibility_level"]
          target_divisions?: Database["public"]["Enums"]["division"][]
          updated_at?: string
          user_id: string
          username?: string | null
          videos_visibility?: Database["public"]["Enums"]["visibility_level"]
          weight_kg?: number | null
          years_experience?: number | null
        }
        Update: {
          academics_visibility?: Database["public"]["Enums"]["visibility_level"]
          bio?: string | null
          city?: string | null
          competitive_level?: string | null
          created_at?: string
          current_team?: string | null
          dominant_side?: string | null
          goals_visibility?: Database["public"]["Enums"]["visibility_level"]
          graduation_year?: number | null
          headline?: string | null
          height_cm?: number | null
          highlight_video_url?: string | null
          intended_major?: string | null
          league?: string | null
          nationality?: string | null
          open_to_opportunities?: boolean
          photo_path?: string | null
          primary_position_id?: number | null
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          secondary_position_id?: number | null
          sport_id?: string | null
          sport_visibility?: Database["public"]["Enums"]["visibility_level"]
          stats_visibility?: Database["public"]["Enums"]["visibility_level"]
          target_divisions?: Database["public"]["Enums"]["division"][]
          updated_at?: string
          user_id?: string
          username?: string | null
          videos_visibility?: Database["public"]["Enums"]["visibility_level"]
          weight_kg?: number | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_primary_position_id_fkey"
            columns: ["primary_position_id"]
            isOneToOne: false
            referencedRelation: "sport_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_profiles_secondary_position_id_fkey"
            columns: ["secondary_position_id"]
            isOneToOne: false
            referencedRelation: "sport_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_profiles_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_statistics: {
        Row: {
          athlete_id: string
          competition: string
          created_at: string
          id: string
          season: string
          source: Database["public"]["Enums"]["data_source"]
          source_url: string | null
          stat_definition_id: number
          team: string
          value: number
          verified_by_org: string | null
        }
        Insert: {
          athlete_id: string
          competition?: string
          created_at?: string
          id?: string
          season: string
          source?: Database["public"]["Enums"]["data_source"]
          source_url?: string | null
          stat_definition_id: number
          team?: string
          value: number
          verified_by_org?: string | null
        }
        Update: {
          athlete_id?: string
          competition?: string
          created_at?: string
          id?: string
          season?: string
          source?: Database["public"]["Enums"]["data_source"]
          source_url?: string | null
          stat_definition_id?: number
          team?: string
          value?: number
          verified_by_org?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_statistics_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_statistics_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_statistics_stat_definition_id_fkey"
            columns: ["stat_definition_id"]
            isOneToOne: false
            referencedRelation: "sport_stat_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_statistics_verified_by_org_fkey"
            columns: ["verified_by_org"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_task_state: {
        Row: {
          athlete_id: string
          snoozed_until: string | null
          status: string
          task_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          athlete_id: string
          snoozed_until?: string | null
          status: string
          task_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          athlete_id?: string
          snoozed_until?: string | null
          status?: string
          task_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_task_state_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_task_state_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_task_state_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_updates: {
        Row: {
          athlete_id: string
          body: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          link_url: string | null
        }
        Insert: {
          athlete_id: string
          body: string
          created_at?: string
          expires_at?: string
          id?: string
          kind: string
          link_url?: string | null
        }
        Update: {
          athlete_id?: string
          body?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_updates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_updates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_videos: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          is_featured: boolean
          kind: string
          season: string | null
          title: string | null
          url: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          is_featured?: boolean
          kind: string
          season?: string | null
          title?: string | null
          url: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          kind?: string
          season?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_videos_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "athlete_videos_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          classification: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
          organization_id: string | null
          program_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          classification?: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
          organization_id?: string | null
          program_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          classification?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          organization_id?: string | null
          program_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          billing_email: string | null
          country: string | null
          created_at: string
          id: string
          organization_id: string | null
          stripe_customer_id: string | null
          tax_id: string | null
          user_id: string | null
        }
        Insert: {
          billing_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          stripe_customer_id?: string | null
          tax_id?: string | null
          user_id?: string | null
        }
        Update: {
          billing_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          stripe_customer_id?: string | null
          tax_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_ledger: {
        Row: {
          amount_cents: number
          billing_account_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          kind: string
          occurred_at: string
          stripe_object_id: string
        }
        Insert: {
          amount_cents: number
          billing_account_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          kind: string
          occurred_at: string
          stripe_object_id: string
        }
        Update: {
          amount_cents?: number
          billing_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          stripe_object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_ledger_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_application_notes: {
        Row: {
          application_id: string
          author_id: string
          body: string
          brand_org_id: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id: string
          body: string
          brand_org_id: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          body?: string
          brand_org_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_application_notes_brand_org_id_fkey"
            columns: ["brand_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaigns: {
        Row: {
          application_deadline: string | null
          brand_org_id: string
          compensation_kind: string
          compensation_usd: number | null
          created_at: string
          created_by: string | null
          deliverables: string
          description: string
          exclusivity_category: string | null
          exclusivity_days: number | null
          id: string
          kind: string
          min_age: number
          paid_media: boolean
          product_description: string | null
          product_value_usd: number | null
          published_at: string | null
          review_note: string | null
          sport_ids: string[]
          status: string
          territory: string | null
          title: string
          updated_at: string
          usage_channels: string[]
          usage_months: number | null
          usage_rights: string | null
        }
        Insert: {
          application_deadline?: string | null
          brand_org_id: string
          compensation_kind: string
          compensation_usd?: number | null
          created_at?: string
          created_by?: string | null
          deliverables: string
          description: string
          exclusivity_category?: string | null
          exclusivity_days?: number | null
          id?: string
          kind: string
          min_age?: number
          paid_media?: boolean
          product_description?: string | null
          product_value_usd?: number | null
          published_at?: string | null
          review_note?: string | null
          sport_ids?: string[]
          status?: string
          territory?: string | null
          title: string
          updated_at?: string
          usage_channels?: string[]
          usage_months?: number | null
          usage_rights?: string | null
        }
        Update: {
          application_deadline?: string | null
          brand_org_id?: string
          compensation_kind?: string
          compensation_usd?: number | null
          created_at?: string
          created_by?: string | null
          deliverables?: string
          description?: string
          exclusivity_category?: string | null
          exclusivity_days?: number | null
          id?: string
          kind?: string
          min_age?: number
          paid_media?: boolean
          product_description?: string | null
          product_value_usd?: number | null
          published_at?: string | null
          review_note?: string | null
          sport_ids?: string[]
          status?: string
          territory?: string | null
          title?: string
          updated_at?: string
          usage_channels?: string[]
          usage_months?: number | null
          usage_rights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaigns_brand_org_id_fkey"
            columns: ["brand_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      break_glass_grants: {
        Row: {
          admin_id: string
          case_id: string | null
          created_at: string
          expires_at: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          subject_user: string
        }
        Insert: {
          admin_id: string
          case_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject_user: string
        }
        Update: {
          admin_id?: string
          case_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          subject_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_glass_grants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "safety_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_applications: {
        Row: {
          athlete_id: string
          campaign_id: string
          created_at: string
          id: string
          message: string | null
          rules_acknowledged: boolean
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          campaign_id: string
          created_at?: string
          id?: string
          message?: string | null
          rules_acknowledged?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          message?: string | null
          rules_acknowledged?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_applications_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "campaign_applications_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "campaign_applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliverable_submissions: {
        Row: {
          athlete_id: string
          deliverable_id: string
          id: string
          note: string | null
          submitted_at: string
          url: string
          version: number
        }
        Insert: {
          athlete_id: string
          deliverable_id: string
          id?: string
          note?: string | null
          submitted_at?: string
          url: string
          version: number
        }
        Update: {
          athlete_id?: string
          deliverable_id?: string
          id?: string
          note?: string | null
          submitted_at?: string
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliverable_submissions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "campaign_deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliverables: {
        Row: {
          approval_required: boolean
          created_at: string
          description: string
          due_date: string | null
          feedback: string | null
          id: string
          kind: string
          offer_id: string
          platform: string | null
          quantity: number
          reviewed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approval_required?: boolean
          created_at?: string
          description: string
          due_date?: string | null
          feedback?: string | null
          id?: string
          kind: string
          offer_id: string
          platform?: string | null
          quantity?: number
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approval_required?: boolean
          created_at?: string
          description?: string
          due_date?: string | null
          feedback?: string | null
          id?: string
          kind?: string
          offer_id?: string
          platform?: string | null
          quantity?: number
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliverables_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "campaign_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_offer_components: {
        Row: {
          amount: number | null
          currency: string
          description: string
          guaranteed: boolean
          id: string
          kind: string
          offer_id: string
        }
        Insert: {
          amount?: number | null
          currency?: string
          description: string
          guaranteed?: boolean
          id?: string
          kind: string
          offer_id: string
        }
        Update: {
          amount?: number | null
          currency?: string
          description?: string
          guaranteed?: boolean
          id?: string
          kind?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_offer_components_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "campaign_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_offers: {
        Row: {
          application_id: string
          athlete_id: string
          brand_org_id: string
          campaign_id: string
          compensation_unknown: boolean
          created_at: string
          decline_reason: string | null
          ends_on: string | null
          exclusivity_category: string | null
          exclusivity_days: number
          expires_at: string
          id: string
          organic_use: boolean
          paid_media: boolean
          payment_status: string
          payment_updated_at: string | null
          responded_at: string | null
          sent_by: string | null
          starts_on: string | null
          status: string
          terms: string | null
          usage_channels: string[]
          usage_months: number
          usage_territory: string
          version: number
        }
        Insert: {
          application_id: string
          athlete_id: string
          brand_org_id: string
          campaign_id: string
          compensation_unknown?: boolean
          created_at?: string
          decline_reason?: string | null
          ends_on?: string | null
          exclusivity_category?: string | null
          exclusivity_days?: number
          expires_at: string
          id?: string
          organic_use?: boolean
          paid_media?: boolean
          payment_status?: string
          payment_updated_at?: string | null
          responded_at?: string | null
          sent_by?: string | null
          starts_on?: string | null
          status?: string
          terms?: string | null
          usage_channels?: string[]
          usage_months?: number
          usage_territory?: string
          version?: number
        }
        Update: {
          application_id?: string
          athlete_id?: string
          brand_org_id?: string
          campaign_id?: string
          compensation_unknown?: boolean
          created_at?: string
          decline_reason?: string | null
          ends_on?: string | null
          exclusivity_category?: string | null
          exclusivity_days?: number
          expires_at?: string
          id?: string
          organic_use?: boolean
          paid_media?: boolean
          payment_status?: string
          payment_updated_at?: string | null
          responded_at?: string | null
          sent_by?: string | null
          starts_on?: string | null
          status?: string
          terms?: string | null
          usage_channels?: string[]
          usage_months?: number
          usage_territory?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "campaign_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_offers_brand_org_id_fkey"
            columns: ["brand_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      case_outreach: {
        Row: {
          agency_id: string
          body: string
          case_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          link_id: string | null
          note: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          body: string
          case_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          link_id?: string | null
          note?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          body?: string
          case_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          link_id?: string | null
          note?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_recommendations: {
        Row: {
          athlete_id: string
          author_id: string | null
          body: string
          created_at: string
          decided_at: string | null
          id: string
          organization_id: string
          status: string
        }
        Insert: {
          athlete_id: string
          author_id?: string | null
          body: string
          created_at?: string
          decided_at?: string | null
          id?: string
          organization_id: string
          status?: string
        }
        Update: {
          athlete_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_recommendations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "club_recommendations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "club_recommendations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_roster: {
        Row: {
          athlete_id: string
          ended_at: string | null
          joined_at: string
          organization_id: string
          season: string
          shares_progress: boolean
          status: string
        }
        Insert: {
          athlete_id: string
          ended_at?: string | null
          joined_at?: string
          organization_id: string
          season: string
          shares_progress?: boolean
          status?: string
        }
        Update: {
          athlete_id?: string
          ended_at?: string | null
          joined_at?: string
          organization_id?: string
          season?: string
          shares_progress?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_roster_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "club_roster_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "club_roster_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_roster_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          organization_id: string
          season: string
          status: string
          token: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          max_uses?: number
          organization_id: string
          season: string
          status?: string
          token?: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number
          organization_id?: string
          season?: string
          status?: string
          token?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_roster_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_roster_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          created_at: string
          document_version: string
          expires_at: string | null
          granted: boolean
          guardian_id: string | null
          id: string
          organization_id: string | null
          purpose: string
          scope: string | null
          target_id: string | null
          target_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_version: string
          expires_at?: string | null
          granted: boolean
          guardian_id?: string | null
          id?: string
          organization_id?: string | null
          purpose: string
          scope?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_version?: string
          expires_at?: string | null
          granted?: boolean
          guardian_id?: string | null
          id?: string
          organization_id?: string | null
          purpose?: string
          scope?: string | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          created_at: string
          id: number
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: never
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: never
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_thread_reads: {
        Row: {
          last_read_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          request_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_thread_reads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_thread_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          athlete_id: string
          created_at: string
          guardian_approved_by: string | null
          id: string
          is_minor_at_request: boolean
          message: string
          organization_id: string
          requested_by: string
          responded_at: string | null
          status: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          guardian_approved_by?: string | null
          id?: string
          is_minor_at_request?: boolean
          message: string
          organization_id: string
          requested_by: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          guardian_approved_by?: string | null
          id?: string
          is_minor_at_request?: boolean
          message?: string
          organization_id?: string
          requested_by?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contact_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contact_requests_guardian_approved_by_fkey"
            columns: ["guardian_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          case_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          priority: number
          reason: string
          reporter_id: string | null
          status: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          priority?: number
          reason: string
          reporter_id?: string | null
          status?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          priority?: number
          reason?: string
          reporter_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "safety_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consent_logs: {
        Row: {
          analytics_allowed: boolean
          anonymous_id: string
          created_at: string
          essential_allowed: boolean
          functional_allowed: boolean
          id: string
          ip_hash: string | null
          third_party_allowed: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          analytics_allowed: boolean
          anonymous_id: string
          created_at?: string
          essential_allowed?: boolean
          functional_allowed: boolean
          id?: string
          ip_hash?: string | null
          third_party_allowed: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          analytics_allowed?: boolean
          anonymous_id?: string
          created_at?: string
          essential_allowed?: boolean
          functional_allowed?: boolean
          id?: string
          ip_hash?: string | null
          third_party_allowed?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cookie_consent_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          created_at: string
          details: string | null
          id: string
          request_type: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          request_type: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_usage: {
        Row: {
          day: string
          searches: number
          user_id: string
        }
        Insert: {
          day?: string
          searches?: number
          user_id: string
        }
        Update: {
          day?: string
          searches?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_grants: {
        Row: {
          athlete_id: string
          context_id: string | null
          context_type: string | null
          created_at: string
          document_id: string
          expires_at: string
          granted_by: string | null
          grantee_user_id: string | null
          id: string
          organization_id: string
          purpose: string
          revoked_at: string | null
        }
        Insert: {
          athlete_id: string
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          document_id: string
          expires_at: string
          granted_by?: string | null
          grantee_user_id?: string | null
          id?: string
          organization_id: string
          purpose: string
          revoked_at?: string | null
        }
        Update: {
          athlete_id?: string
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          document_id?: string
          expires_at?: string
          granted_by?: string | null
          grantee_user_id?: string | null
          id?: string
          organization_id?: string
          purpose?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_grants_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_access_grants_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_access_grants_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "athlete_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verifications: {
        Row: {
          attempts: number
          created_at: string
          email: string
          email_domain: string | null
          id: string
          organization_id: string | null
          result: string
          revoked_at: string | null
          sent_at: string | null
          token_expires_at: string | null
          token_hash: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          email_domain?: string | null
          id?: string
          organization_id?: string | null
          result?: string
          revoked_at?: string | null
          sent_at?: string | null
          token_expires_at?: string | null
          token_hash?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          email_domain?: string | null
          id?: string
          organization_id?: string | null
          result?: string
          revoked_at?: string | null
          sent_at?: string | null
          token_expires_at?: string | null
          token_hash?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          granted_at: string
          id: string
          plan_code: string
          reference: string | null
          revoked_at: string | null
          source: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          plan_code: string
          reference?: string | null
          revoked_at?: string | null
          source: string
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          plan_code?: string
          reference?: string | null
          revoked_at?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_cost_scenarios: {
        Row: {
          academic_aid: number | null
          athlete_id: string
          athletic_aid: number | null
          created_at: string
          created_by: string | null
          currency: string
          fees: number | null
          housing: number | null
          housing_included: boolean | null
          id: string
          institution_id: string | null
          insurance: number | null
          label: string
          meals: number | null
          offer_id: string | null
          opportunity_id: string | null
          other_aid: number | null
          other_costs: number | null
          source_note: string | null
          travel: number | null
          tuition: number | null
          updated_at: string
        }
        Insert: {
          academic_aid?: number | null
          athlete_id: string
          athletic_aid?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fees?: number | null
          housing?: number | null
          housing_included?: boolean | null
          id?: string
          institution_id?: string | null
          insurance?: number | null
          label: string
          meals?: number | null
          offer_id?: string | null
          opportunity_id?: string | null
          other_aid?: number | null
          other_costs?: number | null
          source_note?: string | null
          travel?: number | null
          tuition?: number | null
          updated_at?: string
        }
        Update: {
          academic_aid?: number | null
          athlete_id?: string
          athletic_aid?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fees?: number | null
          housing?: number | null
          housing_included?: boolean | null
          id?: string
          institution_id?: string | null
          insurance?: number | null
          label?: string
          meals?: number | null
          offer_id?: string | null
          opportunity_id?: string | null
          other_aid?: number | null
          other_costs?: number | null
          source_note?: string | null
          travel?: number | null
          tuition?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_cost_scenarios_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_cost_scenarios_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_cost_scenarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_cost_scenarios_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_cost_scenarios_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "athlete_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_cost_scenarios_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      family_cost_settings: {
        Row: {
          athlete_id: string
          eur_per_usd: number | null
          rate_date: string | null
          rate_source: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          athlete_id: string
          eur_per_usd?: number | null
          rate_date?: string | null
          rate_source?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          athlete_id?: string
          eur_per_usd?: number | null
          rate_date?: string | null
          rate_source?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      family_notes: {
        Row: {
          athlete_id: string
          author_id: string
          body: string
          context_id: string | null
          context_type: string | null
          created_at: string
          id: string
          visibility: string
        }
        Insert: {
          athlete_id: string
          author_id: string
          body: string
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          visibility?: string
        }
        Update: {
          athlete_id?: string
          author_id?: string
          body?: string
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_policies: {
        Row: {
          jurisdiction: string
          review_window_days: number
          updated_at: string
        }
        Insert: {
          jurisdiction: string
          review_window_days?: number
          updated_at?: string
        }
        Update: {
          jurisdiction?: string
          review_window_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string
          enabled: boolean
          key: string
          kill_switch: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description: string
          enabled?: boolean
          key: string
          kill_switch?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string
          enabled?: boolean
          key?: string
          kill_switch?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      info_requests: {
        Row: {
          athlete_id: string
          created_at: string
          document_id: string | null
          id: string
          kind: string
          message: string
          organization_id: string
          requested_by: string | null
          responded_at: string | null
          responded_by: string | null
          shared_until: string | null
          status: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          kind: string
          message: string
          organization_id: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          shared_until?: string | null
          status?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          kind?: string
          message?: string
          organization_id?: string
          requested_by?: string | null
          responded_at?: string | null
          responded_by?: string | null
          shared_until?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "info_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "info_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "info_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "athlete_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_claims: {
        Row: {
          created_at: string
          domain_matches: boolean
          email_domain: string | null
          id: string
          institution_id: string
          organization_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_title: string
          status: string
          user_id: string
          work_email: string
        }
        Insert: {
          created_at?: string
          domain_matches?: boolean
          email_domain?: string | null
          id?: string
          institution_id: string
          organization_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title: string
          status?: string
          user_id: string
          work_email: string
        }
        Update: {
          created_at?: string
          domain_matches?: boolean
          email_domain?: string | null
          id?: string
          institution_id?: string
          organization_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title?: string
          status?: string
          user_id?: string
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_claims_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_programs: {
        Row: {
          association: string | null
          conference: string | null
          created_at: string
          division: Database["public"]["Enums"]["division"] | null
          gender: string
          id: string
          institution_id: string
          program_url: string | null
          source: string
          source_url: string | null
          sport_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          association?: string | null
          conference?: string | null
          created_at?: string
          division?: Database["public"]["Enums"]["division"] | null
          gender: string
          id?: string
          institution_id: string
          program_url?: string | null
          source: string
          source_url?: string | null
          sport_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          association?: string | null
          conference?: string | null
          created_at?: string
          division?: Database["public"]["Enums"]["division"] | null
          gender?: string
          id?: string
          institution_id?: string
          program_url?: string | null
          source?: string
          source_url?: string | null
          sport_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_programs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          admission_rate: number | null
          admissions_url: string | null
          association: string | null
          athletic_source: string | null
          athletic_updated_at: string | null
          athletics_url: string | null
          city: string | null
          conference: string | null
          cost_attendance_usd: number | null
          created_at: string
          data_source: string | null
          division: Database["public"]["Enums"]["division"] | null
          enrollment: number | null
          graduation_rate: number | null
          id: string
          international_url: string | null
          intl_share: number | null
          ipeds_unitid: number | null
          links_verified_at: string | null
          links_verified_by: string | null
          locale: string | null
          name: string
          net_price_usd: number | null
          ownership: string | null
          price_calculator_url: string | null
          program_cips: string[]
          sat_avg: number | null
          source_fetched_at: string | null
          sports_offered: string[]
          state: string | null
          tuition_in_state_usd: number | null
          tuition_out_of_state_usd: number | null
          updated_at: string
          virtual_tour_url: string | null
          website_url: string | null
        }
        Insert: {
          admission_rate?: number | null
          admissions_url?: string | null
          association?: string | null
          athletic_source?: string | null
          athletic_updated_at?: string | null
          athletics_url?: string | null
          city?: string | null
          conference?: string | null
          cost_attendance_usd?: number | null
          created_at?: string
          data_source?: string | null
          division?: Database["public"]["Enums"]["division"] | null
          enrollment?: number | null
          graduation_rate?: number | null
          id?: string
          international_url?: string | null
          intl_share?: number | null
          ipeds_unitid?: number | null
          links_verified_at?: string | null
          links_verified_by?: string | null
          locale?: string | null
          name: string
          net_price_usd?: number | null
          ownership?: string | null
          price_calculator_url?: string | null
          program_cips?: string[]
          sat_avg?: number | null
          source_fetched_at?: string | null
          sports_offered?: string[]
          state?: string | null
          tuition_in_state_usd?: number | null
          tuition_out_of_state_usd?: number | null
          updated_at?: string
          virtual_tour_url?: string | null
          website_url?: string | null
        }
        Update: {
          admission_rate?: number | null
          admissions_url?: string | null
          association?: string | null
          athletic_source?: string | null
          athletic_updated_at?: string | null
          athletics_url?: string | null
          city?: string | null
          conference?: string | null
          cost_attendance_usd?: number | null
          created_at?: string
          data_source?: string | null
          division?: Database["public"]["Enums"]["division"] | null
          enrollment?: number | null
          graduation_rate?: number | null
          id?: string
          international_url?: string | null
          intl_share?: number | null
          ipeds_unitid?: number | null
          links_verified_at?: string | null
          links_verified_by?: string | null
          locale?: string | null
          name?: string
          net_price_usd?: number | null
          ownership?: string | null
          price_calculator_url?: string | null
          program_cips?: string[]
          sat_avg?: number | null
          source_fetched_at?: string | null
          sports_offered?: string[]
          state?: string | null
          tuition_in_state_usd?: number | null
          tuition_out_of_state_usd?: number | null
          updated_at?: string
          virtual_tour_url?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutions_links_verified_by_fkey"
            columns: ["links_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_signals: {
        Row: {
          athlete_id: string
          created_at: string
          engine_version: string | null
          id: number
          match_score: number | null
          signal: string
          target_id: string
          target_kind: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          engine_version?: string | null
          id?: never
          match_score?: number | null
          signal: string
          target_id: string
          target_kind: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          engine_version?: string | null
          id?: never
          match_score?: number | null
          signal?: string
          target_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_signals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_signals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      metric_definitions: {
        Row: {
          definition: string
          key: string
          name: string
          source: string
          updated_at: string
          version: number
        }
        Insert: {
          definition: string
          key: string
          name: string
          source: string
          updated_at?: string
          version?: number
        }
        Update: {
          definition?: string
          key?: string
          name?: string
          source?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          case_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          reason: string
          report_id: string | null
          revert_reason: string | null
          reverted_at: string | null
          reverted_by: string | null
          scopes: string[]
          starts_at: string
          subject_org: string | null
          subject_user: string | null
        }
        Insert: {
          action: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          reason: string
          report_id?: string | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          scopes?: string[]
          starts_at?: string
          subject_org?: string | null
          subject_user?: string | null
        }
        Update: {
          action?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          reason?: string
          report_id?: string | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          scopes?: string[]
          starts_at?: string
          subject_org?: string | null
          subject_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "safety_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_subject_org_fkey"
            columns: ["subject_org"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          action_id: string
          appellant_id: string
          body: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          status: string
        }
        Insert: {
          action_id: string
          appellant_id: string
          body: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          status?: string
        }
        Update: {
          action_id?: string
          appellant_id?: string
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          athlete_consented_at: string | null
          athlete_id: string | null
          author_id: string
          body: string
          created_at: string
          hidden_reason: string | null
          id: string
          kind: string
          organization_id: string | null
          source_url: string | null
          status: string
          title: string
        }
        Insert: {
          athlete_consented_at?: string | null
          athlete_id?: string | null
          author_id: string
          body: string
          created_at?: string
          hidden_reason?: string | null
          id?: string
          kind: string
          organization_id?: string | null
          source_url?: string | null
          status?: string
          title: string
        }
        Update: {
          athlete_consented_at?: string | null
          athlete_id?: string | null
          author_id?: string
          body?: string
          created_at?: string
          hidden_reason?: string | null
          id?: string
          kind?: string
          organization_id?: string | null
          source_url?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "news_posts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "news_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          in_app: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          in_app?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          in_app?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: number
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: never
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: never
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          address: string | null
          age_category_code: string | null
          age_category_custom: string | null
          aid_amount_usd: number | null
          aid_kind: string | null
          annual_cost_usd: number | null
          archived_at: string | null
          city: string | null
          contact_method: string
          country: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string
          division: Database["public"]["Enums"]["division"] | null
          end_at: string | null
          english_required: string | null
          expires_at: string | null
          financial_source: string | null
          graduation_years: number[]
          id: string
          international_conditions: string | null
          international_eligible: string
          is_reviewed: boolean | null
          last_confirmed_at: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          min_gpa_4: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_status: string
          need_id: string | null
          organization_id: string
          places: number | null
          position_ids: number[]
          postal_code: string | null
          program_id: string | null
          published_at: string | null
          region: string | null
          required_materials: string[]
          review_note: string | null
          reviewed_by: string | null
          scholarship_status: string
          season_id: string | null
          source: string
          sport_id: string
          start_at: string | null
          start_term: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          team_id: string | null
          timezone: string | null
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at: string
          updated_by: string | null
          venue_name: string | null
          visibility: string
        }
        Insert: {
          address?: string | null
          age_category_code?: string | null
          age_category_custom?: string | null
          aid_amount_usd?: number | null
          aid_kind?: string | null
          annual_cost_usd?: number | null
          archived_at?: string | null
          city?: string | null
          contact_method?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description: string
          division?: Database["public"]["Enums"]["division"] | null
          end_at?: string | null
          english_required?: string | null
          expires_at?: string | null
          financial_source?: string | null
          graduation_years?: number[]
          id?: string
          international_conditions?: string | null
          international_eligible?: string
          is_reviewed?: boolean | null
          last_confirmed_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          min_gpa_4?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          need_id?: string | null
          organization_id: string
          places?: number | null
          position_ids?: number[]
          postal_code?: string | null
          program_id?: string | null
          published_at?: string | null
          region?: string | null
          required_materials?: string[]
          review_note?: string | null
          reviewed_by?: string | null
          scholarship_status?: string
          season_id?: string | null
          source?: string
          sport_id: string
          start_at?: string | null
          start_term?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          team_id?: string | null
          timezone?: string | null
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
          updated_by?: string | null
          venue_name?: string | null
          visibility?: string
        }
        Update: {
          address?: string | null
          age_category_code?: string | null
          age_category_custom?: string | null
          aid_amount_usd?: number | null
          aid_kind?: string | null
          annual_cost_usd?: number | null
          archived_at?: string | null
          city?: string | null
          contact_method?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          division?: Database["public"]["Enums"]["division"] | null
          end_at?: string | null
          english_required?: string | null
          expires_at?: string | null
          financial_source?: string | null
          graduation_years?: number[]
          id?: string
          international_conditions?: string | null
          international_eligible?: string
          is_reviewed?: boolean | null
          last_confirmed_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          min_gpa_4?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          need_id?: string | null
          organization_id?: string
          places?: number | null
          position_ids?: number[]
          postal_code?: string | null
          program_id?: string | null
          published_at?: string | null
          region?: string | null
          required_materials?: string[]
          review_note?: string | null
          reviewed_by?: string | null
          scholarship_status?: string
          season_id?: string | null
          source?: string
          sport_id?: string
          start_at?: string | null
          start_term?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          team_id?: string | null
          timezone?: string | null
          title?: string
          type?: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
          updated_by?: string | null
          venue_name?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_age_category_code_fkey"
            columns: ["age_category_code"]
            isOneToOne: false
            referencedRelation: "age_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "recruiting_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "sports_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "org_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_attendance: {
        Row: {
          athlete_id: string
          check_in_at: string | null
          check_out_at: string | null
          opportunity_id: string
          organization_id: string
          recorded_at: string | null
          recorded_by: string | null
          registration_id: string
          source: string
          status: string
        }
        Insert: {
          athlete_id: string
          check_in_at?: string | null
          check_out_at?: string | null
          opportunity_id: string
          organization_id: string
          recorded_at?: string | null
          recorded_by?: string | null
          registration_id: string
          source?: string
          status?: string
        }
        Update: {
          athlete_id?: string
          check_in_at?: string | null
          check_out_at?: string | null
          opportunity_id?: string
          organization_id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          registration_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_attendance_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "opportunity_attendance_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "opportunity_attendance_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_attendance_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "opportunity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_cost_components: {
        Row: {
          amount: number | null
          component_type: string
          currency: string | null
          id: string
          included: boolean
          label: string
          opportunity_id: string
          period: string
          required: boolean
          sort: number
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          component_type: string
          currency?: string | null
          id?: string
          included?: boolean
          label: string
          opportunity_id: string
          period?: string
          required?: boolean
          sort?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          component_type?: string
          currency?: string | null
          id?: string
          included?: boolean
          label?: string
          opportunity_id?: string
          period?: string
          required?: boolean
          sort?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_cost_components_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_cost_components_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_invitations: {
        Row: {
          athlete_id: string
          created_at: string
          expires_at: string
          guardian_required: boolean
          id: string
          invited_by: string | null
          message: string | null
          opportunity_id: string
          organization_id: string
          responded_at: string | null
          sent_at: string
          source: string
          source_shortlist_id: string | null
          status: string
          team_id: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          expires_at?: string
          guardian_required?: boolean
          id?: string
          invited_by?: string | null
          message?: string | null
          opportunity_id: string
          organization_id: string
          responded_at?: string | null
          sent_at?: string
          source?: string
          source_shortlist_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          expires_at?: string
          guardian_required?: boolean
          id?: string
          invited_by?: string | null
          message?: string | null
          opportunity_id?: string
          organization_id?: string
          responded_at?: string | null
          sent_at?: string
          source?: string
          source_shortlist_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_invitations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "opportunity_invitations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "opportunity_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_invitations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_invitations_source_shortlist_id_fkey"
            columns: ["source_shortlist_id"]
            isOneToOne: false
            referencedRelation: "org_shortlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "org_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_outcomes: {
        Row: {
          athlete_id: string
          candidate_id: string | null
          decided_at: string
          decided_by: string | null
          internal_note: string | null
          opportunity_id: string
          organization_id: string
          outcome: string
          registration_id: string
        }
        Insert: {
          athlete_id: string
          candidate_id?: string | null
          decided_at?: string
          decided_by?: string | null
          internal_note?: string | null
          opportunity_id: string
          organization_id: string
          outcome: string
          registration_id: string
        }
        Update: {
          athlete_id?: string
          candidate_id?: string | null
          decided_at?: string
          decided_by?: string | null
          internal_note?: string | null
          opportunity_id?: string
          organization_id?: string
          outcome?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_outcomes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "opportunity_outcomes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "opportunity_outcomes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "org_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_outcomes_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_outcomes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_outcomes_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "opportunity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          asker_id: string | null
          body: string
          created_at: string
          id: string
          opportunity_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asker_id?: string | null
          body: string
          created_at?: string
          id?: string
          opportunity_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asker_id?: string | null
          body?: string
          created_at?: string
          id?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_questions_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_questions_asker_id_fkey"
            columns: ["asker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_questions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_registration_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          detail: string | null
          from_status: string | null
          id: number
          registration_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind: string
          created_at?: string
          detail?: string | null
          from_status?: string | null
          id?: never
          registration_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          detail?: string | null
          from_status?: string | null
          id?: never
          registration_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_registration_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_registration_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "opportunity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_registrations: {
        Row: {
          agency_id: string | null
          application_id: string | null
          athlete_id: string
          athlete_update: string | null
          athlete_update_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_side: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          guardian_status: string
          id: string
          invitation_id: string | null
          materials_status: string
          needs_athlete_ok: boolean
          opportunity_id: string
          organization_id: string
          origin: string
          payment_status: string
          registered_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          application_id?: string | null
          athlete_id: string
          athlete_update?: string | null
          athlete_update_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_side?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          guardian_status?: string
          id?: string
          invitation_id?: string | null
          materials_status?: string
          needs_athlete_ok?: boolean
          opportunity_id: string
          organization_id: string
          origin: string
          payment_status?: string
          registered_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          application_id?: string | null
          athlete_id?: string
          athlete_update?: string | null
          athlete_update_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_side?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          guardian_status?: string
          id?: string
          invitation_id?: string | null
          materials_status?: string
          needs_athlete_ok?: boolean
          opportunity_id?: string
          organization_id?: string
          origin?: string
          payment_status?: string
          registered_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_registrations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_registrations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "opportunity_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_registrations_opportunity_fk"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_registrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trial_registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trial_registrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_required_materials: {
        Row: {
          created_at: string
          id: string
          label: string | null
          material: string
          opportunity_id: string
          provided_by: string
          required: boolean
          requires_guardian_consent: boolean
          sensitivity: string
          valid_days: number | null
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          material: string
          opportunity_id: string
          provided_by?: string
          required?: boolean
          requires_guardian_consent?: boolean
          sensitivity?: string
          valid_days?: number | null
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          material?: string
          opportunity_id?: string
          provided_by?: string
          required?: boolean
          requires_guardian_consent?: boolean
          sensitivity?: string
          valid_days?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_required_materials_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_requirements: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          opportunity_id: string
          params: Json
          sort: number
          strength: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          opportunity_id: string
          params?: Json
          sort?: number
          strength: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          opportunity_id?: string
          params?: Json
          sort?: number
          strength?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      org_activity: {
        Row: {
          actor_id: string | null
          athlete_id: string | null
          created_at: string
          detail: Json
          id: number
          kind: string
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          athlete_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          kind: string
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          athlete_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          kind?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_activity_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_activity_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_assignment_log: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          athlete_id: string | null
          candidate_id: string | null
          created_at: string
          id: number
          organization_id: string
          shortlist_id: string | null
          status: string
          target_kind: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          athlete_id?: string | null
          candidate_id?: string | null
          created_at?: string
          id?: never
          organization_id: string
          shortlist_id?: string | null
          status: string
          target_kind: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          athlete_id?: string | null
          candidate_id?: string | null
          created_at?: string
          id?: never
          organization_id?: string
          shortlist_id?: string | null
          status?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_assignment_log_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_assignment_log_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_assignment_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_candidates: {
        Row: {
          application_id: string | null
          archived_at: string | null
          assigned_to: string | null
          athlete_id: string
          close_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          internal_stage: string
          invitation_id: string | null
          need_id: string | null
          opportunity_id: string | null
          organization_id: string
          program_id: string | null
          registration_id: string | null
          source: string
          stage_changed_at: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          athlete_id: string
          close_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_stage?: string
          invitation_id?: string | null
          need_id?: string | null
          opportunity_id?: string | null
          organization_id: string
          program_id?: string | null
          registration_id?: string | null
          source?: string
          stage_changed_at?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          athlete_id?: string
          close_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_stage?: string
          invitation_id?: string | null
          need_id?: string | null
          opportunity_id?: string | null
          organization_id?: string
          program_id?: string | null
          registration_id?: string | null
          source?: string
          stage_changed_at?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_candidates_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_candidates_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "opportunity_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "recruiting_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "opportunity_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_candidates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "org_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_labels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          program_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          program_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_labels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_labels_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_notes: {
        Row: {
          athlete_id: string
          author_id: string | null
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          shortlist_id: string | null
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          author_id?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          shortlist_id?: string | null
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          shortlist_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_notes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_notes_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "org_shortlists"
            referencedColumns: ["id"]
          },
        ]
      }
      org_programs: {
        Row: {
          archived_at: string | null
          created_at: string
          gender: string
          id: string
          institution_program_id: string | null
          name: string
          organization_id: string
          sport_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          gender?: string
          id?: string
          institution_program_id?: string | null
          name: string
          organization_id: string
          sport_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          gender?: string
          id?: string
          institution_program_id?: string | null
          name?: string
          organization_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_programs_institution_program_id_fkey"
            columns: ["institution_program_id"]
            isOneToOne: false
            referencedRelation: "institution_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_programs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      org_saved_searches: {
        Row: {
          created_at: string
          created_by: string | null
          filters: Json
          filters_version: number
          id: string
          last_executed_at: string | null
          name: string
          need_id: string | null
          notify: boolean
          organization_id: string
          program_id: string | null
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filters: Json
          filters_version?: number
          id?: string
          last_executed_at?: string | null
          name: string
          need_id?: string | null
          notify?: boolean
          organization_id: string
          program_id?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filters?: Json
          filters_version?: number
          id?: string
          last_executed_at?: string | null
          name?: string
          need_id?: string | null
          notify?: boolean
          organization_id?: string
          program_id?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_saved_searches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_saved_searches_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "recruiting_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_saved_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_saved_searches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_shortlist_member_labels: {
        Row: {
          added_by: string | null
          athlete_id: string
          created_at: string
          label_id: string
          shortlist_id: string
        }
        Insert: {
          added_by?: string | null
          athlete_id: string
          created_at?: string
          label_id: string
          shortlist_id: string
        }
        Update: {
          added_by?: string | null
          athlete_id?: string
          created_at?: string
          label_id?: string
          shortlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_shortlist_member_labels_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlist_member_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "org_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlist_member_labels_shortlist_id_athlete_id_fkey"
            columns: ["shortlist_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "org_shortlist_members"
            referencedColumns: ["shortlist_id", "athlete_id"]
          },
        ]
      }
      org_shortlist_members: {
        Row: {
          added_at: string
          added_by: string | null
          assigned_to: string | null
          athlete_id: string
          fit_at_add: number | null
          internal_label: string | null
          last_reviewed_at: string | null
          organization_id: string
          position: number
          priority: boolean
          promoted_at: string | null
          promoted_candidate_id: string | null
          review_status: string
          shortlist_id: string
          source: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          assigned_to?: string | null
          athlete_id: string
          fit_at_add?: number | null
          internal_label?: string | null
          last_reviewed_at?: string | null
          organization_id: string
          position?: number
          priority?: boolean
          promoted_at?: string | null
          promoted_candidate_id?: string | null
          review_status?: string
          shortlist_id: string
          source?: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          assigned_to?: string | null
          athlete_id?: string
          fit_at_add?: number | null
          internal_label?: string | null
          last_reviewed_at?: string | null
          organization_id?: string
          position?: number
          priority?: boolean
          promoted_at?: string | null
          promoted_candidate_id?: string | null
          review_status?: string
          shortlist_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_shortlist_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlist_members_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlist_members_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_shortlist_members_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_shortlist_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlist_members_promoted_candidate_id_fkey"
            columns: ["promoted_candidate_id"]
            isOneToOne: false
            referencedRelation: "org_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlist_members_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "org_shortlists"
            referencedColumns: ["id"]
          },
        ]
      }
      org_shortlists: {
        Row: {
          archived_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          need_id: string | null
          opportunity_id: string | null
          organization_id: string
          owner_id: string | null
          program_id: string | null
          recruiting_class: number | null
          sport_id: string | null
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          need_id?: string | null
          opportunity_id?: string | null
          organization_id: string
          owner_id?: string | null
          program_id?: string | null
          recruiting_class?: number | null
          sport_id?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          need_id?: string | null
          opportunity_id?: string | null
          organization_id?: string
          owner_id?: string | null
          program_id?: string | null
          recruiting_class?: number | null
          sport_id?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_shortlists_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "recruiting_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlists_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_shortlists_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tasks: {
        Row: {
          assignee_id: string | null
          athlete_id: string | null
          candidate_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_date: string | null
          id: string
          need_id: string | null
          opportunity_id: string | null
          organization_id: string
          priority: string
          shortlist_id: string | null
          status: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          athlete_id?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          need_id?: string | null
          opportunity_id?: string | null
          organization_id: string
          priority?: string
          shortlist_id?: string | null
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          athlete_id?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          need_id?: string | null
          opportunity_id?: string | null
          organization_id?: string
          priority?: string
          shortlist_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_tasks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "org_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "org_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "recruiting_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "org_shortlists"
            referencedColumns: ["id"]
          },
        ]
      }
      org_teams: {
        Row: {
          age_category_code: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          program_id: string
          season_id: string | null
        }
        Insert: {
          age_category_code?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          program_id: string
          season_id?: string | null
        }
        Update: {
          age_category_code?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          program_id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_teams_age_category_code_fkey"
            columns: ["age_category_code"]
            isOneToOne: false
            referencedRelation: "age_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_teams_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "sports_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_domains: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          domain_type: string
          id: string
          is_primary: boolean
          organization_id: string
          reviewed_by: string | null
          revoked_at: string | null
          status: string
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          domain_type?: string
          id?: string
          is_primary?: boolean
          organization_id: string
          reviewed_by?: string | null
          revoked_at?: string | null
          status?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          domain_type?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          reviewed_by?: string | null
          revoked_at?: string | null
          status?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_domains_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_domains_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          member_role: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          affiliation_verification: string
          agency_role: string | null
          created_at: string
          declared_role: string | null
          invitation_source: string | null
          invited_by: string | null
          member_role: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          program_ids: string[]
          program_scope: string
          role_verification: string
          team_ids: string[]
          team_scope: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliation_verification?: string
          agency_role?: string | null
          created_at?: string
          declared_role?: string | null
          invitation_source?: string | null
          invited_by?: string | null
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          program_ids?: string[]
          program_scope?: string
          role_verification?: string
          team_ids?: string[]
          team_scope?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliation_verification?: string
          agency_role?: string | null
          created_at?: string
          declared_role?: string | null
          invitation_source?: string | null
          invited_by?: string | null
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id?: string
          program_ids?: string[]
          program_scope?: string
          role_verification?: string
          team_ids?: string[]
          team_scope?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_membership_records: {
        Row: {
          actor_id: string | null
          created_at: string
          declared_role: string | null
          id: string
          member_role: Database["public"]["Enums"]["org_member_role"] | null
          organization_id: string
          program_ids: string[]
          program_scope: string | null
          reason: string | null
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          declared_role?: string | null
          id?: string
          member_role?: Database["public"]["Enums"]["org_member_role"] | null
          organization_id: string
          program_ids?: string[]
          program_scope?: string | null
          reason?: string | null
          status: string
          title?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          declared_role?: string | null
          id?: string
          member_role?: Database["public"]["Enums"]["org_member_role"] | null
          organization_id?: string
          program_ids?: string[]
          program_scope?: string | null
          reason?: string | null
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_membership_records_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_membership_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_membership_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          annual_cost_usd: number | null
          city: string | null
          claim_status: string
          conference: string | null
          cost_source_url: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          division: Database["public"]["Enums"]["division"] | null
          external_id: string | null
          id: string
          institution_id: string | null
          international_support: string | null
          last_reviewed_at: string | null
          logo_url: string | null
          name: string
          name_key: string | null
          normalized_name: string | null
          org_status: string
          requester_email_domain: string | null
          source: string
          sport_ids: string[]
          state: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          annual_cost_usd?: number | null
          city?: string | null
          claim_status?: string
          conference?: string | null
          cost_source_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          division?: Database["public"]["Enums"]["division"] | null
          external_id?: string | null
          id?: string
          institution_id?: string | null
          international_support?: string | null
          last_reviewed_at?: string | null
          logo_url?: string | null
          name: string
          name_key?: string | null
          normalized_name?: string | null
          org_status?: string
          requester_email_domain?: string | null
          source?: string
          sport_ids?: string[]
          state?: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          annual_cost_usd?: number | null
          city?: string | null
          claim_status?: string
          conference?: string | null
          cost_source_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          division?: Database["public"]["Enums"]["division"] | null
          external_id?: string | null
          id?: string
          institution_id?: string | null
          international_support?: string | null
          last_reviewed_at?: string | null
          logo_url?: string | null
          name?: string
          name_key?: string | null
          normalized_name?: string | null
          org_status?: string
          requester_email_domain?: string | null
          source?: string
          sport_ids?: string[]
          state?: string | null
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_contacts: {
        Row: {
          channel: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          invite_expires_at: string | null
          invite_token_hash: string | null
          invited_at: string | null
          notes: string | null
          organization_name: string
          responded_at: string | null
          role_title: string | null
          segment: string
          source_url: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          channel?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token_hash?: string | null
          invited_at?: string | null
          notes?: string | null
          organization_name: string
          responded_at?: string | null
          role_title?: string | null
          segment: string
          source_url: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          channel?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token_hash?: string | null
          invited_at?: string | null
          notes?: string | null
          organization_name?: string
          responded_at?: string | null
          role_title?: string | null
          segment?: string
          source_url?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_events: {
        Row: {
          actor_id: string | null
          contact_id: string
          created_at: string
          detail: string | null
          id: number
          kind: string
        }
        Insert: {
          actor_id?: string | null
          contact_id: string
          created_at?: string
          detail?: string | null
          id?: never
          kind: string
        }
        Update: {
          actor_id?: string | null
          contact_id?: string
          created_at?: string
          detail?: string | null
          id?: never
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "outreach_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_suppressions: {
        Row: {
          created_at: string
          email_hash: string
        }
        Insert: {
          created_at?: string
          email_hash: string
        }
        Update: {
          created_at?: string
          email_hash?: string
        }
        Relationships: []
      }
      parent_athlete_links: {
        Row: {
          approved_at: string | null
          athlete_id: string | null
          can_edit_profile: boolean
          can_view_academics: boolean
          can_view_applications: boolean
          can_view_budget: boolean
          can_view_contacts: boolean
          can_view_costs: boolean
          can_view_documents: boolean
          can_view_messages: boolean
          can_view_profile: boolean
          created_at: string
          expires_at: string
          guardian_consent_given: boolean
          id: string
          invitation_token: string
          invited_by: string
          last_reviewed_at: string | null
          parent_id: string | null
          relationship: string
          restricted_at: string | null
          restriction_reason: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["link_status"]
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          approved_at?: string | null
          athlete_id?: string | null
          can_edit_profile?: boolean
          can_view_academics?: boolean
          can_view_applications?: boolean
          can_view_budget?: boolean
          can_view_contacts?: boolean
          can_view_costs?: boolean
          can_view_documents?: boolean
          can_view_messages?: boolean
          can_view_profile?: boolean
          created_at?: string
          expires_at?: string
          guardian_consent_given?: boolean
          id?: string
          invitation_token?: string
          invited_by: string
          last_reviewed_at?: string | null
          parent_id?: string | null
          relationship?: string
          restricted_at?: string | null
          restriction_reason?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          approved_at?: string | null
          athlete_id?: string | null
          can_edit_profile?: boolean
          can_view_academics?: boolean
          can_view_applications?: boolean
          can_view_budget?: boolean
          can_view_contacts?: boolean
          can_view_costs?: boolean
          can_view_documents?: boolean
          can_view_messages?: boolean
          can_view_profile?: boolean
          created_at?: string
          expires_at?: string
          guardian_consent_given?: boolean
          id?: string
          invitation_token?: string
          invited_by?: string
          last_reviewed_at?: string | null
          parent_id?: string | null
          relationship?: string
          restricted_at?: string | null
          restriction_reason?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_athlete_links_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_athlete_links_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_athlete_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_athlete_links_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_field_policies: {
        Row: {
          allow_compare: boolean
          allow_export: boolean
          allow_filter: boolean
          allow_match: boolean
          athlete_id: string
          field_group: string
          updated_at: string
        }
        Insert: {
          allow_compare: boolean
          allow_export: boolean
          allow_filter: boolean
          allow_match: boolean
          athlete_id: string
          field_group: string
          updated_at?: string
        }
        Update: {
          allow_compare?: boolean
          allow_export?: boolean
          allow_filter?: boolean
          allow_match?: boolean
          athlete_id?: string
          field_group?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_field_policies_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "passport_field_policies_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      passport_views: {
        Row: {
          athlete_id: string
          id: number
          viewed_at: string
          viewed_on: string
          viewer_id: string | null
          viewer_kind: string
          viewer_org_id: string | null
        }
        Insert: {
          athlete_id: string
          id?: never
          viewed_at?: string
          viewed_on?: string
          viewer_id?: string | null
          viewer_kind: string
          viewer_org_id?: string | null
        }
        Update: {
          athlete_id?: string
          id?: never
          viewed_at?: string
          viewed_on?: string
          viewer_id?: string | null
          viewer_kind?: string
          viewer_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passport_views_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "passport_views_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "passport_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_views_viewer_org_id_fkey"
            columns: ["viewer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requirements: {
        Row: {
          amount: number
          athlete_id: string
          cost_component_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          enrollment_id: string | null
          id: string
          label: string
          opportunity_id: string
          organization_id: string
          provider_reference: string | null
          refund_deadline: string | null
          refundable: string
          registration_id: string | null
          required: boolean
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          athlete_id: string
          cost_component_id?: string | null
          created_at?: string
          currency: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          label: string
          opportunity_id: string
          organization_id: string
          provider_reference?: string | null
          refund_deadline?: string | null
          refundable?: string
          registration_id?: string | null
          required?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          athlete_id?: string
          cost_component_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          label?: string
          opportunity_id?: string
          organization_id?: string
          provider_reference?: string | null
          refund_deadline?: string | null
          refundable?: string
          registration_id?: string | null
          required?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requirements_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_requirements_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_requirements_cost_component_id_fkey"
            columns: ["cost_component_id"]
            isOneToOne: false
            referencedRelation: "opportunity_cost_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requirements_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "program_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requirements_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "opportunity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_contacts: {
        Row: {
          athlete_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          process_id: string
          role: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          process_id: string
          role?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          process_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_contacts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pipeline_contacts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pipeline_contacts_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_events: {
        Row: {
          athlete_id: string
          body: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          id: number
          kind: string
          occurred_at: string
          process_id: string
          source: string
          title: string
        }
        Insert: {
          athlete_id: string
          body?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          kind: string
          occurred_at?: string
          process_id: string
          source: string
          title: string
        }
        Update: {
          athlete_id?: string
          body?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          kind?: string
          occurred_at?: string
          process_id?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pipeline_events_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pipeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_tasks: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          done_at: string | null
          due_date: string | null
          id: string
          owner: string
          process_id: string | null
          source: string
          title: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          owner?: string
          process_id?: string | null
          source?: string
          title: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          owner?: string
          process_id?: string | null
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_tasks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pipeline_tasks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pipeline_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_catalog: {
        Row: {
          active: boolean
          audience: string
          billing_interval: string
          code: string
          created_at: string
          currency: string
          features: Json
          free_until: string | null
          name: string
          price_cents: number | null
          seats_included: number
          stripe_price_id: string | null
          version: number
        }
        Insert: {
          active?: boolean
          audience: string
          billing_interval: string
          code: string
          created_at?: string
          currency?: string
          features?: Json
          free_until?: string | null
          name: string
          price_cents?: number | null
          seats_included?: number
          stripe_price_id?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          audience?: string
          billing_interval?: string
          code?: string
          created_at?: string
          currency?: string
          features?: Json
          free_until?: string | null
          name?: string
          price_cents?: number | null
          seats_included?: number
          stripe_price_id?: string | null
          version?: number
        }
        Relationships: []
      }
      private_profile_data: {
        Row: {
          created_at: string
          date_of_birth: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      process_documents: {
        Row: {
          athlete_id: string
          document_id: string | null
          kind: string
          process_id: string
          sent_at: string | null
        }
        Insert: {
          athlete_id: string
          document_id?: string | null
          kind: string
          process_id: string
          sent_at?: string | null
        }
        Update: {
          athlete_id?: string
          document_id?: string | null
          kind?: string
          process_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "process_documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "process_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "athlete_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          event: string
          id: number
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          event: string
          id?: never
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          event?: string
          id?: never
          props?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_credentials: {
        Row: {
          country: string | null
          created_at: string
          credential_number: string | null
          credential_type: string
          expires_on: string | null
          id: string
          issued_on: string | null
          issuing_body: string
          last_checked_at: string | null
          organization_id: string | null
          sport_id: string | null
          status: string
          updated_at: string
          user_id: string
          verification_request_id: string | null
          verified_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          credential_number?: string | null
          credential_type: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuing_body: string
          last_checked_at?: string | null
          organization_id?: string | null
          sport_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_request_id?: string | null
          verified_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          credential_number?: string | null
          credential_type?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuing_body?: string
          last_checked_at?: string | null
          organization_id?: string | null
          sport_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_request_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_credentials_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_credentials_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string
          id: string
          onboarding_completed: boolean
          primary_role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          id: string
          onboarding_completed?: boolean
          primary_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          id?: string
          onboarding_completed?: boolean
          primary_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      program_enrollments: {
        Row: {
          accepted_at: string | null
          aid_amount: number | null
          aid_currency: string | null
          application_id: string | null
          athlete_id: string
          created_at: string
          created_by: string | null
          end_reason: string | null
          ended_at: string | null
          ends_on: string | null
          enrolled_at: string | null
          guardian_status: string
          id: string
          offer_id: string | null
          offered_at: string
          opportunity_id: string
          organization_id: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          aid_amount?: number | null
          aid_currency?: string | null
          application_id?: string | null
          athlete_id: string
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ends_on?: string | null
          enrolled_at?: string | null
          guardian_status?: string
          id?: string
          offer_id?: string | null
          offered_at?: string
          opportunity_id: string
          organization_id: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          aid_amount?: number | null
          aid_currency?: string | null
          application_id?: string | null
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ends_on?: string | null
          enrolled_at?: string | null
          guardian_status?: string
          id?: string
          offer_id?: string | null
          offered_at?: string
          opportunity_id?: string
          organization_id?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_enrollments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "program_enrollments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "program_enrollments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "athlete_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_memberships: {
        Row: {
          access_level: string
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string
          program_id: string
          program_role: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          access_level?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          program_id: string
          program_role?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          access_level?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          program_id?: string
          program_role?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_memberships_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_memberships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_memberships_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      recruiting_case_activities: {
        Row: {
          actor_id: string | null
          body: string | null
          case_id: string
          created_at: string
          from_stage: string | null
          id: string
          kind: string
          occurred_on: string
          to_stage: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          case_id: string
          created_at?: string
          from_stage?: string | null
          id?: string
          kind: string
          occurred_on?: string
          to_stage?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          case_id?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          kind?: string
          occurred_on?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiting_case_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_case_activities_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "recruiting_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiting_case_tasks: {
        Row: {
          assignee_id: string | null
          case_id: string
          created_at: string
          created_by: string | null
          done: boolean
          done_at: string | null
          due_date: string | null
          id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiting_case_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "recruiting_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_case_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiting_cases: {
        Row: {
          agency_id: string
          athlete_id: string
          contact_id: string | null
          created_at: string
          cycle: string
          id: string
          institution_id: string | null
          institution_name: string
          next_action: string | null
          next_action_due: string | null
          outcome_reason: string | null
          owner_id: string | null
          shared_with_athlete: boolean
          sport_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          athlete_id: string
          contact_id?: string | null
          created_at?: string
          cycle: string
          id?: string
          institution_id?: string | null
          institution_name: string
          next_action?: string | null
          next_action_due?: string | null
          outcome_reason?: string | null
          owner_id?: string | null
          shared_with_athlete?: boolean
          sport_id?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          athlete_id?: string
          contact_id?: string | null
          created_at?: string
          cycle?: string
          id?: string
          institution_id?: string | null
          institution_name?: string
          next_action?: string | null
          next_action_due?: string | null
          outcome_reason?: string | null
          owner_id?: string | null
          shared_with_athlete?: boolean
          sport_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiting_cases_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_cases_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recruiting_cases_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recruiting_cases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "agency_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_cases_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_cases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_cases_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiting_link_views: {
        Row: {
          id: number
          link_id: string
          viewed_at: string
        }
        Insert: {
          id?: never
          link_id: string
          viewed_at?: string
        }
        Update: {
          id?: never
          link_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiting_link_views_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "recruiting_links"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiting_links: {
        Row: {
          athlete_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiting_links_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recruiting_links_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recruiting_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiting_needs: {
        Row: {
          age_category_code: string | null
          class_years: number[]
          countries: string[]
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          min_height_cm: number | null
          opportunity_id: string | null
          organization_id: string
          position_ids: number[]
          program_id: string | null
          requires_documented_academics: boolean
          requires_video: boolean
          season_id: string | null
          slots: number | null
          sport_id: string
          start_term: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          age_category_code?: string | null
          class_years?: number[]
          countries?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          min_height_cm?: number | null
          opportunity_id?: string | null
          organization_id: string
          position_ids?: number[]
          program_id?: string | null
          requires_documented_academics?: boolean
          requires_video?: boolean
          season_id?: string | null
          slots?: number | null
          sport_id: string
          start_term?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          age_category_code?: string | null
          class_years?: number[]
          countries?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          min_height_cm?: number | null
          opportunity_id?: string | null
          organization_id?: string
          position_ids?: number[]
          program_id?: string | null
          requires_documented_academics?: boolean
          requires_video?: boolean
          season_id?: string | null
          slots?: number | null
          sport_id?: string
          start_term?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiting_needs_age_category_code_fkey"
            columns: ["age_category_code"]
            isOneToOne: false
            referencedRelation: "age_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recruiting_needs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_needs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_needs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_needs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_needs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "sports_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_needs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiting_needs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "org_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          referred_user: string
          referrer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          referred_user: string
          referrer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          referred_user?: string
          referrer_id?: string
        }
        Relationships: []
      }
      representation_agreements: {
        Row: {
          acceptance_status: string
          created_at: string
          created_by: string | null
          document_id: string | null
          effective_from: string
          effective_until: string
          evidence_status: string
          id: string
          representation_id: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          acceptance_status?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_from: string
          effective_until: string
          evidence_status?: string
          id?: string
          representation_id: string
          verified_at?: string | null
          verified_by?: string | null
          version: number
        }
        Update: {
          acceptance_status?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_from?: string
          effective_until?: string
          evidence_status?: string
          id?: string
          representation_id?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "representation_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_agreements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "athlete_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_agreements_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_a"]
          },
          {
            foreignKeyName: "representation_agreements_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_b"]
          },
          {
            foreignKeyName: "representation_agreements_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agency_roster"
            referencedColumns: ["representation_id"]
          },
          {
            foreignKeyName: "representation_agreements_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agent_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_agreements_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      representation_assignments: {
        Row: {
          agency_id: string
          assigned_by: string | null
          ended_at: string | null
          id: string
          representation_id: string
          role: string
          started_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          assigned_by?: string | null
          ended_at?: string | null
          id?: string
          representation_id: string
          role: string
          started_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          assigned_by?: string | null
          ended_at?: string | null
          id?: string
          representation_id?: string
          role?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representation_assignments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_assignments_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_a"]
          },
          {
            foreignKeyName: "representation_assignments_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_b"]
          },
          {
            foreignKeyName: "representation_assignments_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agency_roster"
            referencedColumns: ["representation_id"]
          },
          {
            foreignKeyName: "representation_assignments_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agent_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      representation_conflicts: {
        Row: {
          conflicting_id: string
          detected_at: string
          id: string
          overlap: Json
          representation_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          conflicting_id: string
          detected_at?: string
          id?: string
          overlap?: Json
          representation_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          conflicting_id?: string
          detected_at?: string
          id?: string
          overlap?: Json
          representation_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "representation_conflicts_conflicting_id_fkey"
            columns: ["conflicting_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_a"]
          },
          {
            foreignKeyName: "representation_conflicts_conflicting_id_fkey"
            columns: ["conflicting_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_b"]
          },
          {
            foreignKeyName: "representation_conflicts_conflicting_id_fkey"
            columns: ["conflicting_id"]
            isOneToOne: false
            referencedRelation: "agency_roster"
            referencedColumns: ["representation_id"]
          },
          {
            foreignKeyName: "representation_conflicts_conflicting_id_fkey"
            columns: ["conflicting_id"]
            isOneToOne: false
            referencedRelation: "agent_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_conflicts_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_a"]
          },
          {
            foreignKeyName: "representation_conflicts_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_b"]
          },
          {
            foreignKeyName: "representation_conflicts_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agency_roster"
            referencedColumns: ["representation_id"]
          },
          {
            foreignKeyName: "representation_conflicts_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agent_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      representation_coverage: {
        Row: {
          created_at: string
          dimension: string
          id: string
          representation_id: string
          value: string
        }
        Insert: {
          created_at?: string
          dimension: string
          id?: string
          representation_id: string
          value: string
        }
        Update: {
          created_at?: string
          dimension?: string
          id?: string
          representation_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "representation_coverage_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_a"]
          },
          {
            foreignKeyName: "representation_coverage_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_b"]
          },
          {
            foreignKeyName: "representation_coverage_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agency_roster"
            referencedColumns: ["representation_id"]
          },
          {
            foreignKeyName: "representation_coverage_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agent_representations"
            referencedColumns: ["id"]
          },
        ]
      }
      representation_fee_attestations: {
        Row: {
          agency_id: string
          athlete_id: string
          attested_at: string
          attested_by: string | null
          id: string
          representation_id: string
          statement: string
          statement_version: string
        }
        Insert: {
          agency_id: string
          athlete_id: string
          attested_at?: string
          attested_by?: string | null
          id?: string
          representation_id: string
          statement: string
          statement_version: string
        }
        Update: {
          agency_id?: string
          athlete_id?: string
          attested_at?: string
          attested_by?: string | null
          id?: string
          representation_id?: string
          statement?: string
          statement_version?: string
        }
        Relationships: []
      }
      representation_invitations: {
        Row: {
          agency_id: string
          athlete_id: string
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          status: string
          used_at: string | null
        }
        Insert: {
          agency_id: string
          athlete_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string
          used_at?: string | null
        }
        Update: {
          agency_id?: string
          athlete_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "representation_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      representation_permissions: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          permission: string
          representation_id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          representation_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          representation_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "representation_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_permissions_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_a"]
          },
          {
            foreignKeyName: "representation_permissions_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "admin_representation_conflicts"
            referencedColumns: ["representation_b"]
          },
          {
            foreignKeyName: "representation_permissions_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agency_roster"
            referencedColumns: ["representation_id"]
          },
          {
            foreignKeyName: "representation_permissions_representation_id_fkey"
            columns: ["representation_id"]
            isOneToOne: false
            referencedRelation: "agent_representations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_permissions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_case_events: {
        Row: {
          actor_id: string | null
          body: string
          case_id: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          case_id: string
          created_at?: string
          id?: string
          kind: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "safety_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_cases: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          priority: string
          status: string
          subject_org: string | null
          subject_user: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: string
          subject_org?: string | null
          subject_user?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: string
          subject_org?: string | null
          subject_user?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_cases_subject_org_fkey"
            columns: ["subject_org"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_athletes: {
        Row: {
          athlete_id: string
          created_at: string
          list_name: string
          owner_id: string
          private_note: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          list_name?: string
          owner_id: string
          private_note?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          list_name?: string
          owner_id?: string
          private_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "saved_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "saved_athletes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          archived_at: string | null
          athlete_id: string
          close_reason: string | null
          created_at: string
          decided_at: string | null
          id: string
          match_score_at_save: number | null
          match_snapshot: Json | null
          next_action: string | null
          next_action_due: string | null
          note: string | null
          shortlist_tier: string | null
          stage_changed_at: string
          status: string
          target_id: string
          target_kind: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          athlete_id: string
          close_reason?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          match_score_at_save?: number | null
          match_snapshot?: Json | null
          next_action?: string | null
          next_action_due?: string | null
          note?: string | null
          shortlist_tier?: string | null
          stage_changed_at?: string
          status?: string
          target_id: string
          target_kind: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          athlete_id?: string
          close_reason?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          match_score_at_save?: number | null
          match_snapshot?: Json | null
          next_action?: string | null
          next_action_due?: string | null
          note?: string | null
          shortlist_tier?: string | null
          stage_changed_at?: string
          status?: string
          target_id?: string
          target_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "saved_items_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          filters: Json
          id: string
          label: string
          last_seen_at: string
          owner_id: string
          scope: string
          subject_id: string | null
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          label: string
          last_seen_at?: string
          owner_id: string
          scope?: string
          subject_id?: string | null
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          label?: string
          last_seen_at?: string
          owner_id?: string
          scope?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_assignments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          message: string | null
          organization_id: string | null
          plan_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string | null
          plan_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string | null
          plan_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlist_access: {
        Row: {
          access_role: string
          granted_at: string
          granted_by: string | null
          organization_id: string
          revoked_at: string | null
          shortlist_id: string
          user_id: string
        }
        Insert: {
          access_role: string
          granted_at?: string
          granted_by?: string | null
          organization_id: string
          revoked_at?: string | null
          shortlist_id: string
          user_id: string
        }
        Update: {
          access_role?: string
          granted_at?: string
          granted_by?: string | null
          organization_id?: string
          revoked_at?: string | null
          shortlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlist_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_access_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "org_shortlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_entries: {
        Row: {
          athlete_id: string
          created_at: string
          event_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          event_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "showcase_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "showcase_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "showcase_events"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          id: string
          sport_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          sport_id?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          sport_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_events_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_positions: {
        Row: {
          code: string
          id: number
          name_en: string
          name_es: string
          sport_id: string
        }
        Insert: {
          code: string
          id?: number
          name_en: string
          name_es: string
          sport_id: string
        }
        Update: {
          code?: string
          id?: number
          name_en?: string
          name_es?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_positions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_stat_definitions: {
        Row: {
          code: string
          higher_is_better: boolean
          id: number
          label_en: string
          label_es: string
          sort_order: number
          sport_id: string
          unit: string | null
        }
        Insert: {
          code: string
          higher_is_better?: boolean
          id?: number
          label_en: string
          label_es: string
          sort_order?: number
          sport_id: string
          unit?: string | null
        }
        Update: {
          code?: string
          higher_is_better?: boolean
          id?: number
          label_en?: string
          label_es?: string
          sort_order?: number
          sport_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_stat_definitions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          active: boolean
          id: string
          name_en: string
          name_es: string
        }
        Insert: {
          active?: boolean
          id: string
          name_en: string
          name_es: string
        }
        Update: {
          active?: boolean
          id?: string
          name_en?: string
          name_es?: string
        }
        Relationships: []
      }
      sports_seasons: {
        Row: {
          ends_on: string
          id: string
          label: string
          starts_on: string
        }
        Insert: {
          ends_on: string
          id: string
          label: string
          starts_on: string
        }
        Update: {
          ends_on?: string
          id?: string
          label?: string
          starts_on?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          outcome: string | null
          processed_at: string | null
          received_at: string
          stripe_created: string
          type: string
        }
        Insert: {
          id: string
          outcome?: string | null
          processed_at?: string | null
          received_at?: string
          stripe_created: string
          type: string
        }
        Update: {
          id?: string
          outcome?: string | null
          processed_at?: string | null
          received_at?: string
          stripe_created?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_account_id: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_event_at: string | null
          plan_code: string
          plan_version: number
          seats: number
          status: string
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_account_id: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_event_at?: string | null
          plan_code: string
          plan_version?: number
          seats?: number
          status: string
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_account_id?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_event_at?: string | null
          plan_code?: string
          plan_version?: number
          seats?: number
          status?: string
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_code_plan_version_fkey"
            columns: ["plan_code", "plan_version"]
            isOneToOne: false
            referencedRelation: "plan_catalog"
            referencedColumns: ["code", "version"]
          },
        ]
      }
      support_case_notes: {
        Row: {
          author_id: string | null
          body: string
          case_id: string
          created_at: string
          id: string
          internal: boolean
        }
        Insert: {
          author_id?: string | null
          body: string
          case_id: string
          created_at?: string
          id?: string
          internal?: boolean
        }
        Update: {
          author_id?: string | null
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          internal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "support_case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_to: string | null
          body: string
          category: string
          created_at: string
          id: string
          organization_id: string | null
          requester_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          body: string
          category?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          requester_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          requester_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_regions: {
        Row: {
          country: string
          region: string
        }
        Insert: {
          country: string
          region: string
        }
        Update: {
          country?: string
          region?: string
        }
        Relationships: []
      }
      trial_details: {
        Row: {
          accommodation: string
          additional_conditions: string | null
          capacity: number | null
          equipment_requirements: string | null
          meals: string
          min_participants: number | null
          minor_policy: string
          opportunity_id: string
          price_status: string
          refund_deadline: string | null
          refund_percentage: number | null
          refund_policy: string | null
          refundable: string
          registration_deadline: string | null
          registration_mode: string
          registration_status: string
          travel: string
          trial_type: string
          updated_at: string
          video_requirements: string | null
        }
        Insert: {
          accommodation?: string
          additional_conditions?: string | null
          capacity?: number | null
          equipment_requirements?: string | null
          meals?: string
          min_participants?: number | null
          minor_policy?: string
          opportunity_id: string
          price_status?: string
          refund_deadline?: string | null
          refund_percentage?: number | null
          refund_policy?: string | null
          refundable?: string
          registration_deadline?: string | null
          registration_mode?: string
          registration_status?: string
          travel?: string
          trial_type?: string
          updated_at?: string
          video_requirements?: string | null
        }
        Update: {
          accommodation?: string
          additional_conditions?: string | null
          capacity?: number | null
          equipment_requirements?: string | null
          meals?: string
          min_participants?: number | null
          minor_policy?: string
          opportunity_id?: string
          price_status?: string
          refund_deadline?: string | null
          refund_percentage?: number | null
          refund_policy?: string | null
          refundable?: string
          registration_deadline?: string | null
          registration_mode?: string
          registration_status?: string
          travel?: string
          trial_type?: string
          updated_at?: string
          video_requirements?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_details_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          feature: string
          period_start: string
          subject_id: string
          used: number
        }
        Insert: {
          feature: string
          period_start: string
          subject_id: string
          used?: number
        }
        Update: {
          feature?: string
          period_start?: string
          subject_id?: string
          used?: number
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          detail: string | null
          id: number
          method: string
          request_id: string
          result: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          detail?: string | null
          id?: never
          method: string
          request_id: string
          result: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          detail?: string | null
          id?: never
          method?: string
          request_id?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_checks_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_decisions: {
        Row: {
          created_at: string
          decision: string
          id: number
          new_status: string
          previous_status: string
          reason: string | null
          request_id: string
          restrictions: string | null
          review_by: string | null
          reviewer_id: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: never
          new_status: string
          previous_status: string
          reason?: string | null
          request_id: string
          restrictions?: string | null
          review_by?: string | null
          reviewer_id?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: never
          new_status?: string
          previous_status?: string
          reason?: string | null
          request_id?: string
          restrictions?: string | null
          review_by?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_decisions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_evidence: {
        Row: {
          classification: string
          evidence_type: string
          expires_at: string | null
          id: string
          reference_url: string | null
          request_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string | null
          submitted_at: string
          submitted_by: string
          validation_result: string
        }
        Insert: {
          classification?: string
          evidence_type: string
          expires_at?: string | null
          id?: string
          reference_url?: string | null
          request_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string | null
          submitted_at?: string
          submitted_by: string
          validation_result?: string
        }
        Update: {
          classification?: string
          evidence_type?: string
          expires_at?: string | null
          id?: string
          reference_url?: string | null
          request_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string
          validation_result?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_evidence_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_evidence_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          assigned_reviewer: string | null
          created_at: string
          decision: string | null
          decision_reason: string | null
          declared_role: string | null
          expires_at: string | null
          id: string
          institution_id: string | null
          legacy_claim_id: string | null
          organization_id: string | null
          program_id: string | null
          reviewed_at: string | null
          revoked_at: string | null
          risk_level: string
          status: string
          subject_user: string
          submitted_at: string | null
          updated_at: string
          verification_type: string
        }
        Insert: {
          assigned_reviewer?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          declared_role?: string | null
          expires_at?: string | null
          id?: string
          institution_id?: string | null
          legacy_claim_id?: string | null
          organization_id?: string | null
          program_id?: string | null
          reviewed_at?: string | null
          revoked_at?: string | null
          risk_level?: string
          status?: string
          subject_user: string
          submitted_at?: string | null
          updated_at?: string
          verification_type: string
        }
        Update: {
          assigned_reviewer?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          declared_role?: string | null
          expires_at?: string | null
          id?: string
          institution_id?: string | null
          legacy_claim_id?: string | null
          organization_id?: string | null
          program_id?: string | null
          reviewed_at?: string | null
          revoked_at?: string | null
          risk_level?: string
          status?: string
          subject_user?: string
          submitted_at?: string | null
          updated_at?: string
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_assigned_reviewer_fkey"
            columns: ["assigned_reviewer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "org_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_subject_user_fkey"
            columns: ["subject_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_representation_conflicts: {
        Row: {
          agency_a: string | null
          agency_b: string | null
          athlete_id: string | null
          detected_at: string | null
          end_a: string | null
          end_b: string | null
          id: string | null
          representation_a: string | null
          representation_b: string | null
          resolution: string | null
          start_a: string | null
          start_b: string | null
          status: string | null
          status_a: string | null
          status_b: string | null
          type_a: string | null
          type_b: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_representations_agency_id_fkey"
            columns: ["agency_a"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_agency_id_fkey"
            columns: ["agency_b"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agent_representations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agency_roster: {
        Row: {
          agency_id: string | null
          athlete_id: string | null
          end_date: string | null
          primary_agent_id: string | null
          representation_id: string | null
          representation_type: string | null
          roster_status: string | null
          start_date: string | null
        }
        Insert: {
          agency_id?: string | null
          athlete_id?: string | null
          end_date?: string | null
          primary_agent_id?: never
          representation_id?: string | null
          representation_type?: string | null
          roster_status?: never
          start_date?: string | null
        }
        Update: {
          agency_id?: string | null
          athlete_id?: string | null
          end_date?: string | null
          primary_agent_id?: never
          representation_id?: string | null
          representation_type?: string | null
          roster_status?: never
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_representations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_representations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agent_representations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      athlete_directory: {
        Row: {
          avatar_url: string | null
          city: string | null
          competitive_level: string | null
          country: string | null
          current_team: string | null
          display_name: string | null
          dominant_side: string | null
          english_level: string | null
          graduation_year: number | null
          has_verified_stats: boolean | null
          has_video: boolean | null
          headline: string | null
          height_cm: number | null
          league: string | null
          nationality: string | null
          open_to_opportunities: boolean | null
          primary_position_id: number | null
          secondary_position_id: number | null
          sport_id: string | null
          target_divisions: Database["public"]["Enums"]["division"][] | null
          updated_at: string | null
          user_id: string | null
          weight_kg: number | null
          years_experience: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_family_invitation: { Args: { p_token: string }; Returns: string }
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      accept_roster_invitation: {
        Args: { p_shares_progress?: boolean; p_token: string }
        Returns: string
      }
      athlete_block_fields: {
        Args: { p_athlete: string }
        Returns: {
          competitive_level: string
          current_team: string
          dominant_side: string
          height_cm: number
          highlight_video_url: string
          intended_major: string
          league: string
          target_divisions: Database["public"]["Enums"]["division"][]
          user_id: string
          weight_kg: number
          years_experience: number
        }[]
      }
      athlete_block_fields_many: {
        Args: { p_athletes: string[] }
        Returns: {
          competitive_level: string
          current_team: string
          dominant_side: string
          height_cm: number
          highlight_video_url: string
          intended_major: string
          league: string
          target_divisions: Database["public"]["Enums"]["division"][]
          user_id: string
          weight_kg: number
          years_experience: number
        }[]
      }
      active_guardians_with: {
        Args: { p_athlete: string; p_capability: string }
        Returns: string[]
      }
      has_contact_data: { Args: { p_text: string }; Returns: boolean }
      admin_agency_metrics: { Args: { p_days?: number }; Returns: Json }
      admin_ai_stats: {
        Args: never
        Returns: {
          avg_latency_ms: number
          errors: number
          fallbacks: number
          guards: number
          helpful: number
          input_tokens: number
          not_helpful: number
          output_tokens: number
          p95_latency_ms: number
          requests: number
          top_intents: Json
          users: number
        }[]
      }
      admin_approve: {
        Args: { p_approval: string; p_approve: boolean }
        Returns: string
      }
      admin_event_counts: {
        Args: { p_days?: number }
        Returns: {
          event: string
          total: number
          users: number
        }[]
      }
      admin_institution_quality: {
        Args: never
        Returns: {
          detail: string
          institution_id: string
          kind: string
          name: string
          state: string
        }[]
      }
      admin_jobs: {
        Args: never
        Returns: {
          jobname: string
          last_run: string
          last_status: string
          schedule: string
        }[]
      }
      admin_liquidity: {
        Args: never
        Returns: {
          demand: number
          position_id: number
          position_name: string
          sport_id: string
          supply: number
        }[]
      }
      admin_marketplace_metrics: { Args: { p_days?: number }; Returns: Json }
      admin_metrics: { Args: { p_days?: number }; Returns: Json }
      admin_platform_health: { Args: never; Returns: Json }
      admin_read_thread: {
        Args: { p_report: string; p_request: string }
        Returns: {
          body: string
          created_at: string
          id: number
          request_id: string
          sender_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "contact_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_request: {
        Args: { p_action: string; p_payload: Json; p_reason: string }
        Returns: string
      }
      admin_search: {
        Args: { p_query: string }
        Returns: {
          detail: string
          id: string
          kind: string
          label: string
        }[]
      }
      agency_can_read_notes: {
        Args: { p_agency: string; p_athlete: string }
        Returns: boolean
      }
      agency_invite_claim: { Args: { p_token: string }; Returns: string }
      guardian_attest: {
        Args: { p_link: string; p_version: string }
        Returns: string
      }
      guardian_review: {
        Args: { p_link: string; p_approve: boolean; p_reason: string }
        Returns: string
      }
      guardian_review_queue: {
        Args: Record<string, never>
        Returns: { link_id: string; parent_name: string; athlete_name: string; relationship: string; attested_at: string; auto_checks_ok: boolean }[]
      }
      guardian_verification_state: {
        Args: { p_link: string }
        Returns: string
      }
      admin_agency_trial_extend: {
        Args: { p_org: string; p_days: number; p_reason: string }
        Returns: string
      }
      contact_flag_discomfort: {
        Args: { p_note?: string; p_request: string }
        Returns: number
      }
      contact_mark_read: {
        Args: { p_request: string }
        Returns: undefined
      }
      contact_thread_frozen: {
        Args: { p_request: string }
        Returns: boolean
      }
      agency_plan_status: {
        Args: { p_org: string }
        Returns: { source: string; plan_code: string | null; trial_ends_at: string | null; athletes_limit: number; athletes_used: number; seats_limit: number; seats_used: number }[]
      }
      agency_founder_status: {
        Args: never
        Returns: { cap: number; remaining: number; taken: number }[]
      }
      agency_invite_create: {
        Args: { p_agency: string; p_name: string; p_email?: string; p_sport?: string; p_year?: number }
        Returns: { id: string; token: string }[]
      }
      agency_invite_preview: {
        Args: { p_token: string }
        Returns: { agency_name: string; agency_verified: boolean; valid: boolean }[]
      }
      agency_invite_reissue: { Args: { p_id: string }; Returns: string }
      agency_invite_revoke: { Args: { p_id: string }; Returns: undefined }
      agency_can_write: { Args: { p_agency: string }; Returns: boolean }
      agency_has_active_representation: {
        Args: { p_agency: string; p_athlete: string }
        Returns: boolean
      }
      agency_has_relationship: {
        Args: { p_agency: string; p_athlete: string }
        Returns: boolean
      }
      agency_manages: { Args: { p_agency: string }; Returns: boolean }
      agent_discovery_athlete: {
        Args: { p_athlete: string }
        Returns: Json
      }
      agent_can: {
        Args: {
          p_athlete: string
          p_category?: string
          p_country?: string
          p_opportunity?: string
          p_permission: string
          p_sport?: string
        }
        Returns: boolean
      }
      agent_can_via: {
        Args: {
          p_agency: string
          p_athlete: string
          p_category?: string
          p_country?: string
          p_opportunity?: string
          p_permission: string
          p_sport?: string
        }
        Returns: boolean
      }
      application_org: { Args: { p_application: string }; Returns: string }
      application_org_decide: {
        Args: { p_application: string; p_decision: string; p_message?: string }
        Returns: string
      }
      application_stage_for_athlete: {
        Args: { p: Database["public"]["Enums"]["application_status"] }
        Returns: string
      }
      athlete_age: { Args: { p_athlete: string }; Returns: number }
      athlete_blocks_org: {
        Args: { p_athlete: string; p_org: string }
        Returns: boolean
      }
      athlete_field_allows: {
        Args: { p_athlete: string; p_group: string; p_purpose: string }
        Returns: boolean
      }
      athlete_first_name: { Args: { p_athlete: string }; Returns: string }
      attendance_record: {
        Args: { p_check_in?: string; p_registration: string; p_status: string }
        Returns: string
      }
      audit: {
        Args: {
          p_action: string
          p_class?: string
          p_details?: Json
          p_entity: string
          p_entity_id: string
          p_org: string
          p_program?: string
          p_reason?: string
        }
        Returns: undefined
      }
      billing_account_ensure: { Args: { p_org?: string }; Returns: string }
      billing_apply_event: { Args: { p_event: Json }; Returns: string }
      billing_set_customer: {
        Args: { p_account: string; p_customer: string }
        Returns: undefined
      }
      brand_set: { Args: { p_on: boolean }; Returns: undefined }
      break_glass_open: {
        Args: {
          p_case?: string
          p_hours?: number
          p_reason: string
          p_subject: string
        }
        Returns: string
      }
      break_glass_review: { Args: { p_grant: string }; Returns: undefined }
      campaign_deliverable_review: {
        Args: { p_approve: boolean; p_deliverable: string; p_feedback?: string }
        Returns: string
      }
      campaign_deliverable_submit: {
        Args: { p_deliverable: string; p_note?: string; p_url: string }
        Returns: number
      }
      campaign_offer_respond: {
        Args: { p_accept: boolean; p_offer: string; p_reason?: string }
        Returns: string
      }
      campaign_offer_send: {
        Args: {
          p_application: string
          p_compensation_unknown?: boolean
          p_components: Json
          p_deliverables: Json
          p_ends_on?: string
          p_exclusivity_category: string
          p_exclusivity_days: number
          p_expires_days: number
          p_paid_media: boolean
          p_starts_on?: string
          p_terms?: string
          p_usage_channels: string[]
          p_usage_months: number
          p_usage_territory?: string
        }
        Returns: string
      }
      campaign_offer_withdraw: { Args: { p_offer: string }; Returns: string }
      campaign_offers_expire_due: { Args: never; Returns: number }
      campaign_org: { Args: { p_campaign: string }; Returns: string }
      campaign_payment_update: {
        Args: { p_offer: string; p_status: string }
        Returns: string
      }
      can_discover_athlete: {
        Args: { p_athlete: string; p_org: string }
        Returns: boolean
      }
      can_edit_shortlist: { Args: { p_list: string }; Returns: boolean }
      can_manage_recruiting_links: {
        Args: { p_athlete: string }
        Returns: boolean
      }
      can_see_billing_account: { Args: { p_account: string }; Returns: boolean }
      can_see_campaign_offer: { Args: { p_offer: string }; Returns: boolean }
      can_see_representation: { Args: { p_rep: string }; Returns: boolean }
      can_see_shortlist: { Args: { p_list: string }; Returns: boolean }
      can_view_athlete: {
        Args: { p_athlete: string; p_block?: string }
        Returns: boolean
      }
      case_access: {
        Args: {
          p_agency: string
          p_athlete: string
          p_sport?: string
          p_write: boolean
        }
        Returns: boolean
      }
      case_access_by_id: {
        Args: { p_case: string; p_write: boolean }
        Returns: boolean
      }
      case_outreach_create: {
        Args: { p_body: string; p_case: string; p_contact: string | null; p_email: string; p_subject: string }
        Returns: { id: string; token: string }[]
      }
      case_outreach_list: {
        Args: { p_case: string }
        Returns: {
          created_at: string
          id: string
          last_viewed_at: string | null
          link_active: boolean
          note: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          views: number
        }[]
      }
      case_outreach_mark: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: string
      }
      checkout_plan: {
        Args: { p_code: string }
        Returns: {
          audience: string
          billing_interval: string
          code: string
          currency: string
          founder: boolean
          name: string
          price_cents: number | null
          stripe_price_id: string | null
          version: number
        }[]
      }
      club_roster_summary: {
        Args: { p_org: string }
        Returns: {
          applications: number
          athlete_id: string
          best_status: string
          display_name: string
          graduation_year: number
          placed: boolean
          season: string
          shares_progress: boolean
          sport_id: string
        }[]
      }
      club_verify_statistic: {
        Args: { p_org: string; p_stat: string }
        Returns: undefined
      }
      confirm_opportunity_open: {
        Args: { p_opportunity: string }
        Returns: undefined
      }
      consent_granted: {
        Args: {
          p_athlete: string
          p_purpose: string
          p_target: string
          p_target_type: string
        }
        Returns: boolean
      }
      consent_record: {
        Args: {
          p_athlete: string
          p_expires_at?: string
          p_granted: boolean
          p_organization: string
          p_policy_version: string
          p_purpose: string
          p_target: string
          p_target_type: string
        }
        Returns: string
      }
      consume_ai_request: { Args: never; Returns: boolean }
      consume_usage: {
        Args: {
          p_amount?: number
          p_feature: string
          p_org?: string
          p_period?: string
        }
        Returns: number
      }
      create_payment_requirements: {
        Args: { p_enrollment: string; p_registration: string }
        Returns: number
      }
      credential_submit: { Args: { p_credential: string }; Returns: string }
      delete_my_account: { Args: { p_confirm: string }; Returns: undefined }
      discover_athlete_ids: {
        Args: {
          p_filters: Json
          p_org: string
          p_page?: number
          p_page_size?: number
        }
        Returns: {
          match_blocked: string[]
          total: number
          user_id: string
        }[]
      }
      discovery_consume: { Args: never; Returns: boolean }
      document_is_highly_restricted: {
        Args: { p_kind: string }
        Returns: boolean
      }
      document_open: { Args: { p_document: string }; Returns: string }
      document_owner: { Args: { p_path: string }; Returns: string }
      domain_matches: {
        Args: { p_domain: string; p_email_domain: string }
        Returns: boolean
      }
      effective_features: {
        Args: { p_org?: string; p_user: string }
        Returns: Json
      }
      email_verification_confirm: {
        Args: { p_id: string; p_token: string }
        Returns: boolean
      }
      email_verification_issue: { Args: { p_id: string }; Returns: string }
      email_verification_start: {
        Args: { p_email: string; p_org: string }
        Returns: string
      }
      enrollment_org_action: {
        Args: { p_action: string; p_enrollment: string; p_reason?: string }
        Returns: string
      }
      enrollment_respond: {
        Args: { p_action: string; p_enrollment: string }
        Returns: string
      }
      ensure_my_profile: { Args: never; Returns: boolean }
      expire_family_invitations: { Args: never; Returns: number }
      expire_info_grants: { Args: never; Returns: number }
      expire_professional_credentials: { Args: never; Returns: number }
      expire_stale_opportunities: { Args: never; Returns: number }
      family_link_admin_verify: { Args: { p_link: string }; Returns: undefined }
      family_link_lapsed: {
        Args: {
          p_athlete: string
          p_last_reviewed: string
          p_minor_link: boolean
        }
        Returns: boolean
      }
      family_link_restrict: {
        Args: { p_link: string; p_reason?: string; p_restrict: boolean }
        Returns: string
      }
      family_link_review: {
        Args: { p_keep: boolean; p_link: string }
        Returns: string
      }
      family_open_majority_reviews: { Args: never; Returns: number }
      family_review_due_at: { Args: { p_athlete: string }; Returns: string }
      feature_limit: {
        Args: { p_feature: string; p_org?: string }
        Returns: number
      }
      flag_enabled: { Args: { p_key: string }; Returns: boolean }
      flag_set: {
        Args: { p_enabled: boolean; p_key: string; p_reason: string }
        Returns: undefined
      }
      free_email_domain: { Args: { p_domain: string }; Returns: boolean }
      get_recruiting_card: {
        Args: { p_token: string }
        Returns: {
          avatar_url: string
          city: string
          country: string
          current_team: string
          display_name: string
          dominant_side: string
          english_score: string
          english_test: string
          expires_at: string
          gpa_4: number
          graduation_year: number
          headline: string
          height_cm: number
          intended_major: string
          is_minor: boolean
          position_name: string
          sat_score: number
          sport_name: string
          target_divisions: Database["public"]["Enums"]["division"][]
          video_url: string
        }[]
      }
      guardian_can_view_resource: {
        Args: { p_athlete: string; p_resource: string }
        Returns: boolean
      }
      guardian_has_scope: {
        Args: { p_athlete: string; p_scope: string }
        Returns: boolean
      }
      guardian_purpose: { Args: { p_purpose: string }; Returns: boolean }
      guardian_requirement_satisfied: {
        Args: {
          p_athlete: string
          p_purpose: string
          p_target: string
          p_target_type: string
        }
        Returns: boolean
      }
      has_admin_role: { Args: { p_role: string }; Returns: boolean }
      has_block_with: { Args: { p_other: string }; Returns: boolean }
      has_break_glass: { Args: { p_subject: string }; Returns: boolean }
      has_connection_with_athlete: {
        Args: { p_athlete: string }
        Returns: boolean
      }
      has_family_link: {
        Args: { p_athlete: string; p_capability?: string }
        Returns: boolean
      }
      has_plan: { Args: { p_plan: string; p_user: string }; Returns: boolean }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      host_of: { Args: { p_url: string }; Returns: string }
      invitation_respond: {
        Args: { p_action: string; p_invitation: string; p_reason?: string }
        Returns: string
      }
      is_active_agent_for: { Args: { p_athlete: string }; Returns: boolean }
      is_active_guardian: { Args: { p_athlete: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_by_athlete: { Args: { p_athlete: string }; Returns: boolean }
      is_blocked_by_user: { Args: { p_target: string }; Returns: boolean }
      is_club_admin: { Args: { p_org: string }; Returns: boolean }
      is_club_admin_org_verified: { Args: { p_org: string }; Returns: boolean }
      is_contact_participant: { Args: { p_request: string }; Returns: boolean }
      is_guardian_of: { Args: { p_athlete: string }; Returns: boolean }
      is_listed_adult_profile: { Args: { p_id: string }; Returns: boolean }
      is_minor: { Args: { p_user: string }; Returns: boolean }
      is_minor_guardian_of: { Args: { p_athlete: string }; Returns: boolean }
      is_org_member: {
        Args: { p_admin_only?: boolean; p_org: string }
        Returns: boolean
      }
      is_restricted: {
        Args: { p_org: string; p_scope: string; p_user: string }
        Returns: boolean
      }
      is_verified_recruiter: { Args: never; Returns: boolean }
      log_ai_event: {
        Args: {
          p_id: string
          p_input: number
          p_intent: string
          p_latency: number
          p_mode: string
          p_model: string
          p_outcome: string
          p_output: number
          p_page: string
          p_provider: string
          p_tools: number
        }
        Returns: undefined
      }
      log_document_access: { Args: { p_request: string }; Returns: string }
      log_event: {
        Args: { p_dedupe?: string; p_event: string; p_props?: Json }
        Returns: undefined
      }
      minor_contact_mode: {
        Args: { p_athlete: string; p_org: string }
        Returns: string
      }
      minor_has_active_family: { Args: { p_athlete: string }; Returns: boolean }
      moderation_act: {
        Args: {
          p_action: string
          p_case?: string
          p_days?: number
          p_reason: string
          p_report?: string
          p_scopes?: string[]
          p_subject_org?: string
          p_subject_user?: string
        }
        Returns: string
      }
      moderation_appeal: {
        Args: { p_action: string; p_body: string }
        Returns: string
      }
      moderation_appeal_decide: {
        Args: { p_appeal: string; p_overturn: boolean; p_reason: string }
        Returns: undefined
      }
      moderation_revert: {
        Args: { p_action: string; p_reason: string }
        Returns: undefined
      }
      my_referral_code: { Args: never; Returns: string }
      my_referral_count: { Args: never; Returns: number }
      ncaa_contact_opens_on: {
        Args: {
          p_division: Database["public"]["Enums"]["division"]
          p_grad_year: number
          p_sport: string
        }
        Returns: string
      }
      notification_category: { Args: { p_kind: string }; Returns: string }
      notify: {
        Args: {
          p_body: string
          p_kind: string
          p_link: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      notify_org_expiring: { Args: never; Returns: number }
      notify_pipeline_tasks: { Args: never; Returns: number }
      notify_upcoming_deadlines: { Args: never; Returns: number }
      only_nulled:
        | {
            Args: { p_cols: string[]; p_new: Json; p_old: Json }
            Returns: boolean
          }
        | {
            Args: { p_cols: string[]; p_new: Json; p_old: Json; p_rel: unknown }
            Returns: boolean
          }
      opportunity_confirmed_count: { Args: { p_opp: string }; Returns: number }
      opportunity_is_public: {
        Args: { p_opportunity: string }
        Returns: boolean
      }
      opportunity_publish_gaps: { Args: { p_opp: string }; Returns: string[] }
      opportunity_red_flags: {
        Args: {
          p_aid: number
          p_cost: number
          p_deadline: string
          p_description: string
          p_source: string
        }
        Returns: string[]
      }
      opportunity_rep_category: {
        Args: { p_type: Database["public"]["Enums"]["opportunity_type"] }
        Returns: string
      }
      opportunity_visible_confirmed_count: {
        Args: { p_opp: string }
        Returns: number
      }
      org_can: {
        Args: { p_cap: string; p_org: string; p_program?: string }
        Returns: boolean
      }
      org_can_opp: {
        Args: { p_cap: string; p_opportunity: string }
        Returns: boolean
      }
      org_can_scope: {
        Args: {
          p_cap: string
          p_org: string
          p_program: string
          p_team: string
        }
        Returns: boolean
      }
      org_domain_matches: { Args: { p_org: string }; Returns: boolean }
      org_has_document_grant: { Args: { p_document: string }; Returns: boolean }
      org_log: {
        Args: {
          p_athlete: string
          p_detail?: Json
          p_kind: string
          p_org: string
        }
        Returns: undefined
      }
      org_name_key: { Args: { p_name: string }; Returns: string }
      org_policy_version: { Args: never; Returns: string }
      org_record_offer: {
        Args: {
          p_aid: number
          p_annual_cost: number
          p_candidate: string
          p_deadline: string
          p_in_writing: boolean
          p_renewable: string
          p_type: string
        }
        Returns: string
      }
      org_reinstate_member: {
        Args: { p_org: string; p_user: string }
        Returns: undefined
      }
      org_role_caps: { Args: { p_role: string }; Returns: string[] }
      org_staff_notify: {
        Args: {
          p_body: string
          p_kind: string
          p_link: string
          p_org: string
          p_title: string
        }
        Returns: undefined
      }
      org_suspend_member: {
        Args: { p_org: string; p_reason: string; p_user: string }
        Returns: undefined
      }
      org_transfer_ownership: {
        Args: { p_org: string; p_user: string }
        Returns: undefined
      }
      org_type_group: { Args: { p_type: string }; Returns: string }
      outcome_record: {
        Args: {
          p_athlete_message?: string
          p_internal_note?: string
          p_outcome: string
          p_registration: string
        }
        Returns: string
      }
      outreach_issue_invite: { Args: { p_id: string }; Returns: string }
      outreach_preview: {
        Args: { p_token: string }
        Returns: {
          organization_name: string
          segment: string
          status: string
          valid: boolean
        }[]
      }
      outreach_respond: {
        Args: { p_answer: string; p_token: string }
        Returns: string
      }
      outreach_revert_invite: { Args: { p_id: string }; Returns: undefined }
      participation_actor: {
        Args: { p_agency: string; p_athlete: string }
        Returns: string
      }
      participation_notify: {
        Args: {
          p_athlete: string
          p_body: string
          p_kind: string
          p_opp: string
          p_title: string
        }
        Returns: undefined
      }
      passport_view_stats: {
        Args: { p_athlete: string }
        Returns: {
          club_views: number
          organizations: string[]
          total_views: number
          unique_members: number
          university_views: number
        }[]
      }
      pipeline_stage_rank: { Args: { p: string }; Returns: number }
      preview_family_invitation: {
        Args: { p_token: string }
        Returns: {
          expects_role: Database["public"]["Enums"]["app_role"]
          inviter_name: string
          inviter_role: Database["public"]["Enums"]["app_role"]
          valid: boolean
        }[]
      }
      preview_organization_invitation: {
        Args: { p_token: string }
        Returns: {
          organization_name: string
          organization_type: Database["public"]["Enums"]["org_type"]
          valid: boolean
        }[]
      }
      preview_roster_invitation: {
        Args: { p_token: string }
        Returns: {
          organization_name: string
          organization_type: Database["public"]["Enums"]["org_type"]
          season: string
          valid: boolean
        }[]
      }
      program_in_org: {
        Args: { p_org: string; p_program: string }
        Returns: boolean
      }
      rate_limit_hit: {
        Args: { p_bucket: string; p_max: number; p_window: string }
        Returns: undefined
      }
      rate_limit_prune: { Args: never; Returns: number }
      record_passport_view: { Args: { p_athlete: string }; Returns: undefined }
      referral_claim: { Args: { p_code: string }; Returns: boolean }
      registration_became_registered: {
        Args: { p_reg: string }
        Returns: undefined
      }
      registration_open_check: { Args: { p_opp: string }; Returns: undefined }
      rep_set: { Args: { p_on: boolean }; Returns: undefined }
      representation_activate: { Args: { p_id: string }; Returns: string }
      representation_add_agreement: {
        Args: {
          p_document: string
          p_from: string
          p_id: string
          p_until: string
        }
        Returns: string
      }
      representation_assign: {
        Args: { p_id: string; p_role: string; p_user: string }
        Returns: string
      }
      representation_attest_fees: {
        Args: { p_representation: string; p_version?: string }
        Returns: string
      }
      representation_conflict_resolve: {
        Args: { p_activate?: string; p_conflict: string; p_resolution: string }
        Returns: undefined
      }
      representation_covers: {
        Args: {
          p_category: string
          p_country: string
          p_opportunity: string
          p_rep: string
          p_sport: string
        }
        Returns: boolean
      }
      representation_effective: { Args: { p_rep: string }; Returns: boolean }
      representation_end: {
        Args: { p_id: string; p_reason?: string }
        Returns: string
      }
      representation_expire_due: { Args: never; Returns: number }
      representation_guardian_decide: {
        Args: { p_approve: boolean; p_id: string }
        Returns: string
      }
      representation_invite: {
        Args: { p_agency: string; p_athlete: string }
        Returns: string
      }
      representation_permission_catalog: { Args: never; Returns: string[] }
      representation_renew: {
        Args: { p_end: string; p_id: string }
        Returns: undefined
      }
      representation_request: {
        Args: {
          p_agency: string
          p_athlete: string
          p_categories: string[]
          p_end: string
          p_message?: string
          p_opportunity?: string
          p_permissions: string[]
          p_sports: string[]
          p_start?: string
          p_territories: string[]
          p_type: string
        }
        Returns: string
      }
      representation_respond: {
        Args: { p_accept: boolean; p_id: string }
        Returns: string
      }
      representation_set_permissions: {
        Args: { p_id: string; p_permissions: string[] }
        Returns: undefined
      }
      representation_suspend: {
        Args: { p_id: string; p_reason: string; p_suspend: boolean }
        Returns: string
      }
      representation_unassign: {
        Args: { p_assignment: string }
        Returns: undefined
      }
      requires_guardian_consent: {
        Args: { p_action: string; p_athlete: string }
        Returns: boolean
      }
      respond_info_request: {
        Args: {
          p_document?: string
          p_id: string
          p_share: boolean
          p_until?: string
        }
        Returns: undefined
      }
      run_retention: { Args: never; Returns: Json }
      safety_case_note: {
        Args: { p_body: string; p_case: string; p_kind: string }
        Returns: undefined
      }
      safety_case_open: {
        Args: {
          p_category: string
          p_priority: string
          p_reports?: string[]
          p_subject_org?: string
          p_subject_user?: string
          p_title: string
        }
        Returns: string
      }
      safety_case_set_status: {
        Args: { p_case: string; p_status: string }
        Returns: undefined
      }
      seat_assign: {
        Args: { p_assign: boolean; p_subscription: string; p_user: string }
        Returns: undefined
      }
      shortlist_promote: {
        Args: {
          p_athlete: string
          p_list: string
          p_need?: string
          p_opportunity?: string
        }
        Returns: string
      }
      shortlist_role: { Args: { p_list: string }; Returns: string }
      start_recruiting_from_trial: {
        Args: { p_need?: string; p_registration: string }
        Returns: string
      }
      support_case_update: {
        Args: {
          p_case: string
          p_note?: string
          p_public?: boolean
          p_status: string
        }
        Returns: undefined
      }
      team_in_org: {
        Args: { p_org: string; p_program?: string; p_team: string }
        Returns: boolean
      }
      territories_overlap: {
        Args: { a: string[]; b: string[] }
        Returns: boolean
      }
      territory_covers: {
        Args: { p_country: string; p_list: string[] }
        Returns: boolean
      }
      trial_actor: {
        Args: { p_agency: string; p_athlete: string }
        Returns: string
      }
      trial_log: {
        Args: {
          p_actor: string
          p_detail: string
          p_from: string
          p_reg: string
          p_to: string
        }
        Returns: undefined
      }
      trial_notify: {
        Args: { p_body: string; p_kind: string; p_reg: string; p_title: string }
        Returns: undefined
      }
      trial_org_action: {
        Args: { p_action: string; p_outcome?: string; p_registration: string }
        Returns: string
      }
      trial_org_invite: {
        Args: {
          p_athlete: string
          p_message?: string
          p_opportunity: string
          p_shortlist?: string
          p_source?: string
        }
        Returns: string
      }
      trial_register: {
        Args: { p_agency?: string; p_athlete: string; p_opportunity: string }
        Returns: string
      }
      trial_respond: {
        Args: { p_action: string; p_registration: string }
        Returns: string
      }
      verification_decide: {
        Args: {
          p_decision: string
          p_reason: string
          p_request: string
          p_restrictions?: string
          p_role?: Database["public"]["Enums"]["org_member_role"]
        }
        Returns: undefined
      }
      verification_submit: {
        Args: {
          p_declared_role?: string
          p_org: string
          p_program?: string
          p_type: string
        }
        Returns: string
      }
      verification_summary: {
        Args: { p_org: string; p_user?: string }
        Returns: Json
      }
      verified_credentials: {
        Args: { p_user: string }
        Returns: {
          country: string
          credential_type: string
          expires_on: string
          issuing_body: string
          sport_id: string
        }[]
      }
      viewer_is_minor: { Args: { p_user: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "athlete"
        | "parent"
        | "university"
        | "coach"
        | "agent"
        | "brand"
        | "admin"
      application_status:
        | "applied"
        | "reviewed"
        | "contacted"
        | "information_requested"
        | "interview"
        | "tryout"
        | "shortlist"
        | "offer"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "waitlisted"
        | "expired"
      data_source: "self_reported" | "documented" | "club_verified"
      division: "ncaa_d1" | "ncaa_d2" | "ncaa_d3" | "naia" | "njcaa"
      link_status: "pending" | "approved" | "revoked" | "restricted" | "expired"
      opportunity_status:
        | "draft"
        | "pending_review"
        | "published"
        | "rejected"
        | "expired"
        | "closed"
        | "filled"
        | "paused"
        | "archived"
      opportunity_type:
        | "athletic_scholarship"
        | "university_recruitment"
        | "club_recruitment"
        | "academy"
        | "tryout"
        | "camp_showcase"
        | "development_program"
      org_member_role:
        | "admin"
        | "recruiter"
        | "coach"
        | "owner"
        | "head_coach"
        | "assistant_coach"
        | "recruiting_coordinator"
        | "admissions"
        | "compliance"
        | "staff"
        | "athletic_director"
        | "analyst"
        | "viewer"
      org_type:
        | "university"
        | "college"
        | "club"
        | "academy"
        | "agency"
        | "brand"
      verification_status: "unverified" | "submitted" | "verified" | "rejected"
      visibility_level:
        | "public"
        | "members"
        | "verified_orgs"
        | "connections"
        | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "athlete",
        "parent",
        "university",
        "coach",
        "agent",
        "brand",
        "admin",
      ],
      application_status: [
        "applied",
        "reviewed",
        "contacted",
        "information_requested",
        "interview",
        "tryout",
        "shortlist",
        "offer",
        "accepted",
        "declined",
        "withdrawn",
        "waitlisted",
        "expired",
      ],
      data_source: ["self_reported", "documented", "club_verified"],
      division: ["ncaa_d1", "ncaa_d2", "ncaa_d3", "naia", "njcaa"],
      link_status: ["pending", "approved", "revoked", "restricted", "expired"],
      opportunity_status: [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "expired",
        "closed",
        "filled",
        "paused",
        "archived",
      ],
      opportunity_type: [
        "athletic_scholarship",
        "university_recruitment",
        "club_recruitment",
        "academy",
        "tryout",
        "camp_showcase",
        "development_program",
      ],
      org_member_role: [
        "admin",
        "recruiter",
        "coach",
        "owner",
        "head_coach",
        "assistant_coach",
        "recruiting_coordinator",
        "admissions",
        "compliance",
        "staff",
        "athletic_director",
        "analyst",
        "viewer",
      ],
      org_type: ["university", "college", "club", "academy", "agency", "brand"],
      verification_status: ["unverified", "submitted", "verified", "rejected"],
      visibility_level: [
        "public",
        "members",
        "verified_orgs",
        "connections",
        "private",
      ],
    },
  },
} as const
