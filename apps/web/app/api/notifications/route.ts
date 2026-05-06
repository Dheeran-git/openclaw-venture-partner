import { createServiceRoleClient } from "@openclaw/db";
import { getSession, createSupabaseServerClient } from "../../../lib/supabaseServer";

/** GET — list 20 most recent notifications for the user (unread first). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, notifications: data ?? [] });
}

/** POST {id?} — mark one (id given) or all (no id) as read. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = (await req.json().catch(() => ({}))) as { id?: string };
  } catch {
    body = {};
  }

  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  let q = service
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  if (body.id) {
    q = q.eq("id", body.id);
  }
  const { error } = await q;
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
