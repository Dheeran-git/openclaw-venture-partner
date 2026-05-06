/**
 * Scraping primitives — interface used by both Zyte/Firecrawl/Stub adapters
 * and the scout pipeline. Aligned with PRODUCTION_BUILD_GUIDE.md §5.
 */

export type SourceType =
  | "upwork"
  | "linkedin"
  | "indeed"
  | "freelancer"
  | "contra"
  | "reddit"
  | "x"
  | "github"
  | "other";

export const ALL_SOURCES: readonly SourceType[] = [
  "upwork",
  "linkedin",
  "indeed",
  "freelancer",
  "contra",
  "reddit",
  "x",
  "github",
  "other",
] as const;

export interface ScrapedLead {
  source: SourceType;
  source_url: string;
  title: string;
  description: string;
  posted_at: Date;
  budget_text?: string | null;
  raw: unknown;
}

export interface ScrapeHealth {
  ok: boolean;
  latency_ms?: number;
  error?: string;
}

export interface Scraper {
  name: string;
  scrape(query: string, limit: number, sources?: SourceType[]): Promise<ScrapedLead[]>;
  /** Optional: cheap remote ping. Cascade in index.ts uses this. */
  health(): Promise<ScrapeHealth>;
}

/**
 * Best-effort SourceType inference from a URL — used by adapters that don't
 * know their source upfront (e.g., the stub returns mixed sources by design).
 */
export function inferSourceType(url: string): SourceType {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("upwork.com")) return "upwork";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("indeed.com")) return "indeed";
    if (host.includes("freelancer.")) return "freelancer";
    if (host.includes("contra.com")) return "contra";
    if (host.includes("reddit.com")) return "reddit";
    if (host.includes("x.com") || host.includes("twitter.com")) return "x";
    if (host.includes("github.com")) return "github";
    return "other";
  } catch {
    return "other";
  }
}
