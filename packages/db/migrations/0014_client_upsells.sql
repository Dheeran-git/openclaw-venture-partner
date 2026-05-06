-- =============================================================================
-- Phase 5 step 6 — upsell-detection columns on clients
-- =============================================================================
-- The detectUpsells worker (Inngest cron) scans active clients on a schedule
-- and flags candidates for follow-up. We store the flag inline on `clients`
-- rather than a separate table because the relationship is 1:1 and the
-- /clients UI needs the field anyway.

alter table public.clients
  add column if not exists upsell_flagged_at  timestamptz,
  add column if not exists upsell_reason      text,
  add column if not exists last_reply_at      timestamptz;

create index if not exists clients_upsell_flagged_idx
  on public.clients (upsell_flagged_at desc)
  where upsell_flagged_at is not null;
