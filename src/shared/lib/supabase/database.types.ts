// Auto-generated from Supabase project ztaozvgmzycetiwwkhjc

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ab_experiments: {
        Row: {
          conversions_a: number
          conversions_b: number
          created_at: string
          id: string
          is_active: boolean
          sends_a: number
          sends_b: number
          step_id: string
          traffic_split: number
          updated_at: string
          variant_a_key: string
          variant_b_key: string
          winner: string | null
        }
        Insert: {
          conversions_a?: number
          conversions_b?: number
          created_at?: string
          id?: string
          is_active?: boolean
          sends_a?: number
          sends_b?: number
          step_id: string
          traffic_split?: number
          updated_at?: string
          variant_a_key: string
          variant_b_key: string
          winner?: string | null
        }
        Update: {
          conversions_a?: number
          conversions_b?: number
          created_at?: string
          id?: string
          is_active?: boolean
          sends_a?: number
          sends_b?: number
          step_id?: string
          traffic_split?: number
          updated_at?: string
          variant_a_key?: string
          variant_b_key?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_experiments_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      abandoned_carts: {
        Row: {
          abandoned_at: string
          checkout_url: string | null
          client_id: string
          converted_at: string | null
          created_at: string
          customer_id: string | null
          email_hash: string | null
          external_id: string | null
          id: string
          items: Json
          metadata: Json
          phone_hash: string | null
          status: string
          value_cents: number
        }
        Insert: {
          abandoned_at?: string
          checkout_url?: string | null
          client_id: string
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email_hash?: string | null
          external_id?: string | null
          id?: string
          items?: Json
          metadata?: Json
          phone_hash?: string | null
          status?: string
          value_cents?: number
        }
        Update: {
          abandoned_at?: string
          checkout_url?: string | null
          client_id?: string
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email_hash?: string | null
          external_id?: string | null
          id?: string
          items?: Json
          metadata?: Json
          phone_hash?: string | null
          status?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          client_id: string
          created_at: string
          currency: string
          external_id: string
          id: string
          is_active: boolean
          name: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          currency?: string
          external_id: string
          id?: string
          is_active?: boolean
          name?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string
          external_id?: string
          id?: string
          is_active?: boolean
          name?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          client_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          resource: string
          resource_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          resource: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          resource?: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_enrollments: {
        Row: {
          client_id: string
          context: Json
          current_step_index: number
          customer_id: string | null
          enrolled_at: string
          id: string
          next_run_at: string
          sequence_id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          context?: Json
          current_step_index?: number
          customer_id?: string | null
          enrolled_at?: string
          id?: string
          next_run_at?: string
          sequence_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          context?: Json
          current_step_index?: number
          customer_id?: string | null
          enrolled_at?: string
          id?: string
          next_run_at?: string
          sequence_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_enrollments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_enrollments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          customer_id: string | null
          enrollment_id: string | null
          flow_id: string | null
          id: string
          metadata: Json
          sent_at: string
          sequence_id: string | null
          status: string
          step_id: string | null
        }
        Insert: {
          customer_id?: string | null
          enrollment_id?: string | null
          flow_id?: string | null
          id?: string
          metadata?: Json
          sent_at?: string
          sequence_id?: string | null
          status: string
          step_id?: string | null
        }
        Update: {
          customer_id?: string | null
          enrollment_id?: string | null
          flow_id?: string | null
          id?: string
          metadata?: Json
          sent_at?: string
          sequence_id?: string | null
          status?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "automation_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          recovered: number
          sent_30d: number
          sequence_id: string | null
          trigger: string
          updated_at: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          recovered?: number
          sent_30d?: number
          sequence_id?: string | null
          trigger: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          recovered?: number
          sent_30d?: number
          sequence_id?: string | null
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flows_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_sequences: {
        Row: {
          client_id: string
          created_at: string
          flow_definition: Json
          id: string
          is_active: boolean
          metadata: Json
          name: string
          quiet_hours_end: number
          quiet_hours_start: number
          recovered_cents: number
          sent_30d: number
          status: string
          trigger: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          flow_definition?: Json
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          quiet_hours_end?: number
          quiet_hours_start?: number
          recovered_cents?: number
          sent_30d?: number
          status?: string
          trigger: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          flow_definition?: Json
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          quiet_hours_end?: number
          quiet_hours_start?: number
          recovered_cents?: number
          sent_30d?: number
          status?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_sequences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          channel: string
          condition_type: string | null
          created_at: string
          delay_minutes: number
          id: string
          metadata: Json
          sequence_id: string
          sort_order: number
          template_key: string
        }
        Insert: {
          channel: string
          condition_type?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          metadata?: Json
          sequence_id: string
          sort_order?: number
          template_key?: string
        }
        Update: {
          channel?: string
          condition_type?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          metadata?: Json
          sequence_id?: string
          sort_order?: number
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "automation_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_template_library: {
        Row: {
          body_preview: string
          channel: string
          created_at: string
          id: string
          metadata: Json
          name: string
          subject: string | null
          template_key: string
          trigger: string
          vertical: string
        }
        Insert: {
          body_preview: string
          channel: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          subject?: string | null
          template_key: string
          trigger: string
          vertical: string
        }
        Update: {
          body_preview?: string
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          subject?: string | null
          template_key?: string
          trigger?: string
          vertical?: string
        }
        Relationships: []
      }
      benchmark_snapshots: {
        Row: {
          ai_summary: string | null
          client_id: string | null
          id: string
          metric_key: string
          portfolio_avg: number | null
          portfolio_p75: number | null
          snapshot_at: string
          value: number
        }
        Insert: {
          ai_summary?: string | null
          client_id?: string | null
          id?: string
          metric_key: string
          portfolio_avg?: number | null
          portfolio_p75?: number | null
          snapshot_at?: string
          value: number
        }
        Update: {
          ai_summary?: string | null
          client_id?: string | null
          id?: string
          metric_key?: string
          portfolio_avg?: number | null
          portfolio_p75?: number | null
          snapshot_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      boleto_reminders: {
        Row: {
          boleto_url: string
          client_id: string
          created_at: string
          customer_id: string | null
          due_at: string
          enrollment_id: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          boleto_url: string
          client_id: string
          created_at?: string
          customer_id?: string | null
          due_at: string
          enrollment_id?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          boleto_url?: string
          client_id?: string
          created_at?: string
          customer_id?: string | null
          due_at?: string
          enrollment_id?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boleto_reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boleto_reminders_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "automation_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boleto_reminders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ad_account_id: string | null
          client_id: string
          created_at: string
          external_id: string
          id: string
          name: string
          period_end: string | null
          period_start: string | null
          platform: string
          revenue_cents: number
          roas: number
          spend_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          client_id: string
          created_at?: string
          external_id: string
          id?: string
          name: string
          period_end?: string | null
          period_start?: string | null
          platform: string
          revenue_cents?: number
          roas?: number
          spend_cents?: number
          status?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          client_id?: string
          created_at?: string
          external_id?: string
          id?: string
          name?: string
          period_end?: string | null
          period_start?: string | null
          platform?: string
          revenue_cents?: number
          roas?: number
          spend_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_listings: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          external_product_id: string
          external_variant_id: string | null
          id: string
          last_synced_at: string | null
          listing_status: string
          metadata: Json
          product_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          external_product_id: string
          external_variant_id?: string | null
          id?: string
          last_synced_at?: string | null
          listing_status?: string
          metadata?: Json
          product_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          external_product_id?: string
          external_variant_id?: string | null
          id?: string
          last_synced_at?: string | null
          listing_status?: string
          metadata?: Json
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          gmv_30d: number
          health_score: number
          id: string
          last_contact_days: number
          metadata: Json
          name: string
          onboarding_week: number
          plan: string
          roas_avg: number
          segment: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gmv_30d?: number
          health_score?: number
          id?: string
          last_contact_days?: number
          metadata?: Json
          name: string
          onboarding_week?: number
          plan?: string
          roas_avg?: number
          segment?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gmv_30d?: number
          health_score?: number
          id?: string
          last_contact_days?: number
          metadata?: Json
          name?: string
          onboarding_week?: number
          plan?: string
          roas_avg?: number
          segment?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cs_activities: {
        Row: {
          channel: string | null
          client_id: string
          created_at: string
          id: string
          kind: string
          metadata: Json
          notes: string | null
          occurred_at: string
          score: number | null
          staff_id: string
        }
        Insert: {
          channel?: string | null
          client_id: string
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          notes?: string | null
          occurred_at?: string
          score?: number | null
          staff_id: string
        }
        Update: {
          channel?: string | null
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          notes?: string | null
          occurred_at?: string
          score?: number | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_activities_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_reviews: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          customer_id: string | null
          handled_at: string | null
          id: string
          order_id: string | null
          rating: number
          ticket_id: string | null
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          handled_at?: string | null
          id?: string
          order_id?: string | null
          rating: number
          ticket_id?: string | null
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          handled_at?: string | null
          id?: string
          order_id?: string | null
          rating?: number
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contact_prefs: {
        Row: {
          birthday: string | null
          created_at: string
          customer_id: string
          first_purchase_at: string | null
          opted_out_channels: string[]
          push_tokens: Json
          updated_at: string
          whatsapp_window_expires_at: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          customer_id: string
          first_purchase_at?: string | null
          opted_out_channels?: string[]
          push_tokens?: Json
          updated_at?: string
          whatsapp_window_expires_at?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string
          customer_id?: string
          first_purchase_at?: string | null
          opted_out_channels?: string[]
          push_tokens?: Json
          updated_at?: string
          whatsapp_window_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contact_prefs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          acquisition_channel: string | null
          client_id: string
          cold_list_at: string | null
          created_at: string
          email_hash: string
          external_id: string | null
          id: string
          last_order_at: string | null
          ltv_cents: number
          order_count: number
          phone_hash: string | null
          rfm_frequency: number | null
          rfm_last_calc: string | null
          rfm_monetary_cents: number | null
          rfm_recency_days: number | null
          rfm_score: string
          rfm_segment: string | null
          updated_at: string
        }
        Insert: {
          acquisition_channel?: string | null
          client_id: string
          cold_list_at?: string | null
          created_at?: string
          email_hash: string
          external_id?: string | null
          id?: string
          last_order_at?: string | null
          ltv_cents?: number
          order_count?: number
          phone_hash?: string | null
          rfm_frequency?: number | null
          rfm_last_calc?: string | null
          rfm_monetary_cents?: number | null
          rfm_recency_days?: number | null
          rfm_score?: string
          rfm_segment?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_channel?: string | null
          client_id?: string
          cold_list_at?: string | null
          created_at?: string
          email_hash?: string
          external_id?: string | null
          id?: string
          last_order_at?: string | null
          ltv_cents?: number
          order_count?: number
          phone_hash?: string | null
          rfm_frequency?: number | null
          rfm_last_calc?: string | null
          rfm_monetary_cents?: number | null
          rfm_recency_days?: number | null
          rfm_score?: string
          rfm_segment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          client_id: string
          created_at: string
          customer_id: string | null
          id: string
          is_active: boolean
          platform: string
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_active?: boolean
          platform?: string
          token: string
        }
        Update: {
          client_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_active?: boolean
          platform?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_event_outbox: {
        Row: {
          attempts: number
          created_at: string
          event_name: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_name: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_name?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      fiscal_configs: {
        Row: {
          cert_expires_at: string | null
          cert_path: string | null
          client_id: string
          cnpj: string
          company_name: string
          created_at: string
          default_cfop: string | null
          default_cst: string | null
          default_ncm: string | null
          id: string
          tax_regime: string
          updated_at: string
        }
        Insert: {
          cert_expires_at?: string | null
          cert_path?: string | null
          client_id: string
          cnpj: string
          company_name: string
          created_at?: string
          default_cfop?: string | null
          default_cst?: string | null
          default_ncm?: string | null
          id?: string
          tax_regime: string
          updated_at?: string
        }
        Update: {
          cert_expires_at?: string | null
          cert_path?: string | null
          client_id?: string
          cnpj?: string
          company_name?: string
          created_at?: string
          default_cfop?: string | null
          default_cst?: string | null
          default_ncm?: string | null
          id?: string
          tax_regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          client_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json
          operation: string
          provider: string
          request_hash: string | null
          response_code: number | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json
          operation: string
          provider: string
          request_hash?: string | null
          response_code?: number | null
          status: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json
          operation?: string
          provider?: string
          request_hash?: string | null
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          client_id: string
          created_at: string
          id: string
          product: string
          reserved: number
          sku: string
          units: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          product: string
          reserved?: number
          sku: string
          units?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          product?: string
          reserved?: number
          sku?: string
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          attempts: number
          client_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          job_id: string | null
          job_type: string
          metadata: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          job_id?: string | null
          job_type: string
          metadata?: Json
          status: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          job_id?: string | null
          job_type?: string
          metadata?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account: string
          amount_cents: number
          created_at: string
          direction: string
          id: string
          transaction_id: string
        }
        Insert: {
          account: string
          amount_cents: number
          created_at?: string
          direction: string
          id?: string
          transaction_id: string
        }
        Update: {
          account?: string
          amount_cents?: number
          created_at?: string
          direction?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          client_id: string
          created_at: string
          customer_id: string
          id: string
          points_balance: number
          tier: string
          tier_progress_pct: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          customer_id: string
          id?: string
          points_balance?: number
          tier?: string
          tier_progress_pct?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          points_balance?: number
          tier?: string
          tier_progress_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_coupons: {
        Row: {
          account_id: string
          code: string
          created_at: string
          discount_pct: number
          expires_at: string
          id: string
          redeemed_at: string | null
          sent_via: string | null
        }
        Insert: {
          account_id: string
          code: string
          created_at?: string
          discount_pct: number
          expires_at: string
          id?: string
          redeemed_at?: string | null
          sent_via?: string | null
        }
        Update: {
          account_id?: string
          code?: string
          created_at?: string
          discount_pct?: number
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          sent_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_coupons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          order_id: string | null
          points: number
          type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          points: number
          type: string
        }
        Update: {
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          points?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      message_delivery_log: {
        Row: {
          channel: string
          clicked_at: string | null
          enrollment_id: string | null
          execution_id: string | null
          id: string
          metadata: Json
          opened_at: string | null
          provider_message_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          channel: string
          clicked_at?: string | null
          enrollment_id?: string | null
          execution_id?: string | null
          id?: string
          metadata?: Json
          opened_at?: string | null
          provider_message_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          enrollment_id?: string | null
          execution_id?: string | null
          id?: string
          metadata?: Json
          opened_at?: string | null
          provider_message_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_delivery_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "automation_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_delivery_log_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_emissions: {
        Row: {
          access_key: string | null
          authorized_at: string | null
          client_id: string
          created_at: string
          danfe_url: string | null
          external_ref: string | null
          id: string
          last_error: string | null
          order_id: string | null
          retries: number
          status: string
          type: string
          updated_at: string
          value_cents: number
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          authorized_at?: string | null
          client_id: string
          created_at?: string
          danfe_url?: string | null
          external_ref?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          retries?: number
          status?: string
          type: string
          updated_at?: string
          value_cents: number
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          authorized_at?: string | null
          client_id?: string
          created_at?: string
          danfe_url?: string | null
          external_ref?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          retries?: number
          status?: string
          type?: string
          updated_at?: string
          value_cents?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_emissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_connections: {
        Row: {
          access_token: string
          client_id: string
          created_at: string
          external_account: string | null
          id: string
          is_active: boolean
          last_refreshed_at: string | null
          metadata: Json
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          client_id: string
          created_at?: string
          external_account?: string | null
          id?: string
          is_active?: boolean
          last_refreshed_at?: string | null
          metadata?: Json
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          client_id?: string
          created_at?: string
          external_account?: string | null
          id?: string
          is_active?: boolean
          last_refreshed_at?: string | null
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          client_id: string | null
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          nonce: string
          provider: string
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          nonce: string
          provider: string
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          nonce?: string
          provider?: string
          redirect_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          is_done: boolean
          task_key: string
          title: string
          week: number
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_done?: boolean
          task_key: string
          title: string
          week: number
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_done?: boolean
          task_key?: string
          title?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_alerts: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          is_resolved: boolean
          kind: string
          message: string
          severity: string
          title: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_resolved?: boolean
          kind: string
          message: string
          severity: string
          title: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_resolved?: boolean
          kind?: string
          message?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          id: string
          metadata: Json
          occurred_at: string
          order_id: string
          source: string
          status: string
        }
        Insert: {
          id?: string
          metadata?: Json
          occurred_at?: string
          order_id: string
          source?: string
          status: string
        }
        Update: {
          id?: string
          metadata?: Json
          occurred_at?: string
          order_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          channel: string
          city: string | null
          client_id: string
          created_at: string
          external_id: string
          id: string
          metadata: Json
          nf_status: string
          shipment_external_id: string | null
          status: string
          tracking_code: string | null
          updated_at: string
          value_cents: number
        }
        Insert: {
          carrier?: string | null
          channel: string
          city?: string | null
          client_id: string
          created_at?: string
          external_id: string
          id?: string
          metadata?: Json
          nf_status?: string
          shipment_external_id?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
          value_cents: number
        }
        Update: {
          carrier?: string | null
          channel?: string
          city?: string | null
          client_id?: string
          created_at?: string
          external_id?: string
          id?: string
          metadata?: Json
          nf_status?: string
          shipment_external_id?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_recommendations: {
        Row: {
          client_id: string
          confidence: number | null
          created_at: string
          current_cents: number
          id: string
          margin_pct: number | null
          rationale: string | null
          sku: string
          status: string
          suggested_cents: number
        }
        Insert: {
          client_id: string
          confidence?: number | null
          created_at?: string
          current_cents: number
          id?: string
          margin_pct?: number | null
          rationale?: string | null
          sku: string
          status?: string
          suggested_cents: number
        }
        Update: {
          client_id?: string
          confidence?: number | null
          created_at?: string
          current_cents?: number
          id?: string
          margin_pct?: number | null
          rationale?: string | null
          sku?: string
          status?: string
          suggested_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_recommendations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          ncm: string | null
          price_cents: number | null
          sku: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          ncm?: string | null
          price_cents?: number | null
          sku: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          ncm?: string | null
          price_cents?: number | null
          sku?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          expected_at: string | null
          external_ref: string | null
          fee_cents: number
          gross_cents: number
          id: string
          metadata: Json
          net_cents: number
          received_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          expected_at?: string | null
          external_ref?: string | null
          fee_cents?: number
          gross_cents: number
          id?: string
          metadata?: Json
          net_cents: number
          received_at?: string | null
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          expected_at?: string | null
          external_ref?: string | null
          fee_cents?: number
          gross_cents?: number
          id?: string
          metadata?: Json
          net_cents?: number
          received_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          client_id: string
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          provider: string
          provider_sub_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: string
          provider: string
          provider_sub_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string
          provider_sub_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          provider: string
          provider_tx_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          provider: string
          provider_tx_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          provider?: string
          provider_tx_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          client_id: string | null
          created_at: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          processed_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_opt_outs: {
        Row: {
          client_id: string
          id: string
          opted_out_at: string
          phone_hash: string
          source: string
        }
        Insert: {
          client_id: string
          id?: string
          opted_out_at?: string
          phone_hash: string
          source?: string
        }
        Update: {
          client_id?: string
          id?: string
          opted_out_at?: string
          phone_hash?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_opt_outs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          client_id: string
          components: Json
          created_at: string
          external_id: string | null
          id: string
          language: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          components?: Json
          created_at?: string
          external_id?: string | null
          id?: string
          language?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          components?: Json
          created_at?: string
          external_id?: string | null
          id?: string
          language?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          client_id: string
          created_at: string
          customer_id: string | null
          id: string
          notified_at: string | null
          product_image: string | null
          product_name: string | null
          product_sku: string
          updated_at: string
          view_count: number
        }
        Insert: {
          client_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notified_at?: string | null
          product_image?: string | null
          product_name?: string | null
          product_sku: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notified_at?: string | null
          product_image?: string | null
          product_name?: string | null
          product_sku?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mrr_by_plan: {
        Row: {
          client_count: number | null
          plan: string | null
          total_mrr_cents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_oauth_states: { Args: never; Returns: number }
      commit_inventory: {
        Args: { p_client_id: string; p_qty: number; p_sku: string }
        Returns: boolean
      }
      current_client_id: { Args: never; Returns: string }
      increment_sequence_recovered: {
        Args: { p_cents: number; p_sequence_id: string }
        Returns: undefined
      }
      is_orbia_staff: { Args: never; Returns: boolean }
      refresh_client_last_contact: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      release_inventory: {
        Args: { p_client_id: string; p_qty: number; p_sku: string }
        Returns: boolean
      }
      reserve_inventory: {
        Args: { p_client_id: string; p_qty: number; p_sku: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
