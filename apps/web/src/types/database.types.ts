// ==============================================================================
// Automatycznie wygenerowane typy bazy danych Silver Care (PostgreSQL/Supabase)
// Wygenerowano: 2026-11-22T20:32:21.324Z
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
      active_impersonation_sessions: {
        Row: {
          actor_id: string
          session_id: string
          target_admin_id: string
          organization_id: string
          expires_at: string
        }
        Insert: {
          actor_id: string
          session_id: string
          target_admin_id: string
          organization_id: string
          expires_at: string
        }
        Update: {
          actor_id?: string
          session_id?: string
          target_admin_id?: string
          organization_id?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_impersonation_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          search_title: string | null
          family_visible: boolean
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
          search_title?: string | null
          family_visible?: boolean
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
          search_title?: string | null
          family_visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "bed_assignments_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "consent_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_ledger_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "daily_logs_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "daily_reports_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "external_wearable_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_wearable_links_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "family_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_messages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      family_voice_report_provenance: {
        Row: {
          resident_id: string
          report_day: string
          report_id: string
          last_generated_fingerprint: string
          source_segment_ids: unknown[]
        }
        Insert: {
          resident_id: string
          report_day: string
          report_id: string
          last_generated_fingerprint: string
          source_segment_ids: unknown[]
        }
        Update: {
          resident_id?: string
          report_day?: string
          report_id?: string
          last_generated_fingerprint?: string
          source_segment_ids?: unknown[]
        }
        Relationships: [
          {
            foreignKeyName: "family_voice_report_provenance_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_voice_report_provenance_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_defaults: {
        Row: {
          feature_key: string
          default_enabled: boolean
          depends_on: unknown[]
        }
        Insert: {
          feature_key: string
          default_enabled: boolean
          depends_on: unknown[]
        }
        Update: {
          feature_key?: string
          default_enabled?: boolean
          depends_on?: unknown[]
        }
        Relationships: [
        ]
      }
      operational_report_jobs: {
        Row: {
          organization_id: string
          category_code: string
          period_start: string
          period_end: string
          lease_token: string | null
          available_at: string
          attempts: number
          completed_at: string | null
        }
        Insert: {
          organization_id: string
          category_code: string
          period_start: string
          period_end: string
          lease_token?: string | null
          available_at?: string
          attempts?: number
          completed_at?: string | null
        }
        Update: {
          organization_id?: string
          category_code?: string
          period_start?: string
          period_end?: string
          lease_token?: string | null
          available_at?: string
          attempts?: number
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_report_jobs_organization_id_category_code_fkey"
            columns: ["organization_id", "category_code"]
            isOneToOne: false
            referencedRelation: "organization_report_configs"
            referencedColumns: ["organization_id", "category_code"]
          },
        ]
      }
      operational_reports: {
        Row: {
          id: string
          organization_id: string
          category_code: string
          period_start: string
          period_end: string
          source_event_ids: unknown[]
          content: Json
          status: string
          requires_regeneration: boolean
          ai_model: string
          ai_prompt_version: string
          ai_generated_at: string
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category_code: string
          period_start: string
          period_end: string
          source_event_ids: unknown[]
          content: Json
          status?: string
          requires_regeneration?: boolean
          ai_model: string
          ai_prompt_version: string
          ai_generated_at: string
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category_code?: string
          period_start?: string
          period_end?: string
          source_event_ids?: unknown[]
          content?: Json
          status?: string
          requires_regeneration?: boolean
          ai_model?: string
          ai_prompt_version?: string
          ai_generated_at?: string
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_reports_organization_id_category_code_fkey"
            columns: ["organization_id", "category_code"]
            isOneToOne: false
            referencedRelation: "organization_report_configs"
            referencedColumns: ["organization_id", "category_code"]
          },
          {
            foreignKeyName: "operational_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_feature_flags: {
        Row: {
          organization_id: string
          feature_key: string
          enabled: boolean
          updated_by: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          feature_key: string
          enabled: boolean
          updated_by: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          feature_key?: string
          enabled?: boolean
          updated_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_flags_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_flag_defaults"
            referencedColumns: ["feature_key"]
          },
          {
            foreignKeyName: "organization_feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_report_configs: {
        Row: {
          id: string
          organization_id: string
          category_code: string
          category_label: string
          classifier_hint: string
          is_enabled: boolean
          schedule_mode: string
          allowed_sections: unknown[]
          recipient_roles: unknown[]
          requires_approval: boolean
          retention_days: number
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category_code: string
          category_label: string
          classifier_hint?: string
          is_enabled?: boolean
          schedule_mode: string
          allowed_sections: unknown[]
          recipient_roles: unknown[]
          requires_approval?: boolean
          retention_days?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category_code?: string
          category_label?: string
          classifier_hint?: string
          is_enabled?: boolean
          schedule_mode?: string
          allowed_sections?: unknown[]
          recipient_roles?: unknown[]
          requires_approval?: boolean
          retention_days?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_report_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          address: string | null
          resident_limit: number | null
          search_name: string | null
          settings: Json
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          address?: string | null
          resident_limit?: number | null
          search_name?: string | null
          settings?: Json
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          address?: string | null
          resident_limit?: number | null
          search_name?: string | null
          settings?: Json
        }
        Relationships: [
        ]
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
        Relationships: [
        ]
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
        Relationships: [
          {
            foreignKeyName: "physiological_data_ingest_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physiological_data_ingest_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "polar_oauth_tokens_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: true
            referencedRelation: "external_wearable_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polar_oauth_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "report_feedback_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "resident_care_level_history_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_death_reports: {
        Row: {
          resident_id: string
          organization_id: string
          reported_death_date: string
          notes: string | null
          task_ids: unknown[]
          reported_at: string
          reported_by: string
        }
        Insert: {
          resident_id: string
          organization_id: string
          reported_death_date: string
          notes?: string | null
          task_ids?: unknown[]
          reported_at?: string
          reported_by: string
        }
        Update: {
          resident_id?: string
          organization_id?: string
          reported_death_date?: string
          notes?: string | null
          task_ids?: unknown[]
          reported_at?: string
          reported_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_death_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_death_reports_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "resident_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_events_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_funding: {
        Row: {
          resident_id: string
          organization_id: string
          funding_source: string
          updated_by: string
          updated_at: string
        }
        Insert: {
          resident_id: string
          organization_id: string
          funding_source: string
          updated_by: string
          updated_at?: string
        }
        Update: {
          resident_id?: string
          organization_id?: string
          funding_source?: string
          updated_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_funding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_funding_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "resident_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_invitations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
          uploaded_by: string
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
        Relationships: [
          {
            foreignKeyName: "resident_media_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "resident_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_packages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_relative_links: {
        Row: {
          id: string
          resident_id: string
          relative_user_id: string
          relationship_code: string
          role: string
          created_at: string
          is_primary_contact: boolean
        }
        Insert: {
          id?: string
          resident_id: string
          relative_user_id: string
          relationship_code: string
          role: string
          created_at?: string
          is_primary_contact?: boolean
        }
        Update: {
          id?: string
          resident_id?: string
          relative_user_id?: string
          relationship_code?: string
          role?: string
          created_at?: string
          is_primary_contact?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "resident_relative_links_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
          contract_document_path: string | null
          contract_document_name: string | null
          search_name: string | null
          photo_path: string | null
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
          contract_document_path?: string | null
          contract_document_name?: string | null
          search_name?: string | null
          photo_path?: string | null
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
          contract_document_path?: string | null
          contract_document_name?: string | null
          search_name?: string | null
          photo_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          free_beds?: number
          occupied_beds?: number
          bed_count?: number
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
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "security_access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_definitions: {
        Row: {
          id: string
          organization_id: string
          code: string
          name: string
          start_time: string
          end_time: string
          crosses_midnight: boolean | null
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          code: string
          name: string
          start_time: string
          end_time: string
          crosses_midnight?: boolean | null
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          code?: string
          name?: string
          start_time?: string
          end_time?: string
          crosses_midnight?: boolean | null
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_plan_approvals: {
        Row: {
          id: string
          organization_id: string
          shift_definition_id: string
          shift_date: string
          version: number
          approved_by: string
          approved_at: string
          printed_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          shift_definition_id: string
          shift_date: string
          version: number
          approved_by: string
          approved_at?: string
          printed_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          shift_definition_id?: string
          shift_date?: string
          version?: number
          approved_by?: string
          approved_at?: string
          printed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shift_plan_approvals_definition"
            columns: ["shift_definition_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shift_plan_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_roster: {
        Row: {
          id: string
          organization_id: string
          shift_definition_id: string
          shift_date: string
          user_id: string
          is_shift_lead: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          shift_definition_id: string
          shift_date: string
          user_id: string
          is_shift_lead?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          shift_definition_id?: string
          shift_date?: string
          user_id?: string
          is_shift_lead?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shift_roster_definition"
            columns: ["shift_definition_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shift_roster_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_task_voice_suggestions: {
        Row: {
          author_attribution: string
          author_id: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          draft_id: string | null
          draft_updated_at: string | null
          fragment_index: number
          id: string
          kind: string
          organization_id: string
          quote: string
          received_at: string
          recorded_at: string
          resident_id: string | null
          result_task_id: string | null
          segment_id: string | null
          shift_date: string
          shift_definition_id: string
          source_id: string
          source_kind: string
          task_id: string
          task_updated_at: string
        }
        Insert: {
          author_attribution: string
          author_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          draft_id?: string | null
          draft_updated_at?: string | null
          fragment_index: number
          id?: string
          kind: string
          organization_id: string
          quote: string
          received_at: string
          recorded_at: string
          resident_id?: string | null
          result_task_id?: string | null
          segment_id?: string | null
          shift_date: string
          shift_definition_id: string
          source_id: string
          source_kind: string
          task_id: string
          task_updated_at: string
        }
        Update: {
          author_attribution?: string
          author_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          draft_id?: string | null
          draft_updated_at?: string | null
          fragment_index?: number
          id?: string
          kind?: string
          organization_id?: string
          quote?: string
          received_at?: string
          recorded_at?: string
          resident_id?: string | null
          result_task_id?: string | null
          segment_id?: string | null
          shift_date?: string
          shift_definition_id?: string
          source_id?: string
          source_kind?: string
          task_id?: string
          task_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_task_voice_suggestions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "voice_draft_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_task_voice_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_task_voice_suggestions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "resident_sync_status"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "shift_task_voice_suggestions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_task_voice_suggestions_segment_id_organization_id_fkey"
            columns: ["segment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_segments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shift_task_voice_suggestions_shift_definition_id_organizat_fkey"
            columns: ["shift_definition_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shift_task_voice_suggestions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "shift_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_tasks: {
        Row: {
          id: string
          organization_id: string
          shift_definition_id: string
          shift_date: string
          resident_id: string | null
          assignee_user_id: string | null
          title: string
          due_time: string | null
          source: string
          source_ref: string | null
          source_quote: string | null
          carried_from_task_id: string | null
          status: string
          cancel_reason: string | null
          created_by: string
          settled_by: string | null
          settled_at: string | null
          plan_version: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          shift_definition_id: string
          shift_date: string
          resident_id?: string | null
          assignee_user_id?: string | null
          title: string
          due_time?: string | null
          source?: string
          source_ref?: string | null
          source_quote?: string | null
          carried_from_task_id?: string | null
          status?: string
          cancel_reason?: string | null
          created_by: string
          settled_by?: string | null
          settled_at?: string | null
          plan_version?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          shift_definition_id?: string
          shift_date?: string
          resident_id?: string | null
          assignee_user_id?: string | null
          title?: string
          due_time?: string | null
          source?: string
          source_ref?: string | null
          source_quote?: string | null
          carried_from_task_id?: string | null
          status?: string
          cancel_reason?: string | null
          created_by?: string
          settled_by?: string | null
          settled_at?: string | null
          plan_version?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shift_tasks_definition"
            columns: ["shift_definition_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "shift_tasks_carried_from_task_id_fkey"
            columns: ["carried_from_task_id"]
            isOneToOne: false
            referencedRelation: "shift_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_tasks_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          id: string
          title: string
          message: string
          severity: string
          status: string
          affected_services: unknown[]
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          title: string
          message: string
          severity?: string
          status?: string
          affected_services?: unknown[]
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          message?: string
          severity?: string
          status?: string
          affected_services?: unknown[]
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
        ]
      }
      voice_app_report_jobs: {
        Row: {
          draft_id: string
          token: string | null
          available_at: string
          attempts: number
          completed_at: string | null
        }
        Insert: {
          draft_id: string
          token?: string | null
          available_at?: string
          attempts?: number
          completed_at?: string | null
        }
        Update: {
          draft_id?: string
          token?: string | null
          available_at?: string
          attempts?: number
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_app_report_jobs_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "voice_draft_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_assignment_queue: {
        Row: {
          segment_id: string
          organization_id: string
          shift_definition_id: string | null
          shift_date: string | null
          reasons: unknown[]
          candidates: unknown[]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          version: number
        }
        Insert: {
          segment_id: string
          organization_id: string
          shift_definition_id?: string | null
          shift_date?: string | null
          reasons: unknown[]
          candidates?: unknown[]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          version?: number
        }
        Update: {
          segment_id?: string
          organization_id?: string
          shift_definition_id?: string | null
          shift_date?: string | null
          reasons?: unknown[]
          candidates?: unknown[]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_assignment_queue_segment_id_organization_id_fkey"
            columns: ["segment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_segments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "voice_assignment_queue_shift_definition_id_organization_id_fkey"
            columns: ["shift_definition_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      voice_captures: {
        Row: {
          id: string
          organization_id: string
          source: string
          source_key: string
          storage_path: string
          sha256: string
          author_id: string | null
          selected_resident_id: string | null
          device_id: string | null
          session_id: string | null
          session_seq: number | null
          recorded_at: string
          received_at: string
          clock_state: string
          status: string
          processing_token: string | null
          processing_started_at: string | null
          processing_attempts: number
          declared_author_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          source: string
          source_key: string
          storage_path: string
          sha256: string
          author_id?: string | null
          selected_resident_id?: string | null
          device_id?: string | null
          session_id?: string | null
          session_seq?: number | null
          recorded_at: string
          received_at?: string
          clock_state?: string
          status?: string
          processing_token?: string | null
          processing_started_at?: string | null
          processing_attempts?: number
          declared_author_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          source?: string
          source_key?: string
          storage_path?: string
          sha256?: string
          author_id?: string | null
          selected_resident_id?: string | null
          device_id?: string | null
          session_id?: string | null
          session_seq?: number | null
          recorded_at?: string
          received_at?: string
          clock_state?: string
          status?: string
          processing_token?: string | null
          processing_started_at?: string | null
          processing_attempts?: number
          declared_author_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_captures_device_id_organization_id_fkey"
            columns: ["device_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_devices"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "voice_captures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_captures_selected_resident_id_fkey"
            columns: ["selected_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_device_assignments: {
        Row: {
          id: string
          organization_id: string
          device_id: string
          user_id: string
          started_at: string
          ended_at: string | null
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          device_id: string
          user_id: string
          started_at?: string
          ended_at?: string | null
          assigned_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          device_id?: string
          user_id?: string
          started_at?: string
          ended_at?: string | null
          assigned_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_voice_device_assignments_device"
            columns: ["device_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_devices"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      voice_devices: {
        Row: {
          id: string
          organization_id: string
          label: string
          token_hash: string
          firmware_version: string | null
          last_sync_at: string | null
          revoked_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          label: string
          token_hash: string
          firmware_version?: string | null
          last_sync_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          label?: string
          token_hash?: string
          firmware_version?: string | null
          last_sync_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "voice_draft_notes_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_retention_settings: {
        Row: {
          organization_id: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          organization_id: string
          retention_days: number
          updated_at?: string
        }
        Update: {
          organization_id?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_retention_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sanitized_events: {
        Row: {
          id: string
          organization_id: string
          draft_note_id: string | null
          segment_id: string | null
          capture_source: string
          scope: string
          resident_id: string | null
          author_id: string
          sanitized_text: string
          matched_categories: unknown[]
          recorded_at: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          draft_note_id?: string | null
          segment_id?: string | null
          capture_source: string
          scope: string
          resident_id?: string | null
          author_id: string
          sanitized_text: string
          matched_categories: unknown[]
          recorded_at: string
          metadata: Json
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          draft_note_id?: string | null
          segment_id?: string | null
          capture_source?: string
          scope?: string
          resident_id?: string | null
          author_id?: string
          sanitized_text?: string
          matched_categories?: unknown[]
          recorded_at?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_sanitized_events_draft_note_id_fkey"
            columns: ["draft_note_id"]
            isOneToOne: false
            referencedRelation: "voice_draft_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sanitized_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sanitized_events_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sanitized_events_segment_id_organization_id_fkey"
            columns: ["segment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_segments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      voice_segment_proposals: {
        Row: {
          segment_id: string
          organization_id: string
          capture_id: string
          resident_id: string | null
          author_id: string
          recorded_at: string
          time_state: string
          behavioral_facts: unknown[]
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          family_decision: string | null
        }
        Insert: {
          segment_id: string
          organization_id: string
          capture_id: string
          resident_id?: string | null
          author_id: string
          recorded_at: string
          time_state: string
          behavioral_facts: unknown[]
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          family_decision?: string | null
        }
        Update: {
          segment_id?: string
          organization_id?: string
          capture_id?: string
          resident_id?: string | null
          author_id?: string
          recorded_at?: string
          time_state?: string
          behavioral_facts?: unknown[]
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          family_decision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_segment_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_segment_proposals_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_segments: {
        Row: {
          id: string
          organization_id: string
          capture_id: string
          ordinal: number
          start_ms: number
          end_ms: number
          transcript_path: string | null
          assignment_status: string
          resident_id: string | null
          author_id: string | null
          author_attribution: string
          projection_status: string
          projection_token: string | null
          projection_attempted_at: string | null
          projection_attempts: number
          corrected_at: string | null
          event_occurred_at: string | null
          parent_segment_id: string | null
          derived_start_at: string | null
          transcription_status: string | null
          transcription_token: string | null
          transcription_queue_version: number | null
          transcription_started_at: string | null
          transcription_attempts: number
        }
        Insert: {
          id?: string
          organization_id: string
          capture_id: string
          ordinal: number
          start_ms: number
          end_ms: number
          transcript_path?: string | null
          assignment_status?: string
          resident_id?: string | null
          author_id?: string | null
          author_attribution?: string
          projection_status?: string
          projection_token?: string | null
          projection_attempted_at?: string | null
          projection_attempts?: number
          corrected_at?: string | null
          event_occurred_at?: string | null
          parent_segment_id?: string | null
          derived_start_at?: string | null
          transcription_status?: string | null
          transcription_token?: string | null
          transcription_queue_version?: number | null
          transcription_started_at?: string | null
          transcription_attempts?: number
        }
        Update: {
          id?: string
          organization_id?: string
          capture_id?: string
          ordinal?: number
          start_ms?: number
          end_ms?: number
          transcript_path?: string | null
          assignment_status?: string
          resident_id?: string | null
          author_id?: string | null
          author_attribution?: string
          projection_status?: string
          projection_token?: string | null
          projection_attempted_at?: string | null
          projection_attempts?: number
          corrected_at?: string | null
          event_occurred_at?: string | null
          parent_segment_id?: string | null
          derived_start_at?: string | null
          transcription_status?: string | null
          transcription_token?: string | null
          transcription_queue_version?: number | null
          transcription_started_at?: string | null
          transcription_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_segment_parent_source"
            columns: ["parent_segment_id", "capture_id"]
            isOneToOne: false
            referencedRelation: "voice_segments"
            referencedColumns: ["id", "capture_id"]
          },
          {
            foreignKeyName: "voice_segments_capture_id_organization_id_fkey"
            columns: ["capture_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "voice_captures"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "voice_segments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_storage_deletions: {
        Row: {
          path: string
          queued_at: string
          lease_token: string | null
          leased_until: string | null
        }
        Insert: {
          path: string
          queued_at?: string
          lease_token?: string | null
          leased_until?: string | null
        }
        Update: {
          path?: string
          queued_at?: string
          lease_token?: string | null
          leased_until?: string | null
        }
        Relationships: [
        ]
      }
    }
    Views: {
      resident_sync_status: {
        Row: {
          resident_id: string | null
          organization_id: string | null
          seconds_since_last_ping: number | null
          sync_state: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      split_voice_segment: {
        Args: {
          p_segment_id: string
          p_expected_version: number
          p_request_id: string
          p_parts: Json
        }
        Returns: Json
      }
      sync_voice_task_suggestions: {
        Args: {
          p_draft_id: string | null
          p_matches: Json
          p_segment_id: string | null
          p_token: string
        }
        Returns: Json
      }
      decide_shift_task_voice_suggestion: {
        Args: {
          p_decision: string
          p_evidence_id: string
          p_reason: string | null
          p_target_date: string | null
          p_target_definition_id: string | null
        }
        Returns: string
      }
      record_app_voice_task_draft: {
        Args: {
          p_audio_hash: string
          p_author_id: string
          p_client_uuid: string
          p_recorded_at: string
          p_resident_id: string
          p_transcript: string
        }
        Returns: Json
      }
      admit_resident_with_bed: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_pesel_hash: string
          p_gender: string
          p_birth_date: string
          p_care_level: string
          p_is_zsn?: boolean | null
          p_bed_id?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      approve_operational_report: {
        Args: {
          p_report_id: string
        }
        Returns: Database["public"]["Tables"]["operational_reports"]["Row"] | null
      }
      bed_count: {
        Args: {
          r: Database["public"]["Tables"]["rooms"]["Row"]
        }
        Returns: number
      }
      cancel_resident_death_report_atomic: {
        Args: {
          p_resident_id: string
        }
        Returns: undefined
      }
      check_mfa_requirement: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      staff_mfa_satisfied: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      claim_due_operational_report: {
        Args: {
          p_organization_id?: string | null
          p_now?: string | null
        }
        Returns: Json
      }
      claim_processed_app_voice_draft: {
        Args: {
          p_draft_id?: string | null
        }
        Returns: Json
      }
      can_play_voice_segment: {
        Args: {
          p_segment_id: string
        }
        Returns: boolean
      }
      claim_voice_capture: {
        Args: {
          p_capture_id?: string | null
        }
        Returns: Database["public"]["Tables"]["voice_captures"]["Row"][]
      }
      claim_voice_segment_projection: {
        Args: {
          p_segment_id?: string | null
        }
        Returns: Json
      }
      claim_voice_storage_deletions: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["voice_storage_deletions"]["Row"][]
      }
      cleanup_expired_operational_reports: {
        Args: {
          p_org_id?: string | null
        }
        Returns: Json
      }
      cleanup_voice_drafts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      complete_operational_report_job: {
        Args: {
          p_token: string
          p_success: boolean
        }
        Returns: boolean
      }
      complete_processed_app_voice_draft: {
        Args: {
          p_draft_id: string
          p_token: string
          p_result: Json
        }
        Returns: boolean
      }
      claim_voice_segment_transcription: {
        Args: {
          p_segment_id?: string | null
        }
        Returns: Json
      }
      complete_voice_capture_failure: {
        Args: {
          p_capture_id: string
          p_token: string
          p_retry: boolean
        }
        Returns: boolean
      }
      complete_voice_segment_projection: {
        Args: {
          p_segment_id: string
          p_token: string
          p_result: Json
        }
        Returns: boolean
      }
      configure_organization_report_category: {
        Args: {
          p_org_id: string
          p_category_code: string
          p_is_enabled: string
          p_schedule_mode: string
          p_allowed_sections_json: string
          p_recipient_roles_json: string
          p_retention_days?: string | null
        }
        Returns: Database["public"]["Tables"]["organization_report_configs"]["Row"] | null
      }
      declare_voice_capture_author: {
        Args: {
          p_capture_id: string
          p_token: string
          p_author_id: string
        }
        Returns: undefined
      }
      enforce_retention_policy: {
        Args: {
          years_to_keep: number
        }
        Returns: undefined
      }
      correct_voice_segment_time: {
        Args: {
          p_segment_id: string
          p_expected_version: number
          p_request_id: string
          p_mode: string
          p_basis: string
          p_local_start?: string | null
          p_utc_offset_minutes?: number | null
          p_shift_definition_id?: string | null
          p_shift_date?: string | null
        }
        Returns: Json
      }
      expire_voice_captures: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      f_unaccent: {
        Args: {
          input: string
        }
        Returns: string
      }
      family_has_active_link_in_org: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      fetch_next_voice_job: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["voice_draft_notes"]["Row"] | null
      }
      fetch_pending_outbox_notifications: {
        Args: {
          p_batch_size?: number | null
          p_lock_timeout_minutes?: number | null
        }
        Returns: Database["public"]["Tables"]["outbox_notifications"]["Row"][]
      }
      finalize_voice_capture: {
        Args: {
          p_capture_id: string
          p_token: string
          p_segments: Json
        }
        Returns: number
      }
      finish_impersonation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      finish_voice_segment_transcription: {
        Args: {
          p_segment_id: string
          p_token: string
          p_result?: Json | null
          p_unavailable?: boolean | null
        }
        Returns: boolean
      }
      finish_voice_storage_deletions: {
        Args: {
          p_token: string
        }
        Returns: number
      }
      fn_admissions_by_month_care_level: {
        Args: {
          p_org_id: string
          p_year?: number | null
        }
        Returns: {
          admission_month: number
          care_level: string
          cnt: number
        }[]
      }
      fn_care_level_stats: {
        Args: {
          p_org_id: string
        }
        Returns: {
          care_level: string
          resident_count: number
        }[]
      }
      fn_contract_end_reasons: {
        Args: {
          p_org_id: string
          p_year?: number | null
        }
        Returns: {
          end_reason: string
          event_month: number
          cnt: number
        }[]
      }
      fn_contract_sources: {
        Args: {
          p_org_id: string
          p_year?: number | null
        }
        Returns: {
          source: string
          cnt: number
        }[]
      }
      fn_daily_report: {
        Args: {
          p_org_id: string
          p_year: number
          p_month: number
        }
        Returns: {
          report_date: string
          total_residents: number
          zsn_count: number
          deaths: number
          contracts_signed: number
          contracts_ended: number
          delta_change: number
          available_beds: number
          occupied_beds: number
        }[]
      }
      fn_deaths_by_stay_length: {
        Args: {
          p_org_id: string
        }
        Returns: {
          stay_range: string
          cnt: number
        }[]
      }
      fn_monthly_summary: {
        Args: {
          p_org_id: string
          p_year: number
          p_month: number
        }
        Returns: {
          avg_residents: number
          avg_zsn: number
          total_deaths: number
          total_contracts_signed: number
          total_contracts_ended: number
          net_change: number
          total_revenue: number
        }[]
      }
      fn_occupancy_kpi: {
        Args: {
          p_org_id: string
        }
        Returns: {
          total_beds: number
          occupied_beds: number
          free_beds: number
          occupancy_rate: number
          active_residents: number
          zsn_count: number
          zsn_percentage: number
          deaths_this_month: number
          contracts_signed_this_month: number
          contracts_ended_this_month: number
        }[]
      }
      free_beds: {
        Args: {
          r: Database["public"]["Tables"]["rooms"]["Row"]
        }
        Returns: number
      }
      get_family_resident_overview: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          first_name: string
          last_name: string
          photo_path: string
          death_date: string
          contract_end_date: string
          archived_at: string
        }[]
      }
      get_jwt_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_org_feature_flags: {
        Args: {
          p_org_id: string
        }
        Returns: {
          feature_key: string
          enabled: boolean
        }[]
      }
      get_organization_report_configs: {
        Args: {
          p_org_id: string
        }
        Returns: Database["public"]["Tables"]["organization_report_configs"]["Row"][]
      }
      get_superadmin_organization_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          organization_id: string
          organization_name: string
          address: string
          resident_limit: number
          created_at: string
          active_resident_count: number
          staff_count: number
          administrator_count: number
          active_bed_count: number
          over_capacity_limit: boolean
        }[]
      }
      handle_outbox_notification_attempt: {
        Args: {
          p_notification_id: string
          p_success: boolean
          p_error_message?: string | null
        }
        Returns: undefined
      }
      hard_delete_resident: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      has_org_feature: {
        Args: {
          p_org_id: string
          p_feature_key: string
        }
        Returns: boolean
      }
      has_resident_org_feature: {
        Args: {
          p_resident_id: string
          p_feature_key: string
        }
        Returns: boolean
      }
      is_medical_agenda_item: {
        Args: {
          p_title: string
          p_type: string
        }
        Returns: boolean
      }
      is_relative_active_or_retained: {
        Args: {
          target_resident_id: string
        }
        Returns: boolean
      }
      is_relative_linked: {
        Args: {
          target_resident_id: string
        }
        Returns: boolean
      }
      is_shift_lead: {
        Args: {
          p_shift_definition_id: string
          p_shift_date: string
        }
        Returns: boolean
      }
      is_shift_lead_now: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_access_denied: {
        Args: {
          p_org_id: string
          p_resident_id: string
          p_action: string
          p_payload: Json
        }
        Returns: undefined
      }
      log_impersonation_start: {
        Args: {
          p_target_admin_id: string
          p_target_org_id: string
        }
        Returns: undefined
      }
      log_impersonation_stop: {
        Args: {
          p_target_admin_id: string
          p_target_org_id: string
        }
        Returns: undefined
      }
      log_password_reset: {
        Args: {
          p_target_user_id: string
          p_organization_id?: string | null
        }
        Returns: undefined
      }
      log_pesel_access_attempt: {
        Args: {
          p_resident_id: string
          p_status: string
          p_reason: string
        }
        Returns: undefined
      }
      log_role_change: {
        Args: {
          p_target_user_id: string
          p_new_role: string
          p_previous_role?: string | null
          p_organization_id?: string | null
        }
        Returns: undefined
      }
      log_self_password_change: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      log_staff_management_action: {
        Args: {
          p_target_user_id: string
          p_action: string
          p_organization_id: string
        }
        Returns: undefined
      }
      normalize_and_ingest: {
        Args: {
          p_org_id: string
          p_res_id: string
          p_provider: string
          p_metric: string
          p_raw_value: string
          p_dedup_id: string
        }
        Returns: undefined
      }
      occupied_beds: {
        Args: {
          r: Database["public"]["Tables"]["rooms"]["Row"]
        }
        Returns: number
      }
      process_ingest_batch: {
        Args: {
          p_org_id: string
          p_res_id: string
          p_provider: string
          p_payloads: Json
        }
        Returns: Json
      }
      process_ingest_payload: {
        Args: {
          p_org_id: string
          p_res_id: string
          p_metric: string
          p_value: number
          p_dedup_id: string
        }
        Returns: undefined
      }
      process_voice_draft_atomic: {
        Args: {
          p_draft_id: string
          p_resident_id: string
          p_nurse_id: string
          p_daily_log_data: Json
          p_report_content: Json
          p_ai_model?: string | null
          p_ai_prompt_version?: string | null
          p_ai_generated_at?: string | null
          p_organization_id?: string | null
        }
        Returns: Json
      }
      provision_organization: {
        Args: {
          p_org_name: string
          p_admin_email: string
          p_address?: string | null
          p_resident_limit?: number | null
          p_admin_full_name?: string | null
        }
        Returns: string
      }
      read_operational_report_material: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      queue_abandoned_voice_transcripts: {
        Args: { p_capture_id: string; p_paths: string[] }
        Returns: number
      }
      read_voice_capture_context: {
        Args: {
          p_capture_id: string
          p_token: string
        }
        Returns: Json
      }
      record_generated_operational_report: {
        Args: {
          p_org_id: string
          p_category_code: string
          p_period_start: string
          p_period_end: string
          p_source_event_ids_json: string
          p_content_json: string
          p_ai_model: string
          p_ai_prompt_version: string
          p_ai_generated_at: string
        }
        Returns: Database["public"]["Tables"]["operational_reports"]["Row"] | null
      }
      record_shift_plan_print: {
        Args: {
          p_shift_definition_id: string
          p_shift_date: string
          p_expected_version: number
        }
        Returns: number
      }
      record_voice_sanitized_event: {
        Args: {
          p_org_id: string
          p_draft_note_id: string
          p_capture_source: string
          p_scope: string
          p_resident_id: string
          p_author_id: string
          p_sanitized_text: string
          p_matched_categories_json: string
          p_recorded_at: string
          p_metadata_json: string
        }
        Returns: Database["public"]["Tables"]["voice_sanitized_events"]["Row"] | null
      }
      register_stored_device_capture: {
        Args: {
          p_device_id: string
          p_source_key: string
          p_session_id: string
          p_session_seq: number
          p_storage_path: string
          p_sha256: string
          p_recorded_at: string
          p_clock_state: string
        }
        Returns: string
      }
      report_resident_death_atomic: {
        Args: {
          p_resident_id: string
          p_death_date: string
          p_notes?: string | null
          p_tasks?: Json | null
        }
        Returns: undefined
      }
      resident_photo_readable: {
        Args: {
          p_name: string
        }
        Returns: boolean
      }
      resident_photo_target: {
        Args: {
          p_name: string
        }
        Returns: {
          organization_id: string
          resident_id: string
        }[]
      }
      resident_photo_writable: {
        Args: {
          p_name: string
        }
        Returns: boolean
      }
      review_voice_segment_scope: {
        Args: {
          p_segment_id: string
          p_expected_version: number
          p_request_id: string
          p_scope: string
          p_resident_id?: string | null
          p_author_id?: string | null
        }
        Returns: Json
      }
      resolve_voice_segment: {
        Args: {
          p_segment_id: string
          p_scope: string
          p_resident_id?: string | null
          p_author_id?: string | null
        }
        Returns: string
      }
      review_voice_family_facts: {
        Args: {
          p_segment_id: string
          p_accept: boolean
        }
        Returns: string
      }
      revoke_consent: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      revoke_invitation: {
        Args: {
          p_invitation_id: string
        }
        Returns: undefined
      }
      set_organization_feature_flag: {
        Args: {
          p_org_id: string
          p_feature_key: string
          p_enabled: boolean
        }
        Returns: Json
      }
      set_voice_capture_retention: {
        Args: {
          p_organization_id: string
          p_days: number
        }
        Returns: number
      }
      settle_shift_task: {
        Args: {
          p_task_id: string
          p_path: string
          p_reason: string
          p_target_definition_id: string
          p_target_date: string
        }
        Returns: string
      }
      transfer_resident_bed: {
        Args: {
          p_resident_id: string
          p_new_bed_id: string
        }
        Returns: undefined
      }
      upsert_organization_report_category: {
        Args: {
          p_org_id: string
          p_category_code: string
          p_category_label: string
          p_classifier_hint?: string | null
          p_is_enabled?: string | null
          p_schedule_mode?: string | null
          p_allowed_sections_json?: string | null
          p_recipient_roles_json?: string | null
          p_requires_approval?: string | null
          p_retention_days?: string | null
          p_archived_at?: string | null
        }
        Returns: Database["public"]["Tables"]["organization_report_configs"]["Row"] | null
      }
    }
    Enums: {
      [_ in string]: string
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends | keyof (Database["public"]["Tables"] & Database["public"]["Views"]) | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"]) : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] & Database["public"]["Views"])
  ? (Database["public"]["Tables"] & Database["public"]["Views"])[PublicTableNameOrOptions] extends { Row: infer R } ? R : never : never

export type TablesInsert<
  PublicTableNameOrOptions extends | keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"] : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends { Insert: infer I } ? I : never : never

export type TablesUpdate<
  PublicTableNameOrOptions extends | keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"] : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends { Update: infer U } ? U : never : never

export type Enums<
  PublicEnumNameOrOptions extends | keyof Database["public"]["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"] : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions] : never
