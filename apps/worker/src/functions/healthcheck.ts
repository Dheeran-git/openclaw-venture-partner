import { inngest } from "../inngest";

/**
 * Trivial round-trip event handler for verifying the Inngest plumbing.
 *
 * Local dev: send the event from anywhere via:
 *   curl -X POST http://localhost:3000/api/inngest/invoke \
 *     -H "content-type: application/json" \
 *     -d '{"name":"system/healthcheck","data":{"ping":"hi"}}'
 *
 * Or use the Inngest dev-server UI at http://localhost:8288.
 */
export const healthcheck = inngest.createFunction(
  { id: "system-healthcheck", name: "System healthcheck" },
  { event: "system/healthcheck" },
  async ({ event, step }) => {
    const echoed = await step.run("echo", async () => ({
      ok: true,
      receivedAt: new Date().toISOString(),
      ping: event.data.ping ?? null,
    }));

    return echoed;
  }
);
