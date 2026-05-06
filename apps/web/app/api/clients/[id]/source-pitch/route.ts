import { getSession, createSupabaseServerClient } from "../../../../../lib/supabaseServer";

/**
 * Return the most recent pitch_id sent against this client's source lead.
 * Used by the /clients/[id] simulator to attach a fake inbound reply
 * to the right pitch thread.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("source_lead_id, user_id")
    .eq("id", id)
    .single();
  if (!client || client.user_id !== session.user.id) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!client.source_lead_id) {
    return Response.json({ ok: false, error: "Client has no source_lead_id" }, { status: 404 });
  }
  const { data: pitch } = await supabase
    .from("pitches")
    .select("id")
    .eq("lead_id", client.source_lead_id)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pitch) {
    return Response.json({ ok: false, error: "No pitch found for this lead" }, { status: 404 });
  }
  return Response.json({ ok: true, pitch_id: pitch.id });
}
