-- =============================================================================
-- Phase 3: Pitch HITL columns
-- =============================================================================
-- Adds the columns required by the payload_hash security model (§10 of the
-- build guide) and the send-attempt tracking fields for Resend retries.
-- Also opens the pitches table to Supabase Realtime so the dashboard can
-- subscribe to pitch status changes.
-- =============================================================================

alter table public.pitches
  add column if not exists payload_hash       text,
  add column if not exists expected_signal    jsonb,
  add column if not exists send_attempt_count int  not null default 0,
  add column if not exists last_send_error    text;

alter table public.approvals
  add column if not exists verified_payload_hash text,
  add column if not exists actor_platform        text;
-- actor_platform: 'web' | 'telegram' | 'discord' | 'slack'

-- Open pitches to Realtime. 0003_realtime_publications.sql already handles
-- leads/scores. RLS enforces row-level access; the filter on the subscription
-- side (user_id=eq.X) is an optimisation, not the security boundary.
alter publication supabase_realtime add table public.pitches;
