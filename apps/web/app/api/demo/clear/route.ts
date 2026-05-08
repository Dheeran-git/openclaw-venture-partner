import { createServiceRoleClient } from "@openclaw/db";
import { getSession } from "../../../../lib/supabaseServer";

/**
 * Wipes everything the calling user's most recent /api/demo/seed run
 * created. Two markers cover the whole footprint:
 *
 *   - lead.hash starts with `demo-seed:` -> deleting the lead cascades
 *     to its pitches, scores, proof_artifacts, and email_replies.
 *   - client.contact_email ends with `@demo.openclaw.dev` -> the seeded
 *     active client + the historical Northwind client. Clients are
 *     orphaned by lead deletion (FK is on-delete-set-null), so we wipe
 *     them explicitly on this domain marker.
 *
 * Idempotent and scoped to user_id — never touches another operator's
 * data. Returns the count of leads + clients deleted so the caller
 * can show a sensible toast.
 */
const DEMO_HASH_PREFIX = "demo-seed:";
const DEMO_EMAIL_DOMAIN = "demo.openclaw.dev";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const supabase = createServiceRoleClient();

  // Clients first — they don't auto-cascade with lead deletion.
  const { data: priorClients } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .ilike("contact_email", `%@${DEMO_EMAIL_DOMAIN}`);
  const clientIds = ((priorClients ?? []) as Array<{ id: string }>).map(
    (r) => r.id
  );
  if (clientIds.length > 0) {
    await supabase.from("clients").delete().in("id", clientIds);
  }

  const { data: priorLeads } = await supabase
    .from("leads")
    .select("id")
    .like("hash", `${DEMO_HASH_PREFIX}%`)
    .eq("user_id", userId);
  const leadIds = ((priorLeads ?? []) as Array<{ id: string }>).map(
    (r) => r.id
  );
  if (leadIds.length > 0) {
    const { error: delErr } = await supabase
      .from("leads")
      .delete()
      .in("id", leadIds);
    if (delErr) {
      return Response.json(
        { ok: false, error: delErr.message },
        { status: 500 }
      );
    }
  }

  const cleared = leadIds.length + clientIds.length;

  if (cleared > 0) {
    await supabase.from("audit_log").insert({
      user_id: userId,
      actor: "user",
      action: "demo.clear",
      resource_type: "leads",
      resource_id: leadIds[0] ?? clientIds[0]!,
      metadata: { lead_ids: leadIds, client_ids: clientIds },
    });
  }

  return Response.json({
    ok: true,
    cleared,
    leads: leadIds.length,
    clients: clientIds.length,
  });
}
