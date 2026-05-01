-- =============================================================================
-- Seed the hackathon demo user (Anya Petrov)
-- =============================================================================
-- Idempotent. Run after 0001_init.sql with the service role.
--
-- profiles.id is FK'd to auth.users(id) per CLAUDE.md, so we stub an auth row
-- first. The auth row is non-functional (no password / email confirmation) —
-- it exists purely to satisfy the FK. When real auth lands, swap this out
-- for a proper signup flow.
-- =============================================================================

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo+anya@openclaw.local',
  '',
  now(),
  '{"provider":"hackathon","providers":["hackathon"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (
  id,
  display_name,
  skills,
  hourly_rate,
  portfolio_url,
  bio
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Anya Petrov',
  '["React", "TypeScript", "Next.js", "UI design"]'::jsonb,
  85,
  'https://anya.dev',
  'Senior frontend engineer · 6 years · React/Next.js specialist'
)
on conflict (id) do nothing;
