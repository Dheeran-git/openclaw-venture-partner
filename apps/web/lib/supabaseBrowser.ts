/**
 * Module-scoped singleton for the browser Supabase client.
 *
 * Critical: this MUST be cached at module scope, not instantiated
 * inside a hook. Hook-scoped instantiation creates a fresh
 * RealtimeClient on every component render, which floods the
 * Realtime server with WebSocket connections (one per render),
 * cascading into thousands of zombie sockets after a few seconds
 * of mounting/unmounting. Module scope guarantees one client per
 * tab for the lifetime of the page.
 */
import { createBrowserSupabaseClient, type DB } from "@openclaw/db";

let cached: DB | null = null;

export function getSupabaseBrowser(): DB {
  if (!cached) {
    cached = createBrowserSupabaseClient();
  }
  return cached;
}
