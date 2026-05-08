#!/usr/bin/env node
// stdio<->HTTP bridge for OpenClaw Gateway -> Vercel /api/mcp.
//
// The Gateway's bundle-mcp loader expects either an HTTP+SSE endpoint
// (with full session/streaming) or a stdio MCP subprocess. Vercel
// serverless can't hold long-lived SSE state, so we ship this script
// to the Gateway container and let it spawn us as a stdio subprocess.
//
// Each line on stdin is a JSON-RPC message. We POST it to MCP_URL with
// Authorization: $MCP_TOKEN and write the response to stdout (unless
// it's a notification, which has no response).
//
// Run via `openclaw mcp set` with command/args/env, e.g.:
//   { "command": "node",
//     "args": ["/tmp/mcp-bridge.js"],
//     "env": { "MCP_URL": "...", "MCP_TOKEN": "Bearer ..." } }

const readline = require("readline");

const url = process.env.MCP_URL;
const auth = process.env.MCP_TOKEN;

if (!url) {
  console.error("[mcp-bridge] MCP_URL env not set");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let isNotification = false;
  let parsedId = null;
  try {
    const msg = JSON.parse(line);
    isNotification = !("id" in msg);
    parsedId = msg.id ?? null;
  } catch {
    // Pass through to the server; let it respond with parse error
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: line,
    });

    if (isNotification) {
      // Drain the body so the connection releases, then drop it
      try {
        await res.text();
      } catch {}
      return;
    }

    const text = await res.text();
    if (text) {
      process.stdout.write(text);
      if (!text.endsWith("\n")) process.stdout.write("\n");
    }
  } catch (err) {
    if (isNotification) return;
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "bridge error: " + (err && err.message ? err.message : String(err)),
        },
        id: parsedId,
      }) + "\n",
    );
  }
});

rl.on("close", () => {
  process.exit(0);
});
