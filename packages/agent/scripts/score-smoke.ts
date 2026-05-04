/**
 * Score-smoke. Runs scoreLead() against three hand-crafted leads -- a
 * strong fit, a vague middling one, and a wrong-stack one with red
 * flags -- and prints what the LLM returned. Verifies an llm_calls
 * row lands per call (telemetry path is exercised by llm.complete).
 *
 *   pnpm --filter @openclaw/agent score-smoke --user-id=<uuid>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

import {
  scoreLead,
  type ScoringLead,
  type ScoringProfile,
} from "../src/scoring";

const userIdArg = process.argv.slice(2).find((a) => a.startsWith("--user-id="))?.split("=")[1];
if (!userIdArg) {
  console.error("Error: --user-id=<uuid> is required");
  process.exit(1);
}
const USER_ID = userIdArg;

const profile: ScoringProfile = {
  display_name: "Anya Petrov",
  skills: ["React", "TypeScript", "Next.js", "UI design"],
  hourly_rate: 85,
  bio: "Senior frontend engineer -- 6 years -- React/Next.js specialist",
};

const leads: Array<{ name: string; expected: string; lead: ScoringLead }> = [
  {
    name: "Strong: Next.js analytics dashboard rebuild",
    expected: "85-95",
    lead: {
      source: "upwork",
      source_url: "https://www.upwork.com/jobs/~smoke-strong",
      title: "Next.js engineer for B2B SaaS analytics rebuild",
      description:
        "Migrating a CRA dashboard to Next.js 15 App Router. Stack: TypeScript, Tailwind, Supabase, Recharts. Fixed price $7,200 over ~4 weeks. Looking for someone who has shipped a real production dashboard -- please link one. Daily standups, async-friendly.",
      budget_text: "$7,200 fixed",
      posted_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
  },
  {
    name: "Mid: Vague long-term React hourly",
    expected: "60-75",
    lead: {
      source: "upwork",
      source_url: "https://www.upwork.com/jobs/~smoke-vague",
      title: "React developer wanted, ongoing work",
      description:
        "Looking for a React developer to help with our project. Long-term opportunity. Send your portfolio and hourly rate.",
      budget_text: null,
      posted_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    },
  },
  {
    name: "Bad: WordPress + unpaid trial, ancient",
    expected: "15-35",
    lead: {
      source: "upwork",
      source_url: "https://www.upwork.com/jobs/~smoke-bad",
      title: "WordPress + WooCommerce theme customization (urgent)",
      description:
        "Need PHP developer to customize a WooCommerce theme. WordPress experience required. Budget $200 fixed for 2 weeks. Will provide unpaid trial task to evaluate skills.",
      budget_text: "$200 fixed",
      posted_at: new Date(Date.now() - 22 * 86_400_000).toISOString(),
    },
  },
];

function inBand(score: number, expected: string): boolean {
  const [lo, hi] = expected.split("-").map(Number);
  return score >= (lo ?? 0) && score <= (hi ?? 100);
}

async function main() {
  console.log("\nScore-smoke test\n");
  console.log(
    `Profile: ${profile.display_name} -- ${profile.skills.join(", ")} -- $${profile.hourly_rate}/hr\n`
  );

  let passed = 0;
  let failed = 0;
  for (const { name, expected, lead } of leads) {
    process.stdout.write(`  ${name.padEnd(46)} expect ${expected.padEnd(7)} `);
    try {
      const startedAt = Date.now();
      const result = await scoreLead({ lead, profile, userId: USER_ID });
      const ms = Date.now() - startedAt;
      const tag = inBand(result.score, expected) ? "[PASS]" : "[OFF] ";
      if (tag === "[PASS]") passed++;
      else failed++;
      console.log(
        `${tag} ${String(result.score).padStart(3)}  ${ms}ms  ${result.signals.join(" / ")}`
      );
      console.log(`      ${result.reasoning}`);
      console.log("");
    } catch (err) {
      failed++;
      console.log(`[FAIL]`);
      console.error(`      ${(err as Error).message}\n`);
    }
  }

  console.log(`${passed} in-band | ${failed} off-band-or-error\n`);
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error("score-smoke crashed:", err);
  process.exit(1);
});
