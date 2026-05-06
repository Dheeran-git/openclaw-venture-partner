import { z } from "zod";
import { computePayloadHash } from "@openclaw/agent/drafting";
import { createServiceRoleClient } from "@openclaw/db";
import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

const EditBody = z.object({
  draft: z.string().min(1).optional(),
  subject: z.string().min(1).max(100).optional(),
}).refine((b) => b.draft !== undefined || b.subject !== undefined, {
  message: "At least one of draft or subject must be provided",
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }
  const parsed = EditBody.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

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

  const newDraft = parsed.data.draft ?? pitch.draft;
  const newSubject = parsed.data.subject ?? pitch.subject ?? "";

  const newPayloadHash = computePayloadHash({
    id: pitch.id,
    subject: newSubject,
    draft: newDraft,
  });

  const serviceClient = createServiceRoleClient();

  const { error: updateErr } = await serviceClient
    .from("pitches")
    .update({
      draft: newDraft,
      subject: newSubject,
      payload_hash: newPayloadHash,
    })
    .eq("id", id);

  if (updateErr) {
    return Response.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  await serviceClient.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "pitch.edited",
    resource_type: "pitches",
    resource_id: pitch.id,
    metadata: {
      changed: {
        draft: parsed.data.draft !== undefined,
        subject: parsed.data.subject !== undefined,
      },
    },
  });

  return Response.json({ ok: true, payload_hash: newPayloadHash });
}
