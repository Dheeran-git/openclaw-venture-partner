import { computePayloadHash } from "@openclaw/agent/drafting";
import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "@openclaw/worker";
import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

/**
 * Approve a drafted reply for sending. Computes payload_hash from the
 * approved_body the operator selected/edited and re-checks against any
 * payload_hash the client computed locally (stale-draft 409 guard,
 * mirroring the pitch approval flow).
 */
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
  if (!payload_hash) {
    return Response.json({ ok: false, error: "Missing payload_hash" }, { status: 400 });
  }

  const userClient = await createSupabaseServerClient();
  const { data: reply, error: replyErr } = await userClient
    .from("email_replies")
    .select("id, user_id, drafted_subject, approved_body, status")
    .eq("id", id)
    .single();
  if (replyErr || !reply) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (reply.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (reply.status !== "drafted" && reply.status !== "approved") {
    return Response.json({ ok: false, error: `Cannot approve on status=${reply.status}` }, { status: 409 });
  }
  if (!reply.approved_body) {
    return Response.json({ ok: false, error: "No option selected yet" }, { status: 409 });
  }

  const expected = computePayloadHash({
    id: reply.id,
    subject: reply.drafted_subject ?? "",
    draft: reply.approved_body,
  });
  if (expected !== payload_hash) {
    return Response.json(
      { ok: false, error: "stale_draft", message: "Reply has changed since you reviewed it." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const serviceClient = createServiceRoleClient();

  const { error: approvalErr } = await serviceClient.from("approvals").insert({
    user_id: session.user.id,
    action_type: "reply.send",
    resource_type: "email_replies",
    resource_id: reply.id,
    payload_hash,
    verified_payload_hash: expected,
    actor_platform: "web",
    status: "approved",
    decided_at: now,
  });
  if (approvalErr) {
    return Response.json({ ok: false, error: approvalErr.message }, { status: 500 });
  }

  await serviceClient
    .from("email_replies")
    .update({ status: "approved", payload_hash })
    .eq("id", id);

  await serviceClient.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "reply.approved",
    resource_type: "email_replies",
    resource_id: reply.id,
    metadata: { payload_hash },
  });

  await inngest.send({
    name: "reply/approved",
    data: { reply_id: reply.id, user_id: session.user.id },
  });

  return Response.json({ ok: true });
}
