/**
 * Hand-written database types matching packages/db/migrations/0001_init.sql.
 *
 * Replace via `pnpm --filter @openclaw/db db:gen-types` once a Supabase
 * project is linked. This stub exists so TypeScript compiles before the
 * Supabase CLI is wired up.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LeadLayer = 1 | 2 | 3;
export type PitchStatus = "draft" | "approved" | "sent" | "rejected" | "send_failed";
export type ApprovalStatus = "approved" | "rejected" | "pending" | "expired";
export type LLMPurpose =
  | "score_lead"
  | "draft_pitch"
  | "draft_reply"
  | "extract_lead"
  | "memory_update";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          skills: Json | null;
          hourly_rate: number | null;
          bio: string | null;
          portfolio_urls: string[];
          past_clients: Json;
          availability: string | null;
          timezone: string;
          telegram_user_id: number | null;
          discord_user_id: string | null;
          slack_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          skills?: Json | null;
          hourly_rate?: number | null;
          bio?: string | null;
          portfolio_urls?: string[];
          past_clients?: Json;
          availability?: string | null;
          timezone?: string;
          telegram_user_id?: number | null;
          discord_user_id?: string | null;
          slack_user_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      sources: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          config: Json | null;
          last_scraped_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sources"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          user_id: string;
          source_id: string | null;
          layer: LeadLayer;
          raw: Json;
          normalized: Json;
          hash: string;
          scraped_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["leads"]["Row"],
          "id" | "scraped_at"
        > & { id?: string; scraped_at?: string };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      scores: {
        Row: {
          id: string;
          lead_id: string;
          score: number;
          reasoning: string | null;
          signals: Json | null;
          prompt_version: string;
          model: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["scores"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["scores"]["Insert"]>;
      };
      pitches: {
        Row: {
          id: string;
          lead_id: string;
          user_id: string;
          draft: string;
          subject: string | null;
          status: PitchStatus;
          payload_hash: string | null;
          expected_signal: Json | null;
          send_attempt_count: number;
          last_send_error: string | null;
          approved_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          user_id: string;
          draft: string;
          subject?: string | null;
          status?: PitchStatus;
          payload_hash?: string | null;
          expected_signal?: Json | null;
          send_attempt_count?: number;
          last_send_error?: string | null;
          approved_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pitches"]["Insert"]>;
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          contact_email: string | null;
          source_lead_id: string | null;
          status: string | null;
          memory_md: string | null;
          upsell_flagged_at: string | null;
          upsell_reason: string | null;
          last_reply_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          contact_email?: string | null;
          source_lead_id?: string | null;
          status?: string | null;
          memory_md?: string | null;
          upsell_flagged_at?: string | null;
          upsell_reason?: string | null;
          last_reply_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
      };
      approvals: {
        Row: {
          id: string;
          user_id: string;
          action_type: string;
          payload_hash: string;
          resource_type: string | null;
          resource_id: string | null;
          verified_payload_hash: string | null;
          actor_platform: string | null;
          status: ApprovalStatus;
          decided_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["approvals"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["approvals"]["Insert"]>;
      };
      llm_calls: {
        Row: {
          id: string;
          user_id: string | null;
          purpose: LLMPurpose;
          prompt_version: string | null;
          model: string;
          provider: string;
          input_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          duration_ms: number | null;
          request: Json | null;
          response: Json | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["llm_calls"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["llm_calls"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          actor: string;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          metadata: Json | null;
          ip_addr: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          actor: string;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: Json | null;
          ip_addr?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
      };
      binding_codes: {
        Row: {
          code: string;
          user_id: string;
          platform: "telegram" | "discord" | "slack" | "whatsapp";
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          user_id: string;
          platform: "telegram" | "discord" | "slack" | "whatsapp";
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["binding_codes"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          resource_type: string | null;
          resource_id: string | null;
          href: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body?: string | null;
          resource_type?: string | null;
          resource_id?: string | null;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      email_replies: {
        Row: {
          id: string;
          user_id: string;
          pitch_id: string;
          client_id: string | null;
          from_email: string;
          subject: string | null;
          body_text: string;
          body_html: string | null;
          received_at: string;
          classification: "positive" | "negative" | "question" | "unsubscribe" | null;
          classification_confidence: "high" | "medium" | "low" | null;
          classification_reasoning: string | null;
          classification_suggested_action: string | null;
          drafted_subject: string | null;
          drafted_options: Json | null;
          drafted_reasoning: string | null;
          selected_option_index: number | null;
          approved_body: string | null;
          payload_hash: string | null;
          status:
            | "pending"
            | "classified"
            | "drafted"
            | "approved"
            | "sent"
            | "rejected"
            | "failed"
            | "unsubscribed";
          sent_at: string | null;
          send_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pitch_id: string;
          client_id?: string | null;
          from_email: string;
          subject?: string | null;
          body_text: string;
          body_html?: string | null;
          received_at?: string;
          classification?: "positive" | "negative" | "question" | "unsubscribe" | null;
          classification_confidence?: "high" | "medium" | "low" | null;
          classification_reasoning?: string | null;
          classification_suggested_action?: string | null;
          drafted_subject?: string | null;
          drafted_options?: Json | null;
          drafted_reasoning?: string | null;
          selected_option_index?: number | null;
          approved_body?: string | null;
          payload_hash?: string | null;
          status?:
            | "pending"
            | "classified"
            | "drafted"
            | "approved"
            | "sent"
            | "rejected"
            | "failed"
            | "unsubscribed";
          sent_at?: string | null;
          send_error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_replies"]["Insert"]>;
      };
      proof_artifacts: {
        Row: {
          id: string;
          user_id: string;
          pitch_id: string;
          artifact_type: "lighthouse" | "sample_component" | "video" | "custom";
          target_url: string;
          summary: string | null;
          metadata: Json;
          status: "pending" | "running" | "complete" | "failed";
          error: string | null;
          generated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pitch_id: string;
          artifact_type: "lighthouse" | "sample_component" | "video" | "custom";
          target_url: string;
          summary?: string | null;
          metadata?: Json;
          status?: "pending" | "running" | "complete" | "failed";
          error?: string | null;
          generated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["proof_artifacts"]["Insert"]>;
      };
      chat_callback_tokens: {
        Row: {
          token: string;
          user_id: string;
          pitch_id: string;
          payload_hash: string;
          action: "approve" | "reject" | "edit";
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          token: string;
          user_id: string;
          pitch_id: string;
          payload_hash: string;
          action: "approve" | "reject" | "edit";
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_callback_tokens"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
