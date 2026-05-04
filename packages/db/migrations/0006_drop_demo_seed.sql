-- =============================================================================
-- Phase 2.5: Remove the hackathon demo user (Anya Petrov)
-- =============================================================================
-- Idempotent. Deleting from auth.users cascades through profiles, leads,
-- scores, pitches, clients, approvals, llm_calls, sources via the FK chains
-- defined in 0001_init.sql.
--
-- Apply BEFORE 0007_enable_rls.sql. Running 0007 first would also work
-- (service role bypasses RLS) but this order is cleaner to reason about.
-- =============================================================================

delete from auth.users
where id = '00000000-0000-0000-0000-000000000001';
