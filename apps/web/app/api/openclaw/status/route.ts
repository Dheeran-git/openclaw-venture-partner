import { getSession } from "../../../../lib/supabaseServer";

/**
 * Reports OpenClaw Gateway connectivity for the dashboard's /agent page.
 *
 * The Gateway is the runtime brain — it ingests our skills (apps/agent/
 * skills/*.md), routes natural-language requests against them, and calls
 * back into our /api/mcp endpoint for tool execution. The dashboard reads
 * this route to show "connected / not connected" + the Control UI URL.
 *
 * No secrets leak: we don't return OPENCLAW_GATEWAY_TOKEN. Only the public
 * URL is surfaced (it's already user-visible whenever they open the
 * Control UI).
 */
export const dynamic = "force-dynamic";

interface StatusResponse {
  configured: boolean;
  gateway_url: string | null;
  control_ui_url: string | null;
  health: "ok" | "unreachable" | "unknown";
  latency_ms: number | null;
  error: string | null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim() ?? "";
  if (!gatewayUrl) {
    const body: StatusResponse = {
      configured: false,
      gateway_url: null,
      control_ui_url: null,
      health: "unknown",
      latency_ms: null,
      error: "OPENCLAW_GATEWAY_URL is not set in this environment.",
    };
    return Response.json(body);
  }

  const stripped = gatewayUrl.replace(/\/$/, "");
  const controlUiUrl = `${stripped}/openclaw`;
  const healthUrl = `${stripped}/healthz`;

  const startedAt = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(4_000),
    });
    const body: StatusResponse = {
      configured: true,
      gateway_url: stripped,
      control_ui_url: controlUiUrl,
      // Railway template gates root with HTTP Basic, but /healthz returns
      // 200 unauthenticated (per template docs). 401/403 still proves the
      // process is up; treat anything 2xx-4xx as reachable, 5xx/network as
      // unreachable.
      health: res.status < 500 ? "ok" : "unreachable",
      latency_ms: Date.now() - startedAt,
      error: res.ok ? null : `gateway returned ${res.status}`,
    };
    return Response.json(body);
  } catch (err) {
    const body: StatusResponse = {
      configured: true,
      gateway_url: stripped,
      control_ui_url: controlUiUrl,
      health: "unreachable",
      latency_ms: Date.now() - startedAt,
      error: (err as Error).message,
    };
    return Response.json(body);
  }
}
