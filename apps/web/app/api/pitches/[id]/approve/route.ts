import { computePayloadHash } from "@openclaw/agent/drafting";
import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "@openclaw/worker";
import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload_hash: string | undefined;
  try {
    const body = await req.json();
    payload_hash = (body as { payload_hash?: string }).payload_hash;
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }
  if (!payload_hash || typeof payload_hash !== "string") {
    return Response.json({ ok: false, error: "Missing payload_hash" }, { status: 400 });
  }

  // Use session client so RLS enforces ownership on the pitch read.
  const userClient = await createSupabaseServerClient();
  const { data: pitch, error: pitchErr } = await userClient
    .from("pitches")
    .select("id, user_id, draft, subject, status")
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

  const expected = computePayloadHash({
    id: pitch.id,
    subject: pitch.subject ?? "",
    draft: pitch.draft,
  });

  if (expected !== payload_hash) {
    return Response.json(
      { ok: false, error: "stale_draft", message: "Pitch has changed since you reviewed it." },
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
    payload_hash,
    verified_payload_hash: expected,
    actor_platform: "web",
    status: "approved",
    decided_at: now,
  });
  if (approvalErr) {
    return Response.json({ ok: false, error: approvalErr.message }, { status: 500 });
  }

  await serviceClient.from("pitches").update({ status: "approved", approved_at: now }).eq("id", id);

  await serviceClient.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "pitch.approved",
    resource_type: "pitches",
    resource_id: pitch.id,
    metadata: { payload_hash },
  });

  await inngest.send({
    name: "pitch/approved",
    data: { pitch_id: pitch.id, user_id: session.user.id },
  });

  return Response.json({ ok: true });
}
