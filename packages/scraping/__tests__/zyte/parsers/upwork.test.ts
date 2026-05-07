import { describe, it, expect } from "vitest";
import { parseUpwork } from "../../../src/zyte/parsers/upwork";

/**
 * Phase 7 step 1 — Upwork parser unit tests.
 *
 * Two strategies live in the parser:
 *   1. State-walk: extract from window.__APOLLO_STATE__ or __NEXT_DATA__.
 *   2. DOM regex fallback: scan job-tile HTML chunks.
 *
 * Each fixture below is a minimal HTML shell that triggers exactly one
 * strategy — keeps the assertions tight and the failure modes obvious.
 */

const APOLLO_STATE_FIXTURE = (
  jobs: Array<{ ciphertext: string; title: string; description?: string; createdOn?: string }>
) => {
  const wrapper = {
    data: {
      jobSearch: {
        results: jobs,
      },
    },
  };
  return `<!DOCTYPE html>
<html>
<head>
<title>Upwork search</title>
<script>window.__APOLLO_STATE__ = ${JSON.stringify(wrapper)};</script>
</head>
<body>...</body>
</html>`;
};

const NEXT_DATA_FIXTURE = (
  jobs: Array<{ ciphertext: string; title: string; description?: string }>
) => `<!DOCTYPE html>
<html><body>
<script id="__NEXT_DATA__">window.__NEXT_DATA__ = ${JSON.stringify({
  props: { pageProps: { results: jobs } },
})};</script>
</body></html>`;

const DOM_FALLBACK_FIXTURE = `<!DOCTYPE html>
<html><body>
<main>
  <article class="job-tile">
    <h2><a href="/jobs/~01abcd1234efgh5678?source=feed">Senior Next.js engineer for SaaS dashboard</a></h2>
    <p data-test="UpCLineClamp_text">We need a Next.js 14 App Router engineer for a 3-week dashboard rebuild. Stack: TypeScript, Tailwind, Supabase. Fixed price.</p>
    <time datetime="2026-05-01T00:00:00Z">May 1</time>
  </article>
  <article class="JobTile-row">
    <h2><a href="/jobs/~02xxxx9999yyyy2222?clickedFrom=search">Frontend developer for marketing site</a></h2>
    <p>Need a senior frontend dev to build a marketing site over the next 4 weeks. React + Next.js 14 + Tailwind preferred.</p>
    <time datetime="2026-05-02T00:00:00Z">May 2</time>
  </article>
</main>
</body></html>`;

describe("parseUpwork — state-walk strategy", () => {
  it("extracts jobs from window.__APOLLO_STATE__", () => {
    const html = APOLLO_STATE_FIXTURE([
      {
        ciphertext: "01abcd1234efgh5678",
        title: "Senior Next.js engineer",
        description: "Build a dashboard. Next.js 14 + TypeScript.",
        createdOn: "2026-05-01T00:00:00.000Z",
      },
      {
        ciphertext: "02xxxx9999yyyy2222",
        title: "React developer for SaaS",
        description: "Help us rebuild our pricing page.",
        createdOn: "2026-05-02T00:00:00.000Z",
      },
    ]);

    const leads = parseUpwork(html, 10);
    expect(leads).toHaveLength(2);
    expect(leads[0]!.source).toBe("upwork");
    expect(leads[0]!.title).toBe("Senior Next.js engineer");
    expect(leads[0]!.source_url).toBe("https://www.upwork.com/jobs/~01abcd1234efgh5678");
    expect(leads[0]!.description).toContain("dashboard");
    expect(leads[0]!.posted_at).toBeInstanceOf(Date);
  });

  it("extracts jobs from window.__NEXT_DATA__ when __APOLLO_STATE__ absent", () => {
    const html = NEXT_DATA_FIXTURE([
      { ciphertext: "03nextdata00aaaaaa", title: "Backend engineer", description: "Postgres + Node." },
    ]);

    const leads = parseUpwork(html, 10);
    expect(leads).toHaveLength(1);
    expect(leads[0]!.source_url).toBe("https://www.upwork.com/jobs/~03nextdata00aaaaaa");
  });

  it("respects the limit param", () => {
    const html = APOLLO_STATE_FIXTURE(
      Array.from({ length: 25 }, (_, i) => ({
        ciphertext: `cipher${String(i).padStart(8, "0")}`,
        title: `Job number ${i + 1} for the test fixture`,
      }))
    );
    const leads = parseUpwork(html, 5);
    expect(leads).toHaveLength(5);
  });

  it("ignores objects with title shorter than 5 chars (noise filter)", () => {
    const html = APOLLO_STATE_FIXTURE([
      { ciphertext: "tooshort", title: "abc" }, // filtered: title too short
      { ciphertext: "validlong", title: "Senior engineer wanted for SaaS dashboard" },
    ]);
    const leads = parseUpwork(html, 10);
    expect(leads).toHaveLength(1);
    expect(leads[0]!.title).toBe("Senior engineer wanted for SaaS dashboard");
  });
});

describe("parseUpwork — DOM regex fallback strategy", () => {
  it("extracts jobs from job-tile HTML when no state script is present", () => {
    const leads = parseUpwork(DOM_FALLBACK_FIXTURE, 10);
    expect(leads.length).toBeGreaterThanOrEqual(1);
    expect(leads[0]!.source_url).toContain("/jobs/~");
    expect(leads[0]!.source_url.startsWith("https://www.upwork.com/jobs/~")).toBe(true);
    // Query strings are stripped from the source_url
    expect(leads[0]!.source_url).not.toContain("?");
  });

  it("attaches a description when one is present in the markup", () => {
    const leads = parseUpwork(DOM_FALLBACK_FIXTURE, 10);
    expect(leads[0]!.description.length).toBeGreaterThan(0);
  });
});

describe("parseUpwork — empty / malformed input", () => {
  it("returns [] for empty HTML", () => {
    expect(parseUpwork("", 10)).toEqual([]);
  });

  it("returns [] for malformed __APOLLO_STATE__ JSON", () => {
    const html = `<script>window.__APOLLO_STATE__ = {"broken": ;</script>`;
    expect(parseUpwork(html, 10)).toEqual([]);
  });

  it("returns [] when neither strategy finds anything (HTML present but no jobs)", () => {
    const html = `<html><body><p>No results found</p></body></html>`;
    expect(parseUpwork(html, 10)).toEqual([]);
  });
});
