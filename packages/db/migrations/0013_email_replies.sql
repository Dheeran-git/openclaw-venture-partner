-- =============================================================================
-- Phase 5 step 1 — inbound email reply ingestion + reply drafting state
-- =============================================================================
-- One row per inbound email tied to an outgoing pitch. The classifier worker
-- fills `classification*`, the drafter worker fills `drafted_*`, and the
-- operator approval flow fills `approved_*` + flips `status` to 'sent'
-- via the existing payload_hash model.

create table if not exists public.email_replies (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  pitch_id        uuid        not null references public.pitches(id)  on delete cascade,
  client_id       uuid        references public.clients(id) on delete set null,

  -- Inbound payload
  from_email      text        not null,
  subject         text,
  body_text       text        not null,
  body_html       text,
  received_at     timestamptz not null default now(),

  -- Classification output (worker)
  classification  text        check (classification in ('positive','negative','question','unsubscribe')),
  classification_confidence text check (classification_confidence in ('high','medium','low')),
  classification_reasoning text,
  classification_suggested_action text,

  -- Drafted reply (worker)
  drafted_subject text,
  drafted_options jsonb,                    -- array of { tone, body }
  drafted_reasoning text,

  -- Operator approval (user)
  selected_option_index integer check (selected_option_index between 0 and 2),
  approved_body   text,                     -- final, possibly edited
  payload_hash    text,                     -- computed at approve time

  -- Send tracking
  status          text        not null default 'pending'
    check (status in ('pending','classified','drafted','approved','sent','rejected','failed','unsubscribed')),
  sent_at         timestamptz,
  send_error      text,

  created_at      timestamptz not null default now()
);

create index if not exists email_replies_pitch_idx  on public.email_replies (pitch_id);
create index if not exists email_replies_user_idx   on public.email_replies (user_id, created_at desc);
create index if not exists email_replies_client_idx on public.email_replies (client_id);
create index if not exists email_replies_status_idx on public.email_replies (status)
  where status in ('pending','classified','drafted','approved');

alter table public.email_replies enable row level security;

create policy "email_replies: read own" on public.email_replies
  for select to authenticated using (auth.uid() = user_id);

create policy "email_replies: service role insert" on public.email_replies
  for insert to service_role with check (true);

create policy "email_replies: service role update" on public.email_replies
  for update to service_role using (true);

alter publication supabase_realtime add table public.email_replies;

-- ----------------------------------------------------------------------------
-- Allow operator to read their own client rows (needed for /clients UI)
-- The clients table already exists from 0001 with RLS enabled in 0007 but
-- the 'read own' policy may not have been applied; add it idempotently.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clients'
      and policyname = 'clients: read own'
  ) then
    create policy "clients: read own" on public.clients
      for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Realtime so /clients page picks up upsell-detection writes immediately
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients'
  ) then
    execute 'alter publication supabase_realtime add table public.clients';
  end if;
end $$;
