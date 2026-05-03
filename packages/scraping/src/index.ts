import type { Scraper } from "./types";
import { stubScraper } from "./stub";

export type { Scraper, ScrapedLead } from "./types";
export { stubScraper } from "./stub";

/**
 * Picks the active scraper for the current process. Defaults to the
 * stub adapter so demos and tests never depend on external services.
 * Set SCRAPER=zyte (and ZYTE_API_KEY) to switch to real scraping --
 * the Zyte adapter ships in a later step.
 */
export function getScraper(): Scraper {
  const choice = process.env.SCRAPER?.toLowerCase();

  if (choice === "zyte") {
    if (!process.env.ZYTE_API_KEY) {
      throw new Error(
        "SCRAPER=zyte but ZYTE_API_KEY is not set. Add the key to .env or unset SCRAPER."
      );
    }
    throw new Error(
      "Zyte scraper not implemented yet. Unset SCRAPER (or set SCRAPER=stub) for now."
    );
  }

  return stubScraper;
}
