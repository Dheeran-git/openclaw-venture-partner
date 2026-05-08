import {
  validateSecret,
  checkRateLimit,
  checkBindRateLimit,
  recordBindFailure,
} from "../../../lib/mcp-auth";
import { rateLimit } from "../../../lib/rateLimit";
import { handlers, toolManifests } from "@openclaw/agent/mcp-tools";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: string | number | null;
}

function rpcError(id: unknown, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", error: { code, message }, id });
}

function rpcResult(id: unknown, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", result, id });
}

// MCP HTTP+SSE transport handshake. The OpenClaw Gateway opens a GET to this
// endpoint expecting `Content-Type: text/event-stream` with an initial
// `endpoint` event that tells it where to POST JSON-RPC messages. We point it
// back at this same path; our POST handler does the actual JSON-RPC work.
// The stream is kept alive with keepalive comments until Vercel's serverless
// timeout closes it; the client reconnects automatically.
export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!validateSecret(authHeader, "shared") && !validateSecret(authHeader, "worker")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const endpoint = url.pathname; // "/api/mcp"
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpoint}\n\n`));
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 15_000);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const isShared = validateSecret(authHeader, "shared");
  const isWorker = validateSecret(authHeader, "worker");

  if (!isShared && !isWorker) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`ip:${ip}`);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too Many Requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { method, params, id } = body;

  if (method === "tools/list") {
    return rpcResult(id, { tools: toolManifests });
  }

  if (method === "tools/call") {
    const toolName = params?.name as string | undefined;
    const args = (params?.arguments as Record<string, unknown>) ?? {};

    if (!toolName) return rpcError(id, -32602, "Missing tool name");

    // notifyAgent is worker-to-gateway only
    if (toolName === "notifyAgent" && !isWorker) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const handler = handlers[toolName];
    if (!handler) return rpcError(id, -32601, `Unknown tool: ${toolName}`);

    // Per-platform-user rate limit for bind operations
    const isBind = toolName === "bindTelegram" || toolName === "bindDiscord";
    const platformUserId = isBind
      ? ((toolName === "bindTelegram" ? args.telegram_user_id : args.discord_user_id) as string)
      : null;

    if (isBind && platformUserId) {
      const bindRl = checkBindRateLimit(platformUserId);
      if (!bindRl.allowed) {
        return rpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: false, error: "rate_limited", retry_after: bindRl.retryAfter }),
            },
          ],
        });
      }
    }

    // Per-tool rate limits keyed on platform user (Gateway → platform_user_id)
    // matching the user-facing /api/scout and /api/pitches/draft limits.
    const platformId = args.platform_user_id as string | undefined;
    if (toolName === "runScout" && platformId) {
      const tl = await rateLimit({
        prefix: "mcp-runScout",
        id: platformId,
        limit: 10,
        windowMs: 60 * 60 * 1000,
      });
      if (!tl.allowed) {
        return rpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                error: "rate_limited",
                retry_after: tl.retryAfter,
              }),
            },
          ],
        });
      }
    } else if (toolName === "draftPitch" && (args.user_id as string | undefined)) {
      const tl = await rateLimit({
        prefix: "mcp-draftPitch",
        id: args.user_id as string,
        limit: 30,
        windowMs: 24 * 60 * 60 * 1000,
      });
      if (!tl.allowed) {
        return rpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                error: "rate_limited",
                retry_after: tl.retryAfter,
              }),
            },
          ],
        });
      }
    }

    try {
      const result = await handler(args);

      // Record bind failures for lockout tracking
      if (isBind && platformUserId && !result.ok && result.error === "invalid_code") {
        recordBindFailure(platformUserId);
      }

      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return rpcError(id, -32603, message);
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}
