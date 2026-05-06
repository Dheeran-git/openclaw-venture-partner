/**
 * Upwork parser. Two strategies (state-walk + DOM regex). Either producing
 * zero results is not an error.
 *
 * If this breaks: check `scrape_failures` for raw HTML and update the
 * selector. The state-walk path is the most robust; the DOM fallback is
 * a hedge against Upwork redesigns.
 */
import type { ScrapedLead } from "../../types";

interface ParsedJob {
  source_url: string;
  title: string;
  description: string;
  posted_at: Date;
}

function extractFromState(state: unknown, limit: number): ParsedJob[] {
  const results: ParsedJob[] = [];

  function visit(node: unknown, depth: number): void {
    if (depth > 12 || results.length >= limit) return;
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    if (
      typeof obj["ciphertext"] === "string" &&
      typeof obj["title"] === "string" &&
      (obj["title"] as string).length > 4
    ) {
      const ciphertext = obj["ciphertext"] as string;
      const title = (obj["title"] as string).trim();
      const description =
        typeof obj["description"] === "string"
          ? (obj["description"] as string).slice(0, 800).trim()
          : `Upwork job: ${title}`;
      const posted_at =
        typeof obj["createdOn"] === "string"
          ? new Date(obj["createdOn"] as string)
          : new Date();
      results.push({
        source_url: `https://www.upwork.com/jobs/~${ciphertext}`,
        title,
        description,
        posted_at,
      });
      return;
    }

    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) {
        for (const item of val) visit(item, depth + 1);
      } else {
        visit(val, depth + 1);
      }
    }
  }

  visit(state, 0);
  return results;
}

export function parseUpwork(html: string, limit: number): ScrapedLead[] {
  const statePatterns: RegExp[] = [
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/,
    /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/,
  ];
  for (const pattern of statePatterns) {
    const m = html.match(pattern);
    if (!m) continue;
    try {
      const state = JSON.parse(m[1]!) as unknown;
      const jobs = extractFromState(state, limit);
      if (jobs.length > 0) return jobs.map((j) => toLead(j));
    } catch {
      /* fall through */
    }
  }

  // DOM fallback
  const results: ParsedJob[] = [];
  const chunks = html.split(/(?=<(?:article|section)[^>]*(?:job-tile|JobTile)[^>]*>)/i);
  for (const chunk of chunks.slice(1)) {
    if (results.length >= limit) break;
    const urlM = chunk.match(/href="(\/jobs\/~[A-Za-z0-9_-]{8,32}[^"]*)"/);
    if (!urlM) continue;
    const source_url = `https://www.upwork.com${urlM[1]!.split("?")[0]!}`;
    const titleM =
      chunk.match(/data-test="job-tile-title"[^>]*>([^<]{4,200})<\//) ??
      chunk.match(/<h[23][^>]*>[\s\S]{0,60}?<a[^>]*>([^<]{4,200})<\/a>/) ??
      chunk.match(/<h[23][^>]*>([^<]{4,200})<\/h[23]>/);
    if (!titleM) continue;
    const title = titleM[1]!.trim().replace(/\s+/g, " ");
    const descM =
      chunk.match(/data-test="(?:job-description-text|UpCLineClamp)[^"]*"[^>]*>([\s\S]{10,500}?)<\//) ??
      chunk.match(/<p[^>]*>([\s\S]{10,400}?)<\/p>/);
    const description = descM
      ? descM[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : `Upwork posting: ${title}`;
    const timeM = chunk.match(/<time[^>]*datetime="([^"]+)"/);
    const posted_at = timeM ? new Date(timeM[1]!) : new Date();
    results.push({ source_url, title, description, posted_at });
  }

  return results.map((j) => toLead(j));
}

function toLead(j: ParsedJob): ScrapedLead {
  return {
    source: "upwork",
    source_url: j.source_url,
    title: j.title,
    description: j.description,
    posted_at: j.posted_at,
    raw: { strategy: "upwork-zyte", title: j.title },
  };
}
