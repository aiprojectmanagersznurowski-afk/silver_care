// ==============================================================================
// Automatycznie wygenerowane typy bazy danych Silver Care (PostgreSQL/Supabase)
// Wygenerowano: 2026-09-22T11:05:31.482Z
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agenda_items: {
        Row: {
          id: string
          organization_id: string
          resident_id: string | null
          title: string
          time: string
          type: string
          created_at: string
          is_template: boolean
          target_date: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          resident_id?: string | null
          title: string
          time: string
          type: string
          created_at?: string
          is_template?: boolean
          target_date?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string | null
          title?: string
          time?: string
          type?: string
          created_at?: string
          is_template?: boolean
          target_date?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string | null
          resident_id: string | null
          action: string
          performed_by: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          resident_id?: string | null
          action: string
          performed_by?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          resident_id?: string | null
          action?: string
          performed_by?: string | null
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      bed_assignments: {
        Row: {
          id: string
          bed_id: string
          resident_id: string
          assigned_at: string
          unassigned_at: string | null
        }
        Insert: {
          id?: string
          bed_id: string
          resident_id: string
          assigned_at?: string
          unassigned_at?: string | null
        }
        Update: {
          id?: string
          bed_id?: string
          resident_id?: string
          assigned_at?: string
          unassigned_at?: string | null
        }
        Relationships: []
      }
      beds: {
        Row: {
          id: string
          room_id: string
          label: string
          created_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          room_id: string
          label: string
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          room_id?: string
          label?: string
          created_at?: string
          is_active?: boolean
        }
        Relationships: []
      }
      consent_ledger: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          purpose: string
          granted_by: string
          granted_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          resident_id: string
          purpose: string
          granted_by: string
          granted_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          purpose?: string
          granted_by?: string
          granted_at?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          id: string
          resident_id: string
          nurse_id: string
          data: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          resident_id: string
          nurse_id: string
          data?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          resident_id?: string
          nurse_id?: string
          data?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          id: string
          resident_id: string
          author_id: string
          approved_by: string | null
          content: Json
          status: string
          ai_generated: boolean | null
          created_at: string | null
          updated_at: string | null
          ai_model: string | null
          ai_prompt_version: string | null
          ai_generated_at: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          resident_id: string
          author_id: string
          approved_by?: string | null
          content?: Json
          status?: string
          ai_generated?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          ai_model?: string | null
          ai_prompt_version?: string | null
          ai_generated_at?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          resident_id?: string
          author_id?: string
          approved_by?: string | null
          content?: Json
          status?: string
          ai_generated?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          ai_model?: string | null
          ai_prompt_version?: string | null
          ai_generated_at?: string | null
          approved_at?: string | null
        }
        Relationships: []
      }
      external_wearable_links: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          provider: string
          external_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          resident_id: string
          provider: string
          external_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          provider?: string
          external_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      family_messages: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          relative_user_id: string
          content: string
          created_at: string
          is_from_family: boolean
          staff_user_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          resident_id: string
          relative_user_id: string
          content: string
          created_at?: string
          is_from_family?: boolean
          staff_user_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          relative_user_id?: string
          content?: string
          created_at?: string
          is_from_family?: boolean
          staff_user_id?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          address: string | null
          resident_limit: number | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          address?: string | null
          resident_limit?: number | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          address?: string | null
          resident_limit?: number | null
        }
        Relationships: []
      }
      outbox_notifications: {
        Row: {
          id: string
          organization_id: string
          entity_type: string
          entity_id: string
          payload: Json
          status: string
          created_at: string
          attempts: number
          max_attempts: number
          locked_at: string | null
          next_retry_at: string
          last_error: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          entity_type: string
          entity_id: string
          payload: Json
          status?: string
          created_at?: string
          attempts?: number
          max_attempts?: number
          locked_at?: string | null
          next_retry_at?: string
          last_error?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          entity_type?: string
          entity_id?: string
          payload?: Json
          status?: string
          created_at?: string
          attempts?: number
          max_attempts?: number
          locked_at?: string | null
          next_retry_at?: string
          last_error?: string | null
        }
        Relationships: []
      }
      physiological_data_ingest: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          metric: string
          value: number
          recorded_at: string
          created_at: string
          deduplication_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          resident_id: string
          metric: string
          value: number
          recorded_at?: string
          created_at?: string
          deduplication_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          metric?: string
          value?: number
          recorded_at?: string
          created_at?: string
          deduplication_id?: string | null
        }
        Relationships: []
      }
      polar_oauth_tokens: {
        Row: {
          id: string
          link_id: string
          organization_id: string
          access_token: string
          token_type: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          link_id: string
          organization_id: string
          access_token: string
          token_type?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          link_id?: string
          organization_id?: string
          access_token?: string
          token_type?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_feedback: {
        Row: {
          id: string
          report_id: string
          reporter_id: string
          category: string
          snapshot: Json
          prompt_version: string
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          reporter_id: string
          category: string
          snapshot: Json
          prompt_version: string
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          reporter_id?: string
          category?: string
          snapshot?: Json
          prompt_version?: string
          created_at?: string
        }
        Relationships: []
      }
      resident_care_level_history: {
        Row: {
          id: string
          resident_id: string
          care_level: string
          changed_at: string
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          resident_id: string
          care_level: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          resident_id?: string
          care_level?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      resident_events: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          event_type: string
          event_date: string
          event_reason: string | null
          metadata: Json
          performed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          resident_id: string
          event_type: string
          event_date?: string
          event_reason?: string | null
          metadata?: Json
          performed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          event_type?: string
          event_date?: string
          event_reason?: string | null
          metadata?: Json
          performed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      resident_invitations: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          role: string
          expires_at: string
          revoked_at: string | null
          claimed_at: string | null
          created_at: string
          email: string | null
          phone: string | null
        }
        Insert: {
          id?: string
          organization_id?: string
          resident_id: string
          role: string
          expires_at?: string
          revoked_at?: string | null
          claimed_at?: string | null
          created_at?: string
          email?: string | null
          phone?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          role?: string
          expires_at?: string
          revoked_at?: string | null
          claimed_at?: string | null
          created_at?: string
          email?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      resident_media: {
        Row: {
          id: string
          resident_id: string
          storage_path: string
          content_type: string
          captured_at: string
          created_at: string
          uploaded_by: string
        }
        Insert: {
          id?: string
          resident_id: string
          storage_path: string
          content_type: string
          captured_at?: string
          created_at?: string
          uploaded_by?: string
        }
        Update: {
          id?: string
          resident_id?: string
          storage_path?: string
          content_type?: string
          captured_at?: string
          created_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      resident_packages: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          package_type: string
          package_name: string
          monthly_rate: number | null
          started_at: string
          ended_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          resident_id: string
          package_type: string
          package_name: string
          monthly_rate?: number | null
          started_at?: string
          ended_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          resident_id?: string
          package_type?: string
          package_name?: string
          monthly_rate?: number | null
          started_at?: string
          ended_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      resident_relative_links: {
        Row: {
          id: string
          resident_id: string
          relative_user_id: string
          relationship_code: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          resident_id: string
          relative_user_id: string
          relationship_code: string
          role: string
          created_at?: string
        }
        Update: {
          id?: string
          resident_id?: string
          relative_user_id?: string
          relationship_code?: string
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          id: string
          organization_id: string
          first_name: string
          last_name: string
          pesel_hash: string | null
          created_at: string
          archived_at: string | null
          avatar_url: string | null
          birth_date: string | null
          gender: string | null
          admission_date: string | null
          contract_start_date: string | null
          contract_end_date: string | null
          contract_end_reason: string | null
          death_date: string | null
          care_level: string | null
          contract_source: string | null
          contract_monthly_rate: number | null
          notes: string | null
          is_zsn: boolean
          pesel_encrypted: string | null
        }
        Insert: {
          id?: string
          organization_id?: string
          first_name: string
          last_name: string
          pesel_hash?: string | null
          created_at?: string
          archived_at?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          gender?: string | null
          admission_date?: string | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          contract_end_reason?: string | null
          death_date?: string | null
          care_level?: string | null
          contract_source?: string | null
          contract_monthly_rate?: number | null
          notes?: string | null
          is_zsn?: boolean
          pesel_encrypted?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          first_name?: string
          last_name?: string
          pesel_hash?: string | null
          created_at?: string
          archived_at?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          gender?: string | null
          admission_date?: string | null
          contract_start_date?: string | null
          contract_end_date?: string | null
          contract_end_reason?: string | null
          death_date?: string | null
          care_level?: string | null
          contract_source?: string | null
          contract_monthly_rate?: number | null
          notes?: string | null
          is_zsn?: boolean
          pesel_encrypted?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          number: string
          organization_id: string
          created_at: string
          floor: string
          sector: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          number: string
          organization_id?: string
          created_at?: string
          floor?: string
          sector?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          number?: string
          organization_id?: string
          created_at?: string
          floor?: string
          sector?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      security_access_logs: {
        Row: {
          id: string
          organization_id: string | null
          action: string
          performed_by: string
          payload: Json
          created_at: string | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          action: string
          performed_by: string
          payload?: Json
          created_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          action?: string
          performed_by?: string
          payload?: Json
          created_at?: string | null
        }
        Relationships: []
      }
      voice_draft_notes: {
        Row: {
          id: string
          resident_id: string
          nurse_id: string
          audio_url: string
          transcript: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
          followup_question: string | null
          client_uuid: string | null
          async_status: string | null
          attempts: number
          max_attempts: number
          last_error: string | null
          processing_started_at: string | null
        }
        Insert: {
          id?: string
          resident_id: string
          nurse_id: string
          audio_url: string
          transcript?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          followup_question?: string | null
          client_uuid?: string | null
          async_status?: string | null
          attempts?: number
          max_attempts?: number
          last_error?: string | null
          processing_started_at?: string | null
        }
        Update: {
          id?: string
          resident_id?: string
          nurse_id?: string
          audio_url?: string
          transcript?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          followup_question?: string | null
          client_uuid?: string | null
          async_status?: string | null
          attempts?: number
          max_attempts?: number
          last_error?: string | null
          processing_started_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in string]: {
        Row: Record<string, unknown>
      }
    }
    Functions: {
      [_ in string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      [_ in string]: string
    }
  }
}
