/**
 * Zyte adapter — multi-source dispatcher.
 *
 * Activated by setting SCRAPER=zyte and ZYTE_API_KEY in the environment.
 * Stub remains the default for demo predictability.
 *
 * Auth: Zyte uses HTTP Basic with the API key as the username and an
 * empty password (the trailing colon in `${apiKey}:` is intentional).
 *
 * Per build guide §5.2, this adapter:
 *  - dispatches one Zyte call per requested source,
 *  - applies per-source rate limits,
 *  - retries with exponential backoff (1s/4s/16s, max 3) on transient
 *    errors,
 *  - writes a `scrape_failures` row when a parser yields zero results so
 *    the raw HTML can be debugged offline,
 *  - never throws on a single-source failure — the caller still gets the
 *    successful sources' results.
 */
import type {
  ScrapedLead,
  Scraper,
  ScrapeHealth,
  SourceType,
} from "./types";
import {
  upworkSearchUrl,
  linkedinSearchUrl,
  indeedSearchUrl,
  redditSearchUrl,
  contraSearchUrl,
  freelancerSearchUrl,
  xSearchUrl,
} from "./zyte/sources";
import { parseUpwork } from "./zyte/parsers/upwork";
import { parseLinkedIn } from "./zyte/parsers/linkedin";
import { parseIndeed } from "./zyte/parsers/indeed";
import { parseReddit } from "./zyte/parsers/reddit";
import { parseContra } from "./zyte/parsers/contra";
import { parseFreelancer } from "./zyte/parsers/freelancer";
import { takeRateToken } from "./zyte/rateLimits";

const ZYTE_ENDPOINT = "https://api.zyte.com/v1/extract";

interface ZyteRequest {
  url: string;
  browserHtml?: boolean;
  httpResponseBody?: boolean;
}

interface ZyteResponse {
  url: string;
  browserHtml?: string;
  httpResponseBody?: string; // base64 when ZYTE returns it; we use browserHtml mostly
  httpResponseStatusCode?: number;
}

const SOURCE_BUILDERS: Record<SourceType, ((q: string) => string) | null> = {
  upwork: upworkSearchUrl,
  linkedin: linkedinSearchUrl,
  indeed: indeedSearchUrl,
  freelancer: freelancerSearchUrl,
  contra: contraSearchUrl,
  reddit: redditSearchUrl,
  x: xSearchUrl,
  github: null,
  other: null,
};

const SOURCE_PARSERS: Record<
  SourceType,
  ((body: string, limit: number) => ScrapedLead[]) | null
> = {
  upwork: parseUpwork,
  linkedin: parseLinkedIn,
  indeed: parseIndeed,
  freelancer: parseFreelancer,
  contra: parseContra,
  reddit: parseReddit,
  x: null,
  github: null,
  other: null,
};

const BACKOFF_MS = [1_000, 4_000, 16_000];

async function logScrapeFailure(
  source: SourceType,
  url: string,
  raw: string | undefined,
  strategy: string,
  errorMessage: string
): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return;
  try {
    const { createServiceRoleClient } = await import("@openclaw/db/client");
    const db = createServiceRoleClient() as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      };
    };
    await db.from("scrape_failures").insert({
      source,
      url,
      raw_html: raw ?? null,
      parser_strategy: strategy,
      error_message: errorMessage.slice(0, 1000),
    });
  } catch {
    /* never throw from telemetry */
  }
}

async function zyteFetch(
  authHeader: string,
  request: ZyteRequest
): Promise<ZyteResponse> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(ZYTE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "(no body)");
        const err = new Error(`Zyte ${res.status}: ${body.slice(0, 200)}`);
        // 4xx: don't retry. 5xx + network: retry.
        if (res.status >= 400 && res.status < 500) throw err;
        lastErr = err;
      } else {
        return (await res.json()) as ZyteResponse;
      }
    } catch (err) {
      lastErr = err as Error;
    }
    const delay = BACKOFF_MS[attempt]!;
    await new Promise((r) => setTimeout(r, delay));
  }
  throw lastErr ?? new Error("zyte: exhausted retries");
}

export function makeZyteScraper(apiKey: string): Scraper {
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

  async function scrapeOne(
    source: SourceType,
    query: string,
    limit: number
  ): Promise<ScrapedLead[]> {
    const buildUrl = SOURCE_BUILDERS[source];
    const parse = SOURCE_PARSERS[source];
    if (!buildUrl || !parse) return [];

    const url = buildUrl(query);
    await takeRateToken(source);

    // Reddit returns JSON via .json suffix; httpResponseBody is enough.
    const wantsHtml = source !== "reddit";
    const request: ZyteRequest = wantsHtml
      ? { url, browserHtml: true }
      : { url, httpResponseBody: true };

    let body: string;
    try {
      const data = await zyteFetch(authHeader, request);
      body = wantsHtml
        ? data.browserHtml ?? ""
        : data.httpResponseBody
          ? Buffer.from(data.httpResponseBody, "base64").toString("utf8")
          : "";
      if (!body) {
        await logScrapeFailure(source, url, undefined, "zyte-empty", "empty body");
        return [];
      }
    } catch (err) {
      await logScrapeFailure(
        source,
        url,
        undefined,
        "zyte-fetch",
        (err as Error).message
      );
      return [];
    }

    try {
      const leads = parse(body, limit);
      if (leads.length === 0) {
        await logScrapeFailure(
          source,
          url,
          body.slice(0, 100_000),
          `${source}-parser`,
          "parser yielded zero leads"
        );
      }
      return leads;
    } catch (err) {
      await logScrapeFailure(
        source,
        url,
        body.slice(0, 100_000),
        `${source}-parser-throw`,
        (err as Error).message
      );
      return [];
    }
  }

  return {
    name: "zyte",

    async health(): Promise<ScrapeHealth> {
      const startedAt = Date.now();
      try {
        const res = await fetch(ZYTE_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: "https://example.com", browserHtml: true }),
          signal: AbortSignal.timeout(8_000),
        });
        return {
          ok: res.ok,
          latency_ms: Date.now() - startedAt,
          error: res.ok ? undefined : `${res.status}`,
        };
      } catch (err) {
        return {
          ok: false,
          latency_ms: Date.now() - startedAt,
          error: (err as Error).message,
        };
      }
    },

    async scrape(
      query: string,
      limit: number,
      sources?: SourceType[]
    ): Promise<ScrapedLead[]> {
      const targets = sources && sources.length > 0 ? sources : (["upwork"] as SourceType[]);
      const perSourceLimit = Math.max(1, Math.ceil(limit / targets.length));
      const results = await Promise.all(
        targets.map((s) => scrapeOne(s, query, perSourceLimit))
      );
      const flat = results.flat();
      return flat.slice(0, Math.max(0, limit));
    },
  };
}
