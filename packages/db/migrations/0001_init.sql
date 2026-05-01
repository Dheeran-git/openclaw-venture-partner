-- =============================================================================
-- OpenClaw Venture Partner — initial schema
-- =============================================================================
-- Every business table carries `user_id`. Application layer enforces the filter
-- for the hackathon; RLS policies are deferred to a later migration alongside
-- real auth. See CLAUDE.md for rationale.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — extends Supabase auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  skills        jsonb,
  hourly_rate   numeric,
  portfolio_url text,
  bio           text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sources — scrape sources configured per user (upwork, linkedin, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            text not null,
  config          jsonb,
  last_scraped_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists sources_user_id_idx on public.sources (user_id);

-- ---------------------------------------------------------------------------
-- leads — discovered opportunities (layer 1/2/3)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  source_id   uuid references public.sources(id) on delete set null,
  layer       int  not null check (layer in (1, 2, 3)),
  raw         jsonb not null,
  normalized  jsonb not null,
  hash        text not null unique,
  scraped_at  timestamptz not null default now()
);
create index if not exists leads_user_id_idx     on public.leads (user_id);
create index if not exists leads_user_layer_idx  on public.leads (user_id, layer);
create index if not exists leads_scraped_at_idx  on public.leads (scraped_at desc);

-- ---------------------------------------------------------------------------
-- scores — per-lead scoring output
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  score           int  not null check (score between 0 and 100),
  reasoning       text,
  prompt_version  text not null,
  model           text not null,
  created_at      timestamptz not null default now()
);
create index if not exists scores_lead_id_idx on public.scores (lead_id);

-- ---------------------------------------------------------------------------
-- pitches — drafted outreach pinned to a lead
-- ---------------------------------------------------------------------------
create table if not exists public.pitches (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  draft        text not null,
  subject      text,
  status       text not null default 'draft'
                check (status in ('draft', 'approved', 'sent', 'rejected')),
  approved_at  timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists pitches_user_id_idx on public.pitches (user_id);
create index if not exists pitches_lead_id_idx on public.pitches (lead_id);
create index if not exists pitches_status_idx  on public.pitches (status);

-- ---------------------------------------------------------------------------
-- clients — won / engaged clients with persistent agent memory
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  company_name   text not null,
  contact_email  text,
  source_lead_id uuid references public.leads(id) on delete set null,
  status         text default 'active',
  memory_md      text,
  created_at     timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients (user_id);

-- ---------------------------------------------------------------------------
-- approvals — audit log of every HITL decision
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  action_type   text not null,
  payload_hash  text not null,
  resource_type text,
  resource_id   uuid,
  status        text not null
                check (status in ('approved', 'rejected', 'pending', 'expired')),
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists approvals_user_id_idx     on public.approvals (user_id);
create index if not exists approvals_resource_idx    on public.approvals (resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- llm_calls — telemetry for every LLM invocation
-- ---------------------------------------------------------------------------
create table if not exists public.llm_calls (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  purpose         text not null,
  prompt_version  text,
  model           text not null,
  provider        text not null,
  input_tokens    int,
  output_tokens   int,
  cost_usd        numeric,
  duration_ms     int,
  request         jsonb,
  response        jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists llm_calls_user_id_idx    on public.llm_calls (user_id);
create index if not exists llm_calls_created_at_idx on public.llm_calls (created_at desc);
create index if not exists llm_calls_purpose_idx    on public.llm_calls (purpose);
