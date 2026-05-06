import { getSession, createSupabaseServerClient } from "../../../lib/supabaseServer";

/**
 * GET /api/export — return all user-owned data as a JSON snapshot.
 * GDPR-relevant; trust-building. RLS ensures we only return rows
 * where auth.uid() = user_id.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();

  const [
    profileRes,
    leadsRes,
    scoresRes,
    pitchesRes,
    proofsRes,
    repliesRes,
    clientsRes,
    approvalsRes,
    auditRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", session.user.id).single(),
    supabase.from("leads").select("*"),
    supabase.from("scores").select("*"),
    supabase.from("pitches").select("*"),
    supabase.from("proof_artifacts").select("*"),
    supabase.from("email_replies").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("approvals").select("*"),
    supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const payload = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    user: {
      id: session.user.id,
      email: session.user.email,
    },
    profile: profileRes.data ?? null,
    leads: leadsRes.data ?? [],
    scores: scoresRes.data ?? [],
    pitches: pitchesRes.data ?? [],
    proof_artifacts: proofsRes.data ?? [],
    email_replies: repliesRes.data ?? [],
    clients: clientsRes.data ?? [],
    approvals: approvalsRes.data ?? [],
    audit_log: auditRes.data ?? [],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="openclaw-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
