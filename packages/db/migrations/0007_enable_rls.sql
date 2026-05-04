-- =============================================================================
-- Phase 2.5: Enable Row Level Security on all user-scoped tables
-- =============================================================================
-- Reverses the DISABLE ROW LEVEL SECURITY from 0003_realtime_publications.sql
-- and enables RLS on every other business table. Service role bypasses all
-- policies (Supabase built-in). Browser clients use the anon key + user JWT
-- so these policies scope every query to auth.uid().
--
-- Realtime postgres_changes subscriptions also respect RLS — the Realtime
-- service evaluates each changed row against the subscriber's JWT before
-- forwarding it. The server-side filter (user_id=eq.X) is an extra
-- optimisation on the replication slot, not a security boundary.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Re-enable RLS (disabled by 0003_realtime_publications.sql)
-- ---------------------------------------------------------------------------
alter table public.leads    enable row level security;
alter table public.scores   enable row level security;
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Enable RLS on tables that were off-by-default (never explicitly disabled)
-- ---------------------------------------------------------------------------
alter table public.pitches   enable row level security;
alter table public.clients   enable row level security;
alter table public.approvals enable row level security;
alter table public.llm_calls enable row level security;
alter table public.sources   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- Onboarding page upserts a profile via the browser client (anon + JWT),
-- so we need INSERT + UPDATE in addition to SELECT.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- leads
-- Workers insert via service role (bypasses RLS). Browser reads only.
-- ---------------------------------------------------------------------------
drop policy if exists "leads: read own" on public.leads;
create policy "leads: read own"
  on public.leads for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- scores
-- No user_id column. Access is scoped via the lead FK.
-- Workers insert via service role.
-- ---------------------------------------------------------------------------
drop policy if exists "scores: read own via lead" on public.scores;
create policy "scores: read own via lead"
  on public.scores for select
  using (
    lead_id in (
      select id from public.leads where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- pitches
-- Workers / MCP tools insert via service role. Users can read and update
-- (Phase 3 HITL: user approves/rejects their own pitches via the browser).
-- ---------------------------------------------------------------------------
drop policy if exists "pitches: read own" on public.pitches;
create policy "pitches: read own"
  on public.pitches for select
  using (auth.uid() = user_id);

drop policy if exists "pitches: update own" on public.pitches;
create policy "pitches: update own"
  on public.pitches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- clients, approvals, llm_calls, sources — read own
-- All writes go through service role; no user-level write policies needed.
-- ---------------------------------------------------------------------------
drop policy if exists "clients: read own" on public.clients;
create policy "clients: read own"
  on public.clients for select
  using (auth.uid() = user_id);

drop policy if exists "approvals: read own" on public.approvals;
create policy "approvals: read own"
  on public.approvals for select
  using (auth.uid() = user_id);

drop policy if exists "llm_calls: read own" on public.llm_calls;
create policy "llm_calls: read own"
  on public.llm_calls for select
  using (auth.uid() = user_id);

drop policy if exists "sources: read own" on public.sources;
create policy "sources: read own"
  on public.sources for select
  using (auth.uid() = user_id);
