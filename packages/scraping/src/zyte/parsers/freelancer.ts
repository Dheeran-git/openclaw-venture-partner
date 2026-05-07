/**
 * Freelancer.com parser.
 *
 * Strategy 1: schema.org JobPosting blocks embedded as JSON-LD. Freelancer
 *             ships these on search result pages for SEO; they're stable
 *             across redesigns of the card markup.
 * Strategy 2: DOM regex on `data-project-id` attributes. Used only if
 *             JSON-LD is absent.
 */
import type { ScrapedLead } from "../../types";
import { parseJobPostingJsonLd } from "./jsonld";

export function parseFreelancer(html: string, limit: number): ScrapedLead[] {
  const jsonld = parseJobPostingJsonLd(html, "freelancer", limit);
  if (jsonld.length > 0) return jsonld;

  const results: ScrapedLead[] = [];
  const chunks = html.split(/(?=<div[^>]*data-project-id=)/i);
  for (const chunk of chunks.slice(1)) {
    if (results.length >= limit) break;
    const idM = chunk.match(/data-project-id="(\d+)"/);
    const titleM =
      chunk.match(/<a[^>]*class="[^"]*JobSearchCard-primary-heading-link[^"]*"[^>]*>([\s\S]{4,300}?)<\/a>/) ??
      chunk.match(/<a[^>]*href="\/projects\/[^"]+"[^>]*>([\s\S]{4,300}?)<\/a>/);
    if (!idM || !titleM) continue;
    const title = titleM[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const slugM = chunk.match(/href="(\/projects\/[^"]+)"/);
    const url = slugM
      ? `https://www.freelancer.com${slugM[1]}`
      : `https://www.freelancer.com/projects/${idM[1]}`;
    results.push({
      source: "freelancer",
      source_url: url,
      title,
      description: `Freelancer.com project: ${title}`,
      posted_at: new Date(),
      raw: { strategy: "freelancer-dom", projectId: idM[1] },
    });
  }
  return results;
}
