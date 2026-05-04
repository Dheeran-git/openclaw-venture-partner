import { z } from "zod";
import { inngest } from "@openclaw/worker";
import { getSession } from "../../../lib/supabaseServer";

const ScoutBody = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Body is not valid JSON" },
      { status: 400 }
    );
  }

  const parsed = ScoutBody.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid body",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    await inngest.send({
      name: "scout/requested",
      data: {
        user_id: session.user.id,
        query: parsed.data.query,
        ...(parsed.data.limit !== undefined && { limit: parsed.data.limit }),
      },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Failed to enqueue scout: ${(err as Error).message}`,
      },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, query: parsed.data.query });
}
