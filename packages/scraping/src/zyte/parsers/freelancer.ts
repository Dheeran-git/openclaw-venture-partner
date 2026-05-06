/**
 * Freelancer.com parser. The search results page renders project cards with
 * `data-project-id` attributes. This parser is best-effort, single-strategy.
 */
import type { ScrapedLead } from "../../types";

export function parseFreelancer(html: string, limit: number): ScrapedLead[] {
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
