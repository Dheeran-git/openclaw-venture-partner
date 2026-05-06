-- Migration 0017 — scrape_failures table (build guide §5.2)
-- Persists raw HTML from any parser failure so we can debug without re-scraping.
-- Idempotent: safe to re-run.

create table if not exists public.scrape_failures (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  source          text not null,
  url             text not null,
  raw_html        text,
  parser_strategy text,
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists scrape_failures_created_idx
  on public.scrape_failures (created_at desc);
create index if not exists scrape_failures_source_idx
  on public.scrape_failures (source, created_at desc);

alter table public.scrape_failures enable row level security;

drop policy if exists "scrape_failures: service role insert" on public.scrape_failures;
create policy "scrape_failures: service role insert"
  on public.scrape_failures for insert
  to service_role with check (true);

drop policy if exists "scrape_failures: read own" on public.scrape_failures;
create policy "scrape_failures: read own"
  on public.scrape_failures for select
  to authenticated using (auth.uid() = user_id);
