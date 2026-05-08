import { createServiceRoleClient } from "@openclaw/db";
import { getSession } from "../../../../lib/supabaseServer";

/**
 * Wipes the calling user's demo-seed lead (and via cascade, its pitch
 * and proof_artifact). Identified by the constant hash that
 * /api/demo/seed stamps onto the lead row, so this is a no-op when
 * the user hasn't seeded.
 *
 * Idempotent and scoped to user_id — never touches another operator's
 * data. Returns the count of rows deleted so the caller can show a
 * sensible toast.
 */
const DEMO_LEAD_HASH = "demo-seed:nextjs-saas-rebuild";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = createServiceRoleClient();

  const { data: prior } = await supabase
    .from("leads")
    .select("id")
    .eq("hash", DEMO_LEAD_HASH)
    .eq("user_id", userId);

  const ids = ((prior ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ids.length === 0) {
    return Response.json({ ok: true, cleared: 0 });
  }

  const { error: delErr } = await supabase
    .from("leads")
    .delete()
    .in("id", ids);
  if (delErr) {
    return Response.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    user_id: userId,
    actor: "user",
    action: "demo.clear",
    resource_type: "leads",
    resource_id: ids[0]!,
    metadata: { lead_ids: ids },
  });

  return Response.json({ ok: true, cleared: ids.length });
}
