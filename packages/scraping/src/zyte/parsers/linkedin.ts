/**
 * LinkedIn parser. LinkedIn is the most fragile of the sources — they
 * redesign their search HTML every few months and aggressively rate-limit.
 *
 * Strategy 1: schema.org JobPosting blocks embedded as JSON-LD. Stable
 *             across redesigns since LinkedIn ships them for SEO.
 * Strategy 2: DOM regex on `job-search-card` <li> elements. Used only if
 *             JSON-LD is absent (e.g. a stale cache or partial render).
 *
 * If both fail: check `scrape_failures` for raw HTML; LinkedIn's class
 * names typically just gain a hash suffix (e.g. `job-search-card-12abc`).
 * Loosen the regex.
 */
import type { ScrapedLead } from "../../types";
import { parseJobPostingJsonLd } from "./jsonld";

export function parseLinkedIn(html: string, limit: number): ScrapedLead[] {
  const jsonld = parseJobPostingJsonLd(html, "linkedin", limit);
  if (jsonld.length > 0) return jsonld;

  const results: ScrapedLead[] = [];
  const chunks = html.split(/(?=<li[^>]*class="[^"]*job-search-card)/i);
  for (const chunk of chunks.slice(1)) {
    if (results.length >= limit) break;
    const urlM = chunk.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"]+)"/);
    const titleM =
      chunk.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]{4,300}?)<\/h3>/) ??
      chunk.match(/<h3[^>]*>([\s\S]{4,300}?)<\/h3>/);
    if (!urlM || !titleM) continue;
    const title = titleM[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const company =
      chunk.match(/base-search-card__subtitle[^>]*>([\s\S]{2,200}?)<\//)?.[1]
        ?.replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() ?? "Unknown company";
    const description = `${company} — found via LinkedIn job search.`;
    const timeM = chunk.match(/<time[^>]*datetime="([^"]+)"/);
    results.push({
      source: "linkedin",
      source_url: urlM[1]!.split("?")[0]!,
      title,
      description,
      posted_at: timeM ? new Date(timeM[1]!) : new Date(),
      raw: { strategy: "linkedin-zyte", company },
    });
  }
  return results;
}
