import * as nodeCrypto from "node:crypto";
import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "@openclaw/worker";

/**
 * Phase 5 step 1 — Resend Inbound webhook handler.
 *
 * Threading model: outgoing pitches use Reply-To `replies+<pitch_id>@RESEND_INBOUND_DOMAIN`,
 * so the inbound webhook recovers the pitch_id from the To header without needing
 * a separate message-id lookup.
 *
 * If RESEND_INBOUND_SECRET isn't set yet (hackathon $0 mode), the route still
 * exists but is dormant for production traffic; use /api/email/simulate to
 * inject replies for demos.
 */

interface ResendInboundPayload {
  type?: string;
  data?: {
    from?: { email?: string; name?: string };
    to?: Array<{ email?: string }>;
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  };
}

function pickPitchIdFromTo(toAddrs: Array<{ email?: string }> | undefined): string | null {
  if (!toAddrs) return null;
  for (const t of toAddrs) {
    const local = t.email?.split("@")[0] ?? "";
    const m = /^replies\+([0-9a-f-]{36})$/i.exec(local);
    if (m && m[1]) return m[1].toLowerCase();
  }
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_INBOUND_SECRET;
  const rawBody = await req.text();

  if (secret) {
    const provided = req.headers.get("svix-signature") ?? req.headers.get("x-resend-signature");
    if (!provided) {
      return new Response("Missing signature", { status: 401 });
    }
    const expected = nodeCrypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided.replace(/^sha256=/, ""), "utf8");
    if (a.length !== b.length || !nodeCrypto.timingSafeEqual(a, b)) {
      return new Response("Bad signature", { status: 401 });
    }
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const data = payload.data ?? {};
  const pitchId = pickPitchIdFromTo(data.to);
  if (!pitchId) {
    return Response.json({ ok: true, ignored: "no_pitch_id_in_to_header" });
  }

  const supabase = createServiceRoleClient();
  const { data: pitch } = await supabase
    .from("pitches")
    .select("id, user_id")
    .eq("id", pitchId)
    .single();

  if (!pitch) {
    return Response.json({ ok: true, ignored: "pitch_not_found" });
  }

  const { data: reply, error: insertErr } = await supabase
    .from("email_replies")
    .insert({
      user_id: pitch.user_id,
      pitch_id: pitch.id,
      from_email: data.from?.email ?? "unknown@unknown",
      subject: data.subject ?? null,
      body_text: data.text ?? "",
      body_html: data.html ?? null,
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

  return Response.json({ ok: true, reply_id: reply.id });
}
