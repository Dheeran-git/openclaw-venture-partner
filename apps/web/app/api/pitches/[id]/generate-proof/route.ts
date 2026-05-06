import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "@openclaw/worker";
import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pitch_id } = await params;
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let target_url: string | undefined;
  let artifact_type: string | undefined;
  try {
    const body = await req.json();
    target_url = (body as { target_url?: string }).target_url;
    artifact_type = (body as { artifact_type?: string }).artifact_type ?? "lighthouse";
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }
  if (!target_url || typeof target_url !== "string") {
    return Response.json({ ok: false, error: "Missing target_url" }, { status: 400 });
  }
  try {
    new URL(target_url);
  } catch {
    return Response.json({ ok: false, error: "target_url must be a valid absolute URL" }, { status: 400 });
  }
  if (artifact_type !== "lighthouse") {
    return Response.json(
      { ok: false, error: "Only artifact_type=lighthouse is supported in Phase 4" },
      { status: 400 }
    );
  }

  const userClient = await createSupabaseServerClient();
  const { data: pitch, error: pitchErr } = await userClient
    .from("pitches")
    .select("id, user_id")
    .eq("id", pitch_id)
    .single();

  if (pitchErr || !pitch) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (pitch.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = createServiceRoleClient();
  const { data: artifact, error: insertErr } = await serviceClient
    .from("proof_artifacts")
    .insert({
      user_id: session.user.id,
      pitch_id,
      artifact_type: "lighthouse",
      target_url,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !artifact) {
    return Response.json({ ok: false, error: insertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  await inngest.send({
    name: "proof/lighthouse-requested",
    data: {
      user_id: session.user.id,
      pitch_id,
      artifact_id: artifact.id,
      target_url,
    },
  });

  await serviceClient.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "proof.lighthouse.requested",
    resource_type: "proof_artifacts",
    resource_id: artifact.id,
    metadata: { target_url, pitch_id },
  });

  return Response.json({ ok: true, artifact_id: artifact.id });
}
