/**
 * scrape-smoke. Calls the active scraper (stub by default; honors
 * SCRAPER=zyte once that adapter ships) and prints the leads it
 * returns. Useful for sanity-checking query relevance ranking.
 *
 *   pnpm --filter @openclaw/scraping scrape-smoke -- "react next.js"
 *   pnpm --filter @openclaw/scraping scrape-smoke -- "wordpress" 5
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

import { getScraper } from "../src/index";

const args = process.argv.slice(2);
const query = args[0] ?? "react next.js";
const limit = Number(args[1] ?? 10);

async function main() {
  const scraper = getScraper();
  console.log(`\nUsing scraper: ${scraper.name}`);
  console.log(`Query: "${query}"  Limit: ${limit}\n`);

  const startedAt = Date.now();
  const leads = await scraper.scrape(query, limit);
  const ms = Date.now() - startedAt;

  for (const [i, lead] of leads.entries()) {
    const ageDays = Math.round(
      (Date.now() - lead.posted_at.getTime()) / 86_400_000
    );
    console.log(
      `  ${String(i + 1).padStart(2)}. [${String(ageDays).padStart(2)}d]  ${lead.title}`
    );
    console.log(`       ${lead.source_url}`);
  }
  console.log(`\n${leads.length} leads returned in ${ms}ms.\n`);
}

main().catch((err) => {
  console.error("scrape-smoke crashed:", err);
  process.exit(1);
});
