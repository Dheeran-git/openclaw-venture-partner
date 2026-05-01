import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type DB = SupabaseClient<Database>;

/**
 * supabase-js expects the bare project URL (https://xyz.supabase.co) and
 * appends /rest/v1/, /auth/v1/, etc. itself. The Supabase dashboard
 * sometimes shows the URL with "/rest/v1/" already appended in certain
 * panes -- pasting that into NEXT_PUBLIC_SUPABASE_URL produces a doubled
 * /rest/v1/rest/v1/ path. Strip both forms defensively.
 */
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
}

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
  return createClient<Database>(normalizeSupabaseUrl(url), key, {
    auth: { persistSession: false },
  });
}

/**
 * Server-only client. Uses the service role key -- must never reach
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
  return createClient<Database>(normalizeSupabaseUrl(url), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
