-- =============================================================================
-- Phase 3: Pitch HITL columns + audit_log table
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
-- side (lead_id=eq.X) is an optimisation, not the security boundary.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pitches'
  ) then
    alter publication supabase_realtime add table public.pitches;
  end if;
end $$;

-- Append-only audit log for sensitive actions (pitch approvals, rejects, sends).
-- Written by service role; users can read their own rows.
create table if not exists public.audit_log (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references public.profiles(id) on delete cascade,
  actor         text        not null,   -- 'user' | 'agent' | 'system'
  action        text        not null,   -- 'pitch.approved' | 'pitch.rejected' | 'pitch.sent' | ...
  resource_type text,
  resource_id   text,
  metadata      jsonb,
  ip_addr       text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_user_created_idx on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_action_created_idx on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;
create policy "audit_log: read own" on public.audit_log
  for select to authenticated using (auth.uid() = user_id);
create policy "audit_log: service role insert" on public.audit_log
  for insert to service_role with check (true);
