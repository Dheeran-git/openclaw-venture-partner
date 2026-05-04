/**
 * RLS isolation test — Phase 2.5 sub-phase C.
 *
 * Verifies that Row Level Security is correctly enforced: user A's leads are
 * invisible to user B, even via the anon-key client.
 *
 * Prerequisites:
 *   1. Apply migrations 0006 and 0007 to your Supabase project.
 *   2. Create two confirmed test accounts (sign up via the app, click the
 *      confirmation emails, complete onboarding for each).
 *   3. Export the env vars below (or add them to .env.local):
 *        TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD
 *        TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
 *
 * Run:
 *   pnpm --filter web test:isolation
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@openclaw/db/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function require(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeUrl(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
}

const SUPABASE_URL  = normalizeUrl(require("NEXT_PUBLIC_SUPABASE_URL"));
const ANON_KEY      = require("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY   = require("SUPABASE_SERVICE_ROLE_KEY");
const A_EMAIL       = require("TEST_USER_A_EMAIL");
const A_PASS        = require("TEST_USER_A_PASSWORD");
const B_EMAIL       = require("TEST_USER_B_EMAIL");
const B_PASS        = require("TEST_USER_B_PASSWORD");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    process.exitCode = 1;
  }
}

async function signIn(email: string, password: string) {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
async function run() {
  console.log("\nOpenClaw RLS isolation test\n");

  // Step 1: sign in as user A
  console.log("→ Signing in as user A...");
  const clientA = await signIn(A_EMAIL, A_PASS);
  const { data: { user: userA } } = await clientA.auth.getUser();
  if (!userA) throw new Error("Could not get user A identity");

  // Step 2: insert a test lead for user A via service role
  console.log("→ Inserting test lead for user A via service role...");
  const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY);
  const { data: leadData, error: insertErr } = await svc
    .from("leads")
    .insert({
      user_id:   userA.id,
      layer:     1,
      raw:       { title: "RLS isolation test lead" },
      normalized: { title: "RLS isolation test lead", url: "", budget: null, platform: "test" },
      hash:      `rls-test-${Date.now()}`,
    } as never)
    .select("id")
    .single();

  if (insertErr || !leadData) throw new Error(`Lead insert failed: ${insertErr?.message}`);
  const leadId = leadData.id as string;
  console.log(`   lead id: ${leadId}`);

  // Step 3: verify user A can read their own lead
  console.log("\n→ Assertion 1: user A reads their own lead");
  const { data: aOwn } = await clientA.from("leads").select("id").eq("id", leadId).single();
  assert(aOwn?.id === leadId, "User A can see their own lead");

  // Step 4: sign in as user B
  console.log("\n→ Signing in as user B...");
  const clientB = await signIn(B_EMAIL, B_PASS);

  // Step 5: user B should not see user A's lead in a list query
  console.log("\n→ Assertion 2: user B cannot see user A's lead in list");
  const { data: bList } = await clientB.from("leads").select("id");
  const bSeesALead = (bList ?? []).some((r: { id: string }) => r.id === leadId);
  assert(!bSeesALead, "User B's list does not contain user A's lead");

  // Step 6: user B should not see user A's lead via direct id lookup
  console.log("\n→ Assertion 3: user B cannot fetch user A's lead by id");
  const { data: bDirect, error: bErr } = await clientB
    .from("leads").select("id").eq("id", leadId).single();
  assert(!bDirect && !!bErr, "User B gets no row when fetching user A's lead by id");

  // Step 7: service role should still see the lead
  console.log("\n→ Assertion 4: service role can see user A's lead");
  const { data: svcRow } = await svc.from("leads").select("id").eq("id", leadId).single();
  assert(svcRow?.id === leadId, "Service role can read user A's lead");

  // Cleanup: delete the test lead
  await svc.from("leads").delete().eq("id", leadId);
  console.log("\n   test lead cleaned up");

  if (process.exitCode === 1) {
    console.error("\nSome assertions FAILED — RLS may not be applied correctly.\n");
  } else {
    console.log("\nAll assertions passed. RLS isolation is working correctly.\n");
  }
}

run().catch((err) => {
  console.error("\nTest script error:", err.message);
  process.exit(1);
});
