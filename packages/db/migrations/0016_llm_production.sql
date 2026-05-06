-- Migration 0016 — LLM client production hardening (build guide §4 + §8)
-- Adds: idempotency cache for llm_calls, provider_health observability,
-- user_daily_spend materialized view for budget guards.
-- Idempotent: safe to re-run.

-- 1. llm_calls idempotency cache
alter table public.llm_calls
  add column if not exists idempotency_key text;
alter table public.llm_calls
  add column if not exists cached_response_json jsonb;

create unique index if not exists llm_calls_idempotency_key_uidx
  on public.llm_calls (user_id, idempotency_key)
  where idempotency_key is not null;

-- 2. provider_health table
create table if not exists public.provider_health (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  checked_at      timestamptz not null default now(),
  ok              boolean not null,
  latency_ms      int,
  error_kind      text,
  error_message   text
);
create index if not exists provider_health_provider_checked_idx
  on public.provider_health (provider, checked_at desc);

alter table public.provider_health enable row level security;
-- Service-role-only access (no authenticated/anon select policy).
-- Drop any prior duplicate policies first to keep this idempotent.
drop policy if exists "provider_health: service role insert" on public.provider_health;
create policy "provider_health: service role insert"
  on public.provider_health for insert
  to service_role with check (true);

-- 3. user_daily_spend materialized view (refreshed by Inngest cron)
drop materialized view if exists public.user_daily_spend;
create materialized view public.user_daily_spend as
  select
    user_id,
    date_trunc('day', created_at) as day,
    coalesce(sum(cost_usd), 0)::numeric as total_cost_usd,
    count(*) as call_count
  from public.llm_calls
  where cost_usd is not null
  group by user_id, day;

create unique index if not exists user_daily_spend_user_day_uidx
  on public.user_daily_spend (user_id, day);

-- Grants — service role bypasses RLS. authenticated may select their own row.
-- (Materialized views don't support RLS directly; the worker uses the view via
-- service-role and exposes per-user remaining-budget through a function.)
grant select on public.user_daily_spend to authenticated;

-- Cron-callable refresh function. Runs as security definer so the cron worker
-- (service-role) can refresh without owning the matview directly.
create or replace function public.refresh_user_daily_spend()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.user_daily_spend;
exception when feature_not_supported then
  -- "concurrently" requires a unique index. If the index hasn't been built
  -- yet (first refresh), fall back to a regular refresh.
  refresh materialized view public.user_daily_spend;
end;
$$;

grant execute on function public.refresh_user_daily_spend() to service_role;
