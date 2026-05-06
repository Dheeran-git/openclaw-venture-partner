/**
 * Indeed parser. Indeed embeds search results in a `mosaic-data` script
 * with a JSON payload. Strategy 1 reads that payload; strategy 2 falls
 * back to DOM card extraction.
 */
import type { ScrapedLead } from "../../types";

export function parseIndeed(html: string, limit: number): ScrapedLead[] {
  // Strategy 1: mosaic-provider-jobcards JSON
  const stateM = html.match(
    /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{[\s\S]+?\})\s*;\s*<\/script>/
  );
  if (stateM) {
    try {
      const state = JSON.parse(stateM[1]!) as {
        metaData?: { mosaicProviderJobCardsModel?: { results?: unknown[] } };
      };
      const jobs =
        state.metaData?.mosaicProviderJobCardsModel?.results ?? [];
      const results: ScrapedLead[] = [];
      for (const j of jobs.slice(0, limit)) {
        const job = j as {
          jobkey?: string;
          title?: string;
          company?: string;
          snippet?: string;
          pubDate?: number;
        };
        if (!job.jobkey || !job.title) continue;
        results.push({
          source: "indeed",
          source_url: `https://www.indeed.com/viewjob?jk=${job.jobkey}`,
          title: job.title.trim(),
          description: (
            job.snippet?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ??
            `${job.company ?? "Indeed posting"}`
          ).slice(0, 800),
          posted_at: job.pubDate ? new Date(job.pubDate) : new Date(),
          raw: { strategy: "indeed-state", company: job.company ?? null },
        });
      }
      if (results.length > 0) return results;
    } catch {
      /* fall through */
    }
  }

  // Strategy 2: DOM cards
  const results: ScrapedLead[] = [];
  const chunks = html.split(/(?=<a[^>]*data-jk=)/i);
  for (const chunk of chunks.slice(1)) {
    if (results.length >= limit) break;
    const jkM = chunk.match(/data-jk="([^"]+)"/);
    const titleM =
      chunk.match(/<span[^>]*title="([^"]{4,200})"/) ??
      chunk.match(/<span[^>]*id="jobTitle[^"]*"[^>]*>([^<]{4,200})/);
    if (!jkM || !titleM) continue;
    results.push({
      source: "indeed",
      source_url: `https://www.indeed.com/viewjob?jk=${jkM[1]}`,
      title: titleM[1]!.trim(),
      description: `Indeed posting: ${titleM[1]!.trim()}`,
      posted_at: new Date(),
      raw: { strategy: "indeed-dom" },
    });
  }
  return results;
}
