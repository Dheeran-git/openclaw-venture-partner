import { createServiceRoleClient } from "@openclaw/db";
import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

/**
 * Operator selects one of the 3 drafted options for an inbound reply.
 * Optional `edited_body` lets them tweak the chosen option before approval.
 * Computing the payload_hash happens at /approve time, not here.
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

  let body: { selected_option_index?: number; edited_body?: string };
  try {
    body = (await req.json()) as { selected_option_index?: number; edited_body?: string };
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const idx = body.selected_option_index;
  if (typeof idx !== "number" || idx < 0 || idx > 2) {
    return Response.json({ ok: false, error: "selected_option_index must be 0..2" }, { status: 400 });
  }

  const userClient = await createSupabaseServerClient();
  const { data: reply, error: replyErr } = await userClient
    .from("email_replies")
    .select("id, user_id, drafted_options, status")
    .eq("id", id)
    .single();
  if (replyErr || !reply) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (reply.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (reply.status !== "drafted" && reply.status !== "approved") {
    return Response.json({ ok: false, error: `Cannot select on status=${reply.status}` }, { status: 409 });
  }

  const options = reply.drafted_options as Array<{ tone: string; body: string }> | null;
  if (!options || !options[idx]) {
    return Response.json({ ok: false, error: "Option not found" }, { status: 400 });
  }

  const finalBody = body.edited_body && body.edited_body.length > 0 ? body.edited_body : options[idx].body;

  const serviceClient = createServiceRoleClient();
  await serviceClient
    .from("email_replies")
    .update({
      selected_option_index: idx,
      approved_body: finalBody,
    })
    .eq("id", id);

  return Response.json({ ok: true, approved_body: finalBody });
}
