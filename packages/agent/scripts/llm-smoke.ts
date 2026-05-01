/**
 * LLM smoke test. Runs hello-world calls against every configured
 * provider plus the public `llm.complete` (router-selected). Reports
 * a per-provider table:
 *
 *   pnpm --filter @openclaw/agent smoke
 *
 * Pass --provider=<name> to test a single provider. Pass --no-router
 * to skip the router-selected call. Without any provider keys in the
 * environment, every provider reports `not configured` and the script
 * exits non-zero.
 */
import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { llm } from "../src/llm/client.js";
import {
  ALL_PROVIDERS,
  getProviderByName,
} from "../src/llm/router.js";
import {
  LLM_PURPOSES,
  PROVIDER_NAMES,
  type ProviderName,
} from "../src/llm/types.js";

loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

const PROMPT = `Reply with strict JSON only: {"msg":"ok"}.`;
const SCHEMA = z.object({ msg: z.string() });
const USER_ID = process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";

type Outcome =
  | { kind: "skipped"; reason: string }
  | { kind: "ok"; ms: number; model: string }
  | { kind: "fail"; ms: number; error: string };

async function testProvider(name: ProviderName): Promise<Outcome> {
  const adapter = getProviderByName(name);
  if (!adapter.isConfigured()) {
    return { kind: "skipped", reason: "not configured" };
  }
  const startedAt = Date.now();
  try {
    const result = await llm.complete({
      user_id: USER_ID,
      purpose: LLM_PURPOSES[3], // 'extract_lead'
      prompt: PROMPT,
      prompt_version: "smoke@v0",
      schema: SCHEMA,
      model: "fast",
      provider: name,
    });
    if (!result.msg) throw new Error("empty msg");
    return {
      kind: "ok",
      ms: Date.now() - startedAt,
      model: "(see telemetry)",
    };
  } catch (err) {
    return {
      kind: "fail",
      ms: Date.now() - startedAt,
      error: (err as Error).message,
    };
  }
}

async function testRouter(): Promise<Outcome> {
  const startedAt = Date.now();
  try {
    const result = await llm.complete({
      user_id: USER_ID,
      purpose: "extract_lead",
      prompt: PROMPT,
      prompt_version: "smoke@v0",
      schema: SCHEMA,
      model: "fast",
    });
    if (!result.msg) throw new Error("empty msg");
    return {
      kind: "ok",
      ms: Date.now() - startedAt,
      model: "(router-selected)",
    };
  } catch (err) {
    return {
      kind: "fail",
      ms: Date.now() - startedAt,
      error: (err as Error).message,
    };
  }
}

function fmt(name: string, outcome: Outcome): string {
  const pad = name.padEnd(14);
  switch (outcome.kind) {
    case "ok":
      return `  ✔ ${pad}  ${outcome.ms}ms  ${outcome.model}`;
    case "skipped":
      return `  · ${pad}  skipped  (${outcome.reason})`;
    case "fail":
      return `  ✘ ${pad}  ${outcome.ms}ms  ${outcome.error}`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const onlyProvider = args
    .find((a) => a.startsWith("--provider="))
    ?.split("=")[1] as ProviderName | undefined;
  const skipRouter = args.includes("--no-router");

  const targets = onlyProvider ? [onlyProvider] : ALL_PROVIDERS.map((p) => p.name);

  console.log(`\nLLM smoke test — ${targets.join(", ")}\n`);
  console.log("provider configuration:");
  for (const name of PROVIDER_NAMES) {
    const adapter = getProviderByName(name);
    console.log(`  ${name.padEnd(14)}  ${adapter.isConfigured() ? "configured" : "—"}`);
  }
  console.log("");

  const results: Record<string, Outcome> = {};
  for (const name of targets) {
    process.stdout.write(`testing ${name}... `);
    const outcome = await testProvider(name);
    results[name] = outcome;
    console.log(outcome.kind);
  }

  if (!skipRouter && !onlyProvider) {
    process.stdout.write(`testing router... `);
    results["router"] = await testRouter();
    console.log(results["router"].kind);
  }

  console.log("\nresults:");
  for (const [name, outcome] of Object.entries(results)) {
    console.log(fmt(name, outcome));
  }

  const failed = Object.values(results).filter((o) => o.kind === "fail");
  const passed = Object.values(results).filter((o) => o.kind === "ok");
  console.log(
    `\n${passed.length} passed · ${failed.length} failed · ${
      Object.values(results).filter((o) => o.kind === "skipped").length
    } skipped\n`
  );

  if (passed.length === 0) {
    console.error(
      "no providers passed. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env to enable Phase 1 acceptance."
    );
    process.exit(1);
  }
  process.exit(failed.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exit(1);
});
