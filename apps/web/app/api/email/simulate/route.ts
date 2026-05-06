import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "@openclaw/worker";
import { getSession, createSupabaseServerClient } from "../../../../lib/supabaseServer";

/**
 * Phase 5 simulator — explicitly permitted by the build guide:
 *   "simulate inbound reply (insert a row manually if Resend Inbound
 *    isn't fully set up)"
 *
 * Same effect as a real Resend Inbound webhook delivery: insert an
 * email_replies row, fire email/reply-received. Used by the demo flow
 * and by the /clients UI's "simulate reply" button when a custom
 * domain isn't wired up.
 */

interface SimulateBody {
  pitch_id?: string;
  from_email?: string;
  subject?: string;
  body_text?: string;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: SimulateBody;
  try {
    body = (await req.json()) as SimulateBody;
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const { pitch_id, from_email, subject, body_text } = body;
  if (!pitch_id || !from_email || !body_text) {
    return Response.json(
      { ok: false, error: "pitch_id, from_email, body_text required" },
      { status: 400 }
    );
  }

  // Ownership check via session client (RLS enforces it)
  const userClient = await createSupabaseServerClient();
  const { data: pitch, error: pitchErr } = await userClient
    .from("pitches")
    .select("id, user_id")
    .eq("id", pitch_id)
    .single();
  if (pitchErr || !pitch) {
    return Response.json({ ok: false, error: "Pitch not found" }, { status: 404 });
  }
  if (pitch.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  const { data: reply, error: insertErr } = await supabase
    .from("email_replies")
    .insert({
      user_id: pitch.user_id,
      pitch_id: pitch.id,
      from_email,
      subject: subject ?? null,
      body_text,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !reply) {
    return Response.json({ ok: false, error: insertErr?.message ?? "insert failed" }, { status: 500 });
  }

  await inngest.send({
    name: "email/reply-received",
    data: { reply_id: reply.id, user_id: pitch.user_id, pitch_id: pitch.id },
  });

  await supabase.from("audit_log").insert({
    user_id: pitch.user_id,
    actor: "user",
    action: "email.reply.simulated",
    resource_type: "email_replies",
    resource_id: reply.id,
    metadata: { pitch_id: pitch.id, from_email },
  });

  return Response.json({ ok: true, reply_id: reply.id });
}
