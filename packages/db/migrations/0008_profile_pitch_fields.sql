-- =============================================================================
-- Phase 2.5 → 3 bridge: add pitch-context fields to profiles
-- =============================================================================
-- These fields are read by the Phase 3 pitch-drafting prompt to personalize
-- outreach. portfolio_urls and past_clients were described in the design but
-- not included in 0001_init.sql. availability and timezone were collected in
-- the onboarding UI but not persisted (no column existed).
-- =============================================================================

alter table public.profiles
  add column if not exists portfolio_urls  text[]       default '{}',
  add column if not exists past_clients    jsonb        default '[]',
  add column if not exists availability    text,
  add column if not exists timezone        text         default 'UTC';

-- Drop the singular portfolio_url (unused — form never wrote to it).
-- Migrate any existing value into the new array before dropping.
update public.profiles
  set portfolio_urls = array[portfolio_url]
  where portfolio_url is not null and portfolio_url <> '';

alter table public.profiles drop column if exists portfolio_url;
