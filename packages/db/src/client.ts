import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export type DB = SupabaseClient<Database>;

/**
 * Browser-safe client. Uses the public anon key; never receives the
 * service role. Read access only beyond what RLS would allow once
 * policies are wired up post-hackathon.
 */
export function createBrowserSupabaseClient(): DB {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Server-only client. Uses the service role key — must never reach
 * the browser bundle. Suitable for API routes, route handlers, and
 * background workers.
 */
export function createServerClient(): DB {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
