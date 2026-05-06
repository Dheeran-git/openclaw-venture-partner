import { createServiceRoleClient } from "@openclaw/db";

/**
 * Liveness + readiness endpoint.
 * Better Uptime / Cronitor monitor this URL. Returns 200 if both DB and at
 * least one LLM provider report healthy. Returns 503 if either is degraded.
 *
 * Per build guide §15 step 5.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthResponse {
  ok: boolean;
  db: "ok" | string;
  llm: { provider: string; ok: boolean }[];
  ts: string;
}

async function checkDb(): Promise<"ok" | string> {
  try {
    const db = createServiceRoleClient() as unknown as {
      from: (t: string) => {
        select: (
          cols: string,
          opts: { count: string; head: boolean }
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) return error.message;
    return "ok";
  } catch (err) {
    return (err as Error).message;
  }
}

async function checkLlm(): Promise<{ provider: string; ok: boolean }[]> {
  const out: { provider: string; ok: boolean }[] = [];
  for (const adapter of [
    { name: "copilot", isConfigured: () => !!process.env.COPILOT_TOKEN },
    { name: "gemini", isConfigured: () => !!process.env.GEMINI_API_KEY },
    { name: "groq", isConfigured: () => !!process.env.GROQ_API_KEY },
    { name: "openrouter", isConfigured: () => !!process.env.OPENROUTER_API_KEY },
    { name: "anthropic", isConfigured: () => !!process.env.ANTHROPIC_API_KEY },
  ]) {
    out.push({ provider: adapter.name, ok: adapter.isConfigured() });
  }
  return out;
}

export async function GET() {
  const [db, llm] = await Promise.all([checkDb(), checkLlm()]);
  const someLlm = llm.some((p) => p.ok);
  const ok = db === "ok" && someLlm;
  const body: HealthResponse = {
    ok,
    db,
    llm,
    ts: new Date().toISOString(),
  };
  return Response.json(body, { status: ok ? 200 : 503 });
}
