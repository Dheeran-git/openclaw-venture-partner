/**
 * The scout pipeline: scrape -> dedup-and-insert -> score -> insert-scores.
 *
 * Extracted from the Inngest function shell so it can run under the
 * real `step` API (in production) or under a fake `step` (in CLI smoke).
 * The pure-function shape also makes the phase boundaries explicit and
 * the idempotency story easy to read.
 *
 * Idempotency notes (each phase must be safe to retry):
 *   - scrape: no DB writes; deterministic for a given (query, limit)
 *     against the stub. Live scrapers would still produce a superset
 *     of last run; the dedup phase catches duplicates.
 *   - dedup-and-insert-leads: filters out hashes that already exist
 *     for the user, then bulk-inserts only the fresh rows.
 *   - score-leads: queries `scores` for already-scored lead_ids and
 *     skips them. Re-running re-scores nothing new.
 *   - insert-scores: bulk insert; safe to retry only if the prior
 *     attempt failed before the row landed (which is normally the
 *     case under Inngest's per-step retry semantics).
 *
 * Progress broadcasts fire AT THE START of each phase so the UI shows
 * "scouting..." while it's happening, not after. The terminal "ok"
 * broadcast at the end gives the activity rail a clear end state.
 */
import type { DB, Database } from "@openclaw/db";
import { scoreLead, type ScoreLeadResult } from "@openclaw/agent/scoring";

type Json = Database["public"]["Tables"]["leads"]["Row"]["raw"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type ScoreInsert = Database["public"]["Tables"]["scores"]["Insert"];
import { getScraper } from "@openclaw/scraping";
import type { SourceType } from "@openclaw/scraping";
import {
  normalizeScrapedLead,
  type NormalizedLead,
} from "@openclaw/shared";

import { runConcurrent } from "./concurrency";
import type { PublishProgressFn } from "./broadcast";
import { leadHash } from "./leadHash";

/**
 * Hard cap on parallel scoring calls. Tuned conservative because the
 * Gemini and OpenRouter free tiers rate-limit aggressively. Bump this
 * if telemetry shows the LLM router has headroom.
 */
export const SCORE_CONCURRENCY = 5;

const SUPPORTED_SCRAPE_SOURCES: readonly SourceType[] = [
  "upwork",
  "linkedin",
  "indeed",
  "reddit",
  "contra",
  "freelancer",
] as const;

function parseSourcesEnv(raw: string | undefined): SourceType[] | null {
  if (!raw) return null;
  const allowed = new Set<SourceType>(SUPPORTED_SCRAPE_SOURCES);
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SourceType => allowed.has(s as SourceType));
  return parsed.length > 0 ? parsed : null;
}

function resolveSources(input: SourceType[] | undefined): SourceType[] {
  if (input && input.length > 0) return input;
  const fromEnv = parseSourcesEnv(process.env.SCOUT_DEFAULT_SOURCES);
  if (fromEnv) return fromEnv;
  return [...SUPPORTED_SCRAPE_SOURCES];
}

/** Minimal subset of inngest's `step` we depend on. Lets the smoke
 *  drive the same pipeline without spinning up Inngest. */
export interface PipelineStep {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Event-dispatch callback so the pipeline can fan out follow-up Inngest
 * events (auto-pitch on high score) without importing the Inngest client
 * directly. The Inngest shell wires this to inngest.send(); the dryrun
 * smoke stubs it to a console log so the pipeline still runs offline.
 */
export type DispatchEventFn = (event: {
  name: "pitch/draft-requested";
  data: { user_id: string; lead_id: string };
  id?: string;
}) => Promise<void>;

export interface ScoutInput {
  user_id: string;
  query: string;
  limit?: number;
  sources?: SourceType[];
}

const DEFAULT_AUTO_PITCH_THRESHOLD = 80;
const DEFAULT_AUTO_PITCH_MAX_PER_RUN = 5;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface ScoutResult {
  scraper: string;
  scraped: number;
  inserted: number;
  scored: number;
  skippedAlreadyScored: number;
  autoPitched: number;
  durationMs: number;
}

interface ScrapedRecord {
  source_url: string;
  title: string;
  description: string;
  posted_at_iso: string;
  raw: unknown;
  normalized: NormalizedLead;
  hash: string;
}

interface InsertedRow {
  id: string;
  normalized: NormalizedLead;
}

export async function runScoutPipeline(
  step: PipelineStep,
  supabase: DB,
  publish: PublishProgressFn,
  input: ScoutInput,
  dispatchEvent?: DispatchEventFn
): Promise<ScoutResult> {
  const startedAt = Date.now();
  const limit = input.limit ?? 10;
  const sources = resolveSources(input.sources);

  // ============================================================
  // PHASE 1: scrape
  // ============================================================
  const phase1 = await step.run("scrape", async () => {
    await publish(
      "live",
      `Scouting "${input.query}" across ${sources.length} source${sources.length === 1 ? "" : "s"}`,
      "starting"
    );

    const scraper = getScraper();
    const scraped = await scraper.scrape(input.query, limit, sources);

    const records: ScrapedRecord[] = scraped.map((s) => {
      const normalized = normalizeScrapedLead(s);
      return {
        source_url: s.source_url,
        title: s.title,
        description: s.description,
        posted_at_iso: s.posted_at.toISOString(),
        raw: s.raw,
        normalized,
        hash: leadHash(s.source_url),
      };
    });

    await publish(
      "ok",
      `Scraped ${records.length} from ${scraper.name} (${sources.length} source${sources.length === 1 ? "" : "s"})`,
      `${records.length} found`
    );

    return { scraperName: scraper.name, records };
  });

  // ============================================================
  // PHASE 2: dedup + bulk insert leads
  // ============================================================
  const phase2 = await step.run("dedup-and-insert-leads", async () => {
    await publish("live", "Deduping against existing leads", "checking");

    const hashes = phase1.records.map((r) => r.hash);
    const { data: existing, error: lookupErr } = await supabase
      .from("leads")
      .select("hash")
      .eq("user_id", input.user_id)
      .in("hash", hashes);
    if (lookupErr) {
      throw new Error(`dedup lookup failed: ${lookupErr.message}`);
    }
    const existingRows = (existing ?? []) as Array<{ hash: string }>;
    const existingHashes = new Set(existingRows.map((r) => r.hash));
    const fresh = phase1.records.filter(
      (r) => !existingHashes.has(r.hash)
    );

    if (fresh.length === 0) {
      await publish(
        "ok",
        `No new leads -- ${phase1.records.length} duplicates`,
        "0 new"
      );
      return { rows: [] as InsertedRow[] };
    }

    const insertPayload: LeadInsert[] = fresh.map((r) => ({
      user_id: input.user_id,
      source_id: null,
      layer: 1,
      raw: r.raw as Json,
      normalized: r.normalized as unknown as Json,
      hash: r.hash,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("leads")
      .insert(insertPayload)
      .select("id, normalized");
    if (insertErr) {
      throw new Error(`insert leads failed: ${insertErr.message}`);
    }
    if (!inserted) {
      throw new Error("insert leads returned no rows");
    }

    const insertedRows = inserted as Array<{
      id: string;
      normalized: unknown;
    }>;
    const rows: InsertedRow[] = insertedRows.map((row) => ({
      id: row.id,
      normalized: row.normalized as NormalizedLead,
    }));

    await publish(
      "ok",
      `${rows.length} new of ${phase1.records.length} leads queued`,
      `${rows.length} new`
    );

    return { rows };
  });

  // Short-circuit if nothing fresh -- still emit a terminal ok event
  // so the activity rail has an end state.
  if (phase2.rows.length === 0) {
    await publish(
      "ok",
      "Scout complete -- no new leads to score",
      "done"
    );
    return {
      scraper: phase1.scraperName,
      scraped: phase1.records.length,
      inserted: 0,
      scored: 0,
      skippedAlreadyScored: 0,
      autoPitched: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  // ============================================================
  // PHASE 3: score (bounded concurrency, idempotent)
  // ============================================================
  const phase3 = await step.run("score-leads", async () => {
    await publish(
      "live",
      `Scoring ${phase2.rows.length} leads`,
      `0/${phase2.rows.length}`
    );

    // Idempotency: skip leads that already have a score row (would
    // happen if this step retries after a partial success).
    const ids = phase2.rows.map((r) => r.id);
    const { data: existingScores, error: scoreLookupErr } = await supabase
      .from("scores")
      .select("lead_id")
      .in("lead_id", ids);
    if (scoreLookupErr) {
      throw new Error(
        `score idempotency check failed: ${scoreLookupErr.message}`
      );
    }
    const existingScoreRows = (existingScores ?? []) as Array<{
      lead_id: string;
    }>;
    const alreadyScored = new Set(
      existingScoreRows.map((s) => s.lead_id)
    );
    const toScore = phase2.rows.filter((r) => !alreadyScored.has(r.id));

    // Profile lookup (single read; the prompt needs full operator context)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("display_name, skills, hourly_rate, bio")
      .eq("id", input.user_id)
      .single();
    if (profileErr || !profile) {
      throw new Error(
        `profile not found for user ${input.user_id}: ${profileErr?.message ?? "no row"}`
      );
    }
    const scoringProfile = {
      display_name: profile.display_name ?? "(unnamed)",
      skills: Array.isArray(profile.skills)
        ? (profile.skills as unknown[]).filter(
            (s): s is string => typeof s === "string"
          )
        : [],
      hourly_rate:
        typeof profile.hourly_rate === "number"
          ? profile.hourly_rate
          : Number(profile.hourly_rate ?? 0),
      bio: profile.bio ?? "",
    };

    const results = await runConcurrent(
      toScore,
      SCORE_CONCURRENCY,
      async (row) => {
        const result = await scoreLead({
          lead: {
            source: row.normalized.source,
            source_url: row.normalized.source_url,
            title: row.normalized.title,
            description: row.normalized.description,
            budget_text: row.normalized.budget_text,
            posted_at: row.normalized.posted_at,
          },
          profile: scoringProfile,
          userId: input.user_id,
        });
        return { lead_id: row.id, ...result };
      }
    );

    const max = results.reduce(
      (m, r) => (r.score > m ? r.score : m),
      0
    );
    await publish(
      "ok",
      `Top score: ${max}`,
      `${results.length} scored`
    );

    return {
      scored: results,
      skippedAlreadyScored: alreadyScored.size,
    };
  });

  // ============================================================
  // PHASE 4: bulk insert scores + final terminal broadcast
  // ============================================================
  await step.run("insert-scores", async () => {
    if (phase3.scored.length === 0) {
      await publish(
        "ok",
        `Scout complete -- ${phase2.rows.length} leads ready`,
        "done"
      );
      return;
    }

    type ScoredRow = ScoreLeadResult & { lead_id: string };
    const scoreRows: ScoreInsert[] = (phase3.scored as ScoredRow[]).map(
      (r) => ({
        lead_id: r.lead_id,
        score: r.score,
        reasoning: r.reasoning,
        signals: (r.signals ?? []) as Json,
        prompt_version: r.prompt_version,
        model: r.tier,
      })
    );

    const { error } = await supabase.from("scores").insert(scoreRows);
    if (error) {
      throw new Error(`insert scores failed: ${error.message}`);
    }
  });

  // ============================================================
  // PHASE 5: auto-pitch fan-out for top scorers
  // ============================================================
  const autoPitchedCount = await step.run("fan-out-auto-pitch", async () => {
    if (!dispatchEvent || phase3.scored.length === 0) {
      await publish(
        "ok",
        `Scout complete -- ${phase2.rows.length} leads ready`,
        "done"
      );
      return 0;
    }

    const threshold = intFromEnv(
      "AUTO_PITCH_SCORE_THRESHOLD",
      DEFAULT_AUTO_PITCH_THRESHOLD
    );
    const maxPerRun = intFromEnv(
      "AUTO_PITCH_MAX_PER_RUN",
      DEFAULT_AUTO_PITCH_MAX_PER_RUN
    );

    type ScoredRow = ScoreLeadResult & { lead_id: string };
    const candidates = (phase3.scored as ScoredRow[])
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerRun);

    if (candidates.length === 0) {
      await publish(
        "ok",
        `Scout complete -- ${phase2.rows.length} leads ready`,
        "done"
      );
      return 0;
    }

    await publish(
      "live",
      `Drafting pitches for top ${candidates.length} leads`,
      `${candidates.length} queued`
    );

    // Fan out in parallel. Each event carries an id so retries dedupe at
    // Inngest level. The draftPitch worker is idempotent at the
    // llm_calls layer too (Phase 8 idempotency_key), so this is
    // belt-and-suspenders.
    await Promise.all(
      candidates.map((c) =>
        dispatchEvent({
          name: "pitch/draft-requested",
          data: { user_id: input.user_id, lead_id: c.lead_id },
          id: `auto-pitch:${c.lead_id}`,
        })
      )
    );

    await publish(
      "ok",
      `Scout complete -- ${phase2.rows.length} leads, ${candidates.length} pitching`,
      "done"
    );
    return candidates.length;
  });

  return {
    scraper: phase1.scraperName,
    scraped: phase1.records.length,
    inserted: phase2.rows.length,
    scored: phase3.scored.length,
    skippedAlreadyScored: phase3.skippedAlreadyScored,
    autoPitched: autoPitchedCount,
    durationMs: Date.now() - startedAt,
  };
}
