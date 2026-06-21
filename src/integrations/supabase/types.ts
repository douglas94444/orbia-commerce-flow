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
          contact_email: string | null
          contact_phone: string | null
          converted_at: string | null
          created_at: string
          customer_id: string | null
          email_hash: string | null
          external_id: string | null
          id: string
          items: Json
          marketing_opt_in: boolean | null
          metadata: Json
          phone_hash: string | null
          status: string
          value_cents: number
        }
        Insert: {
          abandoned_at?: string
          checkout_url?: string | null
          client_id: string
          contact_email?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email_hash?: string | null
          external_id?: string | null
          id?: string
          items?: Json
          marketing_opt_in?: boolean | null
          metadata?: Json
          phone_hash?: string | null
          status?: string
          value_cents?: number
        }
        Update: {
          abandoned_at?: string
          checkout_url?: string | null
          client_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email_hash?: string | null
          external_id?: string | null
          id?: string
          items?: Json
          marketing_opt_in?: boolean | null
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
      automation_coupons: {
        Row: {
          client_id: string
          code: string
          created_at: string
          customer_id: string | null
          discount_pct: number
          expires_at: string
          external_discount_id: string | null
          id: string
          platform: string | null
          redeemed_at: string | null
          source: string | null
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          customer_id?: string | null
          discount_pct: number
          expires_at: string
          external_discount_id?: string | null
          id?: string
          platform?: string | null
          redeemed_at?: string | null
          source?: string | null
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          customer_id?: string | null
          discount_pct?: number
          expires_at?: string
          external_discount_id?: string | null
          id?: string
          platform?: string | null
          redeemed_at?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_coupons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_coupons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
          attributed_revenue_cents: number
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
          attributed_revenue_cents?: number
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
          attributed_revenue_cents?: number
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
      carrier_pickups: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          order_count: number
          provider: string
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_count?: number
          provider: string
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_count?: number
          provider?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_pickups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_fee_snapshots: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          gmv_cents: number
          id: string
          marketplace_fee_cents: number
          metadata: Json
          net_revenue_cents: number
          order_id: string
          other_fee_cents: number
          payment_fee_cents: number
          shipping_fee_cents: number
          updated_at: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          gmv_cents?: number
          id?: string
          marketplace_fee_cents?: number
          metadata?: Json
          net_revenue_cents?: number
          order_id: string
          other_fee_cents?: number
          payment_fee_cents?: number
          shipping_fee_cents?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          gmv_cents?: number
          id?: string
          marketplace_fee_cents?: number
          metadata?: Json
          net_revenue_cents?: number
          order_id?: string
          other_fee_cents?: number
          payment_fee_cents?: number
          shipping_fee_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_fee_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_fee_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_listings: {
        Row: {
          channel: string
          channel_price_cents: number | null
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
          channel_price_cents?: number | null
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
          channel_price_cents?: number | null
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
      channel_pricing_rules: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          min_price_cents: number | null
          rule_type: string
          updated_at: string
          value: number
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_price_cents?: number | null
          rule_type: string
          updated_at?: string
          value: number
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_price_cents?: number | null
          rule_type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_pricing_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_sla_rules: {
        Row: {
          alert_hours_before: number
          channel: string
          client_id: string | null
          created_at: string
          dispatch_hours: number
          id: string
          penalty_description: string | null
          tracking_deadline_hours: number | null
        }
        Insert: {
          alert_hours_before?: number
          channel: string
          client_id?: string | null
          created_at?: string
          dispatch_hours: number
          id?: string
          penalty_description?: string | null
          tracking_deadline_hours?: number | null
        }
        Update: {
          alert_hours_before?: number
          channel?: string
          client_id?: string | null
          created_at?: string
          dispatch_hours?: number
          id?: string
          penalty_description?: string | null
          tracking_deadline_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_sla_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_stock_buffers: {
        Row: {
          blackout_when_zero: boolean
          buffer_pct: number
          channel: string
          client_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          blackout_when_zero?: boolean
          buffer_pct?: number
          channel: string
          client_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          blackout_when_zero?: boolean
          buffer_pct?: number
          channel?: string
          client_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_stock_buffers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_carrier_configs: {
        Row: {
          auto_select: boolean
          client_id: string
          created_at: string
          credentials_ref: string | null
          id: string
          is_active: boolean
          metadata: Json
          priority: number
          provider: string
          updated_at: string
        }
        Insert: {
          auto_select?: boolean
          client_id: string
          created_at?: string
          credentials_ref?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          priority?: number
          provider: string
          updated_at?: string
        }
        Update: {
          auto_select?: boolean
          client_id?: string
          created_at?: string
          credentials_ref?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          priority?: number
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_carrier_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          allowed_skus: string[]
          client_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
          warehouse_scope_id: string | null
        }
        Insert: {
          allowed_skus?: string[]
          client_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
          warehouse_scope_id?: string | null
        }
        Update: {
          allowed_skus?: string[]
          client_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
          warehouse_scope_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_warehouse_scope_id_fkey"
            columns: ["warehouse_scope_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packing_profiles: {
        Row: {
          branding_url: string | null
          checklist_items: Json
          client_id: string
          created_at: string
          id: string
          insert_material_sku: string | null
          updated_at: string
        }
        Insert: {
          branding_url?: string | null
          checklist_items?: Json
          client_id: string
          created_at?: string
          id?: string
          insert_material_sku?: string | null
          updated_at?: string
        }
        Update: {
          branding_url?: string | null
          checklist_items?: Json
          client_id?: string
          created_at?: string
          id?: string
          insert_material_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_packing_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
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
          marketing_implicit_opt_in: boolean
          metadata: Json
          name: string
          onboarding_week: number
          plan: string
          roas_avg: number
          segment: string | null
          slug: string
          status: string
          updated_at: string
          whatsapp_provider: string
        }
        Insert: {
          created_at?: string
          gmv_30d?: number
          health_score?: number
          id?: string
          last_contact_days?: number
          marketing_implicit_opt_in?: boolean
          metadata?: Json
          name: string
          onboarding_week?: number
          plan?: string
          roas_avg?: number
          segment?: string | null
          slug: string
          status?: string
          updated_at?: string
          whatsapp_provider?: string
        }
        Update: {
          created_at?: string
          gmv_30d?: number
          health_score?: number
          id?: string
          last_contact_days?: number
          marketing_implicit_opt_in?: boolean
          metadata?: Json
          name?: string
          onboarding_week?: number
          plan?: string
          roas_avg?: number
          segment?: string | null
          slug?: string
          status?: string
          updated_at?: string
          whatsapp_provider?: string
        }
        Relationships: []
      }
      consumer_portal_tokens: {
        Row: {
          client_id: string
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumer_portal_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_portal_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          sac_ticket_id: string | null
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
          sac_ticket_id?: string | null
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
          sac_ticket_id?: string | null
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
          {
            foreignKeyName: "cs_reviews_sac_ticket_id_fkey"
            columns: ["sac_ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_channel_links: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          customer_id: string
          document_hash: string | null
          email_hash: string | null
          external_buyer_id: string
          id: string
          phone_hash: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          customer_id: string
          document_hash?: string | null
          email_hash?: string | null
          external_buyer_id: string
          id?: string
          phone_hash?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          customer_id?: string
          document_hash?: string | null
          email_hash?: string | null
          external_buyer_id?: string
          id?: string
          phone_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_channel_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_channel_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contact_prefs: {
        Row: {
          birthday: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string
          first_purchase_at: string | null
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          opted_out_channels: string[]
          push_tokens: Json
          updated_at: string
          whatsapp_window_expires_at: string | null
        }
        Insert: {
          birthday?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          first_purchase_at?: string | null
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          opted_out_channels?: string[]
          push_tokens?: Json
          updated_at?: string
          whatsapp_window_expires_at?: string | null
        }
        Update: {
          birthday?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          first_purchase_at?: string | null
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
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
          document_hash: string | null
          email_hash: string
          external_id: string | null
          id: string
          last_order_at: string | null
          ltv_cents: number
          merged_into_customer_id: string | null
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
          document_hash?: string | null
          email_hash: string
          external_id?: string | null
          id?: string
          last_order_at?: string | null
          ltv_cents?: number
          merged_into_customer_id?: string | null
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
          document_hash?: string | null
          email_hash?: string
          external_id?: string | null
          id?: string
          last_order_at?: string | null
          ltv_cents?: number
          merged_into_customer_id?: string | null
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
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey"
            columns: ["merged_into_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          incident_type: string
          order_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          incident_type: string
          order_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          incident_type?: string
          order_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          auto_emit_nfce: boolean
          auto_emit_nfe: boolean
          auto_emit_nfse: boolean
          cert_expires_at: string | null
          cert_password: string | null
          cert_path: string | null
          client_id: string
          cnpj: string
          company_name: string
          created_at: string
          default_cfop: string | null
          default_cst: string | null
          default_ncm: string | null
          focus_environment: string
          focus_synced_at: string | null
          id: string
          iss_retido: boolean
          municipal_registration: string | null
          municipality_code: string | null
          natureza_operacao_nfse: string | null
          nfce_csc_id: string | null
          nfce_csc_token: string | null
          state_registration: string | null
          state_uf: string
          tax_regime: string
          updated_at: string
        }
        Insert: {
          auto_emit_nfce?: boolean
          auto_emit_nfe?: boolean
          auto_emit_nfse?: boolean
          cert_expires_at?: string | null
          cert_password?: string | null
          cert_path?: string | null
          client_id: string
          cnpj: string
          company_name: string
          created_at?: string
          default_cfop?: string | null
          default_cst?: string | null
          default_ncm?: string | null
          focus_environment?: string
          focus_synced_at?: string | null
          id?: string
          iss_retido?: boolean
          municipal_registration?: string | null
          municipality_code?: string | null
          natureza_operacao_nfse?: string | null
          nfce_csc_id?: string | null
          nfce_csc_token?: string | null
          state_registration?: string | null
          state_uf?: string
          tax_regime: string
          updated_at?: string
        }
        Update: {
          auto_emit_nfce?: boolean
          auto_emit_nfe?: boolean
          auto_emit_nfse?: boolean
          cert_expires_at?: string | null
          cert_password?: string | null
          cert_path?: string | null
          client_id?: string
          cnpj?: string
          company_name?: string
          created_at?: string
          default_cfop?: string | null
          default_cst?: string | null
          default_ncm?: string | null
          focus_environment?: string
          focus_synced_at?: string | null
          id?: string
          iss_retido?: boolean
          municipal_registration?: string | null
          municipality_code?: string | null
          natureza_operacao_nfse?: string | null
          nfce_csc_id?: string | null
          nfce_csc_token?: string | null
          state_registration?: string | null
          state_uf?: string
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
      fiscal_nfce_settings: {
        Row: {
          client_id: string
          created_at: string
          csc_id: string | null
          csc_token: string | null
          id: string
          presenca_default: string
          qr_code_version: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          id?: string
          presenca_default?: string
          qr_code_version?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          id?: string
          presenca_default?: string
          qr_code_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_nfce_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_product_templates: {
        Row: {
          cest: string | null
          cfop_inter: string | null
          cfop_intra: string | null
          cfop_return_inter: string | null
          cfop_return_intra: string | null
          client_id: string
          created_at: string
          default_cst: string | null
          default_ncm: string | null
          icms_st: boolean
          id: string
          name: string
          segment: string
          updated_at: string
        }
        Insert: {
          cest?: string | null
          cfop_inter?: string | null
          cfop_intra?: string | null
          cfop_return_inter?: string | null
          cfop_return_intra?: string | null
          client_id: string
          created_at?: string
          default_cst?: string | null
          default_ncm?: string | null
          icms_st?: boolean
          id?: string
          name: string
          segment: string
          updated_at?: string
        }
        Update: {
          cest?: string | null
          cfop_inter?: string | null
          cfop_intra?: string | null
          cfop_return_inter?: string | null
          cfop_return_intra?: string | null
          client_id?: string
          created_at?: string
          default_cst?: string | null
          default_ncm?: string | null
          icms_st?: boolean
          id?: string
          name?: string
          segment?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_product_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_series: {
        Row: {
          client_id: string
          created_at: string
          doc_type: string
          environment: string
          id: string
          last_number: number
          serie: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          doc_type: string
          environment?: string
          id?: string
          last_number?: number
          serie?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          doc_type?: string
          environment?: string
          id?: string
          last_number?: number
          serie?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_series_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_service_catalog: {
        Row: {
          aliquota_iss: number
          client_id: string
          codigo_tributacao_municipio: string | null
          created_at: string
          descricao: string
          id: string
          is_default: boolean
          item_lista_servico: string
          municipality_code: string | null
          updated_at: string
        }
        Insert: {
          aliquota_iss?: number
          client_id: string
          codigo_tributacao_municipio?: string | null
          created_at?: string
          descricao: string
          id?: string
          is_default?: boolean
          item_lista_servico: string
          municipality_code?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_iss?: number
          client_id?: string
          codigo_tributacao_municipio?: string | null
          created_at?: string
          descricao?: string
          id?: string
          is_default?: boolean
          item_lista_servico?: string
          municipality_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_service_catalog_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_tax_rules: {
        Row: {
          client_id: string
          created_at: string
          difal_enabled: boolean
          fcp_aliquota: number
          icms_aliquota: number | null
          id: string
          ipi_cst: string | null
          mva_st: number | null
          ncm_prefix: string
          uf_destino: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          difal_enabled?: boolean
          fcp_aliquota?: number
          icms_aliquota?: number | null
          id?: string
          ipi_cst?: string | null
          mva_st?: number | null
          ncm_prefix?: string
          uf_destino: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          difal_enabled?: boolean
          fcp_aliquota?: number
          icms_aliquota?: number | null
          id?: string
          ipi_cst?: string | null
          mva_st?: number | null
          ncm_prefix?: string
          uf_destino?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_tax_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_webhook_events: {
        Row: {
          attempts: number
          client_id: string | null
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Update: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_usage: {
        Row: {
          client_id: string
          created_at: string
          id: string
          orders_processed: number
          packs_completed: number
          period_month: string
          picks_completed: number
          returns_handled: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          orders_processed?: number
          packs_completed?: number
          period_month: string
          picks_completed?: number
          returns_handled?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          orders_processed?: number
          packs_completed?: number
          period_month?: string
          picks_completed?: number
          returns_handled?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_health_snapshots: {
        Row: {
          client_id: string
          created_at: string
          failure_streak: number
          id: string
          last_error: string | null
          last_success_at: string | null
          last_webhook_at: string | null
          metadata: Json
          provider: string
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          failure_streak?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          last_webhook_at?: string | null
          metadata?: Json
          provider: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          failure_streak?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          last_webhook_at?: string | null
          metadata?: Json
          provider?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
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
      inventory_count_lines: {
        Row: {
          count_id: string
          counted_qty: number | null
          divergence: number | null
          id: string
          location_id: string | null
          sku: string
          system_qty: number
        }
        Insert: {
          count_id: string
          counted_qty?: number | null
          divergence?: number | null
          id?: string
          location_id?: string | null
          sku: string
          system_qty?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number | null
          divergence?: number | null
          id?: string
          location_id?: string | null
          sku?: string
          system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          client_id: string
          completed_at: string | null
          count_type: string
          id: string
          started_at: string
          started_by: string | null
          status: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          count_type: string
          id?: string
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          count_type?: string
          id?: string
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          location_id: string
          lot_id: string | null
          qty: number
          reserved_qty: number
          sku: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          location_id: string
          lot_id?: string | null
          qty?: number
          reserved_qty?: number
          sku: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          location_id?: string
          lot_id?: string | null
          qty?: number
          reserved_qty?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "product_lots"
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
      marketplace_penalty_records: {
        Row: {
          amount_cents: number
          channel: string
          client_id: string
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          penalty_type: string
        }
        Insert: {
          amount_cents?: number
          channel: string
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          penalty_type: string
        }
        Update: {
          amount_cents?: number
          channel?: string
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          penalty_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_penalty_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_penalty_records_order_id_fkey"
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
          metadata: Json
          number: number | null
          order_id: string | null
          retries: number
          series: string | null
          status: string
          type: string
          updated_at: string
          value_cents: number
          webhook_received_at: string | null
          xml_storage_path: string | null
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
          metadata?: Json
          number?: number | null
          order_id?: string | null
          retries?: number
          series?: string | null
          status?: string
          type: string
          updated_at?: string
          value_cents: number
          webhook_received_at?: string | null
          xml_storage_path?: string | null
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
          metadata?: Json
          number?: number | null
          order_id?: string | null
          retries?: number
          series?: string | null
          status?: string
          type?: string
          updated_at?: string
          value_cents?: number
          webhook_received_at?: string | null
          xml_storage_path?: string | null
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
      nfe_fiscal_events: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          nfe_emission_id: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          nfe_emission_id?: string | null
          payload?: Json
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          nfe_emission_id?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfe_fiscal_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_fiscal_events_nfe_emission_id_fkey"
            columns: ["nfe_emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
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
      order_attributions: {
        Row: {
          attributed_at: string
          campaign_id: string
          client_id: string
          created_at: string
          id: string
          order_id: string
          source: string
          value_cents: number
        }
        Insert: {
          attributed_at?: string
          campaign_id: string
          client_id: string
          created_at?: string
          id?: string
          order_id: string
          source: string
          value_cents: number
        }
        Update: {
          attributed_at?: string
          campaign_id?: string
          client_id?: string
          created_at?: string
          id?: string
          order_id?: string
          source?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
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
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          packed_qty: number
          picked_qty: number
          product_id: string | null
          qty: number
          sku: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          packed_qty?: number
          picked_qty?: number
          product_id?: string | null
          qty: number
          sku: string
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          packed_qty?: number
          picked_qty?: number
          product_id?: string | null
          qty?: number
          sku?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          attributed_campaign_id: string | null
          attribution_meta: Json
          attribution_source: string | null
          carrier: string | null
          channel: string
          city: string | null
          client_id: string
          created_at: string
          customer_id: string | null
          external_id: string
          id: string
          metadata: Json
          nf_status: string
          shipment_external_id: string | null
          sla_alert_sent: boolean
          sla_breached: boolean
          sla_deadline_at: string | null
          status: string
          tracking_code: string | null
          updated_at: string
          value_cents: number
        }
        Insert: {
          attributed_campaign_id?: string | null
          attribution_meta?: Json
          attribution_source?: string | null
          carrier?: string | null
          channel: string
          city?: string | null
          client_id: string
          created_at?: string
          customer_id?: string | null
          external_id: string
          id?: string
          metadata?: Json
          nf_status?: string
          shipment_external_id?: string | null
          sla_alert_sent?: boolean
          sla_breached?: boolean
          sla_deadline_at?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
          value_cents: number
        }
        Update: {
          attributed_campaign_id?: string | null
          attribution_meta?: Json
          attribution_source?: string | null
          carrier?: string | null
          channel?: string
          city?: string | null
          client_id?: string
          created_at?: string
          customer_id?: string | null
          external_id?: string
          id?: string
          metadata?: Json
          nf_status?: string
          shipment_external_id?: string | null
          sla_alert_sent?: boolean
          sla_breached?: boolean
          sla_deadline_at?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_attributed_campaign_id_fkey"
            columns: ["attributed_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_sessions: {
        Row: {
          box_type: string | null
          completed_at: string | null
          id: string
          operator_id: string | null
          order_id: string
          photo_urls: Json
          started_at: string
          status: string
        }
        Insert: {
          box_type?: string | null
          completed_at?: string | null
          id?: string
          operator_id?: string | null
          order_id: string
          photo_urls?: Json
          started_at?: string
          status?: string
        }
        Update: {
          box_type?: string | null
          completed_at?: string | null
          id?: string
          operator_id?: string | null
          order_id?: string
          photo_urls?: Json
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_task_lines: {
        Row: {
          id: string
          location_id: string | null
          order_item_id: string
          qty_picked: number
          qty_required: number
          sku: string
          sort_order: number
          status: string
          task_id: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          order_item_id: string
          qty_picked?: number
          qty_required: number
          sku: string
          sort_order?: number
          status?: string
          task_id: string
        }
        Update: {
          id?: string
          location_id?: string | null
          order_item_id?: string
          qty_picked?: number
          qty_required?: number
          sku?: string
          sort_order?: number
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_task_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_task_lines_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_task_lines_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pick_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          operator_id: string | null
          order_id: string
          route_order: number
          started_at: string | null
          status: string
          wave_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          order_id: string
          route_order?: number
          started_at?: string | null
          status?: string
          wave_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          order_id?: string
          route_order?: number
          started_at?: string | null
          status?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_tasks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_tasks_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "pick_waves"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_waves: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          priority: number
          status: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          priority?: number
          status?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          priority?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_waves_client_id_fkey"
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
      product_lots: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          lot_code: string
          product_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          lot_code: string
          product_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          lot_code?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          cest: string | null
          cfop: string | null
          cfop_inter: string | null
          cfop_intra: string | null
          cfop_return_inter: string | null
          cfop_return_intra: string | null
          client_id: string
          created_at: string
          cst: string | null
          height_mm: number | null
          icms_origem: string
          icms_rates: Json
          icms_st: boolean
          id: string
          is_active: boolean
          length_mm: number | null
          metadata: Json
          min_stock_units: number
          name: string
          ncm: string | null
          parent_product_id: string | null
          photo_url: string | null
          price_cents: number | null
          sku: string
          updated_at: string
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          barcode?: string | null
          cest?: string | null
          cfop?: string | null
          cfop_inter?: string | null
          cfop_intra?: string | null
          cfop_return_inter?: string | null
          cfop_return_intra?: string | null
          client_id: string
          created_at?: string
          cst?: string | null
          height_mm?: number | null
          icms_origem?: string
          icms_rates?: Json
          icms_st?: boolean
          id?: string
          is_active?: boolean
          length_mm?: number | null
          metadata?: Json
          min_stock_units?: number
          name: string
          ncm?: string | null
          parent_product_id?: string | null
          photo_url?: string | null
          price_cents?: number | null
          sku: string
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          barcode?: string | null
          cest?: string | null
          cfop?: string | null
          cfop_inter?: string | null
          cfop_intra?: string | null
          cfop_return_inter?: string | null
          cfop_return_intra?: string | null
          client_id?: string
          created_at?: string
          cst?: string | null
          height_mm?: number | null
          icms_origem?: string
          icms_rates?: Json
          icms_st?: boolean
          id?: string
          is_active?: boolean
          length_mm?: number | null
          metadata?: Json
          min_stock_units?: number
          name?: string
          ncm?: string | null
          parent_product_id?: string | null
          photo_url?: string | null
          price_cents?: number | null
          sku?: string
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      quarantine_items: {
        Row: {
          client_id: string
          created_at: string
          id: string
          inspected_by: string | null
          qty: number
          reason: string
          resolved_at: string | null
          sku: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          inspected_by?: string | null
          qty: number
          reason: string
          resolved_at?: string | null
          sku: string
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          inspected_by?: string | null
          qty?: number
          reason?: string
          resolved_at?: string | null
          sku?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarantine_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarantine_items_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      receiving_appointments: {
        Row: {
          appointment_type: string
          client_id: string
          created_at: string
          expected_items: Json
          id: string
          notes: string | null
          return_request_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_type?: string
          client_id: string
          created_at?: string
          expected_items?: Json
          id?: string
          notes?: string | null
          return_request_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          client_id?: string
          created_at?: string
          expected_items?: Json
          id?: string
          notes?: string | null
          return_request_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_appointments_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_lines: {
        Row: {
          barcode_scanned: string | null
          created_at: string
          expected_qty: number
          has_divergence: boolean
          id: string
          location_id: string | null
          photo_url: string | null
          received_qty: number
          session_id: string
          sku: string
        }
        Insert: {
          barcode_scanned?: string | null
          created_at?: string
          expected_qty?: number
          has_divergence?: boolean
          id?: string
          location_id?: string | null
          photo_url?: string | null
          received_qty?: number
          session_id: string
          sku: string
        }
        Update: {
          barcode_scanned?: string | null
          created_at?: string
          expected_qty?: number
          has_divergence?: boolean
          id?: string
          location_id?: string | null
          photo_url?: string | null
          received_qty?: number
          session_id?: string
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "receiving_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_sessions: {
        Row: {
          appointment_id: string | null
          client_id: string
          completed_at: string | null
          id: string
          metadata: Json
          operator_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          completed_at?: string | null
          id?: string
          metadata?: Json
          operator_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          completed_at?: string | null
          id?: string
          metadata?: Json
          operator_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "receiving_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      return_inspections: {
        Row: {
          destination: string
          id: string
          inspected_at: string
          inspector_id: string | null
          notes: string | null
          photo_urls: Json
          return_request_id: string
        }
        Insert: {
          destination: string
          id?: string
          inspected_at?: string
          inspector_id?: string | null
          notes?: string | null
          photo_urls?: Json
          return_request_id: string
        }
        Update: {
          destination?: string
          id?: string
          inspected_at?: string
          inspector_id?: string | null
          notes?: string | null
          photo_urls?: Json
          return_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_inspections_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          condition_notes: string | null
          id: string
          order_item_id: string | null
          qty: number
          return_request_id: string
          sku: string
        }
        Insert: {
          condition_notes?: string | null
          id?: string
          order_item_id?: string | null
          qty: number
          return_request_id: string
          sku: string
        }
        Update: {
          condition_notes?: string | null
          id?: string
          order_item_id?: string | null
          qty?: number
          return_request_id?: string
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_policies: {
        Row: {
          allow_exchange: boolean
          allow_store_credit: boolean
          approval_mode: string
          auto_approve_exchange: boolean
          client_id: string
          created_at: string
          default_resolution: string
          id: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          allow_exchange?: boolean
          allow_store_credit?: boolean
          approval_mode?: string
          auto_approve_exchange?: boolean
          client_id: string
          created_at?: string
          default_resolution?: string
          id?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          allow_exchange?: boolean
          allow_store_credit?: boolean
          approval_mode?: string
          auto_approve_exchange?: boolean
          client_id?: string
          created_at?: string
          default_resolution?: string
          id?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          approval_mode: string
          client_id: string
          created_at: string
          credit_issued: boolean
          customer_id: string | null
          exchange_order_id: string | null
          exchange_qty: number | null
          exchange_sku: string | null
          id: string
          metadata: Json
          order_id: string
          reason: string
          refund_cents: number | null
          request_type: string
          resolution: string | null
          return_label_url: string | null
          sac_ticket_id: string | null
          status: string
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          approval_mode?: string
          client_id: string
          created_at?: string
          credit_issued?: boolean
          customer_id?: string | null
          exchange_order_id?: string | null
          exchange_qty?: number | null
          exchange_sku?: string | null
          id?: string
          metadata?: Json
          order_id: string
          reason: string
          refund_cents?: number | null
          request_type?: string
          resolution?: string | null
          return_label_url?: string | null
          sac_ticket_id?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          approval_mode?: string
          client_id?: string
          created_at?: string
          credit_issued?: boolean
          customer_id?: string | null
          exchange_order_id?: string | null
          exchange_qty?: number | null
          exchange_sku?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          reason?: string
          refund_cents?: number | null
          request_type?: string
          resolution?: string | null
          return_label_url?: string | null
          sac_ticket_id?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_exchange_order_id_fkey"
            columns: ["exchange_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_sac_ticket_id_fkey"
            columns: ["sac_ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_agent_capacity: {
        Row: {
          client_id: string
          created_at: string
          id: string
          max_concurrent_tickets: number
          staff_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          max_concurrent_tickets?: number
          staff_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          max_concurrent_tickets?: number
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_agent_capacity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_agent_capacity_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_bot_sessions: {
        Row: {
          context: Json
          conversation_id: string
          created_at: string
          handoff_requested: boolean
          id: string
          step: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          context?: Json
          conversation_id: string
          created_at?: string
          handoff_requested?: boolean
          id?: string
          step?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          context?: Json
          conversation_id?: string
          created_at?: string
          handoff_requested?: boolean
          id?: string
          step?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_bot_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "sac_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_bot_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_conversations: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          external_thread_id: string | null
          id: string
          ticket_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          external_thread_id?: string | null
          id?: string
          ticket_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          external_thread_id?: string | null
          id?: string
          ticket_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_conversations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_csat_surveys: {
        Row: {
          channel: string
          client_id: string
          comment: string | null
          created_at: string
          id: string
          responded_at: string | null
          score: number | null
          sent_at: string
          ticket_id: string
        }
        Insert: {
          channel: string
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string
          ticket_id: string
        }
        Update: {
          channel?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_csat_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_csat_surveys_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_internal_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: Json
          staff_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: Json
          staff_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: Json
          staff_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_internal_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_internal_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_knowledge_articles: {
        Row: {
          body: string
          bot_enabled: boolean
          category: string
          client_id: string
          created_at: string
          id: string
          is_public: boolean
          slug: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          body: string
          bot_enabled?: boolean
          category?: string
          client_id: string
          created_at?: string
          id?: string
          is_public?: boolean
          slug: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          body?: string
          bot_enabled?: boolean
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          is_public?: boolean
          slug?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sac_knowledge_articles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_marketplace_claims: {
        Row: {
          amount_at_risk_cents: number
          client_id: string
          created_at: string
          deadline_at: string | null
          evidence: Json
          external_claim_id: string
          id: string
          outcome: string | null
          platform: string
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          amount_at_risk_cents?: number
          client_id: string
          created_at?: string
          deadline_at?: string | null
          evidence?: Json
          external_claim_id: string
          id?: string
          outcome?: string | null
          platform: string
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          amount_at_risk_cents?: number
          client_id?: string
          created_at?: string
          deadline_at?: string | null
          evidence?: Json
          external_claim_id?: string
          id?: string
          outcome?: string | null
          platform?: string
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_marketplace_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_marketplace_claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          read_at: string | null
          sender_type: string
          staff_id: string | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          read_at?: string | null
          sender_type: string
          staff_id?: string | null
          ticket_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          read_at?: string | null
          sender_type?: string
          staff_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sac_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_messages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_quick_replies: {
        Row: {
          body: string
          category: string | null
          client_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_quick_replies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_reclame_aqui_cases: {
        Row: {
          client_id: string
          cnpj: string
          complaint_text: string | null
          created_at: string
          external_id: string
          id: string
          published_response: string | null
          score_impact: number | null
          status: string
          suggested_response: string | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          cnpj: string
          complaint_text?: string | null
          created_at?: string
          external_id: string
          id?: string
          published_response?: string | null
          score_impact?: number | null
          status?: string
          suggested_response?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          cnpj?: string
          complaint_text?: string | null
          created_at?: string
          external_id?: string
          id?: string
          published_response?: string | null
          score_impact?: number | null
          status?: string
          suggested_response?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_reclame_aqui_cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_reclame_aqui_cases_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_sentiment_scores: {
        Row: {
          analyzed_at: string
          confidence: number
          created_at: string
          id: string
          sentiment: string
          ticket_id: string
        }
        Insert: {
          analyzed_at?: string
          confidence?: number
          created_at?: string
          id?: string
          sentiment: string
          ticket_id: string
        }
        Update: {
          analyzed_at?: string
          confidence?: number
          created_at?: string
          id?: string
          sentiment?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_sentiment_scores_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_sla_policies: {
        Row: {
          category: string | null
          channel: string
          client_id: string
          created_at: string
          id: string
          resolution_minutes: number
          response_minutes: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          channel: string
          client_id: string
          created_at?: string
          id?: string
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          channel?: string
          client_id?: string
          created_at?: string
          id?: string
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_sla_policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_ticket_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_value: string | null
          old_value: string | null
          staff_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          staff_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          staff_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_ticket_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          channel: string
          client_id: string
          created_at: string
          customer_id: string | null
          first_response_at: string | null
          id: string
          merged_into_ticket_id: string | null
          metadata: Json
          order_id: string | null
          priority: string
          protocol: string
          resolved_at: string | null
          sla_resolution_due_at: string | null
          sla_response_due_at: string | null
          source_external_id: string | null
          status: string
          subcategory: string | null
          subject: string | null
          tags: Json
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          channel: string
          client_id: string
          created_at?: string
          customer_id?: string | null
          first_response_at?: string | null
          id?: string
          merged_into_ticket_id?: string | null
          metadata?: Json
          order_id?: string | null
          priority?: string
          protocol: string
          resolved_at?: string | null
          sla_resolution_due_at?: string | null
          sla_response_due_at?: string | null
          source_external_id?: string | null
          status?: string
          subcategory?: string | null
          subject?: string | null
          tags?: Json
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          channel?: string
          client_id?: string
          created_at?: string
          customer_id?: string | null
          first_response_at?: string | null
          id?: string
          merged_into_ticket_id?: string | null
          metadata?: Json
          order_id?: string | null
          priority?: string
          protocol?: string
          resolved_at?: string | null
          sla_resolution_due_at?: string | null
          sla_response_due_at?: string | null
          source_external_id?: string | null
          status?: string
          subcategory?: string | null
          subject?: string | null
          tags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_merged_into_ticket_id_fkey"
            columns: ["merged_into_ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_commercial_onboarding: {
        Row: {
          blocker_note: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          depends_on_key: string | null
          due_at: string | null
          id: string
          is_done: boolean
          prospect_id: string | null
          responsible: string
          task_key: string
          title: string
          updated_at: string
          week: number
        }
        Insert: {
          blocker_note?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          depends_on_key?: string | null
          due_at?: string | null
          id?: string
          is_done?: boolean
          prospect_id?: string | null
          responsible: string
          task_key: string
          title: string
          updated_at?: string
          week: number
        }
        Update: {
          blocker_note?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          depends_on_key?: string | null
          due_at?: string | null
          id?: string
          is_done?: boolean
          prospect_id?: string | null
          responsible?: string
          task_key?: string
          title?: string
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_commercial_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commercial_onboarding_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_contract_amendments: {
        Row: {
          clauses: Json
          client_id: string
          contract_id: string
          created_at: string
          from_plan: string
          id: string
          monthly_cents: number
          signed_at: string | null
          to_plan: string
          updated_at: string
        }
        Insert: {
          clauses?: Json
          client_id: string
          contract_id: string
          created_at?: string
          from_plan: string
          id?: string
          monthly_cents: number
          signed_at?: string | null
          to_plan: string
          updated_at?: string
        }
        Update: {
          clauses?: Json
          client_id?: string
          contract_id?: string
          created_at?: string
          from_plan?: string
          id?: string
          monthly_cents?: number
          signed_at?: string | null
          to_plan?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_contract_amendments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sales_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_contracts: {
        Row: {
          clauses: Json
          created_at: string
          id: string
          monthly_cents: number
          plan: string
          proposal_id: string | null
          prospect_id: string
          provider_ref: string | null
          public_token: string
          signed_at: string | null
          signer_email: string | null
          signer_ip: string | null
          signer_name: string | null
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          clauses?: Json
          created_at?: string
          id?: string
          monthly_cents: number
          plan: string
          proposal_id?: string | null
          prospect_id: string
          provider_ref?: string | null
          public_token?: string
          signed_at?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          clauses?: Json
          created_at?: string
          id?: string
          monthly_cents?: number
          plan?: string
          proposal_id?: string | null
          prospect_id?: string
          provider_ref?: string | null
          public_token?: string
          signed_at?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "sales_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contracts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_diagnoses: {
        Row: {
          created_at: string
          dimensions: Json
          gaps: Json
          generated_at: string
          id: string
          is_paid: boolean
          narrative: string | null
          overall_score: number
          potential_growth_pct: number
          prospect_id: string
          public_token: string
          report_pdf_path: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimensions?: Json
          gaps?: Json
          generated_at?: string
          id?: string
          is_paid?: boolean
          narrative?: string | null
          overall_score?: number
          potential_growth_pct?: number
          prospect_id: string
          public_token?: string
          report_pdf_path?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimensions?: Json
          gaps?: Json
          generated_at?: string
          id?: string
          is_paid?: boolean
          narrative?: string | null
          overall_score?: number
          potential_growth_pct?: number
          prospect_id?: string
          public_token?: string
          report_pdf_path?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_diagnoses_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_diagnosis_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          diagnosis_id: string
          id: string
          idempotency_key: string
          prospect_id: string
          provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          diagnosis_id: string
          id?: string
          idempotency_key: string
          prospect_id: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          diagnosis_id?: string
          id?: string
          idempotency_key?: string
          prospect_id?: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_diagnosis_purchases_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "sales_diagnoses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_diagnosis_purchases_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_interactions: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          notes: string | null
          occurred_at: string
          prospect_id: string
          staff_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          notes?: string | null
          occurred_at?: string
          prospect_id: string
          staff_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          notes?: string | null
          occurred_at?: string
          prospect_id?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_interactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_partner_commissions: {
        Row: {
          client_id: string | null
          commission_cents: number
          commission_pct: number
          created_at: string
          id: string
          mrr_cents: number
          paid_at: string | null
          partner_id: string
          period_month: string
          pix_receipt_ref: string | null
          plan: string
          prospect_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          commission_cents?: number
          commission_pct?: number
          created_at?: string
          id?: string
          mrr_cents?: number
          paid_at?: string | null
          partner_id: string
          period_month: string
          pix_receipt_ref?: string | null
          plan: string
          prospect_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          commission_cents?: number
          commission_pct?: number
          created_at?: string
          id?: string
          mrr_cents?: number
          paid_at?: string | null
          partner_id?: string
          period_month?: string
          pix_receipt_ref?: string | null
          plan?: string
          prospect_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_partner_commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "sales_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_commissions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_partners: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json
          name: string
          referral_code: string
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json
          name: string
          referral_code: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json
          name?: string
          referral_code?: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          position: number
          stage_key: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label: string
          position: number
          stage_key: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          position?: number
          stage_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_proposal_views: {
        Row: {
          created_at: string
          duration_ms: number
          id: string
          proposal_id: string
          section_key: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          id?: string
          proposal_id: string
          section_key: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: string
          proposal_id?: string
          section_key?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_proposal_views_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "sales_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_proposals: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          prospect_id: string
          public_token: string
          recommended_plan: string
          roi_params: Json
          sent_at: string | null
          status: string
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          prospect_id: string
          public_token?: string
          recommended_plan: string
          roi_params?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
          valid_until: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          prospect_id?: string
          public_token?: string
          recommended_plan?: string
          roi_params?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_proposals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prospect_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          prospect_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          prospect_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_prospect_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prospects: {
        Row: {
          ad_spend_cents: number
          assigned_staff_id: string | null
          bant_authority: number
          bant_budget: number
          bant_need: number
          bant_timeline: number
          communications_opt_out: boolean
          company_name: string
          contact_name: string
          converted_at: string | null
          converted_client_id: string | null
          created_at: string
          email: string
          id: string
          is_decision_maker: boolean
          last_interaction_at: string | null
          main_pain: string | null
          metadata: Json
          monthly_revenue_cents: number
          partner_id: string | null
          phone: string | null
          platform: string | null
          qualification_score: number
          referral_code: string | null
          segment: string
          source: string
          stage_id: string
          temperature: string
          updated_at: string
          urgency: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          ad_spend_cents?: number
          assigned_staff_id?: string | null
          bant_authority?: number
          bant_budget?: number
          bant_need?: number
          bant_timeline?: number
          communications_opt_out?: boolean
          company_name: string
          contact_name: string
          converted_at?: string | null
          converted_client_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_decision_maker?: boolean
          last_interaction_at?: string | null
          main_pain?: string | null
          metadata?: Json
          monthly_revenue_cents?: number
          partner_id?: string | null
          phone?: string | null
          platform?: string | null
          qualification_score?: number
          referral_code?: string | null
          segment?: string
          source?: string
          stage_id: string
          temperature?: string
          updated_at?: string
          urgency?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          ad_spend_cents?: number
          assigned_staff_id?: string | null
          bant_authority?: number
          bant_budget?: number
          bant_need?: number
          bant_timeline?: number
          communications_opt_out?: boolean
          company_name?: string
          contact_name?: string
          converted_at?: string | null
          converted_client_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_decision_maker?: boolean
          last_interaction_at?: string | null
          main_pain?: string | null
          metadata?: Json
          monthly_revenue_cents?: number
          partner_id?: string | null
          phone?: string | null
          platform?: string | null
          qualification_score?: number
          referral_code?: string | null
          segment?: string
          source?: string
          stage_id?: string
          temperature?: string
          updated_at?: string
          urgency?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_prospects_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prospects_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prospects_partner_fk"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "sales_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prospects_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tasks: {
        Row: {
          assigned_staff_id: string | null
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          priority: string
          prospect_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          priority?: string
          prospect_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          priority?: string
          prospect_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_tasks_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_upsell_opportunities: {
        Row: {
          client_id: string
          created_at: string
          from_plan: string | null
          id: string
          module_key: string | null
          proposed_at: string | null
          resolved_at: string | null
          roi_params: Json
          status: string
          to_plan: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          from_plan?: string | null
          id?: string
          module_key?: string | null
          proposed_at?: string | null
          resolved_at?: string | null
          roi_params?: Json
          status?: string
          to_plan?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          from_plan?: string | null
          id?: string
          module_key?: string | null
          proposed_at?: string | null
          resolved_at?: string | null
          roi_params?: Json
          status?: string
          to_plan?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_upsell_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          label_url: string | null
          order_id: string
          provider: string
          shipment_external_id: string | null
          status: string
          tracking_code: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          label_url?: string | null
          order_id: string
          provider: string
          shipment_external_id?: string | null
          status?: string
          tracking_code?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          label_url?: string | null
          order_id?: string
          provider?: string
          shipment_external_id?: string | null
          status?: string
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          client_id: string
          created_at: string
          delta: number
          id: string
          movement_id: string | null
          reason: string
          sku: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          delta: number
          id?: string
          movement_id?: string | null
          reason: string
          sku: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          delta?: number
          id?: string
          movement_id?: string | null
          reason?: string
          sku?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          client_id: string
          created_at: string
          id: string
          metadata: Json
          movement_type: string
          qty: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          sku: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          metadata?: Json
          movement_type: string
          qty: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sku: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          movement_type?: string
          qty?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sku?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_sync_jobs: {
        Row: {
          attempts: number
          client_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          processed_at: string | null
          sku: string
          status: string
        }
        Insert: {
          attempts?: number
          client_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          processed_at?: string | null
          sku: string
          status?: string
        }
        Update: {
          attempts?: number
          client_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          processed_at?: string | null
          sku?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_sync_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credits: {
        Row: {
          balance_cents: number
          client_id: string
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          source_return_id: string | null
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          client_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          source_return_id?: string | null
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          client_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          source_return_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_source_return_id_fkey"
            columns: ["source_return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
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
      volume_forecast_alerts: {
        Row: {
          campaign_ref: string | null
          client_id: string
          created_at: string
          expected_orders: number
          forecast_date: string
          id: string
          notified_at: string | null
        }
        Insert: {
          campaign_ref?: string | null
          client_id: string
          created_at?: string
          expected_orders: number
          forecast_date: string
          id?: string
          notified_at?: string | null
        }
        Update: {
          campaign_ref?: string | null
          client_id?: string
          created_at?: string
          expected_orders?: number
          forecast_date?: string
          id?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volume_forecast_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          aisle: string
          bin_code: string
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          level: string
          route_order: number
          shelf: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          aisle: string
          bin_code: string
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string
          route_order?: number
          shelf: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          aisle?: string
          bin_code?: string
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string
          route_order?: number
          shelf?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          client_id: string
          code: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_client_id_fkey"
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
      fiscal_emission_metrics_daily: {
        Row: {
          authorized_count: number | null
          avg_auth_minutes: number | null
          channel: string | null
          client_id: string | null
          day: string | null
          emission_count: number | null
          rejected_count: number | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_emissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mrr_by_plan: {
        Row: {
          client_count: number | null
          plan: string | null
          total_mrr_cents: number | null
        }
        Relationships: []
      }
      sac_metrics_daily: {
        Row: {
          avg_tma_minutes: number | null
          avg_tmr_minutes: number | null
          category: string | null
          channel: string | null
          client_id: string | null
          day: string | null
          resolved_count: number | null
          sla_met_count: number | null
          ticket_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sac_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_review_summary: {
        Row: {
          avg_rating: number | null
          client_id: string | null
          negative_count: number | null
          rating: number | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_funnel_metrics: {
        Row: {
          converted_count: number | null
          hot_count: number | null
          label: string | null
          position: number | null
          prospect_count: number | null
          stage_key: string | null
          warm_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_client_id: string
          p_delta: number
          p_reason: string
          p_sku: string
          p_user_id: string
        }
        Returns: string
      }
      cleanup_expired_oauth_states: { Args: never; Returns: number }
      commit_inventory: {
        Args: { p_client_id: string; p_qty: number; p_sku: string }
        Returns: boolean
      }
      current_client_id: { Args: never; Returns: string }
      increment_sac_unread: { Args: { conv_id: string }; Returns: undefined }
      increment_sequence_recovered: {
        Args: { p_cents: number; p_sequence_id: string }
        Returns: undefined
      }
      is_orbia_staff: { Args: never; Returns: boolean }
      record_stock_movement: {
        Args: {
          p_client_id: string
          p_movement_type: string
          p_qty: number
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
          p_sku: string
          p_user_id?: string
        }
        Returns: string
      }
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
      seed_sac_sla_defaults: {
        Args: { p_client_id: string }
        Returns: undefined
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
