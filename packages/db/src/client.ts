import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as ssrCreateBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export type DB = SupabaseClient<Database>;

/**
 * supabase-js expects the bare project URL (https://xyz.supabase.co) and
 * appends /rest/v1/, /auth/v1/, etc. itself. The Supabase dashboard
 * sometimes shows the URL with "/rest/v1/" already appended in certain
 * panes -- pasting that into NEXT_PUBLIC_SUPABASE_URL produces a doubled
 * /rest/v1/rest/v1/ path. Strip both forms defensively.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
}

/**
 * Browser-safe client using @supabase/ssr so auth state is stored in
 * cookies (not just localStorage), enabling the server to read the
 * session via middleware and Server Components without an extra round-trip.
 */
export function createBrowserSupabaseClient(): DB {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }
  return ssrCreateBrowserClient<Database>(normalizeSupabaseUrl(url), key);
}

/**
 * Service-role client. Bypasses RLS entirely — must never reach the
 * browser bundle. Use for Inngest workers, MCP tool handlers, and
 * server-side telemetry that needs full table access.
 */
export function createServiceRoleClient(): DB {
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
