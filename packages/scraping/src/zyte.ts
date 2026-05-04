/**
 * Zyte scraper adapter for Upwork job search.
 *
 * Activated by setting SCRAPER=zyte and ZYTE_API_KEY in the environment.
 * Never the default -- stub stays active for demo predictability.
 *
 * Auth: Zyte uses HTTP Basic with the API key as the username and an
 * empty password (the trailing colon in `${apiKey}:` is intentional).
 *
 * Extraction: uses Zyte's browserHtml to get the JS-rendered page, then
 * parses job listings from the HTML. Two strategies are attempted in
 * order: (1) embedded state JSON (Apollo/Next.js cache), (2) DOM
 * attribute pattern matching. Either producing zero results is not an
 * error -- the scout pipeline handles it as "no new leads."
 */
import type { ScrapedLead, Scraper } from "./types";

const ZYTE_ENDPOINT = "https://api.zyte.com/v1/extract";

interface ZyteRequest {
  url: string;
  browserHtml: boolean;
}

interface ZyteResponse {
  url: string;
  browserHtml?: string;
  httpResponseStatusCode?: number;
}

interface ParsedJob {
  source_url: string;
  title: string;
  description: string;
  posted_at: Date;
}

/**
 * Constructs an Upwork search URL sorted by recency. Recency sort
 * yields fresh postings rather than Upwork's relevance-ranked feed,
 * which better matches the "new leads" use-case.
 */
function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query, sort: "recency" });
  return `https://www.upwork.com/nx/search/jobs/?${params.toString()}`;
}

/**
 * Walks an embedded state object (Apollo cache / __NEXT_DATA__) looking
 * for Upwork job node shapes. Upwork job objects have a `ciphertext`
 * string (their obfuscated job ID) and a `title` string. Returns an
 * empty array when the state shape doesn't match -- the DOM fallback
 * takes over in that case.
 */
function extractFromState(state: unknown, limit: number): ParsedJob[] {
  const results: ParsedJob[] = [];

  function visit(node: unknown, depth: number): void {
    if (depth > 12 || results.length >= limit) return;
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    if (
      typeof obj["ciphertext"] === "string" &&
      typeof obj["title"] === "string" &&
      obj["title"].length > 4
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

/**
 * Parses browser-rendered Upwork HTML into job listings.
 *
 * Strategy 1: find the embedded Apollo/Next.js state JSON and walk it
 * for objects with the Upwork `ciphertext` + `title` shape.
 *
 * Strategy 2: split on job-tile article/section boundaries and regex-
 * extract the URL, title, description, and posted time from each chunk.
 * Conservative: only yields a job if both URL and title are found.
 */
function parseUpworkJobs(html: string, query: string, limit: number): ParsedJob[] {
  // Strategy 1: embedded state
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
      if (jobs.length > 0) return jobs;
    } catch {
      // malformed JSON -- fall through
    }
  }

  // Strategy 2: DOM pattern matching
  const results: ParsedJob[] = [];

  // Upwork job tiles are wrapped in <article> or <section> with "job-tile"
  // in the class or a data-test attribute. Split on the opening tag.
  const chunks = html.split(/(?=<(?:article|section)[^>]*(?:job-tile|JobTile)[^>]*>)/i);

  for (const chunk of chunks.slice(1)) {
    if (results.length >= limit) break;

    // Job URL -- /jobs/~<alphanum>
    const urlM = chunk.match(/href="(\/jobs\/~[A-Za-z0-9_-]{8,32}[^"]*)"/);
    if (!urlM) continue;
    const source_url = `https://www.upwork.com${urlM[1]!.split("?")[0]!}`;

    // Title -- inside an anchor inside an h2/h3, or a data-test attr
    const titleM =
      chunk.match(/data-test="job-tile-title"[^>]*>([^<]{4,200})<\//) ??
      chunk.match(/<h[23][^>]*>[\s\S]{0,60}?<a[^>]*>([^<]{4,200})<\/a>/) ??
      chunk.match(/<h[23][^>]*>([^<]{4,200})<\/h[23]>/);
    if (!titleM) continue;
    const title = titleM[1]!.trim().replace(/\s+/g, " ");

    // Description snippet
    const descM =
      chunk.match(/data-test="(?:job-description-text|UpCLineClamp)[^"]*"[^>]*>([\s\S]{10,500}?)<\//) ??
      chunk.match(/<p[^>]*>([\s\S]{10,400}?)<\/p>/);
    const description = descM
      ? descM[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : `Upwork posting found via search for "${query}"`;

    // Posted time from <time datetime="...">
    const timeM = chunk.match(/<time[^>]*datetime="([^"]+)"/);
    const posted_at = timeM ? new Date(timeM[1]!) : new Date();

    results.push({ source_url, title, description, posted_at });
  }

  return results.slice(0, limit);
}

/**
 * Creates a Zyte-backed Scraper that targets Upwork job search.
 *
 * The returned scraper satisfies the same `Scraper` interface as the
 * stub, so the scout pipeline runs identically regardless of which
 * adapter is active.
 */
export function makeZyteScraper(apiKey: string): Scraper {
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

  return {
    name: "zyte",

    async scrape(query: string, limit: number): Promise<ScrapedLead[]> {
      const searchUrl = buildSearchUrl(query);

      const request: ZyteRequest = { url: searchUrl, browserHtml: true };

      const response = await fetch(ZYTE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "(no body)");
        throw new Error(
          `Zyte API ${response.status} for "${query}": ${body}`
        );
      }

      const data = (await response.json()) as ZyteResponse;
      const html = data.browserHtml;

      if (!html) {
        throw new Error(
          `Zyte returned no browserHtml for "${query}" ` +
            `(HTTP status from target: ${data.httpResponseStatusCode ?? "unknown"})`
        );
      }

      const parsed = parseUpworkJobs(html, query, limit);

      return parsed.map((job) => ({
        source_url: job.source_url,
        title: job.title,
        description: job.description,
        posted_at: job.posted_at,
        raw: {
          scraper: "zyte",
          query,
          searchUrl,
          title: job.title,
        },
      }));
    },
  };
}
