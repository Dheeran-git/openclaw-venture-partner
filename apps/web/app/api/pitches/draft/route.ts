import { z } from "zod";
import { inngest } from "@openclaw/worker";
import { getSession } from "../../../../lib/supabaseServer";
import { rateLimit, rateLimited } from "../../../../lib/rateLimit";

const DraftBody = z.object({
  lead_id: z.string().uuid(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit({
    prefix: "pitch-draft",
    id: session.user.id,
    limit: 30,
    windowMs: DAY_MS,
  });
  if (!rl.allowed) {
    return rateLimited(rl.retryAfter, "draft_rate_limited");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const parsed = DraftBody.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  try {
    await inngest.send({
      name: "pitch/draft-requested",
      data: {
        user_id: session.user.id,
        lead_id: parsed.data.lead_id,
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: `Failed to queue draft: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
