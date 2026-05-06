import type { Scraper } from "./types";
import { stubScraper } from "./stub";
import { makeZyteScraper } from "./zyte";
import { makeFirecrawlScraper } from "./firecrawl";

export type { Scraper, ScrapedLead, SourceType, ScrapeHealth } from "./types";
export { ALL_SOURCES, inferSourceType } from "./types";
export { stubScraper } from "./stub";
export { makeZyteScraper } from "./zyte";
export { makeFirecrawlScraper } from "./firecrawl";

/**
 * Picks the active scraper for the current process per build guide §5.5.
 *
 * Selection rules:
 *  - SCRAPER=zyte and ZYTE_API_KEY set → Zyte primary
 *  - SCRAPER=firecrawl and FIRECRAWL_URL+FIRECRAWL_API_KEY set → Firecrawl
 *  - SCRAPER=stub or unset (and NODE_ENV != production) → Stub
 *  - production with no real scraper configured → throws
 *
 * Cascading fallback: if `SCRAPER=zyte` but ZYTE_API_KEY is missing, falls
 * back to Firecrawl when its credentials are present, else Stub.
 */
export function getScraper(): Scraper {
  const choice = process.env.SCRAPER?.toLowerCase();

  const zyteAvailable = !!process.env.ZYTE_API_KEY;
  const firecrawlAvailable =
    !!process.env.FIRECRAWL_URL && !!process.env.FIRECRAWL_API_KEY;

  if (choice === "zyte") {
    if (zyteAvailable) return makeZyteScraper(process.env.ZYTE_API_KEY!);
    if (firecrawlAvailable) {
      console.warn(
        "[scraping] SCRAPER=zyte but ZYTE_API_KEY missing; falling back to firecrawl"
      );
      return makeFirecrawlScraper({
        url: process.env.FIRECRAWL_URL!,
        apiKey: process.env.FIRECRAWL_API_KEY!,
      });
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SCRAPER=zyte but no scraping credentials configured (ZYTE_API_KEY or FIRECRAWL_URL+FIRECRAWL_API_KEY required)."
      );
    }
    console.warn("[scraping] SCRAPER=zyte with no credentials; using stub");
    return stubScraper;
  }

  if (choice === "firecrawl") {
    if (firecrawlAvailable) {
      return makeFirecrawlScraper({
        url: process.env.FIRECRAWL_URL!,
        apiKey: process.env.FIRECRAWL_API_KEY!,
      });
    }
    throw new Error(
      "SCRAPER=firecrawl but FIRECRAWL_URL or FIRECRAWL_API_KEY is unset."
    );
  }

  if (process.env.NODE_ENV === "production" && !choice) {
    throw new Error(
      "SCRAPER must be set in production. Use 'zyte' or 'firecrawl'."
    );
  }

  return stubScraper;
}
