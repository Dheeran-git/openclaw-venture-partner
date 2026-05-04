import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@openclaw/db/types";
import { normalizeSupabaseUrl } from "@openclaw/db";

/**
 * Cookie-aware Supabase client for Server Components and Route Handlers.
 * Uses the anon key + the user's session cookie — scoped to the
 * authenticated user. RLS policies apply. Never use this where you need
 * service-role access; use createServiceRoleClient from @openclaw/db instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't set cookies — Route Handlers and
            // middleware handle cookie refresh instead.
          }
        },
      },
    }
  );
}

/** Returns the active session, or null if the user is not signed in. */
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
