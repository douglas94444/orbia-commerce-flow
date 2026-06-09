// Auto-generated from Supabase project ztaozvgmzycetiwwkhjc

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          client_id: string;
          created_at: string;
          currency: string;
          external_id: string;
          id: string;
          is_active: boolean;
          name: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          currency?: string;
          external_id: string;
          id?: string;
          is_active?: boolean;
          name?: string | null;
          provider: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          currency?: string;
          external_id?: string;
          id?: string;
          is_active?: boolean;
          name?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ad_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          client_id: string | null;
          created_at: string;
          id: string;
          ip_address: unknown;
          new_data: Json | null;
          old_data: Json | null;
          resource: string;
          resource_id: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          resource: string;
          resource_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          resource?: string;
          resource_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_executions: {
        Row: {
          customer_id: string | null;
          flow_id: string;
          id: string;
          metadata: Json;
          sent_at: string;
          status: string;
        };
        Insert: {
          customer_id?: string | null;
          flow_id: string;
          id?: string;
          metadata?: Json;
          sent_at?: string;
          status: string;
        };
        Update: {
          customer_id?: string | null;
          flow_id?: string;
          id?: string;
          metadata?: Json;
          sent_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_executions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_executions_flow_id_fkey";
            columns: ["flow_id"];
            isOneToOne: false;
            referencedRelation: "automation_flows";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_flows: {
        Row: {
          channel: string;
          client_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          recovered: number;
          sent_30d: number;
          trigger: string;
          updated_at: string;
        };
        Insert: {
          channel: string;
          client_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          recovered?: number;
          sent_30d?: number;
          trigger: string;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          recovered?: number;
          sent_30d?: number;
          trigger?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_flows_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          ad_account_id: string | null;
          client_id: string;
          created_at: string;
          external_id: string;
          id: string;
          name: string;
          period_end: string | null;
          period_start: string | null;
          platform: string;
          revenue_cents: number;
          roas: number;
          spend_cents: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          ad_account_id?: string | null;
          client_id: string;
          created_at?: string;
          external_id: string;
          id?: string;
          name: string;
          period_end?: string | null;
          period_start?: string | null;
          platform: string;
          revenue_cents?: number;
          roas?: number;
          spend_cents?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          ad_account_id?: string | null;
          client_id?: string;
          created_at?: string;
          external_id?: string;
          id?: string;
          name?: string;
          period_end?: string | null;
          period_start?: string | null;
          platform?: string;
          revenue_cents?: number;
          roas?: number;
          spend_cents?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey";
            columns: ["ad_account_id"];
            isOneToOne: false;
            referencedRelation: "ad_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_members: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          created_at: string;
          gmv_30d: number;
          health_score: number;
          id: string;
          last_contact_days: number;
          metadata: Json;
          name: string;
          onboarding_week: number;
          plan: string;
          roas_avg: number;
          segment: string | null;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          gmv_30d?: number;
          health_score?: number;
          id?: string;
          last_contact_days?: number;
          metadata?: Json;
          name: string;
          onboarding_week?: number;
          plan?: string;
          roas_avg?: number;
          segment?: string | null;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          gmv_30d?: number;
          health_score?: number;
          id?: string;
          last_contact_days?: number;
          metadata?: Json;
          name?: string;
          onboarding_week?: number;
          plan?: string;
          roas_avg?: number;
          segment?: string | null;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          client_id: string;
          created_at: string;
          email_hash: string;
          external_id: string | null;
          id: string;
          last_order_at: string | null;
          ltv_cents: number;
          order_count: number;
          phone_hash: string | null;
          rfm_score: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          email_hash: string;
          external_id?: string | null;
          id?: string;
          last_order_at?: string | null;
          ltv_cents?: number;
          order_count?: number;
          phone_hash?: string | null;
          rfm_score?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          email_hash?: string;
          external_id?: string | null;
          id?: string;
          last_order_at?: string | null;
          ltv_cents?: number;
          order_count?: number;
          phone_hash?: string | null;
          rfm_score?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      fiscal_configs: {
        Row: {
          cert_expires_at: string | null;
          cert_path: string | null;
          client_id: string;
          cnpj: string;
          company_name: string;
          created_at: string;
          default_cfop: string | null;
          default_cst: string | null;
          default_ncm: string | null;
          id: string;
          tax_regime: string;
          updated_at: string;
        };
        Insert: {
          cert_expires_at?: string | null;
          cert_path?: string | null;
          client_id: string;
          cnpj: string;
          company_name: string;
          created_at?: string;
          default_cfop?: string | null;
          default_cst?: string | null;
          default_ncm?: string | null;
          id?: string;
          tax_regime: string;
          updated_at?: string;
        };
        Update: {
          cert_expires_at?: string | null;
          cert_path?: string | null;
          client_id?: string;
          cnpj?: string;
          company_name?: string;
          created_at?: string;
          default_cfop?: string | null;
          default_cst?: string | null;
          default_ncm?: string | null;
          id?: string;
          tax_regime?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fiscal_configs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_logs: {
        Row: {
          client_id: string | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          metadata: Json;
          operation: string;
          provider: string;
          request_hash: string | null;
          response_code: number | null;
          status: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          operation: string;
          provider: string;
          request_hash?: string | null;
          response_code?: number | null;
          status: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          operation?: string;
          provider?: string;
          request_hash?: string | null;
          response_code?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          product: string;
          reserved: number;
          sku: string;
          units: number;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          product: string;
          reserved?: number;
          sku: string;
          units?: number;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          product?: string;
          reserved?: number;
          sku?: string;
          units?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      job_logs: {
        Row: {
          attempts: number;
          client_id: string | null;
          created_at: string;
          duration_ms: number | null;
          error: string | null;
          id: string;
          job_id: string | null;
          job_type: string;
          metadata: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          client_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error?: string | null;
          id?: string;
          job_id?: string | null;
          job_type: string;
          metadata?: Json;
          status: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          client_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error?: string | null;
          id?: string;
          job_id?: string | null;
          job_type?: string;
          metadata?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account: string;
          amount_cents: number;
          created_at: string;
          direction: string;
          id: string;
          transaction_id: string;
        };
        Insert: {
          account: string;
          amount_cents: number;
          created_at?: string;
          direction: string;
          id?: string;
          transaction_id: string;
        };
        Update: {
          account?: string;
          amount_cents?: number;
          created_at?: string;
          direction?: string;
          id?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      nfe_emissions: {
        Row: {
          access_key: string | null;
          authorized_at: string | null;
          client_id: string;
          created_at: string;
          danfe_url: string | null;
          external_ref: string | null;
          id: string;
          last_error: string | null;
          order_id: string | null;
          retries: number;
          status: string;
          type: string;
          updated_at: string;
          value_cents: number;
          xml_url: string | null;
        };
        Insert: {
          access_key?: string | null;
          authorized_at?: string | null;
          client_id: string;
          created_at?: string;
          danfe_url?: string | null;
          external_ref?: string | null;
          id?: string;
          last_error?: string | null;
          order_id?: string | null;
          retries?: number;
          status?: string;
          type: string;
          updated_at?: string;
          value_cents: number;
          xml_url?: string | null;
        };
        Update: {
          access_key?: string | null;
          authorized_at?: string | null;
          client_id?: string;
          created_at?: string;
          danfe_url?: string | null;
          external_ref?: string | null;
          id?: string;
          last_error?: string | null;
          order_id?: string | null;
          retries?: number;
          status?: string;
          type?: string;
          updated_at?: string;
          value_cents?: number;
          xml_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nfe_emissions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nfe_emissions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_connections: {
        Row: {
          access_token: string;
          client_id: string;
          created_at: string;
          external_account: string | null;
          id: string;
          is_active: boolean;
          last_refreshed_at: string | null;
          metadata: Json;
          provider: string;
          refresh_token: string | null;
          scopes: string[] | null;
          token_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          client_id: string;
          created_at?: string;
          external_account?: string | null;
          id?: string;
          is_active?: boolean;
          last_refreshed_at?: string | null;
          metadata?: Json;
          provider: string;
          refresh_token?: string | null;
          scopes?: string[] | null;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          client_id?: string;
          created_at?: string;
          external_account?: string | null;
          id?: string;
          is_active?: boolean;
          last_refreshed_at?: string | null;
          metadata?: Json;
          provider?: string;
          refresh_token?: string | null;
          scopes?: string[] | null;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_connections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_states: {
        Row: {
          client_id: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          metadata: Json;
          nonce: string;
          provider: string;
          redirect_to: string | null;
          state: string;
          user_id: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          metadata?: Json;
          nonce: string;
          provider: string;
          redirect_to?: string | null;
          state: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          metadata?: Json;
          nonce?: string;
          provider?: string;
          redirect_to?: string | null;
          state?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_states_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          id: string;
          metadata: Json;
          occurred_at: string;
          order_id: string;
          source: string;
          status: string;
        };
        Insert: {
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          order_id: string;
          source?: string;
          status: string;
        };
        Update: {
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          order_id?: string;
          source?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          carrier: string | null;
          channel: string;
          city: string | null;
          client_id: string;
          created_at: string;
          external_id: string;
          id: string;
          metadata: Json;
          nf_status: string;
          status: string;
          updated_at: string;
          value_cents: number;
        };
        Insert: {
          carrier?: string | null;
          channel: string;
          city?: string | null;
          client_id: string;
          created_at?: string;
          external_id: string;
          id?: string;
          metadata?: Json;
          nf_status?: string;
          status?: string;
          updated_at?: string;
          value_cents: number;
        };
        Update: {
          carrier?: string | null;
          channel?: string;
          city?: string | null;
          client_id?: string;
          created_at?: string;
          external_id?: string;
          id?: string;
          metadata?: Json;
          nf_status?: string;
          status?: string;
          updated_at?: string;
          value_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          amount_cents: number;
          cancelled_at: string | null;
          client_id: string;
          created_at: string;
          current_period_end: string | null;
          id: string;
          plan: string;
          provider: string;
          provider_sub_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          cancelled_at?: string | null;
          client_id: string;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          plan: string;
          provider: string;
          provider_sub_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          cancelled_at?: string | null;
          client_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          plan?: string;
          provider?: string;
          provider_sub_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          amount_cents: number;
          client_id: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          provider: string;
          provider_tx_id: string | null;
          status: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          client_id: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          provider: string;
          provider_tx_id?: string | null;
          status?: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          client_id?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          provider?: string;
          provider_tx_id?: string | null;
          status?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: {
          attempts: number;
          client_id: string | null;
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          last_error: string | null;
          max_attempts: number;
          next_retry_at: string | null;
          payload: Json;
          processed_at: string | null;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          client_id?: string | null;
          created_at?: string;
          event_id: string;
          event_type: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_retry_at?: string | null;
          payload: Json;
          processed_at?: string | null;
          provider: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          client_id?: string | null;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_retry_at?: string | null;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      mrr_by_plan: {
        Row: {
          client_count: number | null;
          plan: string | null;
          total_mrr_cents: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      cleanup_expired_oauth_states: { Args: never; Returns: number };
      current_client_id: { Args: never; Returns: string };
      is_orbia_staff: { Args: never; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
