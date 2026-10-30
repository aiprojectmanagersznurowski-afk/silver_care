// ==============================================================================
// Automatycznie wygenerowane typy bazy danych Silver Care (PostgreSQL/Supabase)
// Wygenerowano: 2026-10-30T17:33:21.936Z
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
          death_reported_at: string | null
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
          death_reported_at?: string | null
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
          death_reported_at?: string | null
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
          bed_count?: number
          free_beds?: number
          occupied_beds?: number
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
            columns: ["shift_definition_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_shift_plan_approvals_definition"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shift_plan_approvals_definition"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_shift_plan_approvals_definition"
            columns: ["shift_definition_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id"]
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
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shift_roster_definition"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_shift_roster_definition"
            columns: ["shift_definition_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_shift_roster_definition"
            columns: ["shift_definition_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id"]
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
            columns: ["shift_definition_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_shift_tasks_definition"
            columns: ["shift_definition_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shift_tasks_definition"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_shift_tasks_definition"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "shift_definitions"
            referencedColumns: ["id"]
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
      bed_count: {
        Args: {
          r: Database["public"]["Tables"]["rooms"]["Row"]
        }
        Returns: number
      }
      check_mfa_requirement: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      cleanup_voice_drafts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      enforce_retention_policy: {
        Args: {
          years_to_keep: number
        }
        Returns: undefined
      }
      f_unaccent: {
        Args: {
          input: string
        }
        Returns: string
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
      get_jwt_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
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
