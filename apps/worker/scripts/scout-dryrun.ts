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
 * Pass --user-id=<uuid> to scope the run to a real auth user.
 *
 *   pnpm --filter @openclaw/worker scout-dryrun --user-id=<uuid>
 *   pnpm --filter @openclaw/worker scout-dryrun --user-id=<uuid> "wordpress" 5
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

import { createServiceRoleClient } from "@openclaw/db";
import type { ProgressKind } from "../src/lib/broadcast";
import {
  runScoutPipeline,
  type PipelineStep,
} from "../src/lib/scoutPipeline";

const args = process.argv.slice(2);
const userIdArg = args.find((a) => a.startsWith("--user-id="))?.split("=")[1];
if (!userIdArg) {
  console.error("Error: --user-id=<uuid> is required");
  process.exit(1);
}
const USER_ID = userIdArg;
const positional = args.filter((a) => !a.startsWith("--"));
const query = positional[0] ?? "react next.js";
const limit = Number(positional[1] ?? 10);

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

  const supabase = createServiceRoleClient();
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
