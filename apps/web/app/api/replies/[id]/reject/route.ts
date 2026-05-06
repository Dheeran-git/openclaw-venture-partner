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
  const { data: reply, error: replyErr } = await userClient
    .from("email_replies")
    .select("id, user_id, status")
    .eq("id", id)
    .single();
  if (replyErr || !reply) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (reply.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (reply.status === "sent" || reply.status === "rejected") {
    return Response.json({ ok: false, error: `Already ${reply.status}` }, { status: 409 });
  }

  const serviceClient = createServiceRoleClient();
  await serviceClient
    .from("email_replies")
    .update({ status: "rejected" })
    .eq("id", id);

  await serviceClient.from("approvals").insert({
    user_id: session.user.id,
    action_type: "reply.send",
    resource_type: "email_replies",
    resource_id: reply.id,
    payload_hash: "",
    verified_payload_hash: null,
    status: "rejected",
    actor_platform: "web",
    decided_at: new Date().toISOString(),
  });

  await serviceClient.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "reply.rejected",
    resource_type: "email_replies",
    resource_id: reply.id,
  });

  return Response.json({ ok: true });
}
