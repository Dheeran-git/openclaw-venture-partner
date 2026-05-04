-- Phase 2 / Step 6: prepare leads, scores, profiles for browser-side
-- live data. Two changes, both idempotent:
--   1. Add tables to the supabase_realtime publication so
--      postgres_changes INSERT events propagate to subscribers.
--   2. Disable RLS so the browser anon role can read them. Modern
--      Supabase projects enable RLS by default on new tables; without
--      policies that is "deny all" and breaks both initial fetch and
--      realtime delivery. The hackathon explicitly defers RLS to a
--      production migration with per-user policies.
--
-- Apply via the Supabase dashboard SQL editor.

-- 1. Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
  END IF;
END
$$;

-- 2. Disable RLS for browser-anon read access on the tables the
--    dashboard reads from. Service role bypasses these regardless.
ALTER TABLE public.leads    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
