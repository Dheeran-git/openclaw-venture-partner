import { createServiceRoleClient } from "@openclaw/db";
import { getSession } from "../../../../lib/supabaseServer";

/**
 * Wipes every lead (and via cascade, every pitch + proof_artifact)
 * that the calling user's most recent /api/demo/seed run created.
 * Identified by the `demo-seed:` hash prefix the seed endpoint
 * stamps on every row, so a multi-lead seed (hero + supporting cast)
 * gets cleaned up in one shot.
 *
 * Idempotent and scoped to user_id — never touches another
 * operator's data. Returns the count of leads deleted so the caller
 * can show a sensible toast.
 */
const DEMO_HASH_PREFIX = "demo-seed:";

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
    .like("hash", `${DEMO_HASH_PREFIX}%`)
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
