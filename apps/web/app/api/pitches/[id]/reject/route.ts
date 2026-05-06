import { createServiceRoleClient } from "@openclaw/db";
import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userClient = await createSupabaseServerClient();
  const { data: pitch, error: pitchErr } = await userClient
    .from("pitches")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (pitchErr || !pitch) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (pitch.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (pitch.status !== "draft") {
    return Response.json(
      { ok: false, error: "Pitch is not in draft status" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const serviceClient = createServiceRoleClient();

  const { error: approvalErr } = await serviceClient.from("approvals").insert({
    user_id: session.user.id,
    action_type: "pitch.send",
    resource_type: "pitches",
    resource_id: pitch.id,
    payload_hash: "",
    verified_payload_hash: null,
    status: "rejected",
    actor_platform: "web",
    decided_at: now,
  });
  if (approvalErr) {
    return Response.json({ ok: false, error: approvalErr.message }, { status: 500 });
  }

  await serviceClient.from("pitches").update({ status: "rejected" }).eq("id", id);

  await serviceClient.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "pitch.rejected",
    resource_type: "pitches",
    resource_id: pitch.id,
  });

  return Response.json({ ok: true });
}
