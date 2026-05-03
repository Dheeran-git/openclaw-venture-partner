/**
 * scout-dryrun. Runs the scout pipeline (scrape -> dedup -> score ->
 * insert) end-to-end against the real Supabase, without going through
 * Inngest. Mocks step.run as direct invocation and routes broadcasts
 * to the console. Useful for verifying the pipeline before launching
 * the Inngest dev server, and for smoke-testing the idempotency story
 * by running the script twice in a row (second run should report all
 * duplicates and zero new scores).
 *
 *   pnpm --filter @openclaw/worker scout-dryrun
 *   pnpm --filter @openclaw/worker scout-dryrun "wordpress" 5
 *
 * The user_id defaults to DEMO_USER_ID.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

import { createServerClient } from "@openclaw/db";
import type { ProgressKind } from "../src/lib/broadcast";
import {
  runScoutPipeline,
  type PipelineStep,
} from "../src/lib/scoutPipeline";

const USER_ID =
  process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";

const args = process.argv.slice(2);
const query = args[0] ?? "react next.js";
const limit = Number(args[1] ?? 10);

const fakeStep: PipelineStep = {
  async run(name, fn) {
    const startedAt = Date.now();
    process.stdout.write(`  [step] ${name.padEnd(28)} ... `);
    try {
      const result = await fn();
      console.log(`ok (${Date.now() - startedAt}ms)`);
      return result;
    } catch (err) {
      console.log(`FAIL (${Date.now() - startedAt}ms)`);
      throw err;
    }
  },
};

async function fakePublish(
  kind: ProgressKind,
  text: string,
  meta: string
): Promise<void> {
  const tag =
    kind === "live" ? "[live]" : kind === "ok" ? "[ok]  " : "[warn]";
  console.log(`        ${tag} ${text}  (${meta})`);
}

async function main() {
  console.log(`\nscout-dryrun  query="${query}"  limit=${limit}  user=${USER_ID}\n`);

  const supabase = createServerClient();
  const result = await runScoutPipeline(fakeStep, supabase, fakePublish, {
    user_id: USER_ID,
    query,
    limit,
  });

  console.log(`\nresult:`);
  console.log(`  scraper             : ${result.scraper}`);
  console.log(`  scraped             : ${result.scraped}`);
  console.log(`  inserted            : ${result.inserted}`);
  console.log(`  scored              : ${result.scored}`);
  console.log(`  alreadyScored skip  : ${result.skippedAlreadyScored}`);
  console.log(`  durationMs          : ${result.durationMs}`);
  console.log("");
}

main().catch((err) => {
  console.error("\nscout-dryrun crashed:", (err as Error).message);
  process.exit(1);
});
