import type { Scraper } from "./types";
import { stubScraper } from "./stub";
import { makeZyteScraper } from "./zyte";

export type { Scraper, ScrapedLead } from "./types";
export { stubScraper } from "./stub";
export { makeZyteScraper } from "./zyte";

/**
 * Picks the active scraper for the current process. Defaults to the
 * stub adapter so demos and tests never depend on external services.
 * Set SCRAPER=zyte (and ZYTE_API_KEY) to switch to live Upwork scraping.
 */
export function getScraper(): Scraper {
  const choice = process.env.SCRAPER?.toLowerCase();

  if (choice === "zyte") {
    const apiKey = process.env.ZYTE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "SCRAPER=zyte but ZYTE_API_KEY is not set. Add the key to .env or unset SCRAPER."
      );
    }
    return makeZyteScraper(apiKey);
  }

  return stubScraper;
}
