import { getSession, createSupabaseServerClient } from "../../../lib/supabaseServer";

export interface SearchHit {
  type: "lead" | "pitch" | "client";
  id: string;
  title: string;
  excerpt: string;
  href: string;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ ok: true, hits: [] });
  }
  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const supabase = await createSupabaseServerClient();

  const [leadsRes, pitchesRes, clientsRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, normalized")
      .or(`normalized->>title.ilike.${pattern},normalized->>description.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("pitches")
      .select("id, lead_id, subject, draft, status")
      .or(`subject.ilike.${pattern},draft.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("clients")
      .select("id, company_name, contact_email, memory_md")
      .or(`company_name.ilike.${pattern},memory_md.ilike.${pattern}`)
      .limit(5),
  ]);

  const hits: SearchHit[] = [];

  for (const lead of leadsRes.data ?? []) {
    const norm = lead.normalized as Record<string, unknown>;
    hits.push({
      type: "lead",
      id: lead.id,
      title: (norm.title as string) ?? "(untitled lead)",
      excerpt: ((norm.description as string) ?? "").slice(0, 140),
      href: `/?lead=${lead.id}`,
    });
  }

  for (const p of pitchesRes.data ?? []) {
    hits.push({
      type: "pitch",
      id: p.id,
      title: p.subject ?? "(no subject)",
      excerpt: (p.draft ?? "").slice(0, 140),
      href: `/?lead=${p.lead_id}`,
    });
  }

  for (const c of clientsRes.data ?? []) {
    hits.push({
      type: "client",
      id: c.id,
      title: c.company_name,
      excerpt: c.contact_email ?? (c.memory_md ?? "").replace(/^#.*$/m, "").slice(0, 140),
      href: `/clients/${c.id}`,
    });
  }

  return Response.json({ ok: true, hits });
}
