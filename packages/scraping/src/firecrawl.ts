/**
 * Firecrawl adapter — secondary fallback when Zyte is unhealthy or rate-limited.
 *
 * Activated via SCRAPER=firecrawl + FIRECRAWL_URL + FIRECRAWL_API_KEY, OR
 * picked automatically by index.ts cascade when Zyte's health check fails.
 *
 * For free-tier Firecrawl cloud, FIRECRAWL_URL = https://api.firecrawl.dev.
 * Self-hosted Firecrawl (build guide §5.3 — VPS deferred on $0 budget) uses
 * the same API shape.
 *
 * Per build guide §5.3: this adapter requests HTML format and delegates to
 * the same per-source parsers used by the Zyte adapter — markdown is more
 * stable across redesigns, but reusing the HTML parsers avoids duplicate
 * parser code without sacrificing correctness.
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
} from "./zyte/sources";
import { parseUpwork } from "./zyte/parsers/upwork";
import { parseLinkedIn } from "./zyte/parsers/linkedin";
import { parseIndeed } from "./zyte/parsers/indeed";
import { parseReddit } from "./zyte/parsers/reddit";
import { parseContra } from "./zyte/parsers/contra";
import { parseFreelancer } from "./zyte/parsers/freelancer";

interface FirecrawlScrapeBody {
  url: string;
  formats?: string[];
  onlyMainContent?: boolean;
  waitFor?: number;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    html?: string;
    markdown?: string;
    rawHtml?: string;
    metadata?: { statusCode?: number };
  };
  error?: string;
}

const SOURCE_BUILDERS: Record<SourceType, ((q: string) => string) | null> = {
  upwork: upworkSearchUrl,
  linkedin: linkedinSearchUrl,
  indeed: indeedSearchUrl,
  freelancer: freelancerSearchUrl,
  contra: contraSearchUrl,
  reddit: redditSearchUrl,
  x: null,
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

export function makeFirecrawlScraper(opts: {
  url: string;
  apiKey: string;
}): Scraper {
  const { url: baseUrl, apiKey } = opts;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/scrape`;

  async function fetchOne(targetUrl: string): Promise<string | undefined> {
    const body: FirecrawlScrapeBody = {
      url: targetUrl,
      formats: ["html"],
      onlyMainContent: false,
      waitFor: 2_000,
    };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as FirecrawlScrapeResponse;
    return data.data?.html ?? data.data?.rawHtml ?? data.data?.markdown ?? undefined;
  }

  return {
    name: "firecrawl",

    async health(): Promise<ScrapeHealth> {
      const startedAt = Date.now();
      try {
        // Firecrawl exposes /v0/health on most deploys; cloud uses a
        // 401 on unauth probe. Treat any HTTP response (even 401) as
        // "service is up." Network failure = unhealthy.
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v0/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5_000),
        }).catch(() => null);
        if (res === null) {
          return {
            ok: false,
            latency_ms: Date.now() - startedAt,
            error: "network",
          };
        }
        return {
          ok: true,
          latency_ms: Date.now() - startedAt,
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
      const results: ScrapedLead[] = [];
      for (const source of targets) {
        const buildUrl = SOURCE_BUILDERS[source];
        const parse = SOURCE_PARSERS[source];
        if (!buildUrl || !parse) continue;
        try {
          const body = await fetchOne(buildUrl(query));
          if (!body) continue;
          results.push(...parse(body, perSourceLimit));
        } catch {
          // Single-source failure should not break the multi-source run.
          continue;
        }
      }
      return results.slice(0, Math.max(0, limit));
    },
  };
}
