/**
 * normalize-smoke. Feeds a representative set of scraped-lead inputs
 * through normalizeScrapedLead and prints the result, exercising:
 *   - source detection across every supported host
 *   - budget regex across fixed / range / hourly / k-suffix variants
 *   - title and description trimming
 *   - posted_at -> ISO conversion
 *
 *   pnpm --filter @openclaw/shared normalize-smoke
 */
import {
  normalizeScrapedLead,
  type ScrapedLeadInput,
} from "../src/leadShape";

const fixtures: Array<{
  name: string;
  input: ScrapedLeadInput;
  expect: { source: string; budget: string | null };
}> = [
  {
    name: "Upwork fixed",
    input: {
      source_url: "https://www.upwork.com/jobs/~01abc",
      title: "  Senior Next.js engineer  ",
      description:
        "Stack: Next.js 14, TypeScript, Tailwind. Budget $5,500 fixed for 3 weeks of work.",
      posted_at: new Date("2026-04-30T10:14:00Z"),
    },
    expect: { source: "upwork", budget: "$5,500 fixed" },
  },
  {
    name: "LinkedIn salary range with k-suffix",
    input: {
      source_url: "https://www.linkedin.com/jobs/view/12345",
      title: "Frontend Lead -- Series B fintech",
      description:
        "React + TypeScript + Tailwind + tRPC. $135k-160k base + equity, fully remote.",
      posted_at: new Date("2026-05-01T09:00:00Z"),
    },
    expect: { source: "linkedin", budget: "$135k-160k" },
  },
  {
    name: "Indeed hourly",
    input: {
      source_url: "https://www.indeed.com/job/abc",
      title: "Shopify Hydrogen migration contractor",
      description: "Hydrogen experience required. $75/hr, ~30 hrs/week for 8 weeks.",
      posted_at: new Date("2026-04-28T14:00:00Z"),
    },
    expect: { source: "indeed", budget: "$75/hr" },
  },
  {
    name: "Contra fixed with k-suffix",
    input: {
      source_url: "https://contra.com/opportunities/xyz",
      title: "Next.js + Sanity portfolio site",
      description:
        "Small design studio. ~10 days, fixed $2.8k. Designer will provide finished Figma.",
      posted_at: new Date("2026-04-29T12:00:00Z"),
    },
    expect: { source: "contra", budget: "$2.8k" },
  },
  {
    name: "Reddit r/forhire flat fee",
    input: {
      source_url: "https://www.reddit.com/r/forhire/comments/abc",
      title: "[Hiring] React Native dev for MVP",
      description: "MVP build, ~10 days. $2,000 flat. Designs ready.",
      posted_at: new Date("2026-05-01T18:00:00Z"),
    },
    expect: { source: "reddit", budget: "$2,000 flat" },
  },
  {
    name: "X (twitter.com host) low-rate hourly",
    input: {
      source_url: "https://twitter.com/job/post/abc",
      title: "Junior React dev",
      description: "Long-term. $15/hr, 10 hrs/week.",
      posted_at: new Date("2026-04-19T10:00:00Z"),
    },
    expect: { source: "x", budget: "$15/hr" },
  },
  {
    name: "GitHub no budget mentioned",
    input: {
      source_url: "https://github.com/some-org/jobs/issue/1",
      title: "Open contract for OSS maintainer",
      description: "Looking for someone to help maintain our build pipeline.",
      posted_at: new Date("2026-04-25T09:00:00Z"),
    },
    expect: { source: "github", budget: null },
  },
  {
    name: "Other host, vague description",
    input: {
      source_url: "https://www.unknownboard.io/listing/9",
      title: "Help us build something exciting",
      description: "Pre-revenue startup. Equity-only for the first 3 months.",
      posted_at: new Date("2026-04-04T09:00:00Z"),
    },
    expect: { source: "other", budget: null },
  },
];

function check(actual: string | null, expected: string | null): "ok" | "off" {
  if (actual === expected) return "ok";
  if (actual !== null && expected !== null && actual.toLowerCase() === expected.toLowerCase())
    return "ok";
  return "off";
}

let passed = 0;
let failed = 0;

console.log(`\nnormalize-smoke -- ${fixtures.length} fixtures\n`);
for (const { name, input, expect } of fixtures) {
  const out = normalizeScrapedLead(input);
  const sourceOk = out.source === expect.source;
  const budgetOk = check(out.budget_text, expect.budget) === "ok";
  const ok = sourceOk && budgetOk;
  if (ok) passed++;
  else failed++;

  console.log(`  ${ok ? "[PASS]" : "[FAIL]"}  ${name}`);
  console.log(`         source : ${out.source}${sourceOk ? "" : `  (expected ${expect.source})`}`);
  console.log(
    `         budget : ${out.budget_text === null ? "(none)" : out.budget_text}${
      budgetOk ? "" : `  (expected ${expect.budget === null ? "(none)" : expect.budget})`
    }`
  );
  console.log(`         title  : ${out.title}`);
  console.log(`         posted : ${out.posted_at}`);
  console.log("");
}

console.log(`${passed} passed | ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
