import { createServiceRoleClient } from "@openclaw/db";
import { getSession } from "../../../lib/supabaseServer";

interface ImportPayload {
  schema_version?: number;
  leads?: Array<{ user_id?: string; hash: string; raw: unknown; normalized: unknown; layer?: number; source_id?: string | null; scraped_at?: string }>;
  // Other tables omitted for hackathon scope — leads import is what's
  // useful for moving between accounts; pitches/clients tend to be
  // session-specific and are recreated by the agent anyway.
}

/**
 * POST /api/import — take a previously-exported JSON snapshot and bulk-insert
 * leads under the calling user's id, deduping on (user_id, hash). Idempotent.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: ImportPayload;
  try {
    payload = (await req.json()) as ImportPayload;
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const leads = payload.leads ?? [];
  if (!Array.isArray(leads)) {
    return Response.json({ ok: false, error: "leads must be an array" }, { status: 400 });
  }

  const service = createServiceRoleClient();

  // Dedup against existing by (user_id, hash)
  const hashes = leads.map((l) => l.hash).filter(Boolean);
  const { data: existing } = await service
    .from("leads")
    .select("hash")
    .eq("user_id", session.user.id)
    .in("hash", hashes);
  const existingSet = new Set((existing ?? []).map((r) => r.hash));

  const fresh = leads
    .filter((l) => l.hash && !existingSet.has(l.hash))
    .map((l) => ({
      user_id: session.user.id,
      hash: l.hash,
      raw: l.raw as never,
      normalized: l.normalized as never,
      layer: (l.layer ?? 1) as 1 | 2 | 3,
      source_id: l.source_id ?? null,
    }));

  if (fresh.length === 0) {
    return Response.json({ ok: true, imported: 0, skipped: leads.length });
  }

  const { error: insertErr, count } = await service
    .from("leads")
    .insert(fresh, { count: "exact" });

  if (insertErr) {
    return Response.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  await service.from("audit_log").insert({
    user_id: session.user.id,
    actor: "user",
    action: "data.imported",
    metadata: { imported: count ?? fresh.length, skipped: leads.length - fresh.length },
  });

  return Response.json({
    ok: true,
    imported: count ?? fresh.length,
    skipped: leads.length - fresh.length,
  });
}
