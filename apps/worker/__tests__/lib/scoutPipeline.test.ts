import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Scraper, ScrapedLead } from "@openclaw/scraping";

// Mocks must be hoisted before importing the SUT.
vi.mock("@openclaw/scraping", async () => {
  const actual = await vi.importActual<typeof import("@openclaw/scraping")>(
    "@openclaw/scraping"
  );
  return {
    ...actual,
    getScraper: vi.fn(),
  };
});

vi.mock("@openclaw/agent/scoring", () => ({
  scoreLead: vi.fn(),
}));

import { getScraper } from "@openclaw/scraping";
import { scoreLead } from "@openclaw/agent/scoring";
import { runScoutPipeline, type PipelineStep } from "../../src/lib/scoutPipeline";
import type { DB } from "@openclaw/db";

/**
 * Phase 7 step 1 — scout pipeline end-to-end with mocked deps.
 *
 * The pipeline phases (scrape → dedup-and-insert → score → insert-scores →
 * fan-out) all have to flow under a single fake `step` to validate that
 * the data shape contract between phases is honored.
 */

// ── Fake step (runs callbacks synchronously) ────────────────────────────────
const passthroughStep: PipelineStep = {
  run: async <T>(_name: string, fn: () => Promise<T>) => fn(),
};

// ── Fluent supabase fake ────────────────────────────────────────────────────
// Each call to .from(table) gets a queue of canned responses; the per-table
// queue advances on each call. Chain methods (select/eq/in/insert/single)
// return the same fluent object until awaited.
type Canned = { data?: unknown; error?: { message: string } | null };

function makeFakeSupabase(responses: Record<string, Canned[]>) {
  const indexes: Record<string, number> = {};
  return {
    from: (table: string) => {
      const i = indexes[table] ?? 0;
      indexes[table] = i + 1;
      const canned = responses[table]?.[i] ?? { data: [], error: null };
      const promise = Promise.resolve({
        data: canned.data ?? null,
        error: canned.error ?? null,
      });
      const fluent: unknown = new Proxy(promise as object, {
        get(target, prop, receiver) {
          if (prop === "then" || prop === "catch" || prop === "finally") {
            return (target as Promise<unknown>)[prop as "then"].bind(target);
          }
          // Every chain method (select/eq/in/insert/single) returns a fresh
          // fluent that still resolves to the same canned response.
          return () => fluent;
        },
      });
      return fluent;
    },
  };
}

// ── Fake scraped lead fixtures ──────────────────────────────────────────────
function makeScrapedLeads(n: number): ScrapedLead[] {
  return Array.from({ length: n }, (_, i) => ({
    source: "upwork",
    source_url: `https://www.upwork.com/jobs/~test${i}`,
    title: `Senior Next.js engineer ${i + 1}`,
    description: `Looking for a Next.js + TypeScript engineer for project ${i + 1}.`,
    posted_at: new Date(`2026-05-0${i + 1}T00:00:00.000Z`),
    raw: { strategy: "test-fixture" },
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("runScoutPipeline — happy path", () => {
  let publish: ReturnType<typeof vi.fn>;
  let dispatchEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(getScraper).mockReset();
    vi.mocked(scoreLead).mockReset();

    publish = vi.fn().mockResolvedValue(undefined);
    dispatchEvent = vi.fn().mockResolvedValue(undefined);

    const fakeScraper: Scraper = {
      name: "stub-test",
      scrape: vi.fn().mockResolvedValue(makeScrapedLeads(3)),
      health: vi.fn().mockResolvedValue({ ok: true, latency_ms: 1 }),
    };
    vi.mocked(getScraper).mockReturnValue(fakeScraper);

    // Three leads → three score results. First one tops auto-pitch threshold (80).
    vi.mocked(scoreLead)
      .mockResolvedValueOnce({
        score: 92,
        reasoning: "Strong match — direct stack alignment with the operator profile.",
        signals: ["nextjs", "typescript", "scope-clear"],
        tier: "balanced",
        prompt_version: "score-lead@v1",
      })
      .mockResolvedValueOnce({
        score: 75,
        reasoning: "Decent match but the budget is below operator's hourly rate.",
        signals: ["budget-low", "scope-medium"],
        tier: "balanced",
        prompt_version: "score-lead@v1",
      })
      .mockResolvedValueOnce({
        score: 40,
        reasoning: "Weak match — wrong stack and the description is vague.",
        signals: ["stack-mismatch", "scope-vague", "low-quality"],
        tier: "balanced",
        prompt_version: "score-lead@v1",
      });
  });

  it("scrapes, dedups, scores, inserts, and fans out auto-pitches above threshold", async () => {
    const supabase = makeFakeSupabase({
      // Phase 2: hash lookup (no existing hashes) → bulk insert returns 3 rows
      leads: [
        { data: [], error: null },
        {
          data: [
            { id: "lead-uuid-1", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test0" } },
            { id: "lead-uuid-2", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test1" } },
            { id: "lead-uuid-3", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test2" } },
          ],
          error: null,
        },
      ],
      // Phase 3: existing scores lookup (none) → noop later for score insert
      scores: [
        { data: [], error: null },
        { data: null, error: null }, // bulk insert response
      ],
      profiles: [
        {
          data: {
            display_name: "Anya Petrov",
            skills: ["React", "Next.js", "TypeScript"],
            hourly_rate: 120,
            bio: "Builds dashboards.",
          },
          error: null,
        },
      ],
    }) as unknown as DB;

    const result = await runScoutPipeline(
      passthroughStep,
      supabase,
      publish as never,
      { user_id: "user-abc", query: "next.js dashboards", limit: 10 },
      dispatchEvent
    );

    expect(result.scraper).toBe("stub-test");
    expect(result.scraped).toBe(3);
    expect(result.inserted).toBe(3);
    expect(result.scored).toBe(3);
    expect(result.skippedAlreadyScored).toBe(0);
    // Only the 92-score lead crosses the default 80 threshold.
    expect(result.autoPitched).toBe(1);

    // Auto-pitch event uses Inngest dedupe id format.
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "pitch/draft-requested",
        data: { user_id: "user-abc", lead_id: "lead-uuid-1" },
        id: "auto-pitch:lead-uuid-1",
      })
    );

    // Activity rail received progress + terminal updates.
    expect(publish).toHaveBeenCalled();
    const finalPublish = publish.mock.calls.at(-1)!;
    expect(finalPublish[0]).toBe("ok");
    expect(finalPublish[2]).toBe("done");
  });

  it("short-circuits with autoPitched=0 when no score crosses threshold", async () => {
    // Override scoreLead to return only mediocre scores.
    vi.mocked(scoreLead).mockReset();
    for (let i = 0; i < 3; i++) {
      vi.mocked(scoreLead).mockResolvedValueOnce({
        score: 50,
        reasoning: "Mediocre fit; budget and scope only partially align.",
        signals: ["partial-fit", "budget-low", "scope-medium"],
        tier: "balanced",
        prompt_version: "score-lead@v1",
      });
    }

    const supabase = makeFakeSupabase({
      leads: [
        { data: [], error: null },
        {
          data: [
            { id: "l1", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test0" } },
            { id: "l2", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test1" } },
            { id: "l3", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test2" } },
          ],
          error: null,
        },
      ],
      scores: [
        { data: [], error: null },
        { data: null, error: null },
      ],
      profiles: [
        {
          data: { display_name: "u", skills: [], hourly_rate: 0, bio: "" },
          error: null,
        },
      ],
    }) as unknown as DB;

    const result = await runScoutPipeline(
      passthroughStep,
      supabase,
      publish as never,
      { user_id: "u", query: "q" },
      dispatchEvent
    );

    expect(result.autoPitched).toBe(0);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("idempotency: skips already-scored leads and records skippedAlreadyScored", async () => {
    const supabase = makeFakeSupabase({
      leads: [
        { data: [], error: null },
        {
          data: [
            { id: "l1", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test0" } },
            { id: "l2", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test1" } },
            { id: "l3", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test2" } },
          ],
          error: null,
        },
      ],
      // Two of the three already have score rows → only 1 needs to be scored.
      scores: [
        { data: [{ lead_id: "l1" }, { lead_id: "l2" }], error: null },
        { data: null, error: null },
      ],
      profiles: [
        {
          data: { display_name: "u", skills: [], hourly_rate: 0, bio: "" },
          error: null,
        },
      ],
    }) as unknown as DB;

    // Only the un-scored lead is passed to scoreLead — reset mocks to single response.
    vi.mocked(scoreLead).mockReset();
    vi.mocked(scoreLead).mockResolvedValueOnce({
      score: 91,
      reasoning: "Stack matches and the brief is unusually clear, so confidence is high.",
      signals: ["stack-match", "clear-brief"],
      tier: "balanced",
      prompt_version: "score-lead@v1",
    });

    const result = await runScoutPipeline(
      passthroughStep,
      supabase,
      publish as never,
      { user_id: "u", query: "q" },
      dispatchEvent
    );

    expect(result.skippedAlreadyScored).toBe(2);
    expect(result.scored).toBe(1);
    expect(scoreLead).toHaveBeenCalledTimes(1);
  });

  it("returns autoPitched=0 when dispatchEvent is not provided", async () => {
    const supabase = makeFakeSupabase({
      leads: [
        { data: [], error: null },
        { data: [{ id: "l1", normalized: { source: "upwork", source_url: "https://www.upwork.com/jobs/~test0" } }], error: null },
      ],
      scores: [
        { data: [], error: null },
        { data: null, error: null },
      ],
      profiles: [
        {
          data: { display_name: "u", skills: [], hourly_rate: 0, bio: "" },
          error: null,
        },
      ],
    }) as unknown as DB;

    vi.mocked(scoreLead).mockReset();
    vi.mocked(scoreLead).mockResolvedValueOnce({
      score: 95,
      reasoning: "Excellent match across every dimension of the rubric.",
      signals: ["s1", "s2", "s3"],
      tier: "balanced",
      prompt_version: "score-lead@v1",
    });

    const result = await runScoutPipeline(
      passthroughStep,
      supabase,
      publish as never,
      { user_id: "u", query: "q" }
      // dispatchEvent omitted on purpose
    );

    expect(result.autoPitched).toBe(0);
  });
});

describe("runScoutPipeline — empty / dedup edge case", () => {
  it("returns inserted=0 when every scraped lead is already present (all hashes existing)", async () => {
    const fakeScraper: Scraper = {
      name: "stub-test",
      scrape: vi.fn().mockResolvedValue(makeScrapedLeads(2)),
      health: vi.fn().mockResolvedValue({ ok: true }),
    };
    vi.mocked(getScraper).mockReturnValue(fakeScraper);

    // The dedup phase needs to see *every* hash already present.
    // We compute hashes the same way the pipeline does.
    const { leadHash } = await import("../../src/lib/leadHash");
    const existingHashes = makeScrapedLeads(2).map((l) => ({ hash: leadHash(l.source_url) }));

    const supabase = makeFakeSupabase({
      leads: [{ data: existingHashes, error: null }],
    }) as unknown as DB;

    const publish = vi.fn().mockResolvedValue(undefined);
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const result = await runScoutPipeline(
      passthroughStep,
      supabase,
      publish as never,
      { user_id: "u", query: "q" },
      dispatch
    );

    expect(result.scraped).toBe(2);
    expect(result.inserted).toBe(0);
    expect(result.scored).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
