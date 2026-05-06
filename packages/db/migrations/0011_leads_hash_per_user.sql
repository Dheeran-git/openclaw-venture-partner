-- =============================================================================
-- Phase 3 hotfix: leads.hash uniqueness must be per-user, not global.
-- =============================================================================
--
-- Migration 0001 declared `hash text not null unique` which produced a global
-- unique index `leads_hash_key`. The dedup step in scoutPipeline.ts already
-- scopes its existence check to (user_id, hash), but the global constraint
-- still rejects user B's insert when user A previously scraped the same URL.
-- This breaks multi-tenant onboarding (any new account hits the duplicate
-- error as soon as the stub scraper returns leads previously seen by another
-- user).
--
-- Fix: drop the global constraint, replace with a composite unique index on
-- (user_id, hash). dedup logic and the per-user index in 0001 already match
-- this shape.

alter table public.leads drop constraint if exists leads_hash_key;

create unique index if not exists leads_user_hash_unique
  on public.leads (user_id, hash);
