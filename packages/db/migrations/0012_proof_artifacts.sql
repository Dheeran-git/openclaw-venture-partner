-- =============================================================================
-- Phase 4: Layer 2 proof-of-value
-- =============================================================================
-- Stores artifacts produced by the agent before sending an outreach email:
-- Lighthouse audits, sample components, video walk-throughs, etc. The pitch
-- prompt reads `metadata.summary` to reference proof concretely in the body.
--
-- Currently only `lighthouse` is shipped (Phase 4); other artifact_types
-- remain empty rows for forward-compat without schema churn.

create table if not exists public.proof_artifacts (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  pitch_id        uuid        not null references public.pitches(id)  on delete cascade,
  artifact_type   text        not null check (artifact_type in ('lighthouse','sample_component','video','custom')),
  target_url      text        not null,
  summary         text,                                          -- 1-2 sentence operator-readable summary
  metadata        jsonb       not null default '{}'::jsonb,      -- full payload (Lighthouse JSON, etc.)
  status          text        not null default 'pending'
                                check (status in ('pending','running','complete','failed')),
  error           text,                                          -- populated when status='failed'
  generated_at    timestamptz,                                   -- when the artifact actually finished
  created_at      timestamptz not null default now()
);

create index if not exists proof_artifacts_pitch_idx
  on public.proof_artifacts (pitch_id);
create index if not exists proof_artifacts_user_idx
  on public.proof_artifacts (user_id, created_at desc);

-- RLS — user reads only their own; service role writes
alter table public.proof_artifacts enable row level security;

create policy "proof_artifacts: read own" on public.proof_artifacts
  for select to authenticated using (auth.uid() = user_id);

create policy "proof_artifacts: service role insert" on public.proof_artifacts
  for insert to service_role with check (true);

create policy "proof_artifacts: service role update" on public.proof_artifacts
  for update to service_role using (true);

-- Realtime so the dashboard can subscribe to status flips (pending → running → complete)
alter publication supabase_realtime add table public.proof_artifacts;
