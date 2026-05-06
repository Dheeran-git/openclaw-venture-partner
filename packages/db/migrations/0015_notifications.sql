-- =============================================================================
-- Phase 6 step 6 — in-app notifications feed
-- =============================================================================
-- One row per actionable event the operator should see in the bell dropdown.
-- Worker functions insert here after pitch drafted, reply received, scout
-- completed; the dashboard reads via /api/notifications + Realtime.

create table if not exists public.notifications (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  kind          text        not null,
  title         text        not null,
  body          text,
  resource_type text,
  resource_id   uuid,
  href          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: read own" on public.notifications
  for select to authenticated using (auth.uid() = user_id);

create policy "notifications: update own" on public.notifications
  for update to authenticated using (auth.uid() = user_id);

create policy "notifications: service role insert" on public.notifications
  for insert to service_role with check (true);

alter publication supabase_realtime add table public.notifications;
